/**
 * Marketing wallet email notifications (low balance, depleted).
 */

import { resend } from '@/lib/email/resend';
import { createAdminClient } from '@/lib/db/supabase-admin';

interface NotifyOpts {
  siteId: string;
  balanceCents: number;
  pausedCampaignCount?: number;
}

async function resolveRecipient(siteId: string): Promise<{ email: string; siteName: string } | null> {
  const db = createAdminClient();
  const { data: site } = await db
    .from('sites')
    .select('user_id, site_slug, design_data')
    .eq('id', siteId)
    .single();

  if (!site?.user_id) return null;

  const { data: userResp } = await db.auth.admin.getUserById(site.user_id);
  const email = userResp?.user?.email;
  if (!email) return null;

  const designData = site.design_data as { siteTitle?: string } | null;
  const siteName = designData?.siteTitle || site.site_slug || 'your site';
  return { email, siteName };
}

export async function sendMarketingWalletLow(opts: NotifyOpts) {
  const recipient = await resolveRecipient(opts.siteId);
  if (!recipient) return { success: false };

  const remaining = `$${(opts.balanceCents / 100).toFixed(2)}`;
  const topupUrl = `https://keystoneweb.ca/admin/marketing/budget?siteId=${opts.siteId}`;

  await resend.emails.send({
    from: 'Keystone Web Design <hello@keystoneweb.ca>',
    to: recipient.email,
    subject: `Marketing balance low — ${remaining} left for ${recipient.siteName}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 12px;color:#111827;">Your marketing balance is running low</h2>
        <p style="color:#374151;line-height:1.5;">
          You have <strong>${remaining}</strong> remaining in your marketing wallet for
          <strong>${recipient.siteName}</strong>. Top up now to avoid your ads pausing.
        </p>
        <p style="margin-top:24px;">
          <a href="${topupUrl}" style="background:#10b981;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">
            Top up balance
          </a>
        </p>
      </div>
    `,
    text: `Your marketing balance for ${recipient.siteName} is at ${remaining}. Top up: ${topupUrl}`,
  });

  return { success: true };
}

export async function sendMarketingWalletEmpty(opts: NotifyOpts) {
  const recipient = await resolveRecipient(opts.siteId);
  if (!recipient) return { success: false };

  const pausedCount = opts.pausedCampaignCount ?? 0;
  const topupUrl = `https://keystoneweb.ca/admin/marketing/budget?siteId=${opts.siteId}`;
  const subject = `Marketing campaigns paused — top up to resume`;

  await resend.emails.send({
    from: 'Keystone Web Design <hello@keystoneweb.ca>',
    to: recipient.email,
    subject,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 12px;color:#111827;">Your marketing wallet is empty</h2>
        <p style="color:#374151;line-height:1.5;">
          ${pausedCount > 0
            ? `We paused <strong>${pausedCount}</strong> active campaign${pausedCount === 1 ? '' : 's'} for <strong>${recipient.siteName}</strong>.`
            : `Your campaigns for <strong>${recipient.siteName}</strong> have been paused.`}
          Top up your balance to resume them.
        </p>
        <p style="margin-top:24px;">
          <a href="${topupUrl}" style="background:#10b981;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">
            Top up & resume
          </a>
        </p>
      </div>
    `,
    text: `Your marketing wallet for ${recipient.siteName} is empty and your campaigns are paused. Top up: ${topupUrl}`,
  });

  return { success: true };
}
