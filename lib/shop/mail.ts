/**
 * Customer and owner emails for the Shop tab. Sent from the site's inbox
 * address (same From/Reply-To rules as the Email tab) and saved to
 * contact_submissions so replies thread into the Email tab.
 */

import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resend } from '@/lib/email/resend';
import { buildSendFrom, listSiteInboxAddresses, resolvePrimaryAddress } from '@/lib/email/inbox-addresses';
import { buildMessageId } from '@/lib/email/threading';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export interface ShopEmail {
  to: string;
  subject: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  attachments?: { filename: string; content: Buffer }[];
  shopName: string;
  logoUrl?: string | null;
}

function renderHtml(m: ShopEmail): string {
  const logo = m.logoUrl
    ? `<img src="${esc(m.logoUrl)}" alt="" style="max-height:56px;max-width:200px;object-fit:contain;display:block;margin:0 auto 12px;" />`
    : '';
  const paras = m.paragraphs.map(p => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1f2937;">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const button = m.button
    ? `<p style="margin:22px 0;text-align:center;"><a href="${esc(m.button.url)}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;">${esc(m.button.label)}</a></p><p style="margin:0 0 14px;font-size:12px;color:#6b7280;text-align:center;word-break:break-all;">${esc(m.button.url)}</p>`
    : '';
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px 8px;">
    <div style="text-align:center;padding-bottom:8px;">${logo}<h1 style="margin:0;font-size:21px;color:#111827;">${esc(m.heading)}</h1><p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${esc(m.shopName)}</p></div>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:22px 22px 8px;margin-top:16px;">${paras}${button}</div>
    <p style="margin-top:14px;font-size:12px;color:#9ca3af;text-align:center;">Reply to this email to reach ${esc(m.shopName)}.</p>
  </div>`;
}

export async function sendShopEmail(db: SupabaseClient, siteId: string, m: ShopEmail): Promise<{ ok: boolean; error?: string }> {
  const addresses = await listSiteInboxAddresses(db, siteId);
  const address = resolvePrimaryAddress(addresses);
  const { from, replyTo } = buildSendFrom(address, m.shopName);
  const rowId = randomUUID();
  const messageId = buildMessageId(rowId);
  const text = [m.heading, '', ...m.paragraphs, m.button ? `${m.button.label}: ${m.button.url}` : ''].join('\n\n');
  try {
    const { data, error } = await resend.emails.send({
      from,
      to: m.to,
      replyTo,
      subject: m.subject,
      html: renderHtml(m),
      text,
      headers: { 'Message-ID': messageId },
      attachments: m.attachments?.map(a => ({ filename: a.filename, content: a.content })),
    });
    if (error) {
      console.error('[shop/mail] Resend error:', error);
      return { ok: false, error: 'The email didn’t send. Check the address and try again.' };
    }
    if (address) {
      const { error: insertErr } = await db.from('contact_submissions').insert({
        id: rowId,
        thread_id: rowId,
        site_id: siteId,
        direction: 'outbound',
        sender_name: m.shopName,
        sender_email: address.address,
        message: text,
        body_html: renderHtml(m),
        subject: m.subject,
        status: 'replied',
        source_type: 'compose',
        inbox_address_id: address.id,
        from_email: address.address,
        from_name: m.shopName,
        to_emails: [m.to],
        cc_emails: [],
        bcc_emails: [],
        message_id_header: messageId,
        is_read: true,
        reply_resend_id: data?.id ?? null,
      });
      if (insertErr) console.error('[shop/mail] could not save sent email to the inbox:', insertErr.message);
    }
    return { ok: true };
  } catch (err) {
    console.error('[shop/mail] send failed:', err);
    return { ok: false, error: 'The email didn’t send. Try again.' };
  }
}

/** Plain notification to the shop owner (not saved to the inbox). */
export async function notifyOwner(to: string | null | undefined, shopName: string, subject: string, paragraphs: string[], button?: { label: string; url: string }) {
  if (!to) return;
  try {
    await resend.emails.send({
      from: `Keystone Shop <contact@keystoneweb.ca>`,
      to,
      subject,
      html: renderHtml({ to, subject, heading: subject, paragraphs, button, shopName }),
      text: [subject, ...paragraphs, button ? button.url : ''].join('\n\n'),
    });
  } catch (err) {
    console.error('[shop/mail] owner notification failed:', err);
  }
}
