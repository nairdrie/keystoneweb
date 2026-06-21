import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { searchTextGta, type PlaceResult } from '@/lib/leads/places';

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

// ── Target: businesses WITHOUT a website that we can phone ────────────────────
// No-website businesses are a minority of any Places result set, so we cast a
// wide net — scan every page of several queries and keep only the few that
// have no website, a phone number, and aren't closed. That's the whole ICP:
// a free build + cheap monthly is an easy pitch to a business that has nothing.
const TARGET_NEW_PROSPECTS = 15;       // soft target of no-website prospects per run
const MAX_QUERY_ATTEMPTS = 10;         // queries to scan before giving up for the day
const PAGES_PER_QUERY = 3;             // Places returns ~20/page, up to 3 pages (~60)
const COOLDOWN_DAYS = 60;              // cooldown applied after every visit
const STALE_POOL_SIZE = 40;            // top-N stalest queries we randomize within

// Drop businesses Google reports as closed — a dead listing is a wasted call.
const CLOSED_STATUSES = new Set(['CLOSED_PERMANENTLY', 'CLOSED_TEMPORARILY']);

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
    no_website_candidates: 0,
    new_prospects: 0,
    duplicates: 0,
    skipped_has_website: 0,
    skipped_closed: 0,
    skipped_no_phone: 0,
    errors: [] as string[],
  };

  // Pre-fetch the stale pool ONCE, shuffle in JS, then pop one per attempt.
  // The shuffle gives us niche/city variety even on first-run when every
  // row has last_run_at = NULL and Postgres would otherwise return them in
  // physical insert order.
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

  // Collect no-website candidates across queries/pages, deduped by place_id in
  // memory so the same business appearing on multiple pages is only kept once.
  const candidates = new Map<string, { place: PlaceResult; query: (typeof shuffled)[number] }>();

  for (let attempt = 0; attempt < MAX_QUERY_ATTEMPTS && attempt < shuffled.length; attempt++) {
    if (candidates.size >= TARGET_NEW_PROSPECTS) break;

    const query = shuffled[attempt];
    summary.queries_attempted.push({ id: query.id, niche: query.niche, city: query.city });

    // ----- Scan every page (page 1 included): no-website businesses can rank
    // anywhere, and the prominent ones (page 1) are often the best calls. -----
    let pageToken: string | null = null;
    for (let page = 0; page < PAGES_PER_QUERY; page++) {
      let pageResult;
      try {
        pageResult = await searchTextGta({ niche: query.niche, city: query.city, pageToken });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        summary.errors.push(`${query.niche}/${query.city} p${page + 1}: ${msg}`);
        break;
      }

      summary.raw_results += pageResult.places.length;

      for (const p of pageResult.places) {
        if (p.website) {
          summary.skipped_has_website++;
          continue;
        }
        if (p.businessStatus && CLOSED_STATUSES.has(p.businessStatus)) {
          summary.skipped_closed++;
          continue;
        }
        // No website + no phone = uncontactable for a calling motion. Skip.
        if (!p.phone) {
          summary.skipped_no_phone++;
          continue;
        }
        if (!candidates.has(p.placeId)) {
          candidates.set(p.placeId, { place: p, query });
        }
      }

      if (!pageResult.nextPageToken) break;
      pageToken = pageResult.nextPageToken;
    }

    await markRun(db, query.id);
  }

  summary.no_website_candidates = candidates.size;

  // ── Dedup against what we've already discovered, then insert ────────────────
  if (candidates.size > 0) {
    const placeIds = [...candidates.keys()];
    const { data: existing } = await db
      .from('lead_prospects')
      .select('place_id')
      .in('place_id', placeIds);
    const existingSet = new Set((existing ?? []).map((r) => r.place_id));

    const fresh = [...candidates.values()].filter((c) => !existingSet.has(c.place.placeId));
    summary.duplicates = candidates.size - fresh.length;

    if (fresh.length > 0) {
      const rows = fresh.map((c) => toProspectRow(c.place, c.query));
      const { error: insertErr, count } = await db
        .from('lead_prospects')
        .insert(rows, { count: 'exact' });
      if (insertErr) {
        summary.errors.push(`Insert: ${insertErr.message}`);
      } else {
        summary.new_prospects = count ?? rows.length;
      }
    }
  }

  console.log(
    `[cron/leads/discover] ${region}: ${summary.no_website_candidates} no-website candidates, ` +
      `+${summary.new_prospects} new (skipped ${summary.skipped_has_website} w/site, ` +
      `${summary.skipped_no_phone} no-phone, ${summary.skipped_closed} closed)`,
  );

  return NextResponse.json(summary);
}

async function markRun(db: ReturnType<typeof createAdminClient>, id: string) {
  await db
    .from('lead_discovery_queries')
    .update({
      last_run_at: new Date().toISOString(),
      last_error: null,
      cooldown_until: new Date(Date.now() + COOLDOWN_DAYS * 86_400_000).toISOString(),
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
  const angles = ['No website — only a Google Business Profile'];
  if (typeof p.reviewCount === 'number' && p.reviewCount > 0) {
    angles.push(
      `${p.reviewCount} Google reviews${typeof p.rating === 'number' ? ` at ${p.rating}★` : ''}` +
        ' — active business with no site to send customers to',
    );
  }

  return {
    place_id: p.placeId,
    name: p.name,
    formatted_address: p.formattedAddress,
    city: p.city ?? query.city,
    region: query.region,
    phone: p.phone,
    website: null,
    business_types: p.types,
    rating: p.rating,
    review_count: p.reviewCount,
    business_status: p.businessStatus,
    discovered_via_query_id: query.id,
    audit_status: 'no_website',
    pitch_angles: angles,
    // All prospects are now no-website (the strongest pitch). Ordering on the
    // call list is by review volume, not this field — see the Discover page.
    pitch_strength: 100,
  };
}
