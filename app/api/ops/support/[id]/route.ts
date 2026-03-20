import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { Resend } from 'resend';

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
 * GET /api/ops/support/[id]
 * Returns a single support request including body_html.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();
  const { data, error } = await db
    .from('support_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Auto-fetch body from Resend if missing
  let resendLog: { attempted: boolean; success?: boolean; error?: string; text_length?: number; html_length?: number } = { attempted: false };

  if (!data.body_text && !data.body_html && data.resend_email_id) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      resendLog = { attempted: true, success: false, error: 'RESEND_API_KEY not set' };
    } else {
      try {
        const resend = new Resend(apiKey);
        const { data: email, error: resendErr } = await resend.emails.receiving.get(data.resend_email_id);
        if (resendErr || !email) {
          resendLog = { attempted: true, success: false, error: String(resendErr ?? 'No data returned') };
        } else {
          const text = (email as any).text ?? null;
          const html = (email as any).html ?? null;
          if (text || html) {
            data.body_text = text;
            data.body_html = html;
            await db
              .from('support_requests')
              .update({ body_text: text, body_html: html, updated_at: new Date().toISOString() })
              .eq('id', id);
            resendLog = { attempted: true, success: true, text_length: text?.length ?? 0, html_length: html?.length ?? 0 };
          } else {
            resendLog = { attempted: true, success: false, error: 'Resend returned email but body (text/html) was empty' };
          }
        }
      } catch (err: any) {
        resendLog = { attempted: true, success: false, error: err?.message ?? String(err) };
      }
    }
  }

  return NextResponse.json({ ...data, _resend_log: resendLog });
}

/**
 * PATCH /api/ops/support/[id]
 * Update status, priority, or notes on a support request.
 * Body: { status?, priority?, notes? }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const allowed = ['status', 'priority', 'notes'];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('support_requests')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/ops/support/[id]
 * Permanently delete a support request.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();
  const { error } = await db
    .from('support_requests')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
