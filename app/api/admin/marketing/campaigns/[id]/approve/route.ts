import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { getWallet } from '@/lib/marketing/wallet';
import { ensureGoogleAdsSubAccount } from '@/lib/marketing/subaccount';
import { createSearchCampaign, createDisplayCampaign } from '@/lib/marketing/google-ads';
import { sendMarketingOpsPendingNotification } from '@/lib/marketing/notifications';
import type { Campaign } from '@/lib/marketing/types';

/**
 * POST /api/admin/marketing/campaigns/[id]/approve
 *
 * Customer's first launch approval. Verifies wallet has funds, provisions a
 * Google Ads sub-account if needed, then either:
 *   - If the sub-account already has billing configured (sites.google_ads_billing_ready),
 *     submits the campaign to Google and goes active.
 *   - Otherwise, parks it in 'pending_launch' and pings ops to set up billing
 *     manually before launching via /api/admin/marketing/campaigns/[id]/launch.
 */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: campaign } = await supabase
    .from('marketing_campaigns')
    .select('*, sites!inner(id, user_id, marketing_enabled, site_slug, design_data, google_ads_billing_ready)')
    .eq('id', id)
    .single();

  if (!campaign || campaign.sites.user_id !== user.id) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }
  if (!campaign.sites.marketing_enabled) {
    return NextResponse.json({ error: 'Marketing not enabled' }, { status: 403 });
  }
  if (campaign.status !== 'draft' && campaign.status !== 'suggested' && campaign.status !== 'failed') {
    return NextResponse.json({ error: `Cannot approve from status ${campaign.status}` }, { status: 400 });
  }

  // Verify wallet has at least one day's bundled budget available.
  const wallet = await getWallet(campaign.site_id);
  const dailyBudget = campaign.daily_budget_cents || 0;
  if (!wallet || wallet.balance_cents < dailyBudget) {
    return NextResponse.json({
      error: 'Insufficient wallet balance. Please top up before launching this campaign.',
      walletBalanceCents: wallet?.balance_cents ?? 0,
      requiredCents: dailyBudget,
    }, { status: 402 });
  }

  const db = createAdminClient();

  // Snapshot what the user approved (in case it's edited later).
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
      total_budget_cents: campaign.total_budget_cents,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
    },
  }, { onConflict: 'campaign_id' });

  // Provision the sub-account up-front so ops can configure billing on it even
  // before the campaign itself is created in Google.
  let subAccountId: string | null = null;
  if (campaign.channel === 'google_ads') {
    try {
      subAccountId = await ensureGoogleAdsSubAccount(campaign.site_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[admin/marketing/approve] sub-account provision failed:', err);
      await db.from('marketing_campaign_log').insert({
        campaign_id: id,
        action: 'failed',
        actor: 'system',
        details: { error: `sub-account provision failed: ${message}` },
      });
      return NextResponse.json({ error: 'Failed to provision Google Ads sub-account. Please contact support.' }, { status: 500 });
    }
  }

  const billingReady = campaign.sites.google_ads_billing_ready === true;

  // Gate launch on billing readiness. First campaign for a new sub-account
  // sits in pending_launch until ops configures billing in Google.
  if (campaign.channel === 'google_ads' && !billingReady) {
    await db.from('marketing_campaigns')
      .update({
        status: 'pending_launch',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    await db.from('marketing_campaign_log').insert({
      campaign_id: id,
      action: 'pending_launch',
      actor: `user:${user.email || ''}`,
      details: { reason: 'awaiting_billing_setup', sub_account: subAccountId },
    });

    const siteName = (campaign.sites.design_data as { siteTitle?: string } | null)?.siteTitle
      || campaign.sites.site_slug
      || 'Untitled site';

    try {
      await sendMarketingOpsPendingNotification({
        campaignId: id,
        campaignName: campaign.name,
        siteId: campaign.site_id,
        siteName,
        customerEmail: user.email || 'unknown',
        dailyBudgetCents: dailyBudget,
        googleAdsCustomerId: subAccountId,
        billingAlreadyReady: false,
      });
    } catch (err) {
      console.error('[admin/marketing/approve] ops notification failed (non-fatal):', err);
    }

    return NextResponse.json({
      campaign: { id, status: 'pending_launch' },
      pendingReview: true,
      message: 'Your campaign has been submitted. Our team activates it within a few hours and you\'ll get an email when it goes live.',
    });
  }

  // Billing is ready — submit to Google immediately and go active.
  await db.from('marketing_campaigns')
    .update({ status: 'submitting', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);

  await db.from('marketing_campaign_log').insert({
    campaign_id: id,
    action: 'approved',
    actor: `user:${user.email || ''}`,
  });

  try {
    if (campaign.channel === 'google_ads') {
      const launched = campaign.campaign_type === 'display'
        ? await createDisplayCampaign(campaign as Campaign)
        : await createSearchCampaign(campaign as Campaign);

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

      await db.from('marketing_campaign_log').insert({
        campaign_id: id,
        action: 'launched',
        actor: `user:${user.email || ''}`,
        details: { external_campaign_id: launched.campaignId },
      });

      return NextResponse.json({ campaign: updated });
    }

    // Meta / email channels: mark active without external submission (out of scope here).
    const { data: updated } = await db.from('marketing_campaigns')
      .update({ status: 'active', launched_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return NextResponse.json({ campaign: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/marketing/approve] launch failed:', err);
    await db.from('marketing_campaigns')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', id);
    await db.from('marketing_campaign_log').insert({
      campaign_id: id,
      action: 'failed',
      actor: 'system',
      details: { error: message },
    });
    return NextResponse.json({ error: message || 'Failed to launch campaign' }, { status: 500 });
  }
}
