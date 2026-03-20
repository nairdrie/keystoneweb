import { NextRequest, NextResponse } from 'next/server';
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

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/ops/contact
 * Send an email to any address from an ops sender.
 * Body: { to, fromEmail, fromName, subject, bodyText }
 */
export async function POST(request: NextRequest) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { to, fromEmail, fromName, subject, bodyText } = await request.json();

  if (!to || !fromEmail || !subject || !bodyText) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  try {
    const { error: sendError } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject,
      text: bodyText,
    });

    if (sendError) {
      console.error('[contact] Resend error:', sendError);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[contact] Internal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
