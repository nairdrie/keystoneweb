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
const COOLDOWN_DAYS_AFTER_EXHAUST = 60;

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

  for (let attempt = 0; attempt < MAX_QUERY_ATTEMPTS; attempt++) {
    if (summary.new_prospects >= TARGET_NEW_PROSPECTS) break;

    // Pick the stalest enabled query in this region whose cooldown has expired.
    const { data: queries } = await db
      .from('lead_discovery_queries')
      .select('*')
      .eq('region', region)
      .eq('enabled', true)
      .or(`cooldown_until.is.null,cooldown_until.lt.${new Date().toISOString()}`)
      .order('last_run_at', { ascending: true, nullsFirst: true })
      .limit(1);

    const query = queries?.[0];
    if (!query) {
      summary.errors.push(`No enabled queries available in region ${region}`);
      break;
    }

    summary.queries_attempted.push({ id: query.id, niche: query.niche, city: query.city });

    let pageResult;
    try {
      pageResult = await searchTextGta({
        niche: query.niche,
        city: query.city,
        pageToken: query.next_page_token,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`Query ${query.niche}/${query.city}: ${msg}`);
      await db
        .from('lead_discovery_queries')
        .update({
          last_run_at: new Date().toISOString(),
          last_error: msg,
        })
        .eq('id', query.id);
      continue;
    }

    summary.raw_results += pageResult.places.length;

    // Insert prospects, skipping any place_id we already have. Supabase
    // doesn't surface per-row insert results easily, so we dedup in two
    // passes: pre-fetch existing place_ids in this batch, then insert the
    // diff. That way `summary.new_prospects` is accurate.
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

    // Advance the query cursor regardless of how many were new — that way a
    // hit-zone query (10/10 fresh) doesn't pin us to the same page tomorrow.
    const exhausted = !pageResult.nextPageToken;
    await db
      .from('lead_discovery_queries')
      .update({
        last_run_at: new Date().toISOString(),
        next_page_token: pageResult.nextPageToken,
        page_index: query.page_index + 1,
        total_results_seen: query.total_results_seen + pageResult.places.length,
        last_error: null,
        cooldown_until: exhausted
          ? new Date(Date.now() + COOLDOWN_DAYS_AFTER_EXHAUST * 86_400_000).toISOString()
          : null,
        // Reset page_index when token is exhausted so the next visit starts page 1 again.
        ...(exhausted ? { page_index: 0 } : {}),
      })
      .eq('id', query.id);

    console.log(
      `[cron/leads/discover] ${query.niche} / ${query.city}: ` +
        `+${inserted} new, ${pageResult.places.length - inserted} dupes, ` +
        `nextPage=${exhausted ? 'EXHAUSTED' : 'yes'}`,
    );
  }

  return NextResponse.json(summary);
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
