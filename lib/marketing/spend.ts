/**
 * Marketing Spend Tracking & Budget Enforcement
 *
 * Tracks daily spend per campaign, enforces budget limits,
 * and provides spend summaries for billing.
 */

import type { MarketingChannel } from './types';

// ── Record Spend ─────────────────────────────────────────────────────────────

/**
 * Record or update daily spend for a campaign.
 * Uses upsert (ON CONFLICT) so calling multiple times per day is safe.
 */
export async function recordSpend(
  campaignId: string,
  siteId: string | null,
  channel: MarketingChannel,
  date: string,               // YYYY-MM-DD
  adSpendCents: number,
  managementFeeCents: number,  // 20% markup (Phase B)
  db: any,
): Promise<void> {
  const { error } = await db
    .from('marketing_spend')
    .upsert(
      {
        campaign_id: campaignId,
        site_id: siteId,
        channel,
        spend_date: date,
        ad_spend_cents: adSpendCents,
        management_fee_cents: managementFeeCents,
      },
      { onConflict: 'campaign_id,spend_date' },
    );

  if (error) {
    console.error('[marketing/spend] Failed to record spend:', error);
    throw new Error('Failed to record spend');
  }

  // Update the campaign's running total
  await updateCampaignSpentTotal(campaignId, db);
}

// ── Budget Queries ───────────────────────────────────────────────────────────

/**
 * Get total spend for a campaign across all days.
 */
export async function getCampaignTotalSpend(
  campaignId: string,
  db: any,
): Promise<number> {
  const { data, error } = await db
    .from('marketing_spend')
    .select('ad_spend_cents')
    .eq('campaign_id', campaignId);

  if (error) {
    console.error('[marketing/spend] Failed to get total spend:', error);
    return 0;
  }

  return (data ?? []).reduce((sum: number, row: any) => sum + (row.ad_spend_cents || 0), 0);
}

/**
 * Check if a campaign has exceeded its total budget.
 */
export async function checkBudgetExceeded(
  campaignId: string,
  db: any,
): Promise<{ exceeded: boolean; spent: number; budget: number | null }> {
  // Get campaign budget
  const { data: campaign } = await db
    .from('marketing_campaigns')
    .select('total_budget_cents, spent_cents')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    return { exceeded: false, spent: 0, budget: null };
  }

  const spent = campaign.spent_cents || 0;
  const budget = campaign.total_budget_cents;

  return {
    exceeded: budget != null && spent >= budget,
    spent,
    budget,
  };
}

/**
 * Update the campaign's `spent_cents` column from the spend ledger.
 */
async function updateCampaignSpentTotal(campaignId: string, db: any): Promise<void> {
  const totalSpent = await getCampaignTotalSpend(campaignId, db);

  await db
    .from('marketing_campaigns')
    .update({ spent_cents: totalSpent, updated_at: new Date().toISOString() })
    .eq('id', campaignId);
}

// ── Spend Summaries ──────────────────────────────────────────────────────────

export interface SpendSummary {
  totalAdSpendCents: number;
  totalManagementFeeCents: number;
  totalCents: number;
  byChannel: Record<MarketingChannel, number>;
  byCampaign: { campaignId: string; adSpendCents: number }[];
}

/**
 * Get monthly spend summary, optionally scoped to a site.
 */
export async function getMonthlySpendSummary(
  year: number,
  month: number,              // 1-12
  db: any,
  siteId?: string | null,
): Promise<SpendSummary> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  let query = db
    .from('marketing_spend')
    .select('campaign_id, channel, ad_spend_cents, management_fee_cents')
    .gte('spend_date', startDate)
    .lt('spend_date', endDate);

  if (siteId === null) {
    // Platform-level campaigns (ops)
    query = query.is('site_id', null);
  } else if (siteId) {
    query = query.eq('site_id', siteId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[marketing/spend] Failed to get monthly summary:', error);
    return {
      totalAdSpendCents: 0,
      totalManagementFeeCents: 0,
      totalCents: 0,
      byChannel: { google_ads: 0, meta_ads: 0, email: 0 },
      byCampaign: [],
    };
  }

  const rows = data ?? [];

  const byChannel: Record<MarketingChannel, number> = { google_ads: 0, meta_ads: 0, email: 0 };
  const campaignMap = new Map<string, number>();
  let totalAdSpend = 0;
  let totalFees = 0;

  for (const row of rows) {
    totalAdSpend += row.ad_spend_cents || 0;
    totalFees += row.management_fee_cents || 0;
    const ch = row.channel as MarketingChannel;
    if (ch in byChannel) byChannel[ch] += row.ad_spend_cents || 0;
    campaignMap.set(
      row.campaign_id,
      (campaignMap.get(row.campaign_id) || 0) + (row.ad_spend_cents || 0),
    );
  }

  return {
    totalAdSpendCents: totalAdSpend,
    totalManagementFeeCents: totalFees,
    totalCents: totalAdSpend + totalFees,
    byChannel,
    byCampaign: Array.from(campaignMap.entries()).map(([campaignId, adSpendCents]) => ({
      campaignId,
      adSpendCents,
    })),
  };
}
