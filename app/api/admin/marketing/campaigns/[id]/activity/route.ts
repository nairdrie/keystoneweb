import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { getActivityFeed } from '@/lib/marketing/activity';
import { getConversionTotals } from '@/lib/marketing/attribution';

/**
 * GET /api/admin/marketing/campaigns/[id]/activity
 *
 * Returns the live activity feed (hourly geo/device segments from Google) and
 * conversion totals attributed to this campaign from bookings/orders/members/
 * contact submissions.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: campaign } = await supabase
    .from('marketing_campaigns')
    .select('id, site_id, sites!inner(user_id)')
    .eq('id', id)
    .single();

  const site = Array.isArray(campaign?.sites) ? campaign?.sites[0] : campaign?.sites;
  if (!campaign || !site || site.user_id !== user.id) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const [activity, conversions] = await Promise.all([
    getActivityFeed(id, 25),
    getConversionTotals(id),
  ]);

  return NextResponse.json({ activity, conversions });
}
