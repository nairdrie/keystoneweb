import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';

async function assertAdmin(): Promise<{ userId: string; email: string } | null> {
  const access = await getOpsAccessContext();
  if (!access?.isAdmin) return null;
  return { userId: access.userId, email: access.userEmail ?? '' };
}

/**
 * GET /api/ops/marketing/campaigns
 * List marketing campaigns with optional filters.
 */
export async function GET(request: NextRequest) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = request.nextUrl;
  const channel = url.searchParams.get('channel');
  const status = url.searchParams.get('status');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const db = createAdminClient();
  let query = db
    .from('marketing_campaigns')
    .select('*', { count: 'exact' })
    .is('site_id', null) // Platform campaigns only (Phase A)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (channel) query = query.eq('channel', channel);
  if (status) query = query.eq('status', status);

  const { data: campaigns, count, error } = await query;

  if (error) {
    console.error('[ops/marketing/campaigns] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }

  return NextResponse.json({ campaigns: campaigns ?? [], total: count ?? 0 });
}

/**
 * POST /api/ops/marketing/campaigns
 * Create a new marketing campaign.
 */
export async function POST(request: NextRequest) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const {
    name, channel, campaign_type, content, targeting,
    daily_budget_cents, total_budget_cents, start_date, end_date,
    ai_generated, ai_rationale, status,
  } = body;

  if (!name || !channel || !campaign_type) {
    return NextResponse.json({ error: 'Missing required fields: name, channel, campaign_type' }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: campaign, error } = await db
    .from('marketing_campaigns')
    .insert({
      site_id: null, // Platform campaign (Phase A)
      created_by: admin.userId,
      name,
      channel,
      campaign_type,
      status: status || 'draft',
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

  if (error) {
    console.error('[ops/marketing/campaigns] POST error:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }

  // Log creation
  await db.from('marketing_campaign_log').insert({
    campaign_id: campaign.id,
    action: 'created',
    actor: `user:${admin.email}`,
    details: { ai_generated: ai_generated || false },
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
