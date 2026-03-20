import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { Resend } from 'resend';
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

  // Skip emails from our own ops addresses (e.g. BCC'd replies)
  if (fromEmail.toLowerCase().endsWith('@keystoneweb.ca')) {
    console.log(`[resend-inbound] Skipping ops self-email from ${fromEmail}`);
    return NextResponse.json({ received: true, skipped: 'ops_sender' });
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

  // Fetch body via Resend SDK.
  // Resend fires the webhook before the body is always ready, so retry a few
  // times with short delays to give it time to process.
  let bodyText: string | null = null;
  let bodyHtml: string | null = null;
  const log: string[] = [];

  const apiKey = process.env.RESEND_API_KEY;
  if (!emailId) {
    log.push('[WARN] No email_id in webhook payload — cannot fetch body.');
  } else if (!apiKey) {
    log.push('[WARN] RESEND_API_KEY env var is not set — cannot fetch body.');
  } else {
    const resend = new Resend(apiKey);
    const delays = [0, 2000, 5000]; // immediate, 2s, 5s
    for (const delay of delays) {
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
      const attemptLabel = `attempt delay=${delay}ms`;
      try {
        log.push(`[${attemptLabel}] Calling resend.emails.receiving.get("${emailId}")…`);
        const { data: fullEmail, error: resendErr } = await resend.emails.receiving.get(emailId);

        if (resendErr) {
          log.push(`[${attemptLabel}] SDK error: ${JSON.stringify(resendErr)}`);
          break; // SDK-level error won't improve with retries
        }

        if (!fullEmail) {
          log.push(`[${attemptLabel}] SDK returned null data, no error.`);
          continue;
        }

        // Log all top-level keys so we can see what Resend actually returns
        const keys = Object.keys(fullEmail);
        log.push(`[${attemptLabel}] Response keys: [${keys.join(', ')}]`);

        const text = (fullEmail as any).text ?? null;
        const html = (fullEmail as any).html ?? null;
        log.push(`[${attemptLabel}] text=${text ? `${text.length}chars` : 'null'}, html=${html ? `${html.length}chars` : 'null'}`);

        if (text || html) {
          bodyText = text;
          bodyHtml = html;
          log.push(`[OK] Body fetched successfully.`);
          break;
        }
        log.push(`[${attemptLabel}] Body still empty, will retry…`);
      } catch (err: any) {
        log.push(`[${attemptLabel}] Exception: ${err?.message ?? String(err)}`);
        break;
      }
    }
  }

  // If body is still empty, store the diagnostic log as body_text so ops can see
  // what happened directly in the support ticket.
  if (!bodyText && !bodyHtml && log.length > 0) {
    bodyText = `[WEBHOOK DEBUG — body fetch failed]\n\n${log.join('\n')}\n\nWebhook payload.data keys: [${Object.keys(emailData ?? {}).join(', ')}]\nemail_id: ${emailId}\nfrom: ${fromRaw}\nsubject: ${subject}`;
  }

  // Thread detection: scan body for ref:UUID token from ops replies
  let threadId: string | null = null;
  const refMatch = (bodyText ?? '').match(/ref:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
    ?? (bodyHtml ?? '').match(/ref:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (refMatch) {
    const candidateId = refMatch[1];
    // Verify the referenced ticket exists
    const { data: rootTicket } = await admin
      .from('support_requests')
      .select('id, thread_id')
      .eq('id', candidateId)
      .maybeSingle();
    if (rootTicket) {
      // Point to the root of the chain (if the ref is itself a reply, follow to root)
      threadId = rootTicket.thread_id ?? rootTicket.id;
    }
  }

  const { error } = await admin.from('support_requests').insert({
    from_email: fromEmail,
    from_name: fromName,
    subject,
    body_text: bodyText,
    body_html: bodyHtml,
    resend_email_id: dedupKey || null,
    thread_id: threadId,
    status: threadId ? 'in_progress' : 'open',
    priority: 'normal',
  });

  if (error) {
    console.error('[resend-inbound] Failed to store support request:', error);
    return NextResponse.json({ error: 'Storage failed' }, { status: 500 });
  }

  console.log(`[resend-inbound] New support request from ${fromEmail}: ${subject}`, log.join(' | '));

  // Notify ops admins
  const adminEmails = (process.env.OPS_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  const bodyPreview = bodyText ? bodyText.slice(0, 300) : null;
  await sendSupportRequestNotification({ fromName, fromEmail, subject, bodyPreview }, adminEmails);

  return NextResponse.json({ received: true });
}
