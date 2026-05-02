import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { sendComposedEmail } from '@/lib/email';
import {
  buildMessageId,
  buildReferencesHeader,
  normalizeMessageId,
} from '@/lib/email/threading';
import {
  buildSendFrom,
  listSiteInboxAddresses,
  resolvePrimaryAddress,
  type SiteInboxAddress,
} from '@/lib/email/inbox-addresses';
import { sanitizeEmailHtml, htmlToPlainText } from '@/lib/email/sanitize';
import { uploadInlineImagesInHtml, InlineImageError } from '@/lib/email/inline-images';
import { scanText } from '@/lib/moderation/text-scan';

/**
 * POST /api/contact/[id]/reply
 *
 * Sends a manual reply from the site owner inside an existing thread.
 * Auth: must own the site the submission belongs to.
 *
 * Body:
 *   replyText:   string         (legacy plain-text fallback)
 *   replyHtml?:  string         (rich HTML — preferred)
 *   siteId:      string
 *   addressId?:  string         (which inbox address to send From; defaults to thread's address or site primary)
 *   ccEmails?:   string[]
 *   bccEmails?:  string[]
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { replyText, replyHtml, siteId, addressId, ccEmails = [], bccEmails = [] } = body as {
    replyText?: string;
    replyHtml?: string;
    siteId?: string;
    addressId?: string;
    ccEmails?: string[];
    bccEmails?: string[];
  };

  if (!siteId) return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
  if (!replyText?.trim() && !replyHtml?.trim()) {
    return NextResponse.json({ error: 'reply body is required' }, { status: 400 });
  }

  const { data: site } = await supabase
    .from('sites')
    .select('site_slug, user_id, published_domain')
    .eq('id', siteId)
    .single();
  if (!site || site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();

  const { data: parent, error: fetchErr } = await db
    .from('contact_submissions')
    .select('*')
    .eq('id', id)
    .eq('site_id', siteId)
    .single();
  if (fetchErr || !parent) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  // Resolve the From address — explicit addressId, then thread's address, then primary.
  const addresses = await listSiteInboxAddresses(db, siteId);
  let address: SiteInboxAddress | null = null;
  if (addressId) address = addresses.find(a => a.id === addressId) ?? null;
  if (!address && parent.inbox_address_id) address = addresses.find(a => a.id === parent.inbox_address_id) ?? null;
  if (!address) address = resolvePrimaryAddress(addresses);

  const businessName = site.site_slug || 'Our Business';
  const { from, replyTo } = buildSendFrom(address, businessName);

  // Process inline images (if any) — uploads pasted data: URIs, returns sanitized HTML
  let processedHtml = replyHtml ?? '';
  if (processedHtml) {
    try {
      processedHtml = await uploadInlineImagesInHtml(processedHtml, {
        siteId,
        userId: user.id,
        supabase,
      });
    } catch (err) {
      if (err instanceof InlineImageError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
    processedHtml = sanitizeEmailHtml(processedHtml);
  }

  const finalText = replyText?.trim() || htmlToPlainText(processedHtml);
  const finalHtml = processedHtml || `<p>${(replyText ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`;

  // Run text moderation on the reply body — same policy as Compose.
  try {
    const scan = await scanText(finalText);
    if (scan.flagged) {
      return NextResponse.json({ error: 'Reply blocked by content policy' }, { status: 422 });
    }
  } catch (err) {
    console.warn('[contact/reply] text scan failed (non-fatal):', err);
  }

  // Build threading headers
  const parentMessageId = normalizeMessageId(parent.message_id_header);
  const referencesHeader = buildReferencesHeader(parent.references_header, parentMessageId);
  const subject = parent.subject
    ? (parent.subject.match(/^re:/i) ? parent.subject : `Re: ${parent.subject}`)
    : `Re: Your message to ${businessName}`;

  // Pre-allocate a row id so we can use it as our deterministic Message-ID
  const newRowId = crypto.randomUUID();
  const ourMessageId = buildMessageId(newRowId);

  const headers: Record<string, string> = { 'Message-ID': ourMessageId };
  if (parentMessageId) headers['In-Reply-To'] = parentMessageId;
  if (referencesHeader) headers['References'] = referencesHeader;

  const result = await sendComposedEmail({
    from,
    replyTo,
    to: [parent.sender_email],
    cc: ccEmails,
    bcc: bccEmails,
    subject,
    html: finalHtml,
    plainText: finalText,
    headers,
  });

  if (!result.success) {
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 });
  }

  // Insert the outbound message row. The email already went out at this point;
  // a persistence failure means the customer received it but it won't show up
  // in our Sent folder. We log loudly and surface a 502 so the UI can retry.
  const { error: insertErr } = await db.from('contact_submissions').insert({
    id: newRowId,
    site_id: siteId,
    thread_id: parent.thread_id,
    direction: 'outbound',
    sender_name: businessName,
    sender_email: address?.address ?? 'contact@keystoneweb.ca',
    message: finalText,
    body_html: finalHtml,
    subject,
    status: 'replied',
    source_type: 'reply',
    inbox_address_id: address?.id ?? null,
    from_email: address?.address ?? 'contact@keystoneweb.ca',
    from_name: businessName,
    to_emails: [parent.sender_email],
    cc_emails: ccEmails,
    bcc_emails: bccEmails,
    message_id_header: ourMessageId,
    in_reply_to: parentMessageId,
    references_header: referencesHeader,
    is_read: true,
    reply_resend_id: result.messageId,
  });

  if (insertErr) {
    console.error('[contact/reply] Email sent but persistence failed:', {
      threadId: parent.thread_id,
      resendId: result.messageId,
      error: insertErr,
    });
    // Still mark the parent as replied so the inbox UI doesn't keep prompting
    await db.from('contact_submissions').update({
      status: 'replied',
      admin_reply: finalText,
      admin_reply_at: new Date().toISOString(),
      reply_resend_id: result.messageId,
      is_read: true,
    }).eq('id', parent.id);
    return NextResponse.json(
      { success: true, persisted: false, warning: 'Email sent but failed to record in Sent folder.' },
      { status: 207 }
    );
  }

  // Mark just the message we replied to as replied. (Older inbound messages
  // in the same thread keep their original admin_reply text — replying once
  // shouldn't rewrite history on every inbound row.)
  await db.from('contact_submissions').update({
    status: 'replied',
    admin_reply: finalText,
    admin_reply_at: new Date().toISOString(),
    reply_resend_id: result.messageId,
    is_read: true,
  }).eq('id', parent.id);

  return NextResponse.json({ success: true });
}
