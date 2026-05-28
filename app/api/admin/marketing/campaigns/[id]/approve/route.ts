import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { computePrepayAmount } from '@/lib/marketing/campaign-budget';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: '2026-02-25.clover' as any,
});

/**
 * POST /api/admin/marketing/campaigns/[id]/approve
 *
 * Customer's approval. Validates the campaign, provisions the Google Ads
 * sub-account (so ops can set up billing on it), and creates a Stripe
 * Checkout session for the prepaid amount (daily budget × duration × 1.05).
 *
 * Returns { checkoutUrl } — the wizard redirects the customer to Stripe.
 *
 * When Stripe payment succeeds, the webhook flips the campaign to
 * 'pending_launch' and notifies ops to set up billing + launch.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: campaign } = await supabase
    .from('marketing_campaigns')
    .select('*, sites!inner(id, user_id, marketing_enabled, site_slug, design_data)')
    .eq('id', id)
    .single();

  if (!campaign || campaign.sites.user_id !== user.id) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }
  if (!campaign.sites.marketing_enabled) {
    return NextResponse.json({ error: 'Marketing not enabled' }, { status: 403 });
  }
  if (campaign.status !== 'draft' && campaign.status !== 'suggested' && campaign.status !== 'failed' && campaign.status !== 'awaiting_payment') {
    return NextResponse.json({ error: `Cannot approve from status ${campaign.status}` }, { status: 400 });
  }
  if (!campaign.daily_budget_cents || campaign.daily_budget_cents <= 0) {
    return NextResponse.json({ error: 'Campaign has no daily budget set' }, { status: 400 });
  }

  // Compute campaign duration. If no end_date, default to 30 days from today.
  const startDate = campaign.start_date ? new Date(campaign.start_date) : new Date();
  const endDate = campaign.end_date ? new Date(campaign.end_date) : null;
  const durationDays = endDate
    ? Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1)
    : 30;

  const prepay = computePrepayAmount({
    dailyBudgetCents: campaign.daily_budget_cents,
    durationDays,
  });

  const db = createAdminClient();

  // Note: we no longer auto-provision a Google Ads sub-account here. Payment
  // comes first; ops links/funds the customer's ad account after payment (see
  // the ops launch flow). This avoids the "manager account can't create new
  // accounts" gate on fresh MCCs.

  // Snapshot what was approved.
  await db.from('marketing_approvals').upsert({
    campaign_id: id,
    site_id: campaign.site_id,
    approved_by: user.id,
    approved_by_email: user.email || '',
    snapshot: {
      name: campaign.name,
      channel: campaign.channel,
      campaign_type: campaign.campaign_type,
      content: campaign.content,
      targeting: campaign.targeting,
      daily_budget_cents: campaign.daily_budget_cents,
      duration_days: durationDays,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      prepay_total_cents: prepay.totalCents,
    },
  }, { onConflict: 'campaign_id' });

  await db.from('marketing_campaigns')
    .update({
      status: 'awaiting_payment',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  // Create the Stripe Checkout session.
  const origin = request.nextUrl.origin;
  const siteName = (campaign.sites.design_data as { siteTitle?: string } | null)?.siteTitle
    || campaign.sites.site_slug
    || 'your site';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email || undefined,
      line_items: [{
        price_data: {
          currency: 'cad',
          product_data: {
            name: `${campaign.name} — ${durationDays} days`,
            description: `$${(campaign.daily_budget_cents / 100).toFixed(2)}/day Google Ads for ${siteName}. Includes 5% service fee.`,
          },
          unit_amount: prepay.totalCents,
        },
        quantity: 1,
      }],
      success_url: `${origin}/admin/marketing/campaigns/${id}?siteId=${campaign.site_id}&paid=1`,
      cancel_url: `${origin}/admin/marketing/campaigns/${id}?siteId=${campaign.site_id}&paid=0`,
      metadata: {
        type: 'marketing_campaign_prepay',
        campaignId: id,
        siteId: campaign.site_id,
        userId: user.id,
        durationDays: String(durationDays),
      },
      payment_intent_data: {
        metadata: {
          type: 'marketing_campaign_prepay',
          campaignId: id,
          siteId: campaign.site_id,
          userId: user.id,
        },
      },
    });

    await db.from('marketing_campaign_log').insert({
      campaign_id: id,
      action: 'awaiting_payment',
      actor: `user:${user.email || ''}`,
      details: {
        prepay_cents: prepay.totalCents,
        duration_days: durationDays,
        checkout_session_id: session.id,
      },
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      prepayCents: prepay.totalCents,
      durationDays,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[approve] Stripe checkout creation failed:', err);
    return NextResponse.json({ error: 'Failed to create payment session. ' + message }, { status: 500 });
  }
}
