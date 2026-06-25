/**
 * Sitelink generation for Google Ads search campaigns.
 *
 * Google recommends every search campaign carry at least six sitelinks — the
 * extra page links that appear under the headline ("Services", "Gallery",
 * "Contact Us", …). Without them the ad serves in a smaller, lower-CTR format
 * and Google nags the operator to add them by hand. Since a Keystone site
 * already has a navigation menu of pages, we can mint those sitelinks
 * automatically from the site's nav and attach them at deploy time.
 *
 * The pure builders ({@link siteBaseUrl}, {@link buildSitelinkSpecs}) have no
 * runtime imports so they're unit-testable; {@link loadSitelinkSpecs} pulls the
 * site + pages from the DB via a lazy import (so importing this module never
 * drags in server-only code).
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface SitelinkSpec {
  /** Shown as the clickable link text. Google limit: 1–25 chars. */
  linkText: string;
  /** Absolute landing URL for this sitelink. */
  finalUrl: string;
  /** Optional description line 1 (1–35 chars). Must be paired with description2. */
  description1?: string;
  /** Optional description line 2 (1–35 chars). Must be paired with description1. */
  description2?: string;
}

/** Subset of a `pages` row that the builder needs. */
export interface SitelinkPageInput {
  slug?: string | null;
  title?: string | null;
  display_name?: string | null;
  is_visible_in_nav?: boolean | null;
  nav_order?: number | null;
}

const MAX_SITELINKS = 8;
const MAX_LINK_TEXT = 25;

// ── Pure builders ─────────────────────────────────────────────────────────────

/** Build the canonical site base URL (no trailing slash) from its domain/slug. */
export function siteBaseUrl(opts: { customDomain?: string | null; siteSlug?: string | null }): string | null {
  const domain = (opts.customDomain || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (domain) return `https://${domain}`;
  const slug = (opts.siteSlug || '').trim();
  if (slug) return `https://${slug}.kswd.ca`;
  return null;
}

/** First non-empty, non-placeholder label among the candidates, cleaned up. */
function cleanLabel(...candidates: Array<string | null | undefined>): string {
  for (const c of candidates) {
    const v = (c || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (v && v.toLowerCase() !== 'untitled') return v;
  }
  return '';
}

/** Turn a slug ("get-a-quote") into a readable label ("Get A Quote"). */
function humanizeSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function stripQuery(url: string): string {
  const i = url.indexOf('?');
  return i >= 0 ? url.slice(0, i) : url;
}

function normalizeUrl(url: string): string {
  return stripQuery(url).trim().replace(/\/+$/, '').toLowerCase();
}

/**
 * Build sitelink specs from a site's nav pages.
 *
 * Pages hidden from the nav are skipped; the rest are ordered by nav_order,
 * de-duplicated by URL and label, and the campaign's own landing page is
 * excluded (a sitelink identical to the main ad URL is pointless). Capped at
 * {@link MAX_SITELINKS}.
 */
export function buildSitelinkSpecs(opts: {
  baseUrl: string;
  pages: SitelinkPageInput[];
  landingFinalUrl?: string | null;
  max?: number;
}): SitelinkSpec[] {
  const base = (opts.baseUrl || '').replace(/\/+$/, '');
  if (!base) return [];
  const max = opts.max ?? MAX_SITELINKS;
  const landing = opts.landingFinalUrl ? normalizeUrl(opts.landingFinalUrl) : null;

  const visible = (opts.pages || [])
    .filter(p => p && p.is_visible_in_nav !== false && (p.slug || '').trim())
    .slice()
    .sort((a, b) => (a.nav_order ?? 0) - (b.nav_order ?? 0));

  const seenUrl = new Set<string>();
  const seenText = new Set<string>();
  const specs: SitelinkSpec[] = [];

  for (const p of visible) {
    const slug = (p.slug || '').trim();
    const url = slug === 'home' ? base : `${base}/${slug.replace(/^\/+/, '')}`;
    const nUrl = normalizeUrl(url);
    if (landing && nUrl === landing) continue;   // don't duplicate the main ad URL
    if (seenUrl.has(nUrl)) continue;

    const label = (cleanLabel(p.display_name, p.title) || humanizeSlug(slug)).slice(0, MAX_LINK_TEXT).trim();
    if (!label) continue;
    const labelKey = label.toLowerCase();
    if (seenText.has(labelKey)) continue;

    seenUrl.add(nUrl);
    seenText.add(labelKey);
    specs.push({ linkText: label, finalUrl: url });
    if (specs.length >= max) break;
  }

  return specs;
}

// ── DB loader ─────────────────────────────────────────────────────────────────

/**
 * Load a site's nav pages and build sitelink specs for a campaign. Best-effort:
 * returns [] on any failure so a sitelink problem can never block a launch.
 */
export async function loadSitelinkSpecs(
  siteId: string | null | undefined,
  opts?: { landingFinalUrl?: string | null; max?: number },
): Promise<SitelinkSpec[]> {
  if (!siteId) return [];
  try {
    const { createAdminClient } = await import('@/lib/db/supabase-admin');
    const db = createAdminClient();
    const [{ data: site }, { data: pages }] = await Promise.all([
      db.from('sites').select('site_slug, custom_domain').eq('id', siteId).single(),
      db.from('pages')
        .select('slug, title, display_name, is_visible_in_nav, nav_order')
        .eq('site_id', siteId)
        .order('nav_order', { ascending: true }),
    ]);
    if (!site) return [];
    const baseUrl = siteBaseUrl({ customDomain: site.custom_domain, siteSlug: site.site_slug });
    if (!baseUrl) return [];
    return buildSitelinkSpecs({
      baseUrl,
      pages: (pages || []) as SitelinkPageInput[],
      landingFinalUrl: opts?.landingFinalUrl,
      max: opts?.max,
    });
  } catch (err) {
    console.warn('[marketing/sitelinks] failed to load sitelinks:', err);
    return [];
  }
}
