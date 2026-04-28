import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { isLeadSource, isLeadStatus } from '@/lib/ops/leads';

// POST /api/ops/leads — create a new lead.
// Used by the NewLeadButton modal on /ops/leads. Both admins and agents may
// create leads; full visibility is enforced at the page level.
export async function POST(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const source = typeof body.source === 'string' ? body.source : 'other';
  if (!isLeadSource(source)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  }

  const status = typeof body.status === 'string' ? body.status : 'new';
  if (!isLeadStatus(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const email =
    typeof body.email === 'string' && body.email.trim()
      ? body.email.trim().toLowerCase()
      : null;

  const insert = {
    contact_name: trimOrNull(body.contact_name),
    business_name: trimOrNull(body.business_name),
    email,
    phone: trimOrNull(body.phone),
    website: trimOrNull(body.website),
    business_type: trimOrNull(body.business_type),
    source,
    source_detail: trimOrNull(body.source_detail),
    status,
    notes: trimOrNull(body.notes),
    assignee_user_id: typeof body.assignee_user_id === 'string' ? body.assignee_user_id : null,
  };

  if (!insert.contact_name && !insert.business_name && !insert.email && !insert.phone) {
    return NextResponse.json(
      { error: 'At least one of contact name, business, email, or phone is required.' },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const { data, error } = await db.from('leads').insert(insert).select().single();

  if (error) {
    console.error('[ops/leads] create failed:', error);
    return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
