import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { syncAllCampaigns } from '@/lib/marketing/performance';

/**
 * GET /api/cron/marketing-sync
 *
 * Invoked once daily by Vercel Cron (Hobby plan caps crons at once/day; was
 * every 6h on Pro). Pulls latest performance data from Google Ads and Meta APIs,
 * updates campaign metrics, and records daily spend.
 *
 * NOTE: this is the ONLY job that refreshes spent_cents and the only prepaid-
 * depletion pause path, and marketing-budget-check reads the spent_cents this
 * writes. At once/day, the worst-case overspend-detection window widens from ~6h
 * to ~24h. The durable fix is a platform-level budget cap (Google campaign
 * budget / Meta lifetime_budget) so the ad platform stops delivery on its own;
 * for near-real-time detection without upgrading, run this from an external
 * scheduler (GitHub Actions cron hitting this route with the Bearer CRON_SECRET).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();

  try {
    const result = await syncAllCampaigns(db);

    console.log(
      `[cron/marketing-sync] Synced ${result.synced} campaigns, ${result.failed} failed`,
      result.errors.length > 0 ? result.errors : '',
    );

    return NextResponse.json({
      success: true,
      synced: result.synced,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (err: any) {
    console.error('[cron/marketing-sync] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
