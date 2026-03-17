import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';

/**
 * POST /api/webhooks/resend-inbound
 *
 * Receives inbound emails forwarded by Resend when a message arrives at
 * support@keystoneweb.ca. Configure this URL in the Resend dashboard under
 * Inbound → Webhooks, and set RESEND_INBOUND_SECRET to the signing secret.
 *
 * Resend inbound email payload shape:
 * {
 *   "type": "email.received",
 *   "data": {
 *     "from": "User Name <user@example.com>",
 *     "to": ["support@keystoneweb.ca"],
 *     "subject": "...",
 *     "text": "...",
 *     "html": "...",
 *     "messageId": "<unique-id@mail.example.com>",
 *     "headers": { ... }
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  // Validate shared secret so only Resend can call this endpoint
  const inboundSecret = process.env.RESEND_INBOUND_SECRET;
  if (inboundSecret) {
    const authHeader = request.headers.get('authorization') || '';
    const providedSecret = authHeader.replace(/^Bearer\s+/i, '');
    if (providedSecret !== inboundSecret) {
      console.warn('[resend-inbound] Invalid secret, rejecting request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Support both Resend webhook envelope and raw email payloads
  const emailData = payload?.data ?? payload;

  const fromRaw: string = emailData?.from ?? '';
  const subject: string = emailData?.subject ?? '(no subject)';
  const bodyText: string = emailData?.text ?? emailData?.plain ?? '';
  const bodyHtml: string = emailData?.html ?? '';
  const messageId: string = emailData?.messageId ?? emailData?.message_id ?? '';

  // Parse "Name <email>" or plain email
  const emailMatch = fromRaw.match(/<([^>]+)>/);
  const fromEmail = emailMatch ? emailMatch[1] : fromRaw.trim();
  const nameMatch = fromRaw.match(/^([^<]+)<[^>]+>/);
  const fromName = nameMatch ? nameMatch[1].trim() : null;

  if (!fromEmail) {
    return NextResponse.json({ error: 'Missing from email' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Deduplicate by Resend message ID
  if (messageId) {
    const { data: existing } = await admin
      .from('support_requests')
      .select('id')
      .eq('resend_email_id', messageId)
      .maybeSingle();

    if (existing) {
      console.log(`[resend-inbound] Duplicate message ${messageId}, skipping`);
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  const { error } = await admin.from('support_requests').insert({
    from_email: fromEmail,
    from_name: fromName,
    subject,
    body_text: bodyText || null,
    body_html: bodyHtml || null,
    resend_email_id: messageId || null,
    status: 'open',
    priority: 'normal',
  });

  if (error) {
    console.error('[resend-inbound] Failed to store support request:', error);
    return NextResponse.json({ error: 'Storage failed' }, { status: 500 });
  }

  console.log(`[resend-inbound] New support request from ${fromEmail}: ${subject}`);
  return NextResponse.json({ received: true });
}
