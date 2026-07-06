import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { ensureConversionActions } from '@/lib/marketing/google-ads';
import {
  normalizeConversionId,
  buildSiteConversionConfig,
  isConversionTrackingActive,
} from '@/lib/marketing/conversions';

/**
 * Conversion-tracking setup for a campaign's site.
 *
 *   GET  → current status { conversionId, labels, active, hasCustomerId }
 *   POST { mode: 'auto' }                 → provision via the Google Ads API
 *   POST { mode: 'manual', conversionId } → store a pasted AW-… tag id
 *
 * Writes to the `sites` row, which the published site reads to inject the tag.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadCampaignSite(db: any, id: string) {
  const { data: campaign } = await db
    .from('marketing_campaigns')
    .select('id, site_id, sites!inner(id, google_ads_customer_id, google_ads_conversion_id, google_ads_conversion_labels)')
    .eq('id', id)
    .single();
  if (!campaign) return null;
  const site = Array.isArray(campaign.sites) ? campaign.sites[0] : campaign.sites;
  return { campaign, site };
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireOpsAccess();
  if (!access || !access.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  const db = createAdminClient();
  const loaded = await loadCampaignSite(db, id);
  if (!loaded) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const { site } = loaded;
  return NextResponse.json({
    conversionId: site?.google_ads_conversion_id || null,
    labels: site?.google_ads_conversion_labels || {},
    active: isConversionTrackingActive(buildSiteConversionConfig(site)),
    hasCustomerId: !!site?.google_ads_customer_id,
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireOpsAccess();
  if (!access || !access.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  const db = createAdminClient();
  const loaded = await loadCampaignSite(db, id);
  if (!loaded) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const { campaign, site } = loaded;
  const body = await request.json().catch(() => ({}));
  const mode = body?.mode === 'manual' ? 'manual' : 'auto';

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
