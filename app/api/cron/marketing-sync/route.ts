import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { syncAllCampaigns } from '@/lib/marketing/performance';

/**
 * GET /api/cron/marketing-sync
 *
 * Invoked every 6 hours by Vercel Cron.
 * Pulls latest performance data from Google Ads and Meta APIs,
 * updates campaign metrics, and records daily spend.
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
