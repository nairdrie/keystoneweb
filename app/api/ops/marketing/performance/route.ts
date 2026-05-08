import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';



import { assertOpsAdmin } from '@/lib/ops/access';
/**
 * GET /api/ops/marketing/performance
 * Aggregated performance across all platform campaigns.
 */
export async function GET() {
  if (!await assertOpsAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();

  // Get all non-cancelled platform campaigns
  const { data: campaigns } = await db
    .from('marketing_campaigns')
    .select('id, name, channel, campaign_type, status, impressions, clicks, conversions, spent_cents, ctr, cpc_cents, created_at, launched_at')
    .is('site_id', null)
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false });

  const allCampaigns = campaigns ?? [];

  // Aggregate totals
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;
  let totalSpentCents = 0;
  let activeCampaigns = 0;

  for (const c of allCampaigns) {
    totalImpressions += c.impressions || 0;
    totalClicks += c.clicks || 0;
    totalConversions += c.conversions || 0;
    totalSpentCents += c.spent_cents || 0;
    if (c.status === 'active') activeCampaigns++;
  }

  const overallCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const overallCpcCents = totalClicks > 0 ? Math.round(totalSpentCents / totalClicks) : 0;

  return NextResponse.json({
    totals: {
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions: totalConversions,
      spentCents: totalSpentCents,
      ctr: overallCtr,
      cpcCents: overallCpcCents,
      activeCampaigns,
      totalCampaigns: allCampaigns.length,
    },
    campaigns: allCampaigns,
  });
}
