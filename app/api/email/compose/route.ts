import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendComposedEmail } from '@/lib/email';
import { sanitizeEmailHtml, htmlToPlainText } from '@/lib/email/sanitize';
import { uploadInlineImagesInHtml, InlineImageError } from '@/lib/email/inline-images';
import {
  buildSendFrom,
  listSiteInboxAddresses,
  resolvePrimaryAddress,
} from '@/lib/email/inbox-addresses';
import { buildMessageId } from '@/lib/email/threading';
import { scanText } from '@/lib/moderation/text-scan';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseAddressList(input: unknown): string[] {
  if (!input) return [];
  const raw = Array.isArray(input)
    ? input
    : String(input).split(/[,;]/);
  return raw
    .map(s => String(s).trim())
    .filter(Boolean)
    .filter(s => EMAIL_REGEX.test(s));
}

/**
 * POST /api/email/compose
 *
 * Start a new email thread from the admin email client.
 * Body:
 *   siteId:     string
 *   addressId?: string   (defaults to site primary)
 *   to:         string[] | string
 *   cc?:        string[] | string
 *   bcc?:       string[] | string
 *   subject:    string
 *   bodyHtml:   string   (rich text from TipTap; may contain data: URIs)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { siteId, addressId, subject } = body;
  const to = parseAddressList(body.to);
  const cc = parseAddressList(body.cc);
  const bcc = parseAddressList(body.bcc);
  const bodyHtml: string = String(body.bodyHtml ?? '');

  if (!siteId) return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
  if (to.length === 0) return NextResponse.json({ error: 'At least one valid To address is required' }, { status: 400 });
  if (!subject || !subject.trim()) return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
  if (!bodyHtml.trim()) return NextResponse.json({ error: 'Message body is required' }, { status: 400 });

  // Verify ownership
  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, site_slug')
    .eq('id', siteId)
    .single();
  if (!site || site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  const addresses = await listSiteInboxAddresses(db, siteId);
  if (addresses.length === 0) {
    return NextResponse.json({ error: 'This site has no configured inbox addresses' }, { status: 400 });
  }
  const address = (addressId && addresses.find(a => a.id === addressId)) || resolvePrimaryAddress(addresses);
  if (!address) return NextResponse.json({ error: 'No usable inbox address' }, { status: 400 });

  const businessName = site.site_slug || 'Our Business';
  const { from, replyTo } = buildSendFrom(address, businessName);

  // Process inline images first, then sanitize
  let processedHtml = bodyHtml;
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
  const plainText = htmlToPlainText(processedHtml);

  // Run text moderation on subject + plain body
  try {
    const scan = await scanText(`${subject}\n\n${plainText}`);
    if (scan.flagged) {
      return NextResponse.json({ error: 'Message blocked by content policy' }, { status: 422 });
    }
  } catch (err) {
    console.warn('[email/compose] text scan failed (non-fatal):', err);
  }

  // Allocate row id + Message-ID up front
  const newRowId = crypto.randomUUID();
  const messageIdHeader = buildMessageId(newRowId);

  const result = await sendComposedEmail({
    from,
    replyTo,
    to,
    cc,
    bcc,
    subject: subject.trim(),
    html: processedHtml,
    plainText,
    headers: { 'Message-ID': messageIdHeader },
  });

  if (!result.success) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  // Persist as a new outbound row that starts its own thread
  const insertRow = {
    id: newRowId,
    thread_id: newRowId,
    site_id: siteId,
    direction: 'outbound' as const,
    sender_name: businessName,
    sender_email: address.address,
    message: plainText,
    body_html: processedHtml,
    subject: subject.trim(),
    status: 'replied',
    source_type: 'compose' as const,
    inbox_address_id: address.id,
    from_email: address.address,
    from_name: businessName,
    to_emails: to,
    cc_emails: cc,
    bcc_emails: bcc,
    message_id_header: messageIdHeader,
    is_read: true,
    reply_resend_id: result.messageId,
  };

  const { error: insertErr } = await db.from('contact_submissions').insert(insertRow);
  if (insertErr) {
    console.error('[email/compose] Failed to persist sent message:', insertErr);
    // Email already went out; return success but flag the persistence error
    return NextResponse.json({ success: true, persisted: false });
  }

  return NextResponse.json({ success: true, threadId: newRowId });
}
