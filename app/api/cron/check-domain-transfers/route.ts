import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { checkAndPromoteTransfer } from '@/lib/domains/status';

/**
 * GET /api/cron/check-domain-transfers
 *
 * Invoked daily by Vercel Cron (vercel.json schedule: "0 10 * * *").
 * Polls Vercel for all in-progress domain transfers and promotes completed ones.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Fetch all in-progress transfers
  const { data: pendingTransfers, error: queryError } = await supabase
    .from('domain_purchases')
    .select('id, domain, site_id, user_id')
    .eq('transfer_status', 'initiated')
    .neq('status', 'failed');

  if (queryError) {
    console.error('Cron: failed to query pending transfers:', queryError);
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 });
  }

  const transfers = pendingTransfers ?? [];
  let completed = 0;
  let errors = 0;

  for (let i = 0; i < transfers.length; i++) {
    const transfer = transfers[i];

    // Avoid hammering Vercel API
    if (i > 0 && transfers.length > 5) {
      await new Promise((r) => setTimeout(r, 200));
    }

    try {
      if (!transfer.site_id) continue;
      
      const finished = await checkAndPromoteTransfer(
        transfer.domain, 
        transfer.site_id, 
        transfer.user_id
      );

      if (finished) completed++;
    } catch (err) {
      console.error(`Cron: unexpected error for ${transfer.domain}:`, err);
      errors++;
    }
  }

  return NextResponse.json({ checked: transfers.length, completed, errors });
}
