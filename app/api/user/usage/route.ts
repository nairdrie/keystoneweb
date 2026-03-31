import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getPlanByName, calculateOverageCost } from '@/lib/plans';

/**
 * GET /api/user/usage
 *
 * Returns the authenticated user's current billing-period usage, plan limits,
 * and projected overage cost. Counts live from site_visits.
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
      .select('subscription_plan, subscription_status, visitor_limit, storage_limit_mb')
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

    // Current billing period (calendar month)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];

    // Get all user's sites
    const { data: userSites } = await supabase
      .from('sites')
      .select('id, site_slug')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    const siteIds = userSites?.map(s => s.id) || [];

    const admin = createAdminClient();

    let totalVisitors = 0;
    let totalViews = 0;
    let siteBreakdown: Array<{ siteId: string; slug: string; visitors: number; views: number }> = [];

    if (siteIds.length > 0) {
      const { data: visits } = await admin
        .from('site_visits')
        .select('site_id, visitor_hash')
        .in('site_id', siteIds)
        .gte('created_at', `${periodStartStr}T00:00:00Z`)
        .lte('created_at', `${periodEndStr}T23:59:59Z`);

      if (visits && visits.length > 0) {
        const siteMap = new Map((userSites || []).map(s => [s.id, s.site_slug || 'Unnamed']));
        const agg = new Map<string, Set<string>>();

        for (const v of visits) {
          if (!agg.has(v.site_id)) agg.set(v.site_id, new Set());
          agg.get(v.site_id)!.add(v.visitor_hash);
        }

        totalViews = visits.length;
        const globalVisitors = new Set(visits.map(v => v.visitor_hash));
        totalVisitors = globalVisitors.size;

        siteBreakdown = Array.from(agg.entries()).map(([siteId, visitors]) => ({
          siteId,
          slug: siteMap.get(siteId) || 'Unnamed',
          visitors: visitors.size,
          views: visits.filter(v => v.site_id === siteId).length,
        })).sort((a, b) => b.visitors - a.visitors);
      }
    }

    const overageVisitors = Math.max(0, totalVisitors - visitorLimit);
    const overageCost = plan ? calculateOverageCost(plan, totalVisitors) : 0;
    const usagePercent = visitorLimit > 0 ? Math.min(100, Math.round((totalVisitors / visitorLimit) * 100)) : 0;

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
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
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
      },
      siteBreakdown,
    });
  } catch (error) {
    console.error('Error fetching user usage:', error);
    return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 });
  }
}
