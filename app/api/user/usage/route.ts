import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { getPlanByName, calculateOverageCost } from '@/lib/plans';

/**
 * GET /api/user/usage
 *
 * Returns the authenticated user's current billing-period usage, plan limits,
 * and projected overage cost. Used by the admin dashboard "Usage & Limits" panel.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch subscription to get plan info and limits
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('subscription_plan, subscription_status, visitor_limit, storage_limit_mb, subscription_started_at')
      .eq('user_id', user.id)
      .single();

    if (!subscription || subscription.subscription_status !== 'active') {
      return NextResponse.json({
        hasSubscription: false,
        usage: null,
      });
    }

    const plan = getPlanByName(subscription.subscription_plan);
    const visitorLimit = subscription.visitor_limit || plan?.visitorLimit || 10_000;
    const storageLimitMb = subscription.storage_limit_mb || plan?.storageLimitMb || 1024;

    // Calculate current billing period (calendar month)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get all user's sites
    const { data: userSites } = await supabase
      .from('sites')
      .select('id')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    const siteIds = userSites?.map(s => s.id) || [];

    // Read totals from the pre-aggregated monthly rollup (populated by the daily cron).
    // site_usage_daily is the source for that rollup, so summing it again would be redundant.
    const { data: monthlyUsage } = await supabase
      .from('user_usage_monthly')
      .select('total_visitors, total_views, overage_visitors, overage_reported')
      .eq('user_id', user.id)
      .eq('period_start', periodStart.toISOString().split('T')[0])
      .single();

    const totalVisitors = monthlyUsage?.total_visitors ?? 0;
    const totalViews = monthlyUsage?.total_views ?? 0;

    const overageVisitors = Math.max(0, totalVisitors - visitorLimit);
    const overageCost = plan ? calculateOverageCost(plan, totalVisitors) : 0;
    const usagePercent = visitorLimit > 0 ? Math.min(100, Math.round((totalVisitors / visitorLimit) * 100)) : 0;

    // Per-site breakdown for the dashboard
    let siteBreakdown: Array<{ siteId: string; slug: string; visitors: number; views: number }> = [];
    if (siteIds.length > 0) {
      const { data: sites } = await supabase
        .from('sites')
        .select('id, site_slug')
        .in('id', siteIds);

      const { data: perSite } = await supabase
        .from('site_usage_daily')
        .select('site_id, unique_visitors, total_views')
        .in('site_id', siteIds)
        .gte('date', periodStart.toISOString().split('T')[0])
        .lte('date', periodEnd.toISOString().split('T')[0]);

      if (perSite && sites) {
        const siteMap = new Map(sites.map(s => [s.id, s.site_slug || 'Unnamed']));
        const agg = new Map<string, { visitors: number; views: number }>();

        for (const row of perSite) {
          const existing = agg.get(row.site_id) || { visitors: 0, views: 0 };
          existing.visitors += row.unique_visitors;
          existing.views += row.total_views;
          agg.set(row.site_id, existing);
        }

        siteBreakdown = Array.from(agg.entries()).map(([siteId, data]) => ({
          siteId,
          slug: siteMap.get(siteId) || 'Unnamed',
          visitors: data.visitors,
          views: data.views,
        })).sort((a, b) => b.visitors - a.visitors);
      }
    }

    const daysInMonth = periodEnd.getDate();
    const dayOfMonth = now.getDate();
    const projectedVisitors = dayOfMonth > 0
      ? Math.round((totalVisitors / dayOfMonth) * daysInMonth)
      : totalVisitors;
    const projectedOverageCost = plan ? calculateOverageCost(plan, projectedVisitors) : 0;

    return NextResponse.json({
      hasSubscription: true,
      plan: {
        name: subscription.subscription_plan,
        visitorLimit,
        storageLimitMb,
        overagePerThousand: plan?.overagePerThousand || 0,
      },
      usage: {
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
        dayOfMonth,
        daysInMonth,
        totalVisitors,
        totalViews,
        visitorLimit,
        usagePercent,
        overageVisitors,
        overageCost: Math.round(overageCost * 100) / 100,
        projectedVisitors,
        projectedOverageCost: Math.round(projectedOverageCost * 100) / 100,
        overageReported: monthlyUsage?.overage_reported || false,
      },
      siteBreakdown,
    });
  } catch (error) {
    console.error('Error fetching user usage:', error);
    return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 });
  }
}
