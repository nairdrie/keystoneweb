import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { createSearchCampaign, createDisplayCampaign } from '@/lib/marketing/google-ads';
import { sendMarketingCampaignLive } from '@/lib/marketing/notifications';
import type { Campaign } from '@/lib/marketing/types';

/**
 * Unpack a google-ads-api GoogleAdsFailure into readable detail. The thrown
 * object has an `errors` array; the useful part — which field triggered the
 * error — lives in `location.field_path_elements`, which console.error collapses
 * to a minified class ref ("location: [pW]"). Flatten it so logs + the API
 * response actually say what Google rejected.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describeGoogleAdsFailure(err: any): { summary: string; errors: Array<Record<string, unknown>> } | null {
  const list = Array.isArray(err?.errors) ? err.errors : null;
  if (!list) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errors = list.map((e: any) => {
    const fieldPath = Array.isArray(e?.location?.field_path_elements)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? e.location.field_path_elements.map((p: any) =>
          `${p.field_name}${typeof p.index === 'number' ? `[${p.index}]` : ''}`).join('.')
      : undefined;
    return {
      errorCode: e?.error_code,   // e.g. { required_field_error: 'REQUIRED' }
      message: e?.message,
      field: fieldPath,
      trigger: e?.trigger,
    };
  });
  const summary = errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((e: any) => `${e.message}${e.field ? ` (field: ${e.field})` : ''}`)
    .join('; ');
  return { summary, errors };
}

/**
 * POST /api/admin/marketing/campaigns/[id]/launch
 * Body (optional): { customerId }  — the linked + funded Google Ads account ID
 *
 * Ops-only. Called once Keystone staff has manually created/linked a Google
 * Ads account for this customer and funded it. If a customerId is supplied (or
 * one is already saved on the site), the campaign is created in THAT account.
 * Flips sites.google_ads_billing_ready so future campaigns from this site skip
 * the ops gate, and notifies the customer.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireOpsAccess();
  if (!access || !access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const db = createAdminClient();

  // Optional customer ID from the ops panel (the manually linked + funded account).
  let bodyCustomerId: string | undefined;
  try {
    const body = await request.json();
    if (typeof body?.customerId === 'string' && body.customerId.trim()) {
      bodyCustomerId = body.customerId.replace(/[^0-9]/g, '');
    }
  } catch {
    // no body — fine, we'll use the saved one
  }

  const { data: campaign } = await db
    .from('marketing_campaigns')
    .select('*, sites!inner(id, site_slug, design_data, google_ads_customer_id)')
    .eq('id', id)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (campaign.status !== 'pending_launch') {
    return NextResponse.json({ error: `Cannot launch from status ${campaign.status}` }, { status: 400 });
  }
  if (campaign.channel !== 'google_ads') {
    return NextResponse.json({ error: 'Only google_ads campaigns use the ops launch flow' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const site = (campaign as any).sites;
  const customerId = bodyCustomerId || site?.google_ads_customer_id || undefined;
  if (!customerId) {
    return NextResponse.json({
      error: 'No Google Ads account ID for this site. Create + link + fund an account, then enter its customer ID.',
    }, { status: 400 });
  }

  // Persist the account ID on the site if it was just provided.
  if (bodyCustomerId && bodyCustomerId !== site?.google_ads_customer_id) {
    await db.from('sites').update({ google_ads_customer_id: bodyCustomerId }).eq('id', campaign.site_id);
  }

  await db.from('marketing_campaigns')
    .update({ status: 'submitting', updated_at: new Date().toISOString() })
    .eq('id', id);

  try {
    const launched = campaign.campaign_type === 'display'
      ? await createDisplayCampaign(campaign as Campaign, customerId)
      : await createSearchCampaign(campaign as Campaign, customerId);

    const { data: updated } = await db.from('marketing_campaigns')
      .update({
        status: 'active',
        launched_at: new Date().toISOString(),
        external_campaign_id: launched.campaignId,
        external_ad_group_id: launched.adGroupId,
        external_ad_id: launched.adId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    // Mark the sub-account as billing-ready so future campaigns from this site
    // auto-launch without sitting in the ops queue.
    await db.from('sites')
      .update({ google_ads_billing_ready: true })
      .eq('id', campaign.site_id);

    await db.from('marketing_campaign_log').insert({
      campaign_id: id,
      action: 'launched',
      actor: `ops:${access.userEmail || access.userId}`,
      details: {
        external_campaign_id: launched.campaignId,
        manual_ops_launch: true,
        // Bidding/budget calibration notes (ceiling applied, thin-budget flags).
        calibration_warnings: launched.warnings || [],
      },
    });

    try {
      await sendMarketingCampaignLive({
        siteId: campaign.site_id,
        campaignId: id,
        campaignName: campaign.name,
      });
    } catch (err) {
      console.error('[ops/launch] customer notification failed (non-fatal):', err);
    }

    return NextResponse.json({ campaign: updated, warnings: launched.warnings || [] });
  } catch (err) {
    const gaFailure = describeGoogleAdsFailure(err);
    if (gaFailure) {
      // Full Google Ads detail — including which field_path triggered it.
      console.error('[ops/launch] Google Ads API failure:', JSON.stringify(gaFailure.errors, null, 2));
    } else {
      console.error('[ops/launch] launch failed:', err);
    }
    const message = gaFailure?.summary || (err instanceof Error ? err.message : String(err));
    await db.from('marketing_campaigns')
      .update({ status: 'pending_launch', updated_at: new Date().toISOString() })
      .eq('id', id);
    await db.from('marketing_campaign_log').insert({
      campaign_id: id,
      action: 'failed',
      actor: `ops:${access.userEmail || access.userId}`,
      details: { error: message, googleAdsErrors: gaFailure?.errors },
    });
    return NextResponse.json({
      error: message || 'Failed to launch campaign',
      googleAdsErrors: gaFailure?.errors,
    }, { status: 500 });
  }
}
