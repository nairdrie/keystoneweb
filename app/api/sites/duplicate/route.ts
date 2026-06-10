import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { trackEvent } from '@/lib/analytics';
import { getUserEffectiveLimits } from '@/lib/addons';
import { getPlanByName } from '@/lib/plans';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';
import { duplicateSite } from '@/lib/sites/duplicate';

/**
 * Duplicate an existing site into a fresh draft owned by the same user.
 *
 * Enforces the user's total-site allowance (plan publishLimit + extra_sites
 * add-ons): if they already have that many sites, the copy is blocked and the
 * caller is told to upgrade / buy an add-on.
 */
export async function POST(request: NextRequest) {
  try {
    const { siteId } = await request.json();

    let access;
    try {
      access = await requireSiteAccess(siteId, request);
    } catch (e) {
      return siteAccessErrorResponse(e);
    }
    const { targetUserId } = access;

    // Use the admin client for all reads/writes so child-table RLS and the
    // brand-new site row insert are handled uniformly. Access is already
    // authorized above.
    const admin = createAdminClient();

    // ── Enforce the total-site allowance ─────────────────────────────────────
    const limits = await getUserEffectiveLimits(targetUserId, admin);
    const { count: siteCount, error: countError } = await admin
      .from('sites')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', targetUserId);

    if (countError) {
      console.error('Error counting sites for duplicate:', countError);
      return NextResponse.json({ error: 'Failed to duplicate site' }, { status: 500 });
    }

    if ((siteCount ?? 0) >= limits.publishLimit) {
      const { data: sub } = await admin
        .from('user_subscriptions')
        .select('subscription_plan')
        .eq('user_id', targetUserId)
        .single();
      const plan = getPlanByName(sub?.subscription_plan);
      return NextResponse.json(
        {
          siteLimitReached: true,
          plan: plan?.name || sub?.subscription_plan || 'Basic',
          limit: limits.publishLimit,
        },
        { status: 403 }
      );
    }

    // ── Clone the site ───────────────────────────────────────────────────────
    const result = await duplicateSite(admin, siteId, targetUserId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    trackEvent('site_duplicate', {
      userId: targetUserId,
      siteId: result.siteId,
      metadata: { sourceSiteId: siteId },
    });

    return NextResponse.json(
      { siteId: result.siteId, message: 'Site duplicated successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error duplicating site:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to duplicate site', detail: message }, { status: 500 });
  }
}
