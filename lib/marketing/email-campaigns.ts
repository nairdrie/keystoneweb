/**
 * Marketing Email Campaign Execution
 *
 * Sends email campaigns via Resend (already integrated in the platform).
 * Reusable by both ops (Phase A) and admin dashboard (Phase B).
 */

import type { Campaign, EmailContent } from './types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailCampaignResult {
  sent: number;
  failed: number;
  errors: string[];
}

// ── Send Campaign ────────────────────────────────────────────────────────────

/**
 * Send an email campaign to a list of recipients via Resend batch API.
 */
export async function sendEmailCampaign(
  campaign: Campaign,
  recipients: EmailRecipient[],
  fromEmail: string = 'marketing@keystoneweb.ca',
  fromName: string = 'Keystone Web',
): Promise<EmailCampaignResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  if (recipients.length === 0) {
    return { sent: 0, failed: 0, errors: ['No recipients provided'] };
  }

  const content = campaign.content as EmailContent;
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Resend batch API supports up to 100 emails per call
  const BATCH_SIZE = 100;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(
          batch.map(r => ({
            from: `${fromName} <${fromEmail}>`,
            to: [r.email],
            subject: content.subject,
            html: content.bodyHtml,
            text: content.bodyText,
            reply_to: content.replyTo || undefined,
            headers: {
              'X-Campaign-Id': campaign.id,
            },
          })),
        ),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[marketing/email] Resend batch error ${res.status}:`, errBody);
        failed += batch.length;
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${res.status}`);
      } else {
        const result = await res.json();
        // Resend batch returns { data: [{ id }...] }
        sent += Array.isArray(result.data) ? result.data.length : batch.length;
      }
    } catch (err: any) {
      console.error('[marketing/email] Batch send error:', err);
      failed += batch.length;
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${err.message}`);
    }
  }

  return { sent, failed, errors };
}

// ── Phase B: Fetch Recipients from Site Members ──────────────────────────────

/**
 * Fetch all members of a site who opted in to marketing emails.
 * Phase B helper — used when site owners send campaigns to their members.
 */
export async function getEmailRecipients(
  siteId: string,
  db: any,
): Promise<EmailRecipient[]> {
  const { data: members, error } = await db
    .from('members')
    .select('email, name')
    .eq('site_id', siteId)
    .eq('status', 'active')
    .eq('marketing_opt_in', true);

  if (error) {
    console.error('[marketing/email] Failed to fetch recipients:', error);
    return [];
  }

  return (members ?? []).map((m: any) => ({
    email: m.email,
    name: m.name || undefined,
  }));
}
