/**
 * Marketing Performance Sync
 *
 * Pulls latest performance data from Google Ads and Meta APIs,
 * updates campaign metrics in the database, and records daily spend.
 */

import type { Campaign, MarketingSettings } from './types';
import { getCampaignPerformance as getGooglePerformance } from './google-ads';
import { getCampaignPerformance as getMetaPerformance } from './meta-ads';
import { recordSpend } from './spend';

// ── Sync All Active Campaigns ────────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

/**
 * Sync performance data for all active campaigns.
 * Called by the marketing-sync cron job.
 */
export async function syncAllCampaigns(db: any): Promise<SyncResult> {
  // Fetch all active campaigns with external IDs
  const { data: campaigns, error } = await db
    .from('marketing_campaigns')
    .select('*')
    .eq('status', 'active')
    .not('external_campaign_id', 'is', null);

  if (error || !campaigns?.length) {
    return { synced: 0, failed: 0, errors: error ? [error.message] : [] };
  }

  // Fetch marketing settings (platform-level for now)
  const { data: settings } = await db
    .from('marketing_settings')
    .select('*')
    .is('site_id', null)
    .single();

  if (!settings) {
    return { synced: 0, failed: 0, errors: ['No marketing settings found'] };
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  const today = new Date().toISOString().split('T')[0];
  // Sync last 7 days of data to catch any delayed reporting
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  for (const campaign of campaigns as Campaign[]) {
    try {
      if (campaign.channel === 'google_ads') {
        await syncGoogleCampaign(settings, campaign, weekAgo, today, db);
      } else if (campaign.channel === 'meta_ads') {
        await syncMetaCampaign(settings, campaign, weekAgo, today, db);
      }
      // Email campaigns don't need external syncing

      // Log the sync
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
  settings: MarketingSettings,
  campaign: Campaign,
  startDate: string,
  endDate: string,
  db: any,
): Promise<void> {
  const metrics = await getGooglePerformance(
    settings,
    campaign.external_campaign_id!,
    startDate,
    endDate,
  );

  // Update campaign metrics
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

  // Record daily spend
  if (metrics.costCents > 0) {
    await recordSpend(
      campaign.id,
      campaign.site_id,
      'google_ads',
      endDate,
      metrics.costCents,
      0, // No management fee for ops (Phase A)
      db,
    );
  }
}

// ── Meta Campaign Sync ───────────────────────────────────────────────────────

async function syncMetaCampaign(
  settings: MarketingSettings,
  campaign: Campaign,
  startDate: string,
  endDate: string,
  db: any,
): Promise<void> {
  const metrics = await getMetaPerformance(
    settings,
    campaign.external_campaign_id!,
    startDate,
    endDate,
  );

  // Update campaign metrics
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

  // Record daily spend
  if (metrics.spendCents > 0) {
    await recordSpend(
      campaign.id,
      campaign.site_id,
      'meta_ads',
      endDate,
      metrics.spendCents,
      0, // No management fee for ops (Phase A)
      db,
    );
  }
}

// ── Derived Metrics ──────────────────────────────────────────────────────────

/**
 * Calculate derived metrics from raw numbers.
 */
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
