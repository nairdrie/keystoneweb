import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendSupportRequestNotification } from '@/lib/email';

/**
 * POST /api/webhooks/resend-inbound
 *
 * Receives inbound emails forwarded by Resend when a message arrives at
 * support@keystoneweb.ca.
 *
 * Setup in Resend dashboard:
 *   Inbound → your domain → Webhook URL → this endpoint
 *   Copy the signing secret (starts with whsec_) → RESEND_INBOUND_SECRET env var
 *
 * Resend signs webhooks using Svix (svix-id / svix-timestamp / svix-signature
 * headers). The SDK's webhooks.verify() handles all of that automatically.
 *
 * Payload shape (email.received) — body is NOT included, metadata only:
 * {
 *   "type": "email.received",
 *   "created_at": "...",
 *   "data": {
 *     "email_id": "56761188-...",
 *     "from": "User Name <user@example.com>",
 *     "to": ["support@keystoneweb.ca"],
 *     "subject": "...",
 *     "message_id": "<unique-id@mail.example.com>"
 *   }
 * }
 * Body (text/html) must be fetched separately:
 *   GET https://api.resend.com/emails/receiving/{email_id}
 * Resend may not have the body ready immediately when the webhook fires,
 * so we retry with delays.
 */
export async function POST(request: NextRequest) {
  const signingSecret = process.env.RESEND_INBOUND_SECRET;

  if (!signingSecret) {
    console.error('[resend-inbound] RESEND_INBOUND_SECRET is not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  // Must read the raw body before any parsing for signature verification
  const rawBody = await request.text();

  // Verify the Svix signature
  const wh = new Webhook(signingSecret);
  let payload: any;
  try {
    payload = wh.verify(rawBody, {
      'svix-id': request.headers.get('svix-id') ?? '',
      'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
      'svix-signature': request.headers.get('svix-signature') ?? '',
    });
  } catch (err) {
    console.warn('[resend-inbound] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (payload?.type !== 'email.received') {
    // Not an inbound email event — acknowledge and ignore
    return NextResponse.json({ received: true });
  }

  const emailData = payload.data;
  const emailId: string = emailData?.email_id ?? '';
  const fromRaw: string = emailData?.from ?? '';
  const subject: string = emailData?.subject ?? '(no subject)';
  const messageId: string = emailData?.message_id ?? '';

  // Parse "Name <email>" or plain email address
  const emailMatch = fromRaw.match(/<([^>]+)>/);
  const fromEmail = emailMatch ? emailMatch[1] : fromRaw.trim();
  const nameMatch = fromRaw.match(/^([^<]+)\s*</);
  const fromName = nameMatch ? nameMatch[1].trim() : null;

  if (!fromEmail) {
    console.error('[resend-inbound] Could not parse from address:', fromRaw);
    return NextResponse.json({ error: 'Missing from email' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Deduplicate by Resend email_id (most reliable unique key)
  const dedupKey = emailId || messageId;
  if (dedupKey) {
    const { data: existing } = await admin
      .from('support_requests')
      .select('id')
      .eq('resend_email_id', dedupKey)
      .maybeSingle();

    if (existing) {
      console.log(`[resend-inbound] Duplicate ${dedupKey}, skipping`);
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  // Fetch body via Received Emails API.
  // Resend fires the webhook before the body is always ready, so retry a few
  // times with short delays to give it time to process.
  let bodyText: string | null = null;
  let bodyHtml: string | null = null;

  if (emailId && process.env.RESEND_API_KEY) {
    const delays = [0, 2000, 5000]; // immediate, 2s, 5s
    for (const delay of delays) {
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
      try {
        const emailRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        });
        if (emailRes.ok) {
          const full = await emailRes.json();
          bodyText = full.text ?? null;
          bodyHtml = full.html ?? null;
          if (bodyText || bodyHtml) break; // got the body, stop retrying
          console.warn(`[resend-inbound] Body empty on attempt (delay=${delay}ms), retrying…`);
        } else {
          console.warn('[resend-inbound] Received Emails API returned', emailRes.status, 'for', emailId);
          break; // non-200 won't improve with retries
        }
      } catch (err) {
        console.warn('[resend-inbound] Failed to fetch email body:', err);
        break;
      }
    }
  }

  const { error } = await admin.from('support_requests').insert({
    from_email: fromEmail,
    from_name: fromName,
    subject,
    body_text: bodyText,
    body_html: bodyHtml,
    resend_email_id: dedupKey || null,
    status: 'open',
    priority: 'normal',
  });

  if (error) {
    console.error('[resend-inbound] Failed to store support request:', error);
    return NextResponse.json({ error: 'Storage failed' }, { status: 500 });
  }

  console.log(`[resend-inbound] New support request from ${fromEmail}: ${subject}`);

  // Notify ops admins
  const adminEmails = (process.env.OPS_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  const bodyPreview = bodyText ? bodyText.slice(0, 300) : null;
  await sendSupportRequestNotification({ fromName, fromEmail, subject, bodyPreview }, adminEmails);

  return NextResponse.json({ received: true });
}
