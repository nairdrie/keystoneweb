import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';

async function assertAdmin(): Promise<{ userId: string; email: string } | null> {
  const access = await getOpsAccessContext();
  if (!access?.isAdmin) return null;
  return { userId: access.userId, email: access.userEmail ?? '' };
}

/**
 * GET /api/ops/marketing/campaigns/[id]
 * Get full campaign detail with activity log.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const db = createAdminClient();

  const [{ data: campaign, error }, { data: logs }] = await Promise.all([
    db.from('marketing_campaigns').select('*').eq('id', id).single(),
    db.from('marketing_campaign_log')
      .select('*')
      .eq('campaign_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (error || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  return NextResponse.json({ campaign, logs: logs ?? [] });
}

/**
 * PATCH /api/ops/marketing/campaigns/[id]
 * Update campaign fields.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  // Only allow updating specific fields
  const allowedFields = [
    'name', 'content', 'targeting',
    'daily_budget_cents', 'total_budget_cents',
    'start_date', 'end_date', 'status',
  ];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  const db = createAdminClient();

  const { data: campaign, error } = await db
    .from('marketing_campaigns')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[ops/marketing/campaigns] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }

  // Log the edit
  await db.from('marketing_campaign_log').insert({
    campaign_id: id,
    action: 'edited',
    actor: `user:${admin.email}`,
    details: { updated_fields: Object.keys(updates).filter(k => k !== 'updated_at') },
  });

  return NextResponse.json({ campaign });
}

/**
 * DELETE /api/ops/marketing/campaigns/[id]
 * Soft-cancel a campaign.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const db = createAdminClient();

  const { error } = await db
    .from('marketing_campaigns')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[ops/marketing/campaigns] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to cancel campaign' }, { status: 500 });
  }

  await db.from('marketing_campaign_log').insert({
    campaign_id: id,
    action: 'cancelled',
    actor: `user:${admin.email}`,
  });

  return NextResponse.json({ success: true });
}
