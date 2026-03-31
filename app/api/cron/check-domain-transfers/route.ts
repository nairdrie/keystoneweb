import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendDomainTransferCompleteEmail } from '@/lib/email';

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_API_BASE = 'https://api.vercel.com';

/**
 * GET /api/cron/check-domain-transfers
 *
 * Invoked daily by Vercel Cron (vercel.json schedule: "0 10 * * *").
 * Polls Vercel for all in-progress domain transfers and promotes completed ones.
 * Sends a completion email to the site owner when a transfer finishes.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!VERCEL_API_TOKEN) {
    return NextResponse.json({ error: 'VERCEL_API_TOKEN not configured' }, { status: 503 });
  }

  const supabase = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://keystoneweb.ca';
  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';

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
      const vercelRes = await fetch(
        `${VERCEL_API_BASE}/v4/domains/${encodeURIComponent(transfer.domain)}${teamParam}`,
        { headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` } }
      );

      // 404 = not yet in Vercel's system, still pending
      if (vercelRes.status === 404) continue;

      if (!vercelRes.ok) {
        console.error(`Cron: Vercel API error for ${transfer.domain}:`, vercelRes.status);
        errors++;
        continue;
      }

      const domainData = await vercelRes.json();
      const isComplete = domainData.verified === true || !domainData.transferring;

      if (!isComplete) continue;

      // Promote pending → active
      await supabase
        .from('domain_purchases')
        .update({ transfer_status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', transfer.id);

      if (transfer.site_id) {
        await supabase
          .from('sites')
          .update({ custom_domain: transfer.domain, pending_custom_domain: null })
          .eq('id', transfer.site_id);
      }

      // Get user email
      const { data: { user } } = await supabase.auth.admin.getUserById(transfer.user_id);
      const userEmail = user?.email;

      if (userEmail && transfer.site_id) {
        await sendDomainTransferCompleteEmail({
          userEmail,
          domain: transfer.domain,
          siteId: transfer.site_id,
          appUrl,
        });
      }

      completed++;
      console.log(`Cron: transfer complete for ${transfer.domain}`);
    } catch (err) {
      console.error(`Cron: unexpected error for ${transfer.domain}:`, err);
      errors++;
    }
  }

  return NextResponse.json({ checked: transfers.length, completed, errors });
}
