import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { searchTextGta, type PlaceResult } from '@/lib/leads/places';

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
const COOLDOWN_DAYS = 60;              // cooldown applied after every visit
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

  const shuffled = shuffle([...pool]);

  for (let attempt = 0; attempt < MAX_QUERY_ATTEMPTS && attempt < shuffled.length; attempt++) {
    if (summary.new_prospects >= TARGET_NEW_PROSPECTS) break;

    const query = shuffled[attempt];
    summary.queries_attempted.push({ id: query.id, niche: query.niche, city: query.city });

    // ----- Skip page 1: low-ranked businesses are who needs help -----
    // pageTokens expire in minutes, so we do the page-1 throwaway in the
    // same invocation as the page-2 fetch we actually want.
    let firstPage;
    try {
      firstPage = await searchTextGta({ niche: query.niche, city: query.city, pageToken: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`Page 1 ${query.niche}/${query.city}: ${msg}`);
      await markRun(db, query.id, msg);
      continue;
    }

    if (!firstPage.nextPageToken) {
      // Fewer than 20 results total — query too narrow. Skip and cooldown
      // so we don't waste a Places call on it tomorrow.
      console.log(
        `[cron/leads/discover] ${query.niche} / ${query.city}: ` +
          `only ${firstPage.places.length} total results, no page 2 — skipping`,
      );
      await markRun(db, query.id, null);
      continue;
    }

    let pageResult;
    try {
      pageResult = await searchTextGta({
        niche: query.niche,
        city: query.city,
        pageToken: firstPage.nextPageToken,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`Page 2 ${query.niche}/${query.city}: ${msg}`);
      await markRun(db, query.id, msg);
      continue;
    }

    summary.raw_results += pageResult.places.length;

    let inserted = 0;
    if (pageResult.places.length > 0) {
      const placeIds = pageResult.places.map((p) => p.placeId);
      const { data: existing } = await db
        .from('lead_prospects')
        .select('place_id')
        .in('place_id', placeIds);
      const existingSet = new Set((existing ?? []).map((r) => r.place_id));

      const fresh = pageResult.places.filter((p) => !existingSet.has(p.placeId));
      summary.duplicates += pageResult.places.length - fresh.length;

      if (fresh.length > 0) {
        const rows = fresh.map((p) => toProspectRow(p, query));
        const { error: insertErr, count } = await db
          .from('lead_prospects')
          .insert(rows, { count: 'exact' });
        if (insertErr) {
          summary.errors.push(
            `Insert for ${query.niche}/${query.city}: ${insertErr.message}`,
          );
        } else {
          inserted = count ?? rows.length;
          summary.new_prospects += inserted;
        }
      }
    }

    await markRun(db, query.id, null);

    console.log(
      `[cron/leads/discover] ${query.niche} / ${query.city}: ` +
        `+${inserted} new, ${pageResult.places.length - inserted} dupes (page 2)`,
    );
  }

  return NextResponse.json(summary);
}

async function markRun(
  db: ReturnType<typeof createAdminClient>,
  id: string,
  error: string | null,
) {
  await db
    .from('lead_discovery_queries')
    .update({
      last_run_at: new Date().toISOString(),
      last_error: error,
      cooldown_until: new Date(Date.now() + COOLDOWN_DAYS * 86_400_000).toISOString(),
      // Pagination columns are vestigial under skip-page-1 logic but kept on
      // the table to avoid a destructive migration.
      next_page_token: null,
    })
    .eq('id', id);
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function toProspectRow(
  p: PlaceResult,
  query: { id: string; region: string; city: string },
) {
  return {
    place_id: p.placeId,
    name: p.name,
    formatted_address: p.formattedAddress,
    city: p.city ?? query.city,
    region: query.region,
    phone: p.phone,
    website: p.website,
    business_types: p.types,
    discovered_via_query_id: query.id,
    audit_status: p.website ? 'pending' : 'no_website',
    pitch_angles: p.website ? [] : ['No website — only Google Business Profile'],
    pitch_strength: p.website ? 0 : 100,
  };
}
