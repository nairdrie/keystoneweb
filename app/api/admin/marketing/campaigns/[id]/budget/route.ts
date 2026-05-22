import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { getCampaignBudget, listCampaignPayments } from '@/lib/marketing/campaign-budget';

/**
 * GET /api/admin/marketing/campaigns/[id]/budget
 * Returns the per-campaign prepaid budget summary + payment history.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Auth: verify the campaign belongs to the caller via its site.
  const { data: campaign } = await supabase
    .from('marketing_campaigns')
    .select('id, sites!inner(user_id)')
    .eq('id', id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const site = (campaign as any)?.sites;
  if (!campaign || site?.user_id !== user.id) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const [budget, payments] = await Promise.all([
    getCampaignBudget(id),
    listCampaignPayments(id),
  ]);

  return NextResponse.json({ budget, payments });
}
