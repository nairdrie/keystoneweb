import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';

async function verifyOwner(supabase: Awaited<ReturnType<typeof createClient>>, siteId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: site } = await supabase.from('sites').select('id, user_id').eq('id', siteId).single();
  if (!site || site.user_id !== user.id) return null;
  return user;
}

/**
 * GET /api/email/drafts?siteId=...
 *   → returns { drafts: EmailDraft[] }  (compose + reply drafts; reply drafts
 *      are enriched with thread_info { sender_name, sender_email, subject })
 *
 * GET /api/email/drafts?siteId=...&threadId=...
 *   → returns { draft: EmailDraft | null }  (single reply draft)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = request.nextUrl;
  const siteId = searchParams.get('siteId');
  const threadId = searchParams.get('threadId');

  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  if (!await verifyOwner(supabase, siteId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();

  if (threadId) {
    const { data } = await db
      .from('email_drafts')
      .select('*')
      .eq('site_id', siteId)
      .eq('thread_id', threadId)
      .maybeSingle();
    return NextResponse.json({ draft: data ?? null });
  }

  // List both compose drafts (thread_id IS NULL) and reply drafts. Reply
  // drafts get enriched with sender/subject from contact_submissions so the
  // Drafts sidebar can show "<customer name> · <subject>" instead of the
  // empty to_emails / subject fields that reply drafts don't populate.
  const { data: drafts } = await db
    .from('email_drafts')
    .select('*')
    .eq('site_id', siteId)
    .order('updated_at', { ascending: false });

  const replyThreadIds = Array.from(
    new Set((drafts ?? []).map(d => d.thread_id).filter((id): id is string => !!id))
  );

  const threadInfo: Record<string, { sender_name: string | null; sender_email: string | null; subject: string | null }> = {};
  if (replyThreadIds.length > 0) {
    const { data: submissions } = await db
      .from('contact_submissions')
      .select('thread_id, sender_name, sender_email, subject, direction, created_at')
      .eq('site_id', siteId)
      .in('thread_id', replyThreadIds)
      .order('created_at', { ascending: true });
    for (const s of submissions ?? []) {
      if (!s.thread_id) continue;
      // Prefer the first inbound message's metadata (the customer's side of
      // the conversation); fall back to whatever we see first.
      const existing = threadInfo[s.thread_id];
      if (!existing || (s.direction === 'inbound' && existing.sender_email == null)) {
        threadInfo[s.thread_id] = {
          sender_name: s.sender_name ?? null,
          sender_email: s.sender_email ?? null,
          subject: s.subject ?? null,
        };
      }
    }
  }

  const enriched = (drafts ?? []).map(d => ({
    ...d,
    thread_info: d.thread_id ? (threadInfo[d.thread_id] ?? null) : null,
  }));

  return NextResponse.json({ drafts: enriched });
}

/**
 * POST /api/email/drafts
 *
 * With threadId    → upsert reply draft (ON CONFLICT site_id, thread_id)
 * Without threadId → insert new compose draft, returns { draft }
 *
 * Body: { siteId, threadId?, addressId?, toEmails?, ccEmails?, bccEmails?, subject?, bodyHtml?, bodyText? }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { siteId, threadId, addressId, subject, bodyHtml, bodyText } = body;
  const toEmails: string[] = body.toEmails ?? [];
  const ccEmails: string[] = body.ccEmails ?? [];
  const bccEmails: string[] = body.bccEmails ?? [];

  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  if (!await verifyOwner(supabase, siteId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();

  if (threadId) {
    // Upsert reply draft
    const { data, error } = await db
      .from('email_drafts')
      .upsert({
        site_id: siteId,
        thread_id: threadId,
        address_id: addressId ?? null,
        to_emails: toEmails,
        cc_emails: ccEmails,
        bcc_emails: bccEmails,
        body_html: bodyHtml ?? null,
        body_text: bodyText ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'site_id,thread_id' })
      .select('*')
      .single();
    if (error) {
      console.error('[email/drafts] upsert reply draft failed:', error);
      return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
    }
    return NextResponse.json({ draft: data });
  }

  // Insert new compose draft
  const { data, error } = await db
    .from('email_drafts')
    .insert({
      site_id: siteId,
      thread_id: null,
      address_id: addressId ?? null,
      to_emails: toEmails,
      cc_emails: ccEmails,
      bcc_emails: bccEmails,
      subject: subject ?? null,
      body_html: bodyHtml ?? null,
      body_text: bodyText ?? null,
    })
    .select('*')
    .single();
  if (error) {
    console.error('[email/drafts] insert compose draft failed:', error);
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
  }
  return NextResponse.json({ draft: data });
}

/**
 * DELETE /api/email/drafts?siteId=...&threadId=...
 *   → delete reply draft by threadId
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = request.nextUrl;
  const siteId = searchParams.get('siteId');
  const threadId = searchParams.get('threadId');

  if (!siteId || !threadId) return NextResponse.json({ error: 'siteId and threadId required' }, { status: 400 });
  if (!await verifyOwner(supabase, siteId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();
  await db.from('email_drafts').delete().eq('site_id', siteId).eq('thread_id', threadId);
  return NextResponse.json({ ok: true });
}
