/**
 * Verifies lib/marketing/geo.ts — the pure geo-target selection/normalization
 * that turns SuggestGeoTargetConstants output into the geoTargetConstants a
 * campaign is targeted to. Runs the real TypeScript via Node type stripping.
 *
 * Run: node scripts/verify-marketing-geo.mjs
 */

import path from 'node:path';

const root = process.cwd();
const failures = [];

function check(name, cond, detail) {
  if (!cond) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}
function eq(name, a, b) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  check(name, A === B, `${A} !== ${B}`);
}

const geo = await import(path.join(root, 'lib/marketing/geo.ts'));
const { inferCountryCode, selectGeoTargets, DEFAULT_COUNTRY_CODE } = geo;

// ── inferCountryCode ─────────────────────────────────────────────────────────
check('country: Canada', inferCountryCode(['Toronto, Ontario, Canada']) === 'CA');
check('country: default when none named', inferCountryCode(['Toronto, ON']) === DEFAULT_COUNTRY_CODE);
check('country: USA', inferCountryCode(['New York, NY, USA']) === 'US');
check('country: UK', inferCountryCode(['London, UK']) === 'GB');
check('country: bare city → default', inferCountryCode(['Sydney']) === 'CA');
check('country: scans all entries', inferCountryCode(['Toronto', 'Buffalo, United States']) === 'US');

// ── selectGeoTargets ─────────────────────────────────────────────────────────

const gtc = (o) => ({ status: 'ENABLED', ...o });

// 1. One best pick per search term; wrong-country same-name dropped.
eq('one per term, country filter',
  selectGeoTargets([
    { search_term: 'Toronto', reach: 100, geo_target_constant: gtc({ id: 1, resource_name: 'geoTargetConstants/1', name: 'Toronto', canonical_name: 'Toronto,Ontario,Canada', country_code: 'CA' }) },
    { search_term: 'Toronto', reach: 5,   geo_target_constant: gtc({ id: 2, resource_name: 'geoTargetConstants/2', name: 'Toronto', canonical_name: 'Toronto,Ohio,United States', country_code: 'US' }) },
    { search_term: 'Mississauga', reach: 50, geo_target_constant: gtc({ id: 3, resource_name: 'geoTargetConstants/3', name: 'Mississauga', canonical_name: 'Mississauga,Ontario,Canada', country_code: 'CA' }) },
  ], 'CA'),
  ['geoTargetConstants/1', 'geoTargetConstants/3'],
);

// 2. Exact name match beats a higher-reach non-exact candidate.
eq('exact match beats reach',
  selectGeoTargets([
    { search_term: 'Toronto', reach: 1000, geo_target_constant: gtc({ id: 10, resource_name: 'geoTargetConstants/10', name: 'Toronto Division', canonical_name: 'Toronto Division,Ontario,Canada', country_code: 'CA' }) },
    { search_term: 'Toronto', reach: 100,  geo_target_constant: gtc({ id: 11, resource_name: 'geoTargetConstants/11', name: 'Toronto', canonical_name: 'Toronto,Ontario,Canada', country_code: 'CA' }) },
  ], 'CA'),
  ['geoTargetConstants/11'],
);

// 3. Non-ENABLED constants are ignored (term yields nothing).
eq('drops non-enabled',
  selectGeoTargets([
    { search_term: 'X', reach: 999, geo_target_constant: { status: 'REMOVED', id: 20, resource_name: 'geoTargetConstants/20', name: 'X', country_code: 'CA' } },
  ], 'CA'),
  [],
);

// 4. resource_name is derived from id when absent.
eq('derives resource_name from id',
  selectGeoTargets([
    { search_term: 'Y', reach: 1, geo_target_constant: gtc({ id: 30, name: 'Y', canonical_name: 'Y,Ontario,Canada', country_code: 'CA' }) },
  ], 'CA'),
  ['geoTargetConstants/30'],
);

// 5. Same constant matched by two terms is emitted once.
eq('dedupes across terms',
  selectGeoTargets([
    { search_term: 'Toronto', reach: 10, geo_target_constant: gtc({ id: 1, resource_name: 'geoTargetConstants/1', name: 'Toronto', canonical_name: 'Toronto,Ontario,Canada', country_code: 'CA' }) },
    { search_term: 'Toronto, ON', reach: 10, geo_target_constant: gtc({ id: 1, resource_name: 'geoTargetConstants/1', name: 'Toronto', canonical_name: 'Toronto,Ontario,Canada', country_code: 'CA' }) },
  ], 'CA'),
  ['geoTargetConstants/1'],
);

// 6. A suggestion with no country_code is not filtered out.
eq('missing country_code passes filter',
  selectGeoTargets([
    { search_term: 'Z', reach: 1, geo_target_constant: gtc({ id: 40, resource_name: 'geoTargetConstants/40', name: 'Z', canonical_name: 'Z' }) },
  ], 'CA'),
  ['geoTargetConstants/40'],
);

// 7. Empty input → empty output (the caller treats this as "refuse to launch").
eq('empty suggestions', selectGeoTargets([], 'CA'), []);

if (failures.length) {
  console.error(`\n✗ verify-marketing-geo: ${failures.length} failure(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ verify-marketing-geo: all checks passed');
