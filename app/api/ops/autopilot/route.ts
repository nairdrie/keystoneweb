import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';

// GET  /api/ops/autopilot — dashboard data: generated sites + enrollments.
// POST /api/ops/autopilot — manage an enrollment:
//   { leadId, action: 'enroll' | 'pause' | 'resume' | 'stop' | 'takeover', channels? }

export const runtime = 'nodejs';

export async function GET() {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();

  const [{ data: generations }, { data: enrollments }, { data: recentEvents }] = await Promise.all([
    db.from('lead_site_generations')
      .select('id, lead_id, site_id, launch_request_id, status, prompt, error, created_at, completed_at, enrichment')
      .order('created_at', { ascending: false })
      .limit(100),
    db.from('lead_autopilot')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(200),
    db.from('lead_autopilot_events')
      .select('autopilot_id, lead_id, kind, summary, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  // Hydrate lead summaries for everything we're about to show.
  const leadIds = Array.from(new Set([
    ...(generations ?? []).map((g) => g.lead_id),
    ...(enrollments ?? []).map((e) => e.lead_id),
  ]));

  let leads: Record<string, unknown>[] = [];
  if (leadIds.length > 0) {
    const { data } = await db
      .from('leads')
      .select('id, business_name, contact_name, email, phone, city, industry, status')
      .in('id', leadIds);
    leads = data ?? [];
  }

  return NextResponse.json({
    generations: generations ?? [],
    enrollments: enrollments ?? [],
    recentEvents: recentEvents ?? [],
    leads,
  });
}

export async function POST(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const leadId = body && typeof body.leadId === 'string' ? body.leadId : '';
  const action = body && typeof body.action === 'string' ? body.action : '';
  if (!leadId || !['enroll', 'pause', 'resume', 'stop', 'takeover'].includes(action)) {
    return NextResponse.json({ error: 'leadId and a valid action are required' }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: lead } = await db
    .from('leads')
    .select('id, email, phone, status')
    .eq('id', leadId)
    .single();
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const { data: existing } = await db
    .from('lead_autopilot')
    .select('*')
    .eq('lead_id', leadId)
    .maybeSingle();

  if (action === 'enroll') {
    if (lead.status === 'do_not_contact') {
      return NextResponse.json({ error: 'This lead is marked do-not-contact.' }, { status: 400 });
    }
    if (!lead.email && !lead.phone) {
      return NextResponse.json({ error: 'Lead needs an email or phone number before enrolling.' }, { status: 400 });
    }

    const channels = {
      email: body?.channels?.email !== false && Boolean(lead.email),
      sms: body?.channels?.sms === true && Boolean(lead.phone),
    };

    if (existing) {
      const { error } = await db
        .from('lead_autopilot')
        .update({
          status: 'active',
          channels,
          stop_reason: null,
          hook_reason: null,
          next_action_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await logEvent(db, existing.id as string, leadId, 'resumed', 'Re-enrolled by operator.');
      return NextResponse.json({ ok: true, autopilotId: existing.id });
    }

    const { data: created, error } = await db
      .from('lead_autopilot')
      .insert({
        lead_id: leadId,
        status: 'active',
        channels,
        next_action_at: new Date().toISOString(),
        enrolled_by_user_id: access.userId,
      })
      .select('id')
      .single();
    if (error || !created) return NextResponse.json({ error: error?.message || 'Failed to enroll' }, { status: 500 });
    await logEvent(db, created.id as string, leadId, 'enrolled', 'Enrolled by operator.');
    return NextResponse.json({ ok: true, autopilotId: created.id });
  }

  if (!existing) {
    return NextResponse.json({ error: 'Lead is not enrolled in autopilot.' }, { status: 404 });
  }

  if (action === 'pause' || action === 'takeover') {
    const { error } = await db
      .from('lead_autopilot')
      .update({ status: 'paused' })
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logEvent(db, existing.id as string, leadId, 'paused', action === 'takeover' ? 'Operator took over the conversation.' : 'Paused by operator.');
    return NextResponse.json({ ok: true });
  }

  if (action === 'resume') {
    const { error } = await db
      .from('lead_autopilot')
      .update({ status: 'active', next_action_at: new Date().toISOString(), hook_reason: null })
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logEvent(db, existing.id as string, leadId, 'resumed', 'Resumed by operator.');
    return NextResponse.json({ ok: true });
  }

  // stop
  const { error } = await db
    .from('lead_autopilot')
    .update({ status: 'stopped', stop_reason: 'Stopped by operator.' })
    .eq('id', existing.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logEvent(db, existing.id as string, leadId, 'stopped', 'Stopped by operator.');
  return NextResponse.json({ ok: true });
}

async function logEvent(
  db: ReturnType<typeof createAdminClient>,
  autopilotId: string,
  leadId: string,
  kind: string,
  summary: string,
) {
  await db.from('lead_autopilot_events').insert({
    autopilot_id: autopilotId,
    lead_id: leadId,
    kind,
    summary,
  });
}
