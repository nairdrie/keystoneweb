import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { Resend } from 'resend';

// Allowed @keystoneweb.ca sender addresses
const ALLOWED_FROM_EMAILS = [
  'ops@keystoneweb.ca',
  'support@keystoneweb.ca',
  'hello@keystoneweb.ca',
  'contact@keystoneweb.ca',
  'sales@keystoneweb.ca',
  'info@keystoneweb.ca',
];

async function getOpsUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

  if (adminEmails.includes(user.email?.toLowerCase() ?? '')) {
    return { user, isAdmin: true, agentContactEmail: null };
  }

  // Check agent
  const db = createAdminClient();
  const { data: profile } = await db
    .from('users')
    .select('is_agent, agent_contact_email')
    .eq('id', user.id)
    .single();

  if (!profile?.is_agent) throw new Error('Forbidden');

  return { user, isAdmin: false, agentContactEmail: profile.agent_contact_email };
}

export async function POST(request: Request) {
  try {
    const { user, isAdmin, agentContactEmail } = await getOpsUser();

    const { to, subject, body, from_email, reply_to } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'to, subject, and body are required' }, { status: 400 });
    }

    // Validate the "from" address
    const fromEmail = (from_email || 'ops@keystoneweb.ca').toLowerCase().trim();
    if (!ALLOWED_FROM_EMAILS.includes(fromEmail)) {
      return NextResponse.json(
        { error: `from_email must be one of: ${ALLOWED_FROM_EMAILS.join(', ')}` },
        { status: 400 }
      );
    }

    // Agents can only send from their own contact email
    if (!isAdmin && agentContactEmail && fromEmail !== agentContactEmail) {
      return NextResponse.json(
        { error: `As an agent you can only send from ${agentContactEmail}` },
        { status: 403 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const senderLabel = isAdmin ? 'Keystone Operations' : 'Keystone';

    const { data, error } = await resend.emails.send({
      from: `${senderLabel} <${fromEmail}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      reply_to: reply_to || fromEmail,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
          ${body.replace(/\n/g, '<br/>')}
          <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="font-size: 12px; color: #9ca3af; margin: 0;">
            This email was sent from ${fromEmail}. Reply to this message to respond.
          </p>
        </div>
      `,
      text: body,
    });

    if (error) {
      console.error('[ops/email/send]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[ops/email/send] Sent by ${user.email} from ${fromEmail} to ${to}: ${data?.id}`);

    return NextResponse.json({ success: true, email_id: data?.id });
  } catch (err: any) {
    if (err.message === 'Unauthenticated') {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }
    if (err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[ops/email/send]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// GET — return allowed sender addresses
export async function GET() {
  try {
    await getOpsUser();
    return NextResponse.json({ from_emails: ALLOWED_FROM_EMAILS });
  } catch (err: any) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
