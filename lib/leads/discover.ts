// Shared no-website prospect discovery, used by both the daily cron and the
// on-demand "Find prospects" button in ops. Given a list of (niche, city)
// search specs, it scans Google Places and keeps only businesses that have
// NO website, a phone number, and aren't closed — the callable ICP.

import { createAdminClient } from '@/lib/db/supabase-admin';
import { searchTextGta, type PlaceResult } from '@/lib/leads/places';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

// Drop businesses Google reports as closed — a dead listing is a wasted call.
export const CLOSED_STATUSES = new Set(['CLOSED_PERMANENTLY', 'CLOSED_TEMPORARILY']);

export interface SearchSpec {
  niche: string;
  city: string;
  region: string;
  // Attribution back to a seeded lead_discovery_queries row, when one exists.
  queryId?: string | null;
}

export interface DiscoverOptions {
  target: number;             // stop once this many no-website candidates are found
  pagesPerQuery?: number;     // Places returns ~20/page, up to 3 pages (~60)
  maxSpecs?: number;          // cap on specs scanned (function-timeout guard)
  markQueries?: boolean;      // stamp last_run_at/cooldown on scanned query rows
  cooldownDays?: number;
}

export interface DiscoverSummary {
  specs_scanned: number;
  raw_results: number;
  no_website_candidates: number;
  new_prospects: number;
  duplicates: number;
  skipped_has_website: number;
  skipped_no_phone: number;
  skipped_closed: number;
  errors: string[];
}

export async function runDiscovery(
  db: SupabaseAdmin,
  specs: SearchSpec[],
  opts: DiscoverOptions,
): Promise<DiscoverSummary> {
  const pagesPerQuery = opts.pagesPerQuery ?? 3;
  const maxSpecs = opts.maxSpecs ?? specs.length;
  const cooldownDays = opts.cooldownDays ?? 60;

  const summary: DiscoverSummary = {
    specs_scanned: 0,
    raw_results: 0,
    no_website_candidates: 0,
    new_prospects: 0,
    duplicates: 0,
    skipped_has_website: 0,
    skipped_no_phone: 0,
    skipped_closed: 0,
    errors: [],
  };

  // Dedup candidates by place_id across pages and specs.
  const candidates = new Map<string, { place: PlaceResult; spec: SearchSpec }>();

  for (let i = 0; i < specs.length && i < maxSpecs; i++) {
    if (candidates.size >= opts.target) break;
    const spec = specs[i];
    summary.specs_scanned++;

    // Scan every page (page 1 included): no-website businesses rank anywhere,
    // and the prominent ones (page 1) are often the best calls.
    let pageToken: string | null = null;
    for (let page = 0; page < pagesPerQuery; page++) {
      let pageResult;
      try {
        pageResult = await searchTextGta({ niche: spec.niche, city: spec.city, pageToken });
      } catch (err) {
        summary.errors.push(
          `${spec.niche}/${spec.city} p${page + 1}: ${err instanceof Error ? err.message : String(err)}`,
        );
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
        // No website + no phone = uncontactable for a calling motion.
        if (!p.phone) {
          summary.skipped_no_phone++;
          continue;
        }
        if (!candidates.has(p.placeId)) {
          candidates.set(p.placeId, { place: p, spec });
        }
      }

      if (!pageResult.nextPageToken) break;
      pageToken = pageResult.nextPageToken;
    }

    if (opts.markQueries && spec.queryId) {
      await markQueryRun(db, spec.queryId, cooldownDays);
    }
  }

  summary.no_website_candidates = candidates.size;

  // Dedup against what we've already discovered, then insert.
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
      const rows = fresh.map((c) => toProspectRow(c.place, c.spec));
      const { error, count } = await db.from('lead_prospects').insert(rows, { count: 'exact' });
      if (error) summary.errors.push(`Insert: ${error.message}`);
      else summary.new_prospects = count ?? rows.length;
    }
  }

  return summary;
}

async function markQueryRun(db: SupabaseAdmin, id: string, cooldownDays: number) {
  await db
    .from('lead_discovery_queries')
    .update({
      last_run_at: new Date().toISOString(),
      last_error: null,
      cooldown_until: new Date(Date.now() + cooldownDays * 86_400_000).toISOString(),
    })
    .eq('id', id);
}

export function toProspectRow(p: PlaceResult, spec: SearchSpec) {
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
    city: p.city ?? spec.city,
    region: spec.region,
    phone: p.phone,
    website: null,
    business_types: p.types,
    // Clean searched category (e.g. "landscaper") — the filterable label, far
    // less noisy than Google's business_types array.
    niche: spec.niche,
    rating: p.rating,
    review_count: p.reviewCount,
    business_status: p.businessStatus,
    discovered_via_query_id: spec.queryId ?? null,
    audit_status: 'no_website',
    pitch_angles: angles,
    // All prospects are no-website (the strongest pitch). The call list ranks
    // by review volume, not this field — see the Discover page.
    pitch_strength: 100,
  };
}
