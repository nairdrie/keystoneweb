import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendMarketingDailyDigest } from '@/lib/marketing/notifications';

/**
 * GET /api/cron/marketing-daily-digest
 *
 * Once-a-day digest: for every site with active campaigns, send the customer
 * yesterday's impressions/clicks/spend. Idempotent — the wallet row tracks
 * `last_daily_digest_at`; we skip sites that already received today's digest.
 *
 * Wire this to Vercel Cron with a daily schedule (e.g. 9am local time).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();

  // Yesterday in YYYY-MM-DD
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  // Find every site with at least one active campaign.
  const { data: activeSites } = await db
    .from('marketing_campaigns')
    .select('site_id')
    .eq('status', 'active')
    .not('site_id', 'is', null);

  const siteIds = Array.from(new Set((activeSites || []).map(r => r.site_id))).filter(Boolean) as string[];

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const siteId of siteIds) {
    try {
      // Idempotency: skip if we already sent today's digest.
      const { data: wallet } = await db
        .from('marketing_wallet')
        .select('id, balance_cents, last_daily_digest_at')
        .eq('site_id', siteId)
        .maybeSingle();
      if (!wallet) { skipped++; continue; }
      if (wallet.last_daily_digest_at && wallet.last_daily_digest_at.startsWith(today)) {
        skipped++;
        continue;
      }

      // Pull yesterday's per-campaign metrics from the activity events table.
      const { data: campaigns } = await db
        .from('marketing_campaigns')
        .select('id, name, channel, content')
        .eq('site_id', siteId)
        .in('status', ['active', 'paused']);

      if (!campaigns?.length) { skipped++; continue; }

      const rows = await Promise.all(campaigns.map(async (c) => {
        const { data: events } = await db
          .from('marketing_activity_events')
          .select('impressions, clicks, cost_cents')
          .eq('campaign_id', c.id)
          .eq('occurred_date', yesterday);

        const totals = (events || []).reduce(
          (acc, e) => ({
            impressions: acc.impressions + (e.impressions || 0),
            clicks: acc.clicks + (e.clicks || 0),
            spendCents: acc.spendCents + (e.cost_cents || 0),
          }),
          { impressions: 0, clicks: 0, spendCents: 0 },
        );

        const headlines = (c.content as { headlines?: string[] } | null)?.headlines;
        return {
          name: c.name,
          channel: c.channel,
          yesterday: {
            ...totals,
            topHeadline: headlines?.[0],
          },
        };
      }));

      const result = await sendMarketingDailyDigest({
        siteId,
        walletBalanceCents: wallet.balance_cents,
        campaigns: rows,
      });

      if (result.success) {
        sent++;
        await db
          .from('marketing_wallet')
          .update({ last_daily_digest_at: new Date().toISOString() })
          .eq('id', wallet.id);
      } else {
        skipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron/marketing-daily-digest] site ${siteId} failed:`, err);
      errors.push(`${siteId}: ${msg}`);
    }
  }

  return NextResponse.json({ success: true, sent, skipped, errors });
}
