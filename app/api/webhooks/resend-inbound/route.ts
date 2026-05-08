import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendSupportRequestNotification, sendContactFormNotification } from '@/lib/email';
import { triageContactSubmission, isSpamInboundEmail } from '@/lib/contact/triage';
import { extractRowIdFromMessageId, normalizeMessageId, parseReferencesHeader, parseOwnerReplyAddress, buildMessageId, buildReferencesHeader } from '@/lib/email/threading';
import { stripQuotedText, stripQuotedHtml } from '@/lib/email/quoted-text';
import { sendComposedEmail } from '@/lib/email';
import { sanitizeEmailHtml } from '@/lib/email/sanitize';
import { buildSendFrom, listSiteInboxAddresses, resolvePrimaryAddress } from '@/lib/email/inbox-addresses';
import { getOpsAdminEmailList } from '@/lib/ops/access';

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
  const inReplyToHeader: string | null = normalizeMessageId(emailData?.in_reply_to ?? null);
  const referencesHeader: string | null = emailData?.references ?? null;
  const referencesIds: string[] = parseReferencesHeader(referencesHeader);

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
  // Owner reply-by-email
  // Notification emails sent to the site owner have Reply-To set to
  //   reply+<threadId>@kswd.ca
  // When the owner hits Reply in their normal email client, we receive it
  // here, validate the sender owns the site, strip quoted text, and forward
  // their response to the customer as an outbound message in the thread.
  // --------------------------------------------------------------------------
  const ownerReplyTargets = normalisedRecipients
    .map(addr => ({ addr, threadId: parseOwnerReplyAddress(addr) }))
    .filter((x): x is { addr: string; threadId: string } => x.threadId !== null);

  if (ownerReplyTargets.length > 0) {
    const { bodyText, bodyHtml } = await fetchResendEmailBody(emailId);
    for (const { threadId } of ownerReplyTargets) {
      try {
        await handleOwnerReplyByEmail(threadId, bodyText, bodyHtml);
      } catch (err) {
        console.error('[resend-inbound] owner-reply route failed:', err);
      }
    }
    // Owner-reply addresses live on @kswd.ca but should never also match a
    // site inbox; nothing more to do for these recipients.
    if (!hasOpsRecipient) {
      return NextResponse.json({ received: true, ownerReplies: ownerReplyTargets.length });
    }
  }

  /**
   * Forward an owner's email-client reply to the customer in the matching
   * thread. The sender is validated against the site owner's notification
   * email or auth email so a third party can't spoof a reply just by
   * knowing the threadId.
   */
  async function handleOwnerReplyByEmail(
    threadId: string,
    bodyText: string | null,
    bodyHtml: string | null,
  ) {
    // 1. Look up the thread + its parent inbound message
    const { data: parent } = await admin
      .from('contact_submissions')
      .select('*')
      .eq('thread_id', threadId)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!parent) {
      console.warn(`[resend-inbound] owner-reply: no parent inbound message for thread ${threadId}`);
      return;
    }

    // 2. Fetch the site so we can validate ownership and pick a sender address
    const { data: site } = await admin
      .from('sites')
      .select('id, user_id, site_slug')
      .eq('id', parent.site_id)
      .single();
    if (!site) return;

    // 3. Validate the From email matches the owner's notification target
    //    (booking_settings.notification_email OR auth user email).
    const { data: settings } = await admin
      .from('booking_settings')
      .select('notification_email')
      .eq('site_id', site.id)
      .maybeSingle();

    let ownerEmail = settings?.notification_email?.toLowerCase() ?? null;
    if (!ownerEmail) {
      const { data: authUser } = await admin.auth.admin.getUserById(site.user_id);
      ownerEmail = authUser?.user?.email?.toLowerCase() ?? null;
    }

    if (!ownerEmail || ownerEmail !== fromEmail.toLowerCase()) {
      console.warn(`[resend-inbound] owner-reply: sender ${fromEmail} doesn't match site ${site.id} owner ${ownerEmail}`);
      return;
    }

    // 4. Strip quoted text so the customer doesn't get their own message
    //    echoed back. Falls back to the full body if nothing was stripped.
    const cleanText = stripQuotedText(bodyText);
    const cleanHtml = bodyHtml
      ? sanitizeEmailHtml(stripQuotedHtml(bodyHtml))
      : `<p>${(cleanText || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`;
    const finalText = cleanText || (bodyText ?? '').trim();

    if (!finalText && !bodyHtml) {
      console.warn('[resend-inbound] owner-reply: empty body, skipping');
      return;
    }

    // 5. Pick the sender address — same logic as the in-app reply flow.
    const addresses = await listSiteInboxAddresses(admin, site.id);
    const address = parent.inbox_address_id
      ? addresses.find(a => a.id === parent.inbox_address_id) ?? resolvePrimaryAddress(addresses)
      : resolvePrimaryAddress(addresses);
    const businessName = site.site_slug || 'Our Business';
    const { from, replyTo } = buildSendFrom(address ?? null, businessName);

    // 6. Build threading headers + send
    const parentMessageId = normalizeMessageId(parent.message_id_header);
    const referencesHeader = buildReferencesHeader(parent.references_header, parentMessageId);
    const subject = parent.subject
      ? (parent.subject.match(/^re:/i) ? parent.subject : `Re: ${parent.subject}`)
      : `Re: Your message to ${businessName}`;

    const newRowId = crypto.randomUUID();
    const ourMessageId = buildMessageId(newRowId);
    const headers: Record<string, string> = { 'Message-ID': ourMessageId };
    if (parentMessageId) headers['In-Reply-To'] = parentMessageId;
    if (referencesHeader) headers['References'] = referencesHeader;

    const result = await sendComposedEmail({
      from,
      replyTo,
      to: [parent.sender_email],
      subject,
      html: cleanHtml,
      plainText: finalText,
      headers,
    });

    if (!result.success) {
      console.error('[resend-inbound] owner-reply: failed to send to customer:', result.error);
      return;
    }

    // 7. Persist the outbound row + mark the parent as replied
    await admin.from('contact_submissions').insert({
      id: newRowId,
      site_id: site.id,
      thread_id: threadId,
      direction: 'outbound',
      sender_name: businessName,
      sender_email: address?.address ?? 'contact@keystoneweb.ca',
      message: finalText,
      body_html: cleanHtml,
      subject,
      status: 'replied',
      source_type: 'reply',
      inbox_address_id: address?.id ?? null,
      from_email: address?.address ?? 'contact@keystoneweb.ca',
      from_name: businessName,
      to_emails: [parent.sender_email],
      cc_emails: [],
      bcc_emails: [],
      message_id_header: ourMessageId,
      in_reply_to: parentMessageId,
      references_header: referencesHeader,
      is_read: true,
      reply_resend_id: result.messageId,
    });

    await admin.from('contact_submissions').update({
      status: 'replied',
      admin_reply: finalText,
      admin_reply_at: new Date().toISOString(),
      reply_resend_id: result.messageId,
      is_read: true,
    }).eq('id', parent.id);

    console.log(`[resend-inbound] owner-reply forwarded to ${parent.sender_email} for thread ${threadId}`);
  }

  // --------------------------------------------------------------------------
  // Thread detection: try to find an existing thread this inbound message
  // belongs to. Order:
  //   1) In-Reply-To matches a known message_id_header
  //   2) Any References ID matches a known message_id_header
  //   3) Our deterministic <uuid@mail.keystoneweb.ca> id encodes the row id
  // --------------------------------------------------------------------------
  async function detectExistingThread(siteId: string): Promise<string | null> {
    const candidateHeaders = [inReplyToHeader, ...referencesIds].filter(Boolean) as string[];

    if (candidateHeaders.length > 0) {
      const { data: priorByMessageId } = await admin
        .from('contact_submissions')
        .select('thread_id')
        .eq('site_id', siteId)
        .in('message_id_header', candidateHeaders)
        .limit(1)
        .maybeSingle();
      if (priorByMessageId?.thread_id) return priorByMessageId.thread_id as string;

      // Fall back to Resend's own message id (we record it as reply_resend_id)
      const bareIds = candidateHeaders.map(h => h.replace(/^<|>$/g, ''));
      const { data: priorByResendId } = await admin
        .from('contact_submissions')
        .select('thread_id')
        .eq('site_id', siteId)
        .in('reply_resend_id', bareIds)
        .limit(1)
        .maybeSingle();
      if (priorByResendId?.thread_id) return priorByResendId.thread_id as string;

      // Decode our own deterministic Message-IDs as a fallback. Scope by site
      // so a forged/forwarded header can never resurrect a thread from a
      // different customer's inbox.
      for (const header of candidateHeaders) {
        const rowId = extractRowIdFromMessageId(header);
        if (!rowId) continue;
        const { data: row } = await admin
          .from('contact_submissions')
          .select('thread_id')
          .eq('id', rowId)
          .eq('site_id', siteId)
          .maybeSingle();
        if (row?.thread_id) return row.thread_id as string;
      }
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // Helper: route one email to a site's contact_submissions inbox
  // --------------------------------------------------------------------------
  async function routeEmailToSiteInbox(
    site: { id: string; user_id: string; site_slug: string | null; contact_ai_replies_enabled: boolean },
    recipientLabel: string,
    messageBody: string | null,
    inboxAddressId: string | null,
    bodyHtml: string | null,
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

    // Resolve the thread this message belongs to (or start a new one)
    const existingThreadId = await detectExistingThread(site.id);

    // Insert into contact_submissions as an inbound message
    const { data: submission, error: insertErr } = await admin
      .from('contact_submissions')
      .insert({
        site_id: site.id,
        sender_name: fromName || fromEmail,
        sender_email: fromEmail,
        sender_phone: null,
        message: messageBody || `[Email] ${subject}`,
        status: existingThreadId ? 'new' : 'new',
        direction: 'inbound',
        subject,
        body_html: bodyHtml,
        from_email: fromEmail,
        from_name: fromName,
        to_emails: [recipientLabel],
        message_id_header: normalizeMessageId(messageId),
        in_reply_to: inReplyToHeader,
        references_header: referencesHeader,
        inbox_address_id: inboxAddressId,
        source_type: 'inbound_email',
        is_read: false,
      })
      .select('id, thread_id')
      .single();

    if (insertErr || !submission) {
      console.error(`[resend-inbound] Failed to store contact submission for ${recipientLabel}:`, insertErr);
      return;
    }

    // If we detected an existing thread, point the new row at it
    if (existingThreadId && submission.thread_id !== existingThreadId) {
      await admin
        .from('contact_submissions')
        .update({ thread_id: existingThreadId })
        .eq('id', submission.id);
    }

    const threadId = existingThreadId ?? submission.thread_id ?? submission.id;

    console.log(`[resend-inbound] Email from ${fromEmail} routed to site ${recipientLabel} inbox (${submission.id})${existingThreadId ? ` thread=${existingThreadId}` : ''}`);

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
            submissionId: threadId,  // deep link target — the thread, not the row
            siteId: site.id,
            inboxAddressId,
            previewBody: messageBody,
            subject,
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
    const { bodyText, bodyHtml } = await fetchResendEmailBody(emailId);
    const messageBody = bodyText || (bodyHtml ? bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null);

    // Look up every site recipient in site_inbox_addresses in one round trip
    const siteRecipientAddresses = normalisedRecipients.filter(
      addr => !addr.endsWith('@keystoneweb.ca')
    );

    if (siteRecipientAddresses.length > 0) {
      const { data: addressRows } = await admin
        .from('site_inbox_addresses')
        .select('id, address, kind, site_id, sites:sites!inner(id, user_id, site_slug, contact_ai_replies_enabled)')
        .in('address', siteRecipientAddresses);

      type AddressRow = {
        id: string;
        address: string;
        kind: string;
        site_id: string;
        sites: { id: string; user_id: string; site_slug: string | null; contact_ai_replies_enabled: boolean } | null;
      };
      const matchedAddresses = new Set<string>();
      for (const row of (addressRows ?? []) as unknown as AddressRow[]) {
        const site = row.sites;
        if (!site) continue;
        matchedAddresses.add(row.address.toLowerCase());
        await routeEmailToSiteInbox(
          site,
          row.address,
          messageBody,
          row.id,
          bodyHtml,
        );
      }

      // Fallback: legacy kswd subdomains that haven't been backfilled yet —
      // look up the site by published_domain and lazily create the address row.
      const unmatchedKswd = siteRecipientAddresses
        .filter(a => a.endsWith('@kswd.ca') && !matchedAddresses.has(a))
        .map(a => a.replace(/@kswd\.ca$/, ''));

      for (const localPart of unmatchedKswd) {
        const { data: site } = await admin
          .from('sites')
          .select('id, user_id, site_slug, contact_ai_replies_enabled')
          .eq('published_domain', localPart)
          .eq('is_published', true)
          .maybeSingle();

        if (!site) continue;

        const fullAddress = `${localPart}@kswd.ca`;
        const { data: created } = await admin
          .from('site_inbox_addresses')
          .insert({ site_id: site.id, address: fullAddress, kind: 'kswd_subdomain', is_primary: true })
          .select('id')
          .single();

        await routeEmailToSiteInbox(site, fullAddress, messageBody, created?.id ?? null, bodyHtml);
      }
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
    const adminEmails = await getOpsAdminEmailList();

    const bodyPreview = opsBodyText ? opsBodyText.slice(0, 300) : null;
    await sendSupportRequestNotification({ fromName, fromEmail, subject, bodyPreview }, adminEmails);
  }

  return NextResponse.json({ received: true });
}
