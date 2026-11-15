import {
  normalizeRegistrant,
  parseVercelSchema,
  tldOf,
  validateRegistrant,
  type RegistrantContact,
  type RegistrantErrors,
  type RegistrantSchema,
} from './registrant';

const VERCEL_API_BASE = 'https://api.vercel.com';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const cache = new Map<string, { at: number; schema: RegistrantSchema }>();

/**
 * Fetch Vercel's TLD-specific registrant requirements for a domain.
 * Returns an empty schema for TLDs without extra rules, or null if the lookup
 * failed (callers then fall back to the standard checks only).
 */
export async function getRegistrantSchema(domain: string): Promise<RegistrantSchema | null> {
  const tld = tldOf(domain);
  const hit = cache.get(tld);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.schema;

  const token = process.env.VERCEL_API_TOKEN;
  if (!token) return null;
  const teamParam = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : '';

  try {
    const res = await fetch(
      `${VERCEL_API_BASE}/v1/registrar/domains/${encodeURIComponent(domain)}/contact-info/schema${teamParam}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    if (!res.ok) {
      console.error(`getRegistrantSchema: ${res.status} for ${domain}`);
      return null;
    }
    const schema = parseVercelSchema(tld, await res.json());
    cache.set(tld, { at: Date.now(), schema });
    return schema;
  } catch (err) {
    console.error('getRegistrantSchema failed:', err);
    return null;
  }
}

export type RegistrantCheck =
  | { ok: true; contact: RegistrantContact; schema: RegistrantSchema | null }
  | { ok: false; error: string; fieldErrors: RegistrantErrors };

/**
 * Validate registrant details against the domain's registry requirements.
 * Used by the free purchase route and paid checkout so problems surface
 * before anything is bought or charged.
 */
export async function checkRegistrant(domain: string, contact: unknown): Promise<RegistrantCheck> {
  if (!contact || typeof contact !== 'object') {
    return {
      ok: false,
      error: 'Please enter the domain owner contact details.',
      fieldErrors: { firstName: 'Required' },
    };
  }
  const schema = await getRegistrantSchema(domain);
  const normalized = normalizeRegistrant(contact as RegistrantContact, schema);
  const fieldErrors = validateRegistrant(normalized, schema);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: 'Please fix the highlighted owner details.', fieldErrors };
  }
  return { ok: true, contact: normalized, schema };
}
