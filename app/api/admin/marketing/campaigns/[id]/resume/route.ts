import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { resumeCampaign } from '@/lib/marketing/google-ads';
import { getCampaignBudget } from '@/lib/marketing/campaign-budget';

export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: campaign } = await supabase
    .from('marketing_campaigns')
    .select('*, sites!inner(user_id, marketing_enabled)')
    .eq('id', id)
    .single();

  if (!campaign || campaign.sites.user_id !== user.id) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }
  if (campaign.status !== 'paused') {
    return NextResponse.json({ error: `Cannot resume from status ${campaign.status}` }, { status: 400 });
  }

  // Check this campaign's prepaid budget — must have at least one day's worth left.
  const budget = await getCampaignBudget(id);
  const dailyBundled = Math.round((campaign.daily_budget_cents || 0) * 1.05);
  if (budget.remainingCents < dailyBundled) {
    return NextResponse.json({
      error: 'Campaign budget too low to resume. Add more budget first.',
      remainingCents: budget.remainingCents,
      requiredCents: dailyBundled,
    }, { status: 402 });
  }

  if (campaign.channel === 'google_ads' && campaign.external_campaign_id) {
    try {
      await resumeCampaign(campaign.external_campaign_id);
    } catch (err) {
      console.error('[admin/marketing/resume] Google resume failed:', err);
      return NextResponse.json({ error: 'Failed to resume campaign on Google Ads' }, { status: 500 });
    }
  }

  const db = createAdminClient();
  const { data: updated } = await db
    .from('marketing_campaigns')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  await db.from('marketing_campaign_log').insert({
    campaign_id: id,
    action: 'resumed',
    actor: `user:${user.email || ''}`,
  });

  return NextResponse.json({ campaign: updated });
}
