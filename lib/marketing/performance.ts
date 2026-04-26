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
