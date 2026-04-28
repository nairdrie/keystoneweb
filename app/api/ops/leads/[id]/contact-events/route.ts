import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { isContactEventKind } from '@/lib/ops/leads';

// GET /api/ops/leads/[id]/contact-events
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();
  const { data, error } = await db
    .from('lead_contact_events')
    .select('*')
    .eq('lead_id', id)
    .order('occurred_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

// POST /api/ops/leads/[id]/contact-events
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const kind = typeof body.kind === 'string' ? body.kind : null;
  if (!kind || !isContactEventKind(kind)) {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  }

  const db = createAdminClient();

  // Confirm the lead exists before inserting (cheap check).
  const { data: lead } = await db.from('leads').select('id').eq('id', id).single();
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const occurredAt =
    typeof body.occurred_at === 'string' && body.occurred_at.trim()
      ? body.occurred_at
      : new Date().toISOString();

  const insert = {
    lead_id: id,
    kind,
    occurred_at: occurredAt,
    outcome: typeof body.outcome === 'string' && body.outcome.trim() ? body.outcome.trim() : null,
    notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
    created_by_user_id: access.userId,
    ops_sent_email_id:
      typeof body.ops_sent_email_id === 'string' ? body.ops_sent_email_id : null,
  };

  const { data, error } = await db
    .from('lead_contact_events')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[ops/leads] contact-event create failed:', error);
    return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
