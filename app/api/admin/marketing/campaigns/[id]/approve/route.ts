import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { getWallet } from '@/lib/marketing/wallet';
import { ensureGoogleAdsSubAccount } from '@/lib/marketing/subaccount';
import { createSearchCampaign, createDisplayCampaign } from '@/lib/marketing/google-ads';
import type { Campaign } from '@/lib/marketing/types';

/**
 * POST /api/admin/marketing/campaigns/[id]/approve
 *
 * Customer's first launch approval. Verifies wallet has funds, provisions a
 * Google Ads sub-account if needed, submits the campaign to the ad platform,
 * and records the approval snapshot.
 */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: campaign } = await supabase
    .from('marketing_campaigns')
    .select('*, sites!inner(id, user_id, marketing_enabled)')
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

  await db.from('marketing_campaigns')
    .update({ status: 'submitting', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);

  await db.from('marketing_campaign_log').insert({
    campaign_id: id,
    action: 'approved',
    actor: `user:${user.email || ''}`,
  });

  // Provision sub-account + submit to ad platform (Google only for now).
  try {
    if (campaign.channel === 'google_ads') {
      await ensureGoogleAdsSubAccount(campaign.site_id);
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
