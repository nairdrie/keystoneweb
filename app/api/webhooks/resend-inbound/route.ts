import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendSupportRequestNotification, sendContactFormNotification } from '@/lib/email';
import { triageContactSubmission, isSpamInboundEmail } from '@/lib/contact/triage';

/**
 * POST /api/webhooks/resend-inbound
 *
 * Receives inbound emails forwarded by Resend.
 *
 * Routing:
 *   - Emails to *@keystoneweb.ca → ops support_requests table (existing)
 *   - Emails to {subdomain}@kswd.ca → customer contact_submissions inbox (Pro only)
 *
 * Setup in Resend dashboard:
 *   Inbound → your domain → Webhook URL → this endpoint
 *   Copy the signing secret (starts with whsec_) → RESEND_INBOUND_SECRET env var
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

// ---------------------------------------------------------------------------
// Shared helper: fetch email body from Resend with retries
// ---------------------------------------------------------------------------
async function fetchResendEmailBody(emailId: string): Promise<{
  bodyText: string | null;
  bodyHtml: string | null;
  log: string[];
}> {
  const log: string[] = [];
  let bodyText: string | null = null;
  let bodyHtml: string | null = null;

  const apiKey = process.env.RESEND_API_KEY;
  if (!emailId) {
    log.push('[WARN] No email_id in webhook payload — cannot fetch body.');
    return { bodyText, bodyHtml, log };
  }
  if (!apiKey) {
    log.push('[WARN] RESEND_API_KEY env var is not set — cannot fetch body.');
    return { bodyText, bodyHtml, log };
  }

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
        break;
      }

      if (!fullEmail) {
        log.push(`[${attemptLabel}] SDK returned null data, no error.`);
        continue;
      }

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

  return { bodyText, bodyHtml, log };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
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
  const toAddresses: string[] = emailData?.to ?? [];

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

  // -------------------------------------------------------------------------
  // Routing: check if any recipient is @kswd.ca (customer site email)
  //          or a custom domain inbox email configured on a site
  // -------------------------------------------------------------------------
  const kswdRecipients = toAddresses
    .map(addr => addr.toLowerCase().trim())
    .filter(addr => addr.endsWith('@kswd.ca'))
    .map(addr => addr.replace(/@kswd\.ca$/, ''));

  // Normalise all recipient addresses for custom-domain lookup
  const normalisedRecipients = toAddresses.map(addr => addr.toLowerCase().trim());

  const hasOpsRecipient = toAddresses.some(
    addr => addr.toLowerCase().trim().endsWith('@keystoneweb.ca')
  );

  // --------------------------------------------------------------------------
  // Helper: route one email to a site's contact_submissions inbox
  // --------------------------------------------------------------------------
  async function routeEmailToSiteInbox(
    site: { id: string; user_id: string; site_slug: string | null; contact_ai_replies_enabled: boolean },
    recipientLabel: string,
    messageBody: string | null,
  ) {
    // Check Pro subscription
    const { data: subscription } = await admin
      .from('user_subscriptions')
      .select('subscription_status, subscription_plan')
      .eq('user_id', site.user_id)
      .maybeSingle();

    const isPro =
      subscription?.subscription_status === 'active' &&
      subscription?.subscription_plan?.toLowerCase().includes('pro');

    if (!isPro) {
      console.log(`[resend-inbound] Site ${recipientLabel} owner is not on Pro plan, discarding email`);
      return;
    }

    // Dedup: check for very recent submission from same sender to same site
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recentDup } = await admin
      .from('contact_submissions')
      .select('id')
      .eq('site_id', site.id)
      .eq('sender_email', fromEmail)
      .gte('created_at', oneMinuteAgo)
      .maybeSingle();

    if (recentDup) {
      console.log(`[resend-inbound] Duplicate email from ${fromEmail} to ${recipientLabel}, skipping`);
      return;
    }

    // Insert into contact_submissions
    const { data: submission, error: insertErr } = await admin
      .from('contact_submissions')
      .insert({
        site_id: site.id,
        sender_name: fromName || fromEmail,
        sender_email: fromEmail,
        sender_phone: null,
        message: messageBody || `[Email] ${subject}`,
        status: 'new',
      })
      .select('id')
      .single();

    if (insertErr || !submission) {
      console.error(`[resend-inbound] Failed to store contact submission for ${recipientLabel}:`, insertErr);
      return;
    }

    console.log(`[resend-inbound] Email from ${fromEmail} routed to site ${recipientLabel} inbox (${submission.id})`);

    // Fire AI triage in the background (non-blocking)
    triageContactSubmission(submission.id, admin).catch(err => {
      console.error('[resend-inbound] Triage error (non-fatal):', err);
    });

    // Notify site owner
    try {
      const { data: settings } = await admin
        .from('booking_settings')
        .select('notification_email')
        .eq('site_id', site.id)
        .maybeSingle();

      let ownerEmail = settings?.notification_email;
      if (!ownerEmail) {
        const { data: authUser } = await admin.auth.admin.getUserById(site.user_id);
        ownerEmail = authUser?.user?.email ?? null;
      }

      if (ownerEmail) {
        const siteName = site.site_slug || recipientLabel;
        await sendContactFormNotification(
          {
            siteName,
            customerName: fromName || fromEmail,
            customerEmail: fromEmail,
            customerPhone: undefined,
            message: messageBody || `[Email] ${subject}`,
            submissionId: submission.id,
            siteId: site.id,
          },
          ownerEmail
        );
      }
    } catch (notifErr) {
      console.error('[resend-inbound] Owner notification error (non-fatal):', notifErr);
    }
  }

  // Handle @kswd.ca site emails AND custom domain inbox emails
  const hasSiteRecipients = kswdRecipients.length > 0 || normalisedRecipients.some(
    addr => !addr.endsWith('@kswd.ca') && !addr.endsWith('@keystoneweb.ca')
  );

  if (hasSiteRecipients) {
    // Fetch body once, reuse for all recipients
    const { bodyText, bodyHtml, log } = await fetchResendEmailBody(emailId);
    const messageBody = bodyText || (bodyHtml ? bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null);

    // -- @kswd.ca routing (existing logic) -----------------------------------
    for (const localPart of kswdRecipients) {
      const { data: site } = await admin
        .from('sites')
        .select('id, user_id, site_slug, contact_ai_replies_enabled')
        .eq('published_domain', localPart)
        .eq('is_published', true)
        .maybeSingle();

      if (!site) {
        console.log(`[resend-inbound] No published site for ${localPart}@kswd.ca, skipping`);
        continue;
      }

      await routeEmailToSiteInbox(site, `${localPart}@kswd.ca`, messageBody);
    }

    // -- Custom domain inbox routing (new) -----------------------------------
    // Find any recipient that has a matching inbox_custom_email on a site
    const customDomainRecipients = normalisedRecipients.filter(
      addr => !addr.endsWith('@kswd.ca') && !addr.endsWith('@keystoneweb.ca')
    );

    for (const recipientAddr of customDomainRecipients) {
      const { data: site } = await admin
        .from('sites')
        .select('id, user_id, site_slug, contact_ai_replies_enabled')
        .eq('inbox_custom_email', recipientAddr)
        .maybeSingle();

      if (!site) {
        console.log(`[resend-inbound] No site configured for custom inbox ${recipientAddr}, skipping`);
        continue;
      }

      await routeEmailToSiteInbox(site, recipientAddr, messageBody);
    }

    // If no ops recipient, we're done
    if (!hasOpsRecipient) {
      return NextResponse.json({ received: true });
    }
  }

  // -------------------------------------------------------------------------
  // Existing ops/support routing for @keystoneweb.ca
  // -------------------------------------------------------------------------
  const isOpsSender = fromEmail.toLowerCase().endsWith('@keystoneweb.ca');
  if (isOpsSender) {
    console.log(`[resend-inbound] Ops self-email detected from ${fromEmail} - will save to DB but skip notification.`);
  }

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

  // Fetch body via Resend SDK
  const { bodyText, bodyHtml, log } = await fetchResendEmailBody(emailId);
  let opsBodyText = bodyText;
  const opsBodyHtml = bodyHtml;

  // If body is still empty, store the diagnostic log as body_text
  if (!opsBodyText && !opsBodyHtml && log.length > 0) {
    opsBodyText = `[WEBHOOK DEBUG — body fetch failed]\n\n${log.join('\n')}\n\nWebhook payload.data keys: [${Object.keys(emailData ?? {}).join(', ')}]\nemail_id: ${emailId}\nfrom: ${fromRaw}\nsubject: ${subject}`;
  }

  // Spam pre-screen: skip notification for obvious spam / gibberish emails
  const isSpam = isSpamInboundEmail(fromName, subject, opsBodyText);
  if (isSpam) {
    // Still store for audit purposes, but mark as spam and skip notification
    await admin.from('support_requests').insert({
      from_email: fromEmail,
      from_name: fromName,
      subject,
      body_text: opsBodyText,
      body_html: opsBodyHtml,
      resend_email_id: dedupKey || null,
      thread_id: null,
      status: 'closed',
      priority: 'low',
      notes: 'Auto-closed: detected as spam/gibberish.',
    });
    console.log(`[resend-inbound] Spam detected from ${fromEmail}, stored but skipping notification`);
    return NextResponse.json({ received: true });
  }

  // Thread detection: scan body for ref:UUID token from ops replies
  let threadId: string | null = null;
  const refMatch = (opsBodyText ?? '').match(/ref:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
    ?? (opsBodyHtml ?? '').match(/ref:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
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
    body_text: opsBodyText,
    body_html: opsBodyHtml,
    resend_email_id: dedupKey || null,
    thread_id: threadId,
    status: threadId ? 'in_progress' : 'open',
    priority: 'normal',
  });

  if (error) {
    console.error('[resend-inbound] Failed to store support request:', error);
    return NextResponse.json({ error: 'Storage failed' }, { status: 500 });
  }

  console.log(`[resend-inbound] New support request stored from ${fromEmail}: ${subject}`);

  // Notify ops admins only if not an ops sender
  if (!isOpsSender) {
    const adminEmails = (process.env.OPS_ADMIN_EMAILS ?? '')
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);

    const bodyPreview = opsBodyText ? opsBodyText.slice(0, 300) : null;
    await sendSupportRequestNotification({ fromName, fromEmail, subject, bodyPreview }, adminEmails);
  }

  return NextResponse.json({ received: true });
}
