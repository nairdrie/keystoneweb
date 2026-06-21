import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { ensureDiscoveryQuery, runDiscoveryForQuery, type DiscoveryRunResult } from '@/lib/leads/discover';
import { isLeadRegion } from '@/lib/leads/regions';

// POST /api/ops/lead-prospects/discover
// Operator-triggered prospect finder. Runs Google Places discovery on demand
// for a chosen niche across one or more GTA cities, instead of waiting for the
// weekday cron rotation. Newly found prospects land in the normal audit
// pipeline (pending → audited) just like cron-discovered ones.
//
// Body: { niche: string, region: LeadRegion, cities: string[] }

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_CITIES = 12; // bound the Places spend + keep us under the function timeout

export async function POST(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access?.isAdmin) {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const niche = typeof body.niche === 'string' ? body.niche.trim() : '';
  const region = typeof body.region === 'string' ? body.region : '';
  const rawCities: unknown[] = Array.isArray(body.cities) ? body.cities : [];

  if (!niche) {
    return NextResponse.json({ error: 'A niche is required.' }, { status: 400 });
  }
  if (!isLeadRegion(region)) {
    return NextResponse.json({ error: 'A valid region is required.' }, { status: 400 });
  }

  // Normalize, dedupe, and bound the city list.
  const cities = Array.from(
    new Set(
      rawCities
        .filter((c): c is string => typeof c === 'string')
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  );

  if (cities.length === 0) {
    return NextResponse.json({ error: 'Select at least one city.' }, { status: 400 });
  }
  if (cities.length > MAX_CITIES) {
    return NextResponse.json(
      { error: `Too many cities — pick at most ${MAX_CITIES} per run.` },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  // Run cities sequentially: each does 2 Places calls and they share the same
  // dedup table, so parallelism buys little and risks the timeout.
  const results: DiscoveryRunResult[] = [];
  for (const city of cities) {
    try {
      const query = await ensureDiscoveryQuery(db, { niche, city, region });
      results.push(await runDiscoveryForQuery(db, query));
    } catch (err) {
      results.push({
        niche,
        city,
        inserted: 0,
        duplicates: 0,
        scanned: 0,
        error: err instanceof Error ? err.message : String(err),
        tooNarrow: false,
      });
    }
  }

  const totals = results.reduce(
    (acc, r) => ({
      inserted: acc.inserted + r.inserted,
      duplicates: acc.duplicates + r.duplicates,
      scanned: acc.scanned + r.scanned,
    }),
    { inserted: 0, duplicates: 0, scanned: 0 },
  );

  console.log(
    `[ops/lead-prospects/discover] ${niche} x ${cities.length} cities (${region}): ` +
      `+${totals.inserted} new, ${totals.duplicates} dupes`,
  );

  return NextResponse.json({ niche, region, cities, totals, results });
}
