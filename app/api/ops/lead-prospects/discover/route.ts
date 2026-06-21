import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { runDiscovery, type SearchSpec } from '@/lib/leads/discover';

// POST /api/ops/lead-prospects/discover
// On-demand prospect finder: { niche, region? } pulls ~10 fresh no-website
// businesses in that niche right now, so an operator can say "find me
// landscapers to call" without waiting for the daily cron.

export const runtime = 'nodejs';
export const maxDuration = 60;

const TARGET = 10;        // no-website prospects to find per click
const MAX_CITIES = 12;    // function-timeout guard

const VALID_REGIONS = new Set(['toronto_core', 'york', 'peel', 'halton', 'durham']);

export async function POST(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const niche = (body && typeof body.niche === 'string' ? body.niche.trim().toLowerCase() : '').slice(0, 80);
  const region =
    body && typeof body.region === 'string' && VALID_REGIONS.has(body.region) ? body.region : 'all';

  if (!niche) {
    return NextResponse.json({ error: 'Niche is required' }, { status: 400 });
  }

  const db = createAdminClient();

  // Reuse the seeded GTA city matrix for geography. We don't need a row to
  // match the niche — any niche can be searched — but when one exists we
  // attribute the prospect back to it.
  let cityQuery = db.from('lead_discovery_queries').select('id, niche, city, region');
  if (region !== 'all') cityQuery = cityQuery.eq('region', region);
  const { data: queryRows } = await cityQuery;

  const cityMap = new Map<string, { city: string; region: string; queryId: string | null }>();
  for (const r of queryRows ?? []) {
    const key = `${r.region}::${r.city}`;
    const matches = r.niche === niche;
    const existing = cityMap.get(key);
    if (!existing) {
      cityMap.set(key, { city: r.city, region: r.region, queryId: matches ? r.id : null });
    } else if (matches && !existing.queryId) {
      existing.queryId = r.id;
    }
  }

  const cities = shuffle([...cityMap.values()]);
  if (cities.length === 0) {
    return NextResponse.json({ error: 'No cities configured for that region' }, { status: 400 });
  }

  const specs: SearchSpec[] = cities.map((c) => ({
    niche,
    city: c.city,
    region: c.region,
    queryId: c.queryId,
  }));

  const summary = await runDiscovery(db, specs, {
    target: TARGET,
    pagesPerQuery: 3,
    maxSpecs: MAX_CITIES,
    markQueries: false, // ad-hoc search shouldn't burn the daily cron's cooldowns
  });

  return NextResponse.json({ niche, region, ...summary });
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
