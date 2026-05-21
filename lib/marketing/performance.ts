/**
 * Marketing Performance Sync
 *
 * Pulls latest performance data from Google Ads and Meta APIs,
 * updates campaign metrics in the database, and records daily spend.
 * Platform credentials come from env vars (agency model).
 */

import type { Campaign } from './types';
import { getCampaignPerformance as getGooglePerformance } from './google-ads';
import { getCampaignPerformance as getMetaPerformance } from './meta-ads';
import { recordSpend } from './spend';
import { debitWalletForSpend, getWallet, shouldNotifyEmpty, shouldNotifyLowBalance, markEmptyNotified, markLowBalanceNotified } from './wallet';
import { sendMarketingWalletEmpty, sendMarketingWalletLow } from './notifications';
import { pauseCampaign as pauseGoogleCampaign } from './google-ads';

// ── Sync All Active Campaigns ────────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

export async function syncAllCampaigns(db: any): Promise<SyncResult> {
  const { data: campaigns, error } = await db
    .from('marketing_campaigns')
    .select('*')
    .eq('status', 'active')
    .not('external_campaign_id', 'is', null);

  if (error || !campaigns?.length) {
    return { synced: 0, failed: 0, errors: error ? [error.message] : [] };
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  for (const campaign of campaigns as Campaign[]) {
    try {
      if (campaign.channel === 'google_ads') {
        await syncGoogleCampaign(campaign, weekAgo, today, db);
      } else if (campaign.channel === 'meta_ads') {
        await syncMetaCampaign(campaign, weekAgo, today, db);
      }

      // After spend is recorded, reconcile the wallet for site (customer) campaigns.
      if (campaign.site_id) {
        await reconcileCampaignWallet(campaign, db);
      }

      await db.from('marketing_campaign_log').insert({
        campaign_id: campaign.id,
        action: 'performance_synced',
        actor: 'cron',
        details: { synced_at: new Date().toISOString(), date_range: { from: weekAgo, to: today } },
      });

      synced++;
    } catch (err: any) {
      console.error(`[marketing/performance] Failed to sync campaign ${campaign.id}:`, err);
      failed++;
      errors.push(`Campaign ${campaign.id}: ${err.message}`);
    }
  }

  return { synced, failed, errors };
}

/**
 * For each marketing_spend row on a customer campaign, ensure a corresponding
 * wallet debit txn exists. After applying debits, check if the wallet is empty
 * and pause active campaigns + email the customer.
 *
 * Idempotency is enforced by the unique index on (campaign_id, spend_date) for debit txns.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function reconcileCampaignWallet(campaign: Campaign, db: any): Promise<void> {
  if (!campaign.site_id) return;

  const { data: spendRows } = await db
    .from('marketing_spend')
    .select('spend_date, ad_spend_cents')
    .eq('campaign_id', campaign.id)
    .order('spend_date', { ascending: true });

  if (!spendRows?.length) return;

  const { data: existingDebits } = await db
    .from('marketing_wallet_transactions')
    .select('spend_date')
    .eq('campaign_id', campaign.id)
    .eq('kind', 'debit');

  const debited = new Set((existingDebits || []).map((r: { spend_date: string }) => r.spend_date));

  let walletDepleted = false;
  for (const row of spendRows) {
    if (debited.has(row.spend_date) || row.ad_spend_cents <= 0) continue;
    const result = await debitWalletForSpend({
      siteId: campaign.site_id,
      campaignId: campaign.id,
      spendDate: row.spend_date,
      rawAdSpendCents: row.ad_spend_cents,
      actor: 'cron',
    });
    if (result.depleted) walletDepleted = true;
  }

  // Wallet-empty handling: pause this campaign + notify the customer (once).
  if (walletDepleted) {
    const wallet = await getWallet(campaign.site_id);
    if (!wallet) return;

    if (campaign.status === 'active' && campaign.channel === 'google_ads' && campaign.external_campaign_id) {
      try {
        await pauseGoogleCampaign(campaign.external_campaign_id);
        await db.from('marketing_campaigns')
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('id', campaign.id);
        await db.from('marketing_campaign_log').insert({
          campaign_id: campaign.id,
          action: 'paused',
          actor: 'system',
          details: { reason: 'wallet_depleted' },
        });
      } catch (err) {
        console.error('[performance] Failed to auto-pause depleted campaign:', err);
      }
    }

    if (shouldNotifyEmpty(wallet)) {
      try {
        await sendMarketingWalletEmpty({ siteId: campaign.site_id, balanceCents: wallet.balance_cents });
        await markEmptyNotified(wallet.id);
      } catch (err) {
        console.error('[performance] Failed to send wallet-empty email:', err);
      }
    }
  } else {
    const wallet = await getWallet(campaign.site_id);
    if (wallet && shouldNotifyLowBalance(wallet)) {
      try {
        await sendMarketingWalletLow({ siteId: campaign.site_id, balanceCents: wallet.balance_cents });
        await markLowBalanceNotified(wallet.id);
      } catch (err) {
        console.error('[performance] Failed to send wallet-low email:', err);
      }
    }
  }
}

// ── Google Campaign Sync ─────────────────────────────────────────────────────

async function syncGoogleCampaign(
  campaign: Campaign,
  startDate: string,
  endDate: string,
  db: any,
): Promise<void> {
  const metrics = await getGooglePerformance(
    campaign.external_campaign_id!,
    startDate,
    endDate,
  );

  await db
    .from('marketing_campaigns')
    .update({
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      conversions: metrics.conversions,
      spent_cents: metrics.costCents,
      ctr: metrics.ctr,
      cpc_cents: metrics.cpcCents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id);

  if (metrics.costCents > 0) {
    await recordSpend(
      campaign.id,
      campaign.site_id,
      'google_ads',
      endDate,
      metrics.costCents,
      0,
      db,
    );
  }
}

// ── Meta Campaign Sync ───────────────────────────────────────────────────────

async function syncMetaCampaign(
  campaign: Campaign,
  startDate: string,
  endDate: string,
  db: any,
): Promise<void> {
  const metrics = await getMetaPerformance(
    campaign.external_campaign_id!,
    startDate,
    endDate,
  );

  await db
    .from('marketing_campaigns')
    .update({
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      conversions: metrics.conversions,
      spent_cents: metrics.spendCents,
      ctr: metrics.ctr,
      cpc_cents: metrics.cpcCents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id);

  if (metrics.spendCents > 0) {
    await recordSpend(
      campaign.id,
      campaign.site_id,
      'meta_ads',
      endDate,
      metrics.spendCents,
      0,
      db,
    );
  }
}

// ── Derived Metrics ──────────────────────────────────────────────────────────

export function calculateDerivedMetrics(
  impressions: number,
  clicks: number,
  spentCents: number,
): { ctr: number; cpcCents: number } {
  return {
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpcCents: clicks > 0 ? Math.round(spentCents / clicks) : 0,
  };
}
