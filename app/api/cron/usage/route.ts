import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getPlanByName } from '@/lib/plans';
import Stripe from 'stripe';

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

/**
 * POST /api/cron/usage
 *
 * Daily cron job that:
 * 1. Aggregates site_visits into site_usage_daily for each site
 * 2. Rolls up per-user monthly totals into user_usage_monthly
 * 3. Reports overage usage to Stripe via usage records
 *
 * Secured via CRON_SECRET header. Configure in Vercel:
 *   vercel.json -> crons: [{ path: "/api/cron/usage", schedule: "0 5 * * *" }]
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().split('T')[0];

  // Current billing period
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  let sitesProcessed = 0;
  let usersProcessed = 0;
  let usageReported = 0;

  try {
    // ── Step 1: Aggregate yesterday's site_visits into site_usage_daily ──────
    const { data: sites } = await supabase
      .from('sites')
      .select('id, user_id')
      .eq('is_published', true)
      .is('deleted_at', null);

    if (sites && sites.length > 0) {
      for (const site of sites) {
        if (!site.user_id) continue;

        // Count unique visitors and total views for yesterday
        const { data: visits } = await supabase
          .from('site_visits')
          .select('visitor_hash')
          .eq('site_id', site.id)
          .gte('created_at', `${yesterday}T00:00:00Z`)
          .lt('created_at', `${today}T00:00:00Z`);

        if (!visits || visits.length === 0) continue;

        const uniqueVisitors = new Set(visits.map(v => v.visitor_hash)).size;
        const totalViews = visits.length;

        await supabase
          .from('site_usage_daily')
          .upsert({
            site_id: site.id,
            user_id: site.user_id,
            date: yesterday,
            unique_visitors: uniqueVisitors,
            total_views: totalViews,
          }, { onConflict: 'site_id,date' });

        sitesProcessed++;
      }
    }

    // ── Step 2: Roll up per-user monthly totals ──────────────────────────────
    const { data: activeSubscriptions } = await supabase
      .from('user_subscriptions')
      .select('user_id, subscription_plan, visitor_limit, stripe_customer_id, stripe_subscription_id')
      .eq('subscription_status', 'active');

    if (activeSubscriptions && activeSubscriptions.length > 0) {
      for (const sub of activeSubscriptions) {
        // Sum all site_usage_daily for this user in the current period
        const { data: usageRows } = await supabase
          .from('site_usage_daily')
          .select('unique_visitors, total_views')
          .eq('user_id', sub.user_id)
          .gte('date', periodStart)
          .lte('date', periodEnd);

        let totalVisitors = 0;
        let totalViews = 0;
        if (usageRows) {
          for (const row of usageRows) {
            totalVisitors += row.unique_visitors;
            totalViews += row.total_views;
          }
        }

        const plan = getPlanByName(sub.subscription_plan);
        const visitorLimit = sub.visitor_limit || plan?.visitorLimit || 10_000;
        const overageVisitors = Math.max(0, totalVisitors - visitorLimit);

        await supabase
          .from('user_usage_monthly')
          .upsert({
            user_id: sub.user_id,
            period_start: periodStart,
            period_end: periodEnd,
            total_visitors: totalVisitors,
            total_views: totalViews,
            visitor_limit: visitorLimit,
            overage_visitors: overageVisitors,
            updated_at: now.toISOString(),
          }, { onConflict: 'user_id,period_start' });

        usersProcessed++;

        // ── Step 3: Report overage to Stripe ─────────────────────────────
        // Uses the Billing Meter Events API (Stripe SDK v20+).
        // The meter event_name must match a Billing Meter created in Stripe Dashboard.
        // Meter aggregation should be set to "sum" so daily reports accumulate correctly.
        if (overageVisitors > 0 && sub.stripe_customer_id) {
          try {
            const stripe = getStripeClient();
            const meterEventName = process.env.STRIPE_OVERAGE_METER_EVENT_NAME || 'visitor_overage';

            await stripe.billing.meterEvents.create({
              event_name: meterEventName,
              payload: {
                stripe_customer_id: sub.stripe_customer_id,
                value: String(overageVisitors),
              },
              timestamp: Math.floor(now.getTime() / 1000),
            });

            // Mark as reported
            await supabase
              .from('user_usage_monthly')
              .update({
                overage_reported: true,
                reported_at: now.toISOString(),
              })
              .eq('user_id', sub.user_id)
              .eq('period_start', periodStart);

            usageReported++;
            console.log(`Reported ${overageVisitors} overage visitors for user ${sub.user_id}`);
          } catch (stripeErr) {
            console.error(`Failed to report usage for user ${sub.user_id}:`, stripeErr);
          }
        }
      }
    }

    console.log(`Usage cron complete: ${sitesProcessed} sites, ${usersProcessed} users, ${usageReported} overage reports`);

    return NextResponse.json({
      success: true,
      sitesProcessed,
      usersProcessed,
      usageReported,
    });
  } catch (error) {
    console.error('Usage cron error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
