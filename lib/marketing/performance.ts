/**
 * Marketing Performance Sync
 *
 * Pulls latest performance data from Google Ads and Meta APIs,
 * updates campaign metrics in the database, and records daily spend.
 *
 * After spend is recorded, checks per-campaign budget (prepaid_cents vs
 * spent × 1.05). When budget is depleted, auto-pauses the campaign and
 * emails the customer to top up.
 */

import type { Campaign } from './types';
import { getCampaignPerformance as getGooglePerformance } from './google-ads';
import { getCampaignPerformance as getMetaPerformance } from './meta-ads';
import { recordSpend } from './spend';
import { getCampaignBudget } from './campaign-budget';
import { sendMarketingCampaignBudgetLow, sendMarketingCampaignBudgetDepleted } from './notifications';
import { pauseCampaign as pauseGoogleCampaign } from './google-ads';
import { syncActivityForCampaign } from './activity';

// Notify customer when remaining budget drops below this many days of spend.
const LOW_BUDGET_THRESHOLD_DAYS = 2;

// ── Sync All Active Campaigns ────────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // Customer campaigns get their per-campaign budget reconciled (pause if depleted).
      if (campaign.site_id) {
        await reconcileCampaignBudget(campaign, db);
        try {
          await syncActivityForCampaign(campaign);
        } catch (actErr) {
          console.warn(`[performance] activity sync failed for ${campaign.id}:`, actErr);
        }
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
 * Read the campaign's prepaid budget vs total bundled spend. If depleted, pause
 * the campaign in Google + email the customer. If running low (<2 days at
 * current burn), email a heads-up.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function reconcileCampaignBudget(campaign: Campaign, db: any): Promise<void> {
  if (!campaign.site_id) return;

  const budget = await getCampaignBudget(campaign.id);
  if (budget.prepaidCents <= 0) return;  // No prepay yet (shouldn't be active anyway).

  const dailyBundled = Math.round((campaign.daily_budget_cents || 0) * 1.05);
  const daysRemaining = dailyBundled > 0 ? budget.remainingCents / dailyBundled : 999;

  // Depleted: pause and notify (idempotent — only paused once).
  if (budget.depleted) {
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
          details: { reason: 'budget_depleted' },
        });

        try {
          await sendMarketingCampaignBudgetDepleted({
            siteId: campaign.site_id,
            campaignId: campaign.id,
            campaignName: campaign.name,
          });
        } catch (err) {
          console.error('[performance] depleted notification failed:', err);
        }
      } catch (err) {
        console.error('[performance] failed to auto-pause depleted campaign:', err);
      }
    }
    return;
  }

  // Heads-up when remaining budget is below threshold.
  if (daysRemaining <= LOW_BUDGET_THRESHOLD_DAYS) {
    // Use a log entry as our idempotency guard — only one low-budget email per "low" period.
    const { data: existingLog } = await db
      .from('marketing_campaign_log')
      .select('id')
      .eq('campaign_id', campaign.id)
      .eq('action', 'budget_low_notified')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Only notify if we haven't already notified for this low period (i.e. since last topup).
    if (!existingLog) {
      try {
        await sendMarketingCampaignBudgetLow({
          siteId: campaign.site_id,
          campaignId: campaign.id,
          campaignName: campaign.name,
          remainingCents: budget.remainingCents,
          dailyBundledCents: dailyBundled,
        });
        await db.from('marketing_campaign_log').insert({
          campaign_id: campaign.id,
          action: 'budget_low_notified',
          actor: 'system',
          details: { remaining_cents: budget.remainingCents },
        });
      } catch (err) {
        console.error('[performance] low-budget notification failed:', err);
      }
    }
  }
}

// ── Google Campaign Sync ─────────────────────────────────────────────────────

async function syncGoogleCampaign(
  campaign: Campaign,
  startDate: string,
  endDate: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
