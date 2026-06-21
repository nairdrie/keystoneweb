import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { runDiscovery, type SearchSpec } from '@/lib/leads/discover';

// Weekday → GTA sub-region rotation. Discovery only runs Mon–Fri so weekends
// just no-op if Vercel happens to fire the cron. One region per day keeps a
// day's call list geographically coherent.
const WEEKDAY_REGION: Record<number, string> = {
  1: 'toronto_core', // Monday
  2: 'york',
  3: 'peel',
  4: 'halton',
  5: 'durham',
};

const TARGET_NEW_PROSPECTS = 15;       // soft target of no-website prospects per run
const MAX_QUERY_ATTEMPTS = 10;         // queries to scan before giving up for the day
const PAGES_PER_QUERY = 3;             // Places returns ~20/page, up to 3 pages (~60)
const COOLDOWN_DAYS = 60;              // cooldown applied after every visit
const STALE_POOL_SIZE = 40;            // top-N stalest queries we randomize within

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dow = new Date().getUTCDay();
  // Vercel cron timezone is UTC; we run at 14:00 UTC = 10am ET, which is the
  // same calendar day in both. Map JS Sunday=0..Saturday=6 onto our 1..5.
  const region = WEEKDAY_REGION[dow];
  if (!region) {
    return NextResponse.json({ skipped: 'weekend', dow });
  }

  const db = createAdminClient();

  // Pre-fetch the stale pool ONCE, shuffle in JS for niche/city variety, then
  // feed it to the shared discovery engine.
  const nowIso = new Date().toISOString();
  const { data: pool } = await db
    .from('lead_discovery_queries')
    .select('id, niche, city, region')
    .eq('region', region)
    .eq('enabled', true)
    .or(`cooldown_until.is.null,cooldown_until.lt.${nowIso}`)
    .order('last_run_at', { ascending: true, nullsFirst: true })
    .limit(STALE_POOL_SIZE);

  if (!pool || pool.length === 0) {
    return NextResponse.json({ region, error: `No eligible queries in region ${region}` });
  }

  const specs: SearchSpec[] = shuffle([...pool]).map((q) => ({
    niche: q.niche,
    city: q.city,
    region: q.region,
    queryId: q.id,
  }));

  const summary = await runDiscovery(db, specs, {
    target: TARGET_NEW_PROSPECTS,
    pagesPerQuery: PAGES_PER_QUERY,
    maxSpecs: MAX_QUERY_ATTEMPTS,
    markQueries: true,
    cooldownDays: COOLDOWN_DAYS,
  });

  console.log(
    `[cron/leads/discover] ${region}: ${summary.no_website_candidates} candidates, ` +
      `+${summary.new_prospects} new (skipped ${summary.skipped_has_website} w/site, ` +
      `${summary.skipped_no_phone} no-phone, ${summary.skipped_closed} closed)`,
  );

  return NextResponse.json({ region, ...summary });
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
