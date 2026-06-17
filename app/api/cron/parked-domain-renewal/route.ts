import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { isProEntitled } from '@/lib/subscription/access';

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
 * Resolve which of the given owners are entitled to keep domain auto-renewal.
 * Entitled = active OR past_due (grace window) AND on a Pro plan. Anyone else
 * (Basic, canceled, lapsed-to-Free, no subscription) loses auto-renewal — they
 * keep the domain until it expires, but we stop paying to renew it.
 */
async function resolveEntitledOwners(
  supabase: ReturnType<typeof createAdminClient>,
  ownerIds: string[],
): Promise<Set<string>> {
  const entitled = new Set<string>();
  if (ownerIds.length === 0) return entitled;

  const { data: subs } = await supabase
    .from('user_subscriptions')
    .select('user_id, subscription_status, subscription_plan')
    .in('user_id', ownerIds);

  for (const sub of subs ?? []) {
    if (isProEntitled(sub)) entitled.add(sub.user_id);
  }
  return entitled;
}

/**
 * GET /api/cron/parked-domain-renewal
 *
 * Invoked daily by Vercel Cron.
 *
 * 1. Finds completed domains within 7 days of their renewal date whose owner is
 *    NOT a Pro-entitled (active or in-grace) user, and turns OFF auto-renewal.
 *    This includes domains on a still-published site whose owner has lapsed to
 *    Free after a failed payment — we keep their site online but stop paying to
 *    renew the domain. Pro (and in-grace) owners keep their domains.
 *
 * 2. Finds domains that are back on a published site, owned by a Pro-entitled
 *    user, but still have auto_renew = false (e.g. they re-subscribed) and
 *    re-enables auto-renewal.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // ── 1. Disable auto-renewal for non-entitled owners' domains nearing expiry ──
  // We no longer require the domain to be "parked" — a lapsed user's domain can
  // still be linked to a published site. Entitlement (not publish state) decides.
  const { data: expiringDomains, error: expiringErr } = await supabase
    .from('domain_purchases')
    .select('id, domain, user_id')
    .eq('status', 'completed')
    .eq('auto_renew', true)
    .lte('expires_at', sevenDaysFromNow);

  if (expiringErr) {
    console.error('Cron parked-renewal: failed to query expiring domains:', expiringErr);
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 });
  }

  const expiring = expiringDomains ?? [];
  const entitledOwnerIds = await resolveEntitledOwners(
    supabase,
    [...new Set(expiring.map((d) => d.user_id))],
  );

  const toDisable = expiring.filter((d) => !entitledOwnerIds.has(d.user_id));
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
      console.log(`Cron parked-renewal: disabled auto-renew for ${dp.domain} (owner not Pro-entitled)`);
    } else {
      disableErrors++;
    }
  }

  // ── 2. Re-enable auto-renewal for entitled owners' domains on a published site ─
  // Only re-enable if cancelled_at is null (user didn't manually cancel) AND the
  // owner is Pro-entitled (e.g. they re-subscribed after lapsing).
  const { data: reEnableCandidates, error: reEnableErr } = await supabase
    .from('domain_purchases')
    .select('id, domain, user_id, sites!inner(is_published)')
    .eq('status', 'completed')
    .eq('auto_renew', false)
    .is('cancelled_at', null)
    .not('site_id', 'is', null)
    .eq('sites.is_published', true);

  if (reEnableErr) {
    console.error('Cron parked-renewal: failed to query re-enable candidates:', reEnableErr);
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 });
  }

  const reCandidates = reEnableCandidates ?? [];
  const reEntitledOwnerIds = await resolveEntitledOwners(
    supabase,
    [...new Set(reCandidates.map((d) => d.user_id))],
  );

  const toReEnable = reCandidates.filter((d) => reEntitledOwnerIds.has(d.user_id));
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
    disabled: { checked: toDisable.length, disabled, errors: disableErrors },
    reEnabled: { checked: toReEnable.length, reEnabled, errors: reEnableErrors },
  });
}
