import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_API_BASE = 'https://api.vercel.com';

/**
 * Toggle auto-renewal for a domain via the Vercel Registrar API.
 */
async function setVercelAutoRenew(domain: string, renew: boolean): Promise<boolean> {
  if (!VERCEL_API_TOKEN) {
    console.error('setVercelAutoRenew: VERCEL_API_TOKEN is missing');
    return false;
  }

  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';

  try {
    const res = await fetch(
      `${VERCEL_API_BASE}/v1/registrar/domains/${encodeURIComponent(domain)}${teamParam}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ renew }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error(`setVercelAutoRenew: Failed to set renew=${renew} for ${domain}:`, res.status, errorData);
      return false;
    }

    console.log(`setVercelAutoRenew: Set renew=${renew} for ${domain}`);
    return true;
  } catch (err) {
    console.error(`setVercelAutoRenew: Unexpected error for ${domain}:`, err);
    return false;
  }
}

/**
 * GET /api/cron/parked-domain-renewal
 *
 * Invoked daily by Vercel Cron.
 *
 * 1. Finds parked domains (completed, not linked to a published site) that are
 *    within 7 days of their renewal date and have auto_renew = true.
 *    → Turns off auto-renewal via Vercel API and updates the DB.
 *
 * 2. Finds domains that are back on a published site but still have
 *    auto_renew = false (turned off by this cron, not by the user).
 *    → Re-enables auto-renewal via Vercel API and updates the DB.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // ── 1. Disable auto-renewal for parked domains nearing expiry ──────────

  // Parked = completed domain where site_id is null OR the linked site is not published.
  // We query in two steps: first null site_id, then linked-but-unpublished.

  // 1a. Domains with no site at all
  const { data: unlinkedDomains, error: unlinkedErr } = await supabase
    .from('domain_purchases')
    .select('id, domain')
    .eq('status', 'completed')
    .eq('auto_renew', true)
    .is('site_id', null)
    .lte('expires_at', sevenDaysFromNow);

  if (unlinkedErr) {
    console.error('Cron parked-renewal: failed to query unlinked domains:', unlinkedErr);
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 });
  }

  // 1b. Domains linked to a site that is not published
  const { data: linkedDomains, error: linkedErr } = await supabase
    .from('domain_purchases')
    .select('id, domain, site_id, sites!inner(is_published)')
    .eq('status', 'completed')
    .eq('auto_renew', true)
    .not('site_id', 'is', null)
    .lte('expires_at', sevenDaysFromNow)
    .eq('sites.is_published', false);

  if (linkedErr) {
    console.error('Cron parked-renewal: failed to query linked-unpublished domains:', linkedErr);
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 });
  }

  const toDisable = [...(unlinkedDomains ?? []), ...(linkedDomains ?? [])];
  let disabled = 0;
  let disableErrors = 0;

  for (let i = 0; i < toDisable.length; i++) {
    const dp = toDisable[i];

    if (i > 0 && toDisable.length > 5) {
      await new Promise((r) => setTimeout(r, 200));
    }

    const ok = await setVercelAutoRenew(dp.domain, false);
    if (ok) {
      await supabase
        .from('domain_purchases')
        .update({ auto_renew: false, updated_at: new Date().toISOString() })
        .eq('id', dp.id);
      disabled++;
      console.log(`Cron parked-renewal: disabled auto-renew for parked domain ${dp.domain}`);
    } else {
      disableErrors++;
    }
  }

  // ── 2. Re-enable auto-renewal for domains back on a published site ─────

  // Only re-enable if cancelled_at is null (user didn't manually cancel).
  const { data: reEnableCandidates, error: reEnableErr } = await supabase
    .from('domain_purchases')
    .select('id, domain, sites!inner(is_published)')
    .eq('status', 'completed')
    .eq('auto_renew', false)
    .is('cancelled_at', null)
    .not('site_id', 'is', null)
    .eq('sites.is_published', true);

  if (reEnableErr) {
    console.error('Cron parked-renewal: failed to query re-enable candidates:', reEnableErr);
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 });
  }

  const toReEnable = reEnableCandidates ?? [];
  let reEnabled = 0;
  let reEnableErrors = 0;

  for (let i = 0; i < toReEnable.length; i++) {
    const dp = toReEnable[i];

    if (i > 0 && toReEnable.length > 5) {
      await new Promise((r) => setTimeout(r, 200));
    }

    const ok = await setVercelAutoRenew(dp.domain, true);
    if (ok) {
      await supabase
        .from('domain_purchases')
        .update({ auto_renew: true, updated_at: new Date().toISOString() })
        .eq('id', dp.id);
      reEnabled++;
      console.log(`Cron parked-renewal: re-enabled auto-renew for active domain ${dp.domain}`);
    } else {
      reEnableErrors++;
    }
  }

  return NextResponse.json({
    parked: { checked: toDisable.length, disabled, errors: disableErrors },
    active: { checked: toReEnable.length, reEnabled, errors: reEnableErrors },
  });
}
