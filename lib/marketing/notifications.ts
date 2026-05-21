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

export interface DailyDigestCampaignRow {
  name: string;
  channel: string;
  yesterday: { impressions: number; clicks: number; spendCents: number; topHeadline?: string };
}

export async function sendMarketingDailyDigest(opts: {
  siteId: string;
  walletBalanceCents: number;
  campaigns: DailyDigestCampaignRow[];
}) {
  const recipient = await resolveRecipient(opts.siteId);
  if (!recipient) return { success: false };

  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const totals = opts.campaigns.reduce(
    (acc, c) => ({
      impressions: acc.impressions + c.yesterday.impressions,
      clicks: acc.clicks + c.yesterday.clicks,
      spend: acc.spend + c.yesterday.spendCents,
    }),
    { impressions: 0, clicks: 0, spend: 0 },
  );

  // Skip the email entirely if there was no activity yesterday.
  if (totals.impressions === 0 && totals.clicks === 0 && totals.spend === 0) {
    return { success: false, skipped: 'no_activity' };
  }

  const dashboardUrl = `https://keystoneweb.ca/admin/marketing?siteId=${opts.siteId}`;

  const campaignRows = opts.campaigns
    .filter(c => c.yesterday.impressions > 0 || c.yesterday.clicks > 0 || c.yesterday.spendCents > 0)
    .map(c => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a;">
          ${c.name}
          <div style="font-weight:400;font-size:11px;color:#64748b;">${c.channel}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;color:#334155;">${c.yesterday.impressions.toLocaleString('en-US')}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;color:#334155;">${c.yesterday.clicks.toLocaleString('en-US')}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;color:#334155;">${fmt(c.yesterday.spendCents)}</td>
      </tr>
    `).join('');

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a;">
      <h1 style="margin:0 0 4px;font-size:20px;">Your ads ran yesterday</h1>
      <p style="margin:0 0 20px;color:#64748b;font-size:13px;">${yesterday} · ${recipient.siteName}</p>

      <div style="display:flex;gap:12px;margin-bottom:20px;">
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">
          <div style="font-size:11px;text-transform:uppercase;font-weight:700;color:#64748b;letter-spacing:0.05em;">Impressions</div>
          <div style="font-size:22px;font-weight:800;margin-top:2px;">${totals.impressions.toLocaleString('en-US')}</div>
        </div>
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">
          <div style="font-size:11px;text-transform:uppercase;font-weight:700;color:#64748b;letter-spacing:0.05em;">Clicks</div>
          <div style="font-size:22px;font-weight:800;margin-top:2px;">${totals.clicks.toLocaleString('en-US')}</div>
        </div>
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">
          <div style="font-size:11px;text-transform:uppercase;font-weight:700;color:#64748b;letter-spacing:0.05em;">Spend</div>
          <div style="font-size:22px;font-weight:800;margin-top:2px;">${fmt(totals.spend)}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:0.05em;">Campaign</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:0.05em;">Impressions</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:0.05em;">Clicks</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:0.05em;">Spend</th>
          </tr>
        </thead>
        <tbody>${campaignRows}</tbody>
      </table>

      <p style="margin-top:20px;font-size:13px;color:#475569;">
        Wallet balance: <strong>${fmt(opts.walletBalanceCents)}</strong>.
      </p>

      <p style="margin-top:20px;">
        <a href="${dashboardUrl}" style="background:#10b981;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
          See live activity
        </a>
      </p>

      <p style="margin-top:32px;color:#94a3b8;font-size:11px;">
        You're receiving this because you have active marketing campaigns on ${recipient.siteName}.
      </p>
    </div>
  `;

  await resend.emails.send({
    from: 'Keystone Web Design <hello@keystoneweb.ca>',
    to: recipient.email,
    subject: `Yesterday: ${totals.clicks.toLocaleString('en-US')} clicks for ${recipient.siteName}`,
    html,
    text: `Yesterday's ad activity for ${recipient.siteName}: ${totals.impressions} impressions, ${totals.clicks} clicks, ${fmt(totals.spend)} spent. See live: ${dashboardUrl}`,
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
