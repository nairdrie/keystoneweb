import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/sites/conversions/track
 *
 * Records a site conversion event that has no other server-side home — today
 * just tel: ("call") clicks. Bookings/orders/members/contacts already persist
 * their own rows with marketing_campaign_id, so they are NOT sent here.
 *
 * Only stores calls that are attributed to a campaign (campaignId is a valid
 * uuid), which keeps this to ad-driven calls and bounds write volume. Called via
 * navigator.sendBeacon, so it always returns 200 and never blocks the visitor.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || body.type !== 'call') {
      return NextResponse.json({ ok: true });
    }

    const campaignId = typeof body.campaignId === 'string' && UUID_RE.test(body.campaignId)
      ? body.campaignId
      : null;
    const siteId = typeof body.siteId === 'string' && UUID_RE.test(body.siteId) ? body.siteId : null;
    if (!campaignId) {
      // Unattributed call — nothing to count against a campaign.
      return NextResponse.json({ ok: true });
    }

    const db = createAdminClient();
    await db.from('marketing_call_clicks').insert({
      site_id: siteId,
      marketing_campaign_id: campaignId,
      page_url: typeof body.href === 'string' ? body.href.slice(0, 500) : null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[sites/conversions/track] failed:', err);
    // Never surface an error to the beacon caller.
    return NextResponse.json({ ok: true });
  }
}
