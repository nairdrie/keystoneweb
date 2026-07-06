/**
 * Geo targeting helpers — turning the free-form location strings on a campaign
 * ("Toronto, ON", "Greater Toronto Area", "Toronto, Ontario, Canada") into the
 * Google `geoTargetConstants/<id>` resource names a campaign is targeted to.
 *
 * An exact `geo_target_constant.name = '...'` match (the original approach)
 * silently fails on any of those messy forms, which left campaigns with NO
 * location criteria — i.e. serving worldwide. The live resolver now leans on
 * Google's SuggestGeoTargetConstants; the selection/normalization logic here is
 * pure and unit-tested, and google-ads.ts feeds it the raw API response.
 */

/** Country name (as it may appear in a location string) → ISO code Google expects. */
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'canada': 'CA',
  'united states': 'US', 'united states of america': 'US', 'usa': 'US', 'u.s.': 'US', 'us': 'US', 'america': 'US',
  'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB', 'england': 'GB',
  'australia': 'AU', 'new zealand': 'NZ', 'ireland': 'IE',
};

/**
 * Default country used to disambiguate bare place names ("Toronto" alone exists
 * in several countries). Keystone is a Canada-based platform (CAD billing, .ca
 * domain), so CA is the safe default when a location string names no country.
 */
export const DEFAULT_COUNTRY_CODE = 'CA';

/**
 * Infer an ISO country code from a set of location strings by looking for a
 * country name in any comma-separated component (e.g. "Toronto, Ontario, Canada"
 * → "CA"). Returns DEFAULT_COUNTRY_CODE when none is named.
 */
export function inferCountryCode(locationNames: string[]): string {
  for (const raw of locationNames) {
    for (const part of raw.split(',')) {
      const code = COUNTRY_NAME_TO_CODE[part.trim().toLowerCase()];
      if (code) return code;
    }
  }
  return DEFAULT_COUNTRY_CODE;
}

/** Minimal shape of a SuggestGeoTargetConstants suggestion we depend on. */
export interface GeoSuggestion {
  reach?: number | null;
  search_term?: string | null;
  geo_target_constant?: {
    resource_name?: string | null;
    id?: string | number | null;
    name?: string | null;
    canonical_name?: string | null;
    country_code?: string | null;
    status?: string | null;
  } | null;
}

function resourceNameOf(gtc: NonNullable<GeoSuggestion['geo_target_constant']>): string | null {
  if (gtc.resource_name) return gtc.resource_name;
  if (gtc.id != null) return `geoTargetConstants/${gtc.id}`;
  return null;
}

/**
 * Reduce the raw suggestions from SuggestGeoTargetConstants to at most one geo
 * target resource name per requested location: the best ENABLED match in the
 * requested country. "Best" prefers an exact name / canonical-name match to the
 * search term, then the highest reach. Suggestions outside `countryCode` are
 * dropped so a same-named place in another country can't slip in.
 */
export function selectGeoTargets(
  suggestions: GeoSuggestion[],
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string[] {
  const byTerm = new Map<string, GeoSuggestion[]>();
  for (const s of suggestions || []) {
    const term = (s?.search_term || '').toLowerCase().trim();
    const list = byTerm.get(term) ?? [];
    list.push(s);
    byTerm.set(term, list);
  }

  const out: string[] = [];
  const seen = new Set<string>();

  for (const [term, group] of byTerm) {
    let best: GeoSuggestion | null = null;
    let bestScore = -Infinity;
    for (const s of group) {
      const gtc = s?.geo_target_constant;
      if (!gtc) continue;
      if (gtc.status && gtc.status !== 'ENABLED') continue;
      if (countryCode && gtc.country_code && gtc.country_code !== countryCode) continue;

      const name = (gtc.name || '').toLowerCase().trim();
      const canonical = (gtc.canonical_name || '').toLowerCase().trim();
      const exact = !!term && (name === term || canonical === term || canonical.startsWith(`${term},`));
      const score = (exact ? 1e15 : 0) + Number(s?.reach || 0);
      if (score > bestScore) { bestScore = score; best = s; }
    }
    const gtc = best?.geo_target_constant;
    if (!gtc) continue;
    const rn = resourceNameOf(gtc);
    if (rn && !seen.has(rn)) { seen.add(rn); out.push(rn); }
  }

  return out;
}
