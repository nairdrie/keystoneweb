import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { ensureConversionActions } from '@/lib/marketing/google-ads';
import {
  normalizeConversionId,
  buildSiteConversionConfig,
  isConversionTrackingActive,
} from '@/lib/marketing/conversions';

/**
 * Conversion-tracking setup for a campaign's site. Lives on the customer admin
 * page, so it authenticates as the logged-in site owner (like the pause/resume/
 * budget routes) — NOT as Keystone ops.
 *
 *   GET  → current status { conversionId, labels, active, hasCustomerId }
 *   POST { mode: 'auto' }                 → provision via the Google Ads API
 *   POST { mode: 'manual', conversionId } → store a pasted AW-… tag id
 */

type Loaded =
  | { error: 'unauthorized' }
  | { error: 'not_found' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { campaign: { id: string; site_id: string }; site: any };

/** Load the campaign + site, enforcing that the caller owns the site. */
async function loadOwnedCampaignSite(id: string): Promise<Loaded> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { data: campaign } = await supabase
    .from('marketing_campaigns')
    .select('id, site_id, sites!inner(id, user_id, google_ads_customer_id, google_ads_conversion_id, google_ads_conversion_labels)')
    .eq('id', id)
    .single();

  if (!campaign) return { error: 'not_found' };
  const site = Array.isArray(campaign.sites) ? campaign.sites[0] : campaign.sites;
  if (!site || site.user_id !== user.id) return { error: 'not_found' };

  return { campaign: { id: campaign.id, site_id: campaign.site_id }, site };
}

function errorResponse(loaded: { error: 'unauthorized' | 'not_found' }) {
  return loaded.error === 'unauthorized'
    ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    : NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const loaded = await loadOwnedCampaignSite(id);
  if ('error' in loaded) return errorResponse(loaded);

  const { site } = loaded;
  return NextResponse.json({
    conversionId: site?.google_ads_conversion_id || null,
    labels: site?.google_ads_conversion_labels || {},
    active: isConversionTrackingActive(buildSiteConversionConfig(site)),
    hasCustomerId: !!site?.google_ads_customer_id,
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const loaded = await loadOwnedCampaignSite(id);
  if ('error' in loaded) return errorResponse(loaded);

  const { campaign, site } = loaded;
  const body = await request.json().catch(() => ({}));
  const mode = body?.mode === 'manual' ? 'manual' : 'auto';

  // Writes use the service-role client (bypasses RLS); ownership was already
  // verified above with the user-scoped client.
  const db = createAdminClient();

  try {
    if (mode === 'manual') {
      const conversionId = normalizeConversionId(body?.conversionId);
      if (!conversionId) {
        return NextResponse.json({ error: 'Enter a valid Google Ads tag id, e.g. AW-123456789.' }, { status: 400 });
      }
      // A pasted id sets only the base tag; keep any labels already provisioned.
      await db.from('sites').update({ google_ads_conversion_id: conversionId }).eq('id', campaign.site_id);
      return NextResponse.json({ conversionId, labels: site?.google_ads_conversion_labels || {}, mode });
    }

    // Auto: create the conversion actions and pull the id + labels from Google.
    if (!site?.google_ads_customer_id) {
      return NextResponse.json({
        error: 'This site has no linked Google Ads account yet. Launch a campaign first, or paste the tag id manually.',
      }, { status: 400 });
    }
    const conv = await ensureConversionActions(site.google_ads_customer_id);
    if (!conv.conversionId) {
      return NextResponse.json({
        error: 'Could not read a conversion tag from the Google Ads account. Paste the AW-… id manually instead.',
      }, { status: 502 });
    }
    await db.from('sites')
      .update({ google_ads_conversion_id: conv.conversionId, google_ads_conversion_labels: conv.labels })
      .eq('id', campaign.site_id);
    return NextResponse.json({ conversionId: conv.conversionId, labels: conv.labels, mode });
  } catch (err) {
    console.error('[conversion-setup] failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Setup failed' }, { status: 500 });
  }
}
