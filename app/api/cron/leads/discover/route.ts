import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { runDiscoveryForQuery, type DiscoveryQuery } from '@/lib/leads/discover';

// Weekday → GTA sub-region rotation. Discovery only runs Mon–Fri so weekends
// just no-op if Vercel happens to fire the cron.
const WEEKDAY_REGION: Record<number, string> = {
  1: 'toronto_core', // Monday
  2: 'york',
  3: 'peel',
  4: 'halton',
  5: 'durham',
};

const TARGET_NEW_PROSPECTS = 10;       // soft target per run
const MAX_QUERY_ATTEMPTS = 4;          // stop after this many query advances
const STALE_POOL_SIZE = 25;            // top-N stalest queries we randomize within

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
  const summary = {
    region,
    queries_attempted: [] as Array<{ id: string; niche: string; city: string }>,
    raw_results: 0,
    new_prospects: 0,
    duplicates: 0,
    errors: [] as string[],
  };

  // Pre-fetch the stale pool ONCE, shuffle in JS, then pop one per attempt.
  // The shuffle gives us niche/city variety even on first-run when every
  // row has last_run_at = NULL and Postgres would otherwise return them in
  // physical insert order (which lands us on "all plumber" results because
  // plumber is the first niche per city in the seed).
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
    summary.errors.push(`No eligible queries in region ${region}`);
    return NextResponse.json(summary);
  }

  const shuffled = shuffle([...pool]) as DiscoveryQuery[];

  for (let attempt = 0; attempt < MAX_QUERY_ATTEMPTS && attempt < shuffled.length; attempt++) {
    if (summary.new_prospects >= TARGET_NEW_PROSPECTS) break;

    const query = shuffled[attempt];
    summary.queries_attempted.push({ id: query.id, niche: query.niche, city: query.city });

    const result = await runDiscoveryForQuery(db, query);

    summary.raw_results += result.scanned;
    summary.new_prospects += result.inserted;
    summary.duplicates += result.duplicates;
    if (result.error) {
      summary.errors.push(`${query.niche}/${query.city}: ${result.error}`);
    }

    if (result.tooNarrow) {
      console.log(
        `[cron/leads/discover] ${query.niche} / ${query.city}: ` +
          `only ${result.scanned} total results, no page 2 — skipping`,
      );
    } else {
      console.log(
        `[cron/leads/discover] ${query.niche} / ${query.city}: ` +
          `+${result.inserted} new, ${result.duplicates} dupes (page 2)`,
      );
    }
  }

  return NextResponse.json(summary);
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
