// Shared lead-discovery core.
//
// Both the scheduled cron (app/api/cron/leads/discover) and the manual
// operator-triggered run (app/api/ops/lead-prospects/discover) funnel through
// runDiscoveryForQuery so the "skip page 1, keep the lower-ranked businesses
// who actually need help" logic lives in exactly one place.

import type { createAdminClient } from '@/lib/db/supabase-admin';
import { searchTextGta, type PlaceResult } from '@/lib/leads/places';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

// Cooldown applied after every visit (scheduled or manual) so we don't burn a
// Places call re-scanning the same niche/city the next day.
export const COOLDOWN_DAYS = 60;

export interface DiscoveryQuery {
  id: string;
  niche: string;
  city: string;
  region: string;
}

export interface DiscoveryRunResult {
  niche: string;
  city: string;
  inserted: number;
  duplicates: number;
  scanned: number;
  error: string | null;
  // True when the query returned <20 total results (no page 2) — too narrow to
  // bother with under skip-page-1 logic.
  tooNarrow: boolean;
}

// Find-or-create the lead_discovery_queries row for a niche/city so manually
// triggered runs share the same dedup + cooldown bookkeeping as the cron.
export async function ensureDiscoveryQuery(
  db: SupabaseAdmin,
  input: { niche: string; city: string; region: string },
): Promise<DiscoveryQuery> {
  const niche = input.niche.trim();
  const city = input.city.trim();

  const { data: existing } = await db
    .from('lead_discovery_queries')
    .select('id, niche, city, region')
    .eq('niche', niche)
    .eq('city', city)
    .maybeSingle();

  if (existing) {
    // Make sure a previously-disabled or differently-regioned query is usable.
    if (existing.region !== input.region) {
      await db
        .from('lead_discovery_queries')
        .update({ region: input.region, enabled: true })
        .eq('id', existing.id);
    }
    return { id: existing.id, niche, city, region: input.region };
  }

  const { data: created, error } = await db
    .from('lead_discovery_queries')
    .insert({ niche, city, region: input.region, enabled: true })
    .select('id, niche, city, region')
    .single();

  if (error || !created) {
    throw new Error(`Failed to create discovery query: ${error?.message ?? 'unknown error'}`);
  }
  return { id: created.id, niche: created.niche, city: created.city, region: created.region };
}

// Run discovery for a single niche/city query. Skips page 1 (top-ranked
// businesses don't need us), inserts the fresh page-2 prospects, and records
// the visit + cooldown on the query row.
export async function runDiscoveryForQuery(
  db: SupabaseAdmin,
  query: DiscoveryQuery,
): Promise<DiscoveryRunResult> {
  const result: DiscoveryRunResult = {
    niche: query.niche,
    city: query.city,
    inserted: 0,
    duplicates: 0,
    scanned: 0,
    error: null,
    tooNarrow: false,
  };

  // ----- Skip page 1: low-ranked businesses are who needs help -----
  // pageTokens expire in minutes, so the page-1 throwaway and the page-2 fetch
  // we actually want both happen in the same invocation.
  let firstPage;
  try {
    firstPage = await searchTextGta({ niche: query.niche, city: query.city, pageToken: null });
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    await markRun(db, query.id, result.error);
    return result;
  }

  if (!firstPage.nextPageToken) {
    // Fewer than 20 results total — query too narrow. Cooldown so we don't
    // waste a Places call on it again tomorrow.
    result.tooNarrow = true;
    result.scanned = firstPage.places.length;
    await markRun(db, query.id, null);
    return result;
  }

  let pageResult;
  try {
    pageResult = await searchTextGta({
      niche: query.niche,
      city: query.city,
      pageToken: firstPage.nextPageToken,
    });
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    await markRun(db, query.id, result.error);
    return result;
  }

  result.scanned = pageResult.places.length;

  if (pageResult.places.length > 0) {
    const placeIds = pageResult.places.map((p) => p.placeId);
    const { data: existing } = await db
      .from('lead_prospects')
      .select('place_id')
      .in('place_id', placeIds);
    const existingSet = new Set((existing ?? []).map((r) => r.place_id));

    const fresh = pageResult.places.filter((p) => !existingSet.has(p.placeId));
    result.duplicates = pageResult.places.length - fresh.length;

    if (fresh.length > 0) {
      const rows = fresh.map((p) => toProspectRow(p, query));
      const { error: insertErr, count } = await db
        .from('lead_prospects')
        .insert(rows, { count: 'exact' });
      if (insertErr) {
        result.error = insertErr.message;
      } else {
        result.inserted = count ?? rows.length;
      }
    }
  }

  await markRun(db, query.id, null);
  return result;
}

export async function markRun(db: SupabaseAdmin, id: string, error: string | null) {
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

export function toProspectRow(p: PlaceResult, query: DiscoveryQuery) {
  return {
    place_id: p.placeId,
    name: p.name,
    formatted_address: p.formattedAddress,
    city: p.city ?? query.city,
    region: query.region,
    niche: query.niche,
    phone: p.phone,
    website: p.website,
    business_types: p.types,
    discovered_via_query_id: query.id,
    audit_status: p.website ? 'pending' : 'no_website',
    pitch_angles: p.website ? [] : ['No website — only Google Business Profile'],
    pitch_strength: p.website ? 0 : 100,
  };
}
