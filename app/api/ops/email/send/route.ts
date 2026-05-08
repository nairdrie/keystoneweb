import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { resend } from '@/lib/email/resend';
import { buildSignatureHtml, buildSignatureText, nameFromEmail } from '@/lib/email/signature';
import { getOpsAccessContext } from '@/lib/ops/access';

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
  const access = await getOpsAccessContext();
  if (!access) throw new Error('Unauthenticated');
  if (!access.isAdmin && !access.isAgent) throw new Error('Forbidden');

  return {
    userId: access.userId,
    userEmail: access.userEmail,
    isAdmin: access.isAdmin,
    agentContactEmail: access.agentContactEmail,
  };
}

export async function POST(request: Request) {
  try {
    const { userId, userEmail, isAdmin, agentContactEmail } = await getOpsUser();

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
    const senderName = nameFromEmail(userEmail ?? fromEmail);

    const { data, error } = await resend.emails.send({
      from: `${senderLabel} <${fromEmail}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      replyTo: reply_to || fromEmail,
      html: `
        <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937;">
          <div style="margin: 0 0 24px 0;">${body.replace(/\n/g, '<br/>')}</div>
          ${buildSignatureHtml({ senderName, fromEmail })}
        </div>
      `,
      text: `${body}\n\n${buildSignatureText({ senderName, fromEmail })}`,
    });

    if (error) {
      console.error('[ops/email/send]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the sent email so agents can see replies in their inbox.
    // If the recipient matches a lead, also log a lead_contact_events row
    // so the lead's timeline stays in sync.
    try {
      const db = createAdminClient();
      const toEmail = (Array.isArray(to) ? to[0] : to).toLowerCase().trim();
      const { data: sentRow } = await db
        .from('ops_sent_emails')
        .insert({
          sent_by_user_id: userId,
          from_email: fromEmail,
          to_email: toEmail,
          subject,
          resend_id: data?.id ?? null,
        })
        .select('id')
        .single();

      const { data: matchingLeads } = await db
        .from('leads')
        .select('id')
        .ilike('email', toEmail);

      if (matchingLeads && matchingLeads.length > 0 && sentRow?.id) {
        const events = matchingLeads.map((l) => ({
          lead_id: l.id,
          kind: 'email_sent',
          occurred_at: new Date().toISOString(),
          notes: subject ?? null,
          created_by_user_id: userId,
          ops_sent_email_id: sentRow.id,
        }));
        await db.from('lead_contact_events').insert(events);
      }
    } catch (logErr) {
      // Non-fatal — email was sent successfully, just log the error
      console.error('[ops/email/send] Failed to log sent email:', logErr);
    }

    console.log(`[ops/email/send] Sent by ${userEmail} from ${fromEmail} to ${to}: ${data?.id}`);

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
