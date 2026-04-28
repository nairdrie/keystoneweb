import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { isContactEventKind } from '@/lib/ops/leads';

const UPDATABLE = new Set(['kind', 'occurred_at', 'outcome', 'notes']);

// PATCH /api/ops/leads/[id]/contact-events/[eventId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, eventId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (!UPDATABLE.has(key)) continue;
    update[key] = body[key] === '' ? null : body[key];
  }

  if (typeof update.kind === 'string' && !isContactEventKind(update.kind)) {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('lead_contact_events')
    .update(update)
    .eq('id', eventId)
    .eq('lead_id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
  return NextResponse.json(data);
}

// DELETE /api/ops/leads/[id]/contact-events/[eventId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, eventId } = await params;
  const db = createAdminClient();
  const { error } = await db
    .from('lead_contact_events')
    .delete()
    .eq('id', eventId)
    .eq('lead_id', id);

  if (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
