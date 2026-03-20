import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';

async function assertAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
      .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    return adminEmails.includes(user.email?.toLowerCase() ?? '');
  } catch {
    return false;
  }
}

/**
 * GET /api/ops/support/[id]/debug
 *
 * Re-fetches the email body from Resend's Received Emails API using the
 * stored resend_email_id and returns the raw response alongside what is
 * currently stored in the DB. Useful when body_text/body_html are null.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();

  const { data: ticket, error: dbErr } = await db
    .from('support_requests')
    .select('id, resend_email_id, body_text, body_html, from_email, subject, created_at')
    .eq('id', id)
    .single();

  if (dbErr || !ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const resendEmailId = ticket.resend_email_id;
  const apiKey = process.env.RESEND_API_KEY;

  const stored = {
    resend_email_id: resendEmailId ?? null,
    body_text_length: ticket.body_text?.length ?? null,
    body_html_length: ticket.body_html?.length ?? null,
    body_text_preview: ticket.body_text?.slice(0, 200) ?? null,
  };

  if (!resendEmailId) {
    return NextResponse.json({
      stored,
      resend: null,
      error: 'No resend_email_id stored for this ticket — cannot fetch from Resend.',
    });
  }

  if (!apiKey) {
    return NextResponse.json({
      stored,
      resend: null,
      error: 'RESEND_API_KEY env var is not set.',
    });
  }

  let resendRaw: any = null;
  let fetchError: string | null = null;
  let httpStatus: number | null = null;

  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${resendEmailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    httpStatus = res.status;
    resendRaw = await res.json();
  } catch (err: any) {
    fetchError = err?.message ?? String(err);
  }

  // If body came back and DB is empty, patch the ticket now
  let patched = false;
  if (resendRaw && (resendRaw.text || resendRaw.html) && !ticket.body_text && !ticket.body_html) {
    const { error: patchErr } = await db
      .from('support_requests')
      .update({
        body_text: resendRaw.text ?? null,
        body_html: resendRaw.html ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    patched = !patchErr;
  }

  return NextResponse.json({
    stored,
    resend_http_status: httpStatus,
    resend: resendRaw
      ? {
          // Surface key fields at top level for easy reading
          text_length: resendRaw.text?.length ?? null,
          html_length: resendRaw.html?.length ?? null,
          text_preview: resendRaw.text?.slice(0, 300) ?? null,
          subject: resendRaw.subject ?? null,
          from: resendRaw.from ?? null,
          to: resendRaw.to ?? null,
          created_at: resendRaw.created_at ?? null,
          // Full raw payload for complete inspection
          raw: resendRaw,
        }
      : null,
    fetch_error: fetchError,
    auto_patched: patched,
  });
}
