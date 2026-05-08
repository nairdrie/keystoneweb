import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import {
  LEAD_UPDATABLE_FIELDS,
  isLeadSource,
  isLeadStatus,
} from '@/lib/ops/leads';

const UPDATABLE = new Set<string>(LEAD_UPDATABLE_FIELDS);

// GET /api/ops/leads/[id]
// Returns the lead plus all the related data the detail page needs:
//   assignee, referred_by, converted_user (+ subscription),
//   email_match_candidates, assignee_options, contact_events, messages.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();

  const { data: lead, error } = await db.from('leads').select('*').eq('id', id).single();
  if (error || !lead) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const userIdsToFetch = new Set<string>();
  if (lead.assignee_user_id) userIdsToFetch.add(lead.assignee_user_id);
  if (lead.referred_by_user_id) userIdsToFetch.add(lead.referred_by_user_id);
  if (lead.converted_user_id) userIdsToFetch.add(lead.converted_user_id);

  const [
    relatedUsersResult,
    convertedSubResult,
    contactEventsResult,
    sentEmailsResult,
    supportRequestsResult,
    emailMatchResult,
    assigneeOptions,
  ] = await Promise.all([
    userIdsToFetch.size > 0
      ? db
          .from('users')
          .select('id, email, business_name')
          .in('id', Array.from(userIdsToFetch))
      : Promise.resolve({ data: [] as Array<{ id: string; email: string | null; business_name: string | null }> }),
    lead.converted_user_id
      ? db
          .from('user_subscriptions')
          .select('subscription_plan, subscription_status, subscription_started_at')
          .eq('user_id', lead.converted_user_id)
          .single()
      : Promise.resolve({ data: null }),
    db
      .from('lead_contact_events')
      .select('*')
      .eq('lead_id', id)
      .order('occurred_at', { ascending: false }),
    lead.email
      ? db
          .from('ops_sent_emails')
          .select('id, from_email, to_email, subject, sent_by_user_id, created_at')
          .eq('to_email', lead.email.toLowerCase())
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    lead.email
      ? db
          .from('support_requests')
          .select('id, from_email, from_name, subject, body_text, status, created_at')
          .eq('from_email', lead.email.toLowerCase())
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    lead.email && !lead.converted_user_id
      ? db
          .from('users')
          .select('id, email, business_name, created_at')
          .ilike('email', lead.email)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    fetchAssigneeOptions(db),
  ]);

  const usersById = new Map<string, { id: string; email: string | null; business_name: string | null }>();
  for (const u of relatedUsersResult.data ?? []) {
    usersById.set(u.id, u);
  }

  const assignee = lead.assignee_user_id ? usersById.get(lead.assignee_user_id) ?? null : null;
  const referred_by = lead.referred_by_user_id ? usersById.get(lead.referred_by_user_id) ?? null : null;
  const converted_user = lead.converted_user_id ? usersById.get(lead.converted_user_id) ?? null : null;

  // Fetch sender emails for the contact event author chips
  const eventAuthorIds = new Set<string>();
  for (const ev of contactEventsResult.data ?? []) {
    if (ev.created_by_user_id) eventAuthorIds.add(ev.created_by_user_id);
  }
  for (const m of sentEmailsResult.data ?? []) {
    const senderId = (m as { sent_by_user_id?: string }).sent_by_user_id;
    if (senderId) eventAuthorIds.add(senderId);
  }
  const authorMap: Record<string, { email: string | null; business_name: string | null }> = {};
  if (eventAuthorIds.size > 0) {
    const { data: authors } = await db
      .from('users')
      .select('id, email, business_name')
      .in('id', Array.from(eventAuthorIds));
    for (const a of authors ?? []) {
      authorMap[a.id] = { email: a.email, business_name: a.business_name };
    }
  }

  const messages = [
    ...((sentEmailsResult.data ?? []) as Array<{
      id: string;
      from_email: string;
      to_email: string;
      subject: string | null;
      sent_by_user_id: string | null;
      created_at: string;
    }>).map((row) => ({
      id: `sent:${row.id}`,
      direction: 'outbound' as const,
      kind: 'email' as const,
      subject: row.subject,
      from_email: row.from_email,
      to_email: row.to_email,
      sent_by: row.sent_by_user_id ? authorMap[row.sent_by_user_id] ?? null : null,
      created_at: row.created_at,
    })),
    ...((supportRequestsResult.data ?? []) as Array<{
      id: string;
      from_email: string;
      from_name: string | null;
      subject: string | null;
      body_text: string | null;
      status: string;
      created_at: string;
    }>).map((row) => ({
      id: `inbound:${row.id}`,
      direction: 'inbound' as const,
      kind: 'email' as const,
      subject: row.subject,
      from_email: row.from_email,
      from_name: row.from_name,
      body_preview: row.body_text ? row.body_text.slice(0, 280) : null,
      support_status: row.status,
      created_at: row.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const contact_events = (contactEventsResult.data ?? []).map((ev) => ({
    ...ev,
    created_by: ev.created_by_user_id ? authorMap[ev.created_by_user_id] ?? null : null,
  }));

  // Generate a short-lived signed URL for the lead image so the browser can
  // render it without exposing the storage path or making the bucket public.
  // Page should refetch when the URL expires (1 hour).
  let image_url: string | null = null;
  if (lead.image_storage_path) {
    const { data: signed } = await db.storage
      .from('lead-images')
      .createSignedUrl(lead.image_storage_path, 60 * 60);
    image_url = signed?.signedUrl ?? null;
  }

  return NextResponse.json({
    ...lead,
    image_url,
    assignee,
    referred_by,
    converted_user,
    converted_subscription: convertedSubResult.data ?? null,
    email_match_candidates: emailMatchResult.data ?? [],
    contact_events,
    messages,
    assignee_options: assigneeOptions,
  });
}

// PATCH /api/ops/leads/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (!UPDATABLE.has(key)) continue;
    update[key] = body[key] === '' ? null : body[key];
  }

  if (typeof update.status === 'string' && !isLeadStatus(update.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if (typeof update.source === 'string' && !isLeadSource(update.source)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  }
  if (typeof update.email === 'string') {
    update.email = update.email.toLowerCase().trim() || null;
  }
  if (typeof update.onboarding_amount_cents === 'string') {
    const n = parseInt(update.onboarding_amount_cents, 10);
    update.onboarding_amount_cents = Number.isFinite(n) ? n : null;
  }

  // When ops links a converted user, stamp converted_at + flip status to converted
  // (unless caller explicitly set status to something else in the same patch).
  if (
    Object.prototype.hasOwnProperty.call(update, 'converted_user_id') &&
    update.converted_user_id &&
    !Object.prototype.hasOwnProperty.call(update, 'converted_at')
  ) {
    update.converted_at = new Date().toISOString();
  }
  if (
    Object.prototype.hasOwnProperty.call(update, 'converted_user_id') &&
    update.converted_user_id &&
    !Object.prototype.hasOwnProperty.call(update, 'status')
  ) {
    update.status = 'converted';
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('leads')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[ops/leads] update failed:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/ops/leads/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();
  const { error } = await db.from('leads').delete().eq('id', id);

  if (error) {
    console.error('[ops/leads] delete failed:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// Returns the same admin+agent merged list used by /api/ops/launch/[id].
async function fetchAssigneeOptions(db: ReturnType<typeof createAdminClient>) {
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
  return [...peopleById.values()].sort((a, b) =>
    a.is_admin === b.is_admin ? a.email.localeCompare(b.email) : a.is_admin ? -1 : 1,
  );
}
