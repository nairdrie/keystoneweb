/**
 * Marketing email notifications: per-campaign budget alerts, ops launch
 * pending pings, customer "campaign is live" notifications, daily digest.
 */

import { resend } from '@/lib/email/resend';
import { createAdminClient } from '@/lib/db/supabase-admin';

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

export interface DailyDigestCampaignRow {
  name: string;
  channel: string;
  yesterday: { impressions: number; clicks: number; spendCents: number; topHeadline?: string };
}

export async function sendMarketingDailyDigest(opts: {
  siteId: string;
  totalRemainingCents: number;
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
        Remaining budget across active campaigns: <strong>${fmt(opts.totalRemainingCents)}</strong>.
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

/**
 * Ping the ops team when a customer approves a campaign that needs manual
 * billing setup on the Google Ads sub-account before it can launch.
 */
export async function sendMarketingOpsPendingNotification(opts: {
  campaignId: string;
  campaignName: string;
  siteId: string;
  siteName: string;
  customerEmail: string;
  dailyBudgetCents: number;
  googleAdsCustomerId: string | null;
  billingAlreadyReady: boolean;
}) {
  const opsEmail = process.env.MARKETING_OPS_EMAIL || 'hello@keystoneweb.ca';
  const opsPanelUrl = `https://keystoneweb.ca/ops/marketing`;
  const googleAdsUrl = opts.googleAdsCustomerId
    ? `https://ads.google.com/aw/billing/summary?ocid=${opts.googleAdsCustomerId.replace(/-/g, '')}`
    : `https://ads.google.com/aw/overview`;
  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

  await resend.emails.send({
    from: 'Keystone Marketing <hello@keystoneweb.ca>',
    to: opsEmail,
    subject: `[Marketing] Launch ready: ${opts.siteName} — ${opts.campaignName}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
        <h2 style="margin:0 0 12px;">Campaign awaiting launch</h2>
        <p style="margin:0 0 16px;color:#475569;line-height:1.5;">
          <strong>${opts.customerEmail}</strong> just approved a campaign for
          <strong>${opts.siteName}</strong>.
        </p>

        <p style="margin:0 0 16px;color:#16a34a;font-weight:600;font-size:13px;">✓ Payment received — ready to launch.</p>

        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
          <tr><td style="padding:6px 0;color:#64748b;">Campaign</td><td style="padding:6px 0;font-weight:600;">${opts.campaignName}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Daily budget</td><td style="padding:6px 0;font-weight:600;">${fmt(opts.dailyBudgetCents)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;">Linked Google Ads account</td><td style="padding:6px 0;font-weight:600;font-family:monospace;">${opts.googleAdsCustomerId || 'NOT LINKED YET'}</td></tr>
        </table>

        ${opts.googleAdsCustomerId && opts.billingAlreadyReady ? `
          <div style="background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:12px;margin:16px 0;font-size:13px;color:#166534;">
            This site already has a funded account. Just open the ops panel and click <em>Launch</em>.
          </div>
        ` : `
          <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px;margin:16px 0;font-size:13px;color:#78350f;">
            <strong>Action required:</strong> Create a Google Ads account for this customer (or use their existing one),
            <strong>link it to the Keystone MCC</strong>, add a payment method &amp; fund it. Then open the ops panel,
            paste the account&rsquo;s customer ID, and click <em>Launch</em>.
          </div>
        `}

        <div style="margin-top:20px;display:flex;gap:8px;">
          <a href="${googleAdsUrl}" style="background:#1a73e8;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;font-size:13px;">
            Open in Google Ads
          </a>
          <a href="${opsPanelUrl}" style="background:#10b981;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;font-size:13px;">
            Ops panel
          </a>
        </div>
      </div>
    `,
    text: `Campaign awaiting launch: ${opts.campaignName} (${opts.siteName}). Sub-account: ${opts.googleAdsCustomerId}. Ops panel: ${opsPanelUrl}`,
  });

  return { success: true };
}

/**
 * Notify the customer that their campaign's prepaid budget is running low
 * (under ~2 days of spend remaining).
 */
export async function sendMarketingCampaignBudgetLow(opts: {
  siteId: string;
  campaignId: string;
  campaignName: string;
  remainingCents: number;
  dailyBundledCents: number;
}) {
  const recipient = await resolveRecipient(opts.siteId);
  if (!recipient) return { success: false };
  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  const daysLeft = opts.dailyBundledCents > 0
    ? Math.max(0, Math.floor(opts.remainingCents / opts.dailyBundledCents))
    : 0;
  const url = `https://keystoneweb.ca/admin/marketing/campaigns/${opts.campaignId}?siteId=${opts.siteId}`;

  await resend.emails.send({
    from: 'Keystone Web Design <hello@keystoneweb.ca>',
    to: recipient.email,
    subject: `Campaign budget running low — ${opts.campaignName}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
        <h2 style="margin:0 0 12px;">Your campaign budget is running low</h2>
        <p style="color:#475569;line-height:1.5;">
          <strong>${opts.campaignName}</strong> has <strong>${fmt(opts.remainingCents)}</strong>
          left in its prepaid budget &mdash; about <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong> at the current spend rate.
          Add more budget now to avoid pausing.
        </p>
        <p style="margin-top:24px;">
          <a href="${url}" style="background:#10b981;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">
            Add budget
          </a>
        </p>
      </div>
    `,
    text: `Your campaign "${opts.campaignName}" has ${fmt(opts.remainingCents)} left (~${daysLeft} days). Add more: ${url}`,
  });

  return { success: true };
}

/**
 * Notify the customer that their campaign was paused because the prepaid
 * budget was fully spent.
 */
export async function sendMarketingCampaignBudgetDepleted(opts: {
  siteId: string;
  campaignId: string;
  campaignName: string;
}) {
  const recipient = await resolveRecipient(opts.siteId);
  if (!recipient) return { success: false };
  const url = `https://keystoneweb.ca/admin/marketing/campaigns/${opts.campaignId}?siteId=${opts.siteId}`;

  await resend.emails.send({
    from: 'Keystone Web Design <hello@keystoneweb.ca>',
    to: recipient.email,
    subject: `Campaign paused — budget depleted (${opts.campaignName})`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
        <h2 style="margin:0 0 12px;">Your campaign is paused</h2>
        <p style="color:#475569;line-height:1.5;">
          <strong>${opts.campaignName}</strong> finished its prepaid budget and was paused.
          Top up to resume serving ads.
        </p>
        <p style="margin-top:24px;">
          <a href="${url}" style="background:#10b981;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">
            Add budget &amp; resume
          </a>
        </p>
      </div>
    `,
    text: `Your campaign "${opts.campaignName}" was paused — prepaid budget depleted. Top up: ${url}`,
  });

  return { success: true };
}

/**
 * Notify the customer that their campaign just went live in Google.
 */
export async function sendMarketingCampaignLive(opts: {
  siteId: string;
  campaignId: string;
  campaignName: string;
}) {
  const recipient = await resolveRecipient(opts.siteId);
  if (!recipient) return { success: false };
  const dashboardUrl = `https://keystoneweb.ca/admin/marketing/campaigns/${opts.campaignId}?siteId=${opts.siteId}`;

  await resend.emails.send({
    from: 'Keystone Web Design <hello@keystoneweb.ca>',
    to: recipient.email,
    subject: `Your campaign is live — ${opts.campaignName}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
        <h2 style="margin:0 0 12px;">Your campaign is now live</h2>
        <p style="color:#475569;line-height:1.5;">
          <strong>${opts.campaignName}</strong> for <strong>${recipient.siteName}</strong> just started
          running on Google. It may take a few hours for the first impressions to appear as Google
          reviews your ad.
        </p>
        <p style="margin-top:24px;">
          <a href="${dashboardUrl}" style="background:#10b981;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">
            See live activity
          </a>
        </p>
      </div>
    `,
    text: `Your campaign "${opts.campaignName}" for ${recipient.siteName} is now live. See activity: ${dashboardUrl}`,
  });

  return { success: true };
}

