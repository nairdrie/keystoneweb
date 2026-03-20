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

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/ops/support/[id]/reply
 * Send a reply to the support request.
 * Body: { fromEmail, fromName, bodyText }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { fromEmail, fromName, bodyText } = await request.json();

  if (!fromEmail || !bodyText) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: ticket, error: ticketError } = await db
    .from('support_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const replySubject = ticket.subject?.toLowerCase().startsWith('re:') 
    ? ticket.subject 
    : `Re: ${ticket.subject || 'Your Support Request'}`;

  // Build the quoted history
  const quotedDate = new Date(ticket.created_at).toLocaleString('en-US');
  const originalSender = ticket.from_name ? `${ticket.from_name} <${ticket.from_email}>` : ticket.from_email;
  const quotedMessage = `\n\n\nOn ${quotedDate}, ${originalSender} wrote:\n> ` + 
    (ticket.body_text || '').split('\n').join('\n> ');

  // Thread ref: use the root ticket ID so customer replies get threaded
  const threadRoot = ticket.thread_id ?? ticket.id;
  const threadRef = `\n\nref:${threadRoot}`;
  const fullBodyText = bodyText + quotedMessage + threadRef;

  // Use the fromName if provided, otherwise default
  const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  try {
    const { error: sendError } = await resend.emails.send({
      from: fromAddress,
      to: [ticket.from_email],
      subject: replySubject,
      text: fullBodyText,
      // Pass the original message ID if we have it to thread properly
      ...(ticket.resend_email_id ? {
        headers: {
          'In-Reply-To': `<${ticket.resend_email_id}>`,
          'References': `<${ticket.resend_email_id}>`,
        }
      } : {}),
    });

    if (sendError) {
      console.error('[reply] Resend error:', sendError);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    // Update the ticket to mark as in_progress and log the reply
    const newNoteLog = `[${new Date().toISOString()}] Replied via Resend as ${fromAddress}`;
    const updatedNotes = ticket.notes ? `${ticket.notes}\n\n${newNoteLog}` : newNoteLog;

    const { data: updatedTicket, error: updateError } = await db
      .from('support_requests')
      .update({
        status: ticket.status === 'open' ? 'in_progress' : ticket.status,
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[reply] DB update error:', updateError);
      // Even if DB update fails, the email was sent, so we still return success but maybe warn
    }

    return NextResponse.json(updatedTicket || ticket);
  } catch (err) {
    console.error('[reply] Internal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
