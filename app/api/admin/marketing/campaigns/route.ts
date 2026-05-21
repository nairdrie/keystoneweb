import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getMarketingAccess } from '@/lib/marketing/admin-auth';

/**
 * GET /api/admin/marketing/campaigns?siteId=xxx
 * List this site's marketing campaigns.
 */
export async function GET(request: NextRequest) {
  const result = await getMarketingAccess(request);
  if ('error' in result) return result.error;
  const { access } = result;

  const url = request.nextUrl;
  const status = url.searchParams.get('status');
  const channel = url.searchParams.get('channel');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const db = createAdminClient();
  let query = db
    .from('marketing_campaigns')
    .select('*', { count: 'exact' })
    .eq('site_id', access.siteId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (channel) query = query.eq('channel', channel);

  const { data, count, error } = await query;
  if (error) {
    console.error('[admin/marketing/campaigns] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }

  return NextResponse.json({ campaigns: data ?? [], total: count ?? 0 });
}

/**
 * POST /api/admin/marketing/campaigns
 * Create a draft campaign for this site.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await getMarketingAccess(request, { siteIdFromBody: body });
  if ('error' in result) return result.error;
  const { access } = result;

  const {
    name, channel, campaign_type, content, targeting,
    daily_budget_cents, total_budget_cents, start_date, end_date,
    ai_generated, ai_rationale,
  } = body;

  if (!name || !channel || !campaign_type) {
    return NextResponse.json({ error: 'Missing required fields: name, channel, campaign_type' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: campaign, error } = await db
    .from('marketing_campaigns')
    .insert({
      site_id: access.siteId,
      created_by: access.userId,
      name,
      channel,
      campaign_type,
      status: 'draft',
      content: content || {},
      targeting: targeting || {},
      daily_budget_cents: daily_budget_cents || null,
      total_budget_cents: total_budget_cents || null,
      start_date: start_date || null,
      end_date: end_date || null,
      ai_generated: ai_generated || false,
      ai_rationale: ai_rationale || null,
    })
    .select()
    .single();

  if (error || !campaign) {
    console.error('[admin/marketing/campaigns] POST error:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }

  await db.from('marketing_campaign_log').insert({
    campaign_id: campaign.id,
    action: 'created',
    actor: `user:${access.userEmail}`,
    details: { ai_generated: ai_generated || false },
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
