import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { getOpsAdminEmailList } from '@/lib/ops/access';

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text || text.length < 3) {
    return NextResponse.json({ error: 'Please describe what you’d like changed.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const db = createAdminClient();
  const { data: req, error } = await db
    .from('launch_requests')
    .select('id, name, email, business_name, onboarding_user_id, assignee_user_id')
    .eq('onboarding_token', token)
    .single();
  if (error || !req) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (req.onboarding_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: updErr } = await db
    .from('launch_requests')
    .update({
      onboarding_status: 'changes_requested',
      changes_requested_text: text,
    })
    .eq('id', req.id);
  if (updErr) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

  // Notify operator(s) by email. Falls back to all admins if no assignee.
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    let recipients: string[] = [];
    if (req.assignee_user_id) {
      const { data: assignee } = await db
        .from('users')
        .select('email')
        .eq('id', req.assignee_user_id)
        .single();
      if (assignee?.email) recipients = [assignee.email];
    }
    if (recipients.length === 0) {
      recipients = await getOpsAdminEmailList();
    }

    if (recipients.length > 0) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://keystoneweb.ca';
      await resend.emails.send({
        from: 'Keystone Web Design <noreply@keystoneweb.ca>',
        to: recipients,
        subject: `Launch client requested changes — ${req.business_name || req.name}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto;">
            <h2 style="color: #111;">Client requested changes</h2>
            <p style="color: #444; font-size: 14px;">
              <strong>${req.business_name || req.name}</strong> (${req.email}) submitted change requests via the launch onboarding flow:
            </p>
            <div style="background: #f9fafb; border-left: 3px solid #f59e0b; padding: 12px 16px; margin: 16px 0; white-space: pre-wrap; font-size: 14px; color: #1f2937;">
              ${escapeHtml(text)}
            </div>
            <p style="font-size: 14px;">
              <a href="${baseUrl}/ops/launch/${req.id}">Open in ops →</a>
            </p>
          </div>
        `,
      });
    }
  } catch (e) {
    console.error('Failed to notify operator of change request:', e);
    // non-fatal
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
