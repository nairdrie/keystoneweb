import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';

const ALLOWED_STATUSES = [
  'new',
  'contacted',
  'scheduled',
  'building',
  'preview_sent',
  'approved',
  'paid',
  'launched',
  'post_launch',
  'closed_won',
  'closed_lost',
];

const ALLOWED_PATCH_FIELDS = new Set([
  'status',
  'notes',
  'assignee_user_id',
  'site_id',
  'stripe_checkout_url',
  'stripe_setup_invoice_id',
]);

async function assertAdmin(): Promise<boolean> {
  const access = await getOpsAccessContext();
  return Boolean(access?.isAdmin);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();
  const { data, error } = await db.from('launch_requests').select('*').eq('id', id).single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let assignee: { id: string; email: string | null; business_name: string | null } | null = null;
  if (data.assignee_user_id) {
    const { data: user } = await db
      .from('users')
      .select('id, email, business_name')
      .eq('id', data.assignee_user_id)
      .single();
    assignee = user ?? null;
  }

  let site: { id: string; site_slug: string | null } | null = null;
  if (data.site_id) {
    const { data: s } = await db
      .from('sites')
      .select('id, site_slug')
      .eq('id', data.site_id)
      .single();
    site = s ?? null;
  }

  // Assignee options: admins (via is_admin flag) + agents
  const [agentsResult, adminsResult] = await Promise.all([
    db.from('users').select('id, email, business_name, is_agent, is_admin').eq('is_agent', true),
    db.from('users').select('id, email, business_name, is_agent, is_admin').eq('is_admin', true),
  ]);

  const peopleById = new Map<string, { id: string; email: string; business_name: string | null; is_admin: boolean }>();
  for (const row of [...(agentsResult.data ?? []), ...(adminsResult.data ?? [])]) {
    if (!row?.id || !row.email) continue;
    const email = String(row.email).toLowerCase();
    const existing = peopleById.get(row.id);
    peopleById.set(row.id, {
      id: row.id,
      email,
      business_name: row.business_name ?? existing?.business_name ?? null,
      is_admin: Boolean(row.is_admin || existing?.is_admin),
    });
  }
  const assignee_options = [...peopleById.values()]
    .sort((a, b) => (a.is_admin === b.is_admin ? a.email.localeCompare(b.email) : a.is_admin ? -1 : 1))
    .map(({ id, email, business_name, is_admin }) => ({ id, email, business_name, is_admin }));

  return NextResponse.json({ ...data, assignee, site, assignee_options });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (!ALLOWED_PATCH_FIELDS.has(key)) continue;
    update[key] = body[key] === '' ? null : body[key];
  }

  if (typeof update.status === 'string' && !ALLOWED_STATUSES.includes(update.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('launch_requests')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update launch_request:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json(data);
}
