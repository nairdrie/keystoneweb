import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { resend } from '@/lib/email/resend';

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

  const isAdmin = adminEmails.includes(user.email?.toLowerCase() ?? '');

  // Fetch contact email for all users (admins and agents)
  const db = createAdminClient();
  const { data: profile } = await db
    .from('users')
    .select('is_agent, agent_contact_email')
    .eq('id', user.id)
    .single();

  if (isAdmin) {
    return { user, isAdmin: true, agentContactEmail: profile?.agent_contact_email ?? null };
  }

  if (!profile?.is_agent) throw new Error('Forbidden');

  return { user, isAdmin: false, agentContactEmail: profile.agent_contact_email };
}

/** Derive a display name from an email address, e.g. "nick.smith@gmail.com" → "Nick Smith" */
function nameFromEmail(email: string): string {
  const username = email.split('@')[0];
  return username
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
    const normalizedContactEmail = agentContactEmail?.toLowerCase().trim() ?? null;
    const isOwnContactEmail = normalizedContactEmail && fromEmail === normalizedContactEmail;

    if (isAdmin) {
      // Admins can use any standard address or their own personal @keystoneweb.ca
      if (!ALLOWED_FROM_EMAILS.includes(fromEmail) && !isOwnContactEmail) {
        return NextResponse.json(
          { error: `from_email must be one of: ${ALLOWED_FROM_EMAILS.join(', ')}` },
          { status: 400 }
        );
      }
    } else {
      // Agents can only send from their own contact email
      if (!normalizedContactEmail || fromEmail !== normalizedContactEmail) {
        return NextResponse.json(
          { error: `As an agent you can only send from ${agentContactEmail}` },
          { status: 403 }
        );
      }
    }

    const senderLabel = isAdmin ? 'Keystone Operations' : 'Keystone';
    const senderName = nameFromEmail(user.email ?? fromEmail);
    const logoUrl = 'https://keystoneweb.ca/assets/logo/keystone-logo.png';

    const { data, error } = await resend.emails.send({
      from: `${senderLabel} <${fromEmail}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      replyTo: reply_to || fromEmail,
      html: `
        <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937;">
          <div style="margin: 0 0 24px 0;">${body.replace(/\n/g, '<br/>')}</div>
          <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif;">
              <tr>
                <td style="padding-right: 16px; border-right: 2px solid #2563eb; vertical-align: top;">
                  <a href="https://keystoneweb.ca" target="_blank" style="text-decoration: none;">
                    <img src="${logoUrl}" alt="Keystone Web Design" style="height: 48px; width: auto; display: block;" />
                  </a>
                </td>
                <td style="padding-left: 16px; vertical-align: top;">
                  <p style="margin: 0; font-size: 15px; font-weight: 700; color: #111827;">${senderName}</p>
                  <p style="margin: 2px 0 0 0; font-size: 13px; color: #6b7280;">Keystone Web Design</p>
                  <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">
                    <a href="mailto:${fromEmail}" style="color: #6b7280; text-decoration: none;">${fromEmail}</a>
                  </p>
                  <p style="margin: 4px 0 0 0; font-size: 12px;">
                    <a href="https://keystoneweb.ca" style="color: #2563eb; text-decoration: none;">keystoneweb.ca</a>
                  </p>
                </td>
              </tr>
            </table>
          </div>
        </div>
      `,
      text: `${body}\n\n--\n${senderName}\nKeystone Web Design\n${fromEmail}\nhttps://keystoneweb.ca`,
    });

    if (error) {
      console.error('[ops/email/send]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the sent email so agents can see replies in their inbox
    try {
      const db = createAdminClient();
      const toEmail = Array.isArray(to) ? to[0] : to;
      await db.from('ops_sent_emails').insert({
        sent_by_user_id: user.id,
        from_email: fromEmail,
        to_email: toEmail.toLowerCase().trim(),
        subject,
        resend_id: data?.id ?? null,
      });
    } catch (logErr) {
      // Non-fatal — email was sent successfully, just log the error
      console.error('[ops/email/send] Failed to log sent email:', logErr);
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
    const { isAdmin, agentContactEmail } = await getOpsUser();
    const fromEmails = isAdmin
      ? [
          ...(agentContactEmail ? [agentContactEmail] : []),
          ...ALLOWED_FROM_EMAILS,
        ]
      : agentContactEmail
        ? [agentContactEmail]
        : [];
    return NextResponse.json({ from_emails: fromEmails });
  } catch (err: any) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
