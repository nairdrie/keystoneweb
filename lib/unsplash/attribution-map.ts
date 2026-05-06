/**
 * Photographer attribution for the Unsplash photos hardcoded into our
 * structural templates and admin seed data.
 *
 * The keys are the CDN photo-id slugs (the segment that follows
 * `images.unsplash.com/`, e.g. `photo-1495020689067-958852a7765e`). When a
 * template helper or render path encounters one of these IDs, it looks up
 * the corresponding attribution here and surfaces it both at site
 * instantiation time and at render time so every published Unsplash photo
 * carries a "Photo by {name} on Unsplash" caption (Unsplash API Terms §9).
 *
 * To populate or refresh this map, run:
 *   npx tsx scripts/fetch-unsplash-attribution.ts
 * with `UNSPLASH_ACCESS_KEY` exported in the environment. The script reads
 * every CDN photo-id used in `lib/templates/*` and rewrites this file.
 *
 * Entries with `null` mean we have not yet fetched attribution for that
 * photo. The renderer treats a `null` entry as "no caption" — it does NOT
 * fall back to displaying the image without credit; instead, the
 * surrounding code is structured so that a `null` here is the only path
 * that can produce an Unsplash image without a caption, and is therefore
 * easy to find via grep before any production deploy.
 */
import type { UnsplashAttribution } from './types';

export const UNSPLASH_ATTRIBUTION_MAP: Record<string, UnsplashAttribution | null> = {
    'photo-1450101499163-c8848c66ca85': null,
    'photo-1452860606245-08befc0ff44b': null,
    'photo-1473093295043-cdd812d0e601': null,
    'photo-1488477181946-6428a0291777': null,
    'photo-1492684223066-81342ee5ff30': null,
    'photo-1492691527719-9d1e07e534b4': null,
    'photo-1495020689067-958852a7765e': null,
    'photo-1497366754035-f200968a6e72': null,
    'photo-1497366811353-6870744d04b2': null,
    'photo-1500530855697-b586d89ba3ee': null,
    'photo-1500534314209-a25ddb2bd429': null,
    'photo-1503387762-592deb58ef4e': null,
    'photo-1504674900247-0877df9cc836': null,
    'photo-1508214751196-bcfd4ca60f91': null,
    'photo-1513519245088-0e12902e5a38': null,
    'photo-1516035069371-29a1b244cc32': null,
    'photo-1516321318423-f06f85e504b3': null,
    'photo-1517248135467-4c7edcad34c4': null,
    'photo-1517701604599-bb29b565090c': null,
    'photo-1518005020951-eccb494ad742': null,
    'photo-1520453803296-c39eabe2dab4': null,
    'photo-1524758631624-e2822e304c36': null,
    'photo-1525351484163-7529414344d8': null,
    'photo-1528207776546-365bb710ee93': null,
    'photo-1528735602780-2552fd46c7af': null,
    'photo-1528756514091-dee5ecaa3278': null,
    'photo-1532550907401-a500c9a57435': null,
    'photo-1533174072545-7a4b6ad7a6c3': null,
    'photo-1540420773420-3366772f4999': null,
    'photo-1546069901-ba9599a7e63c': null,
    'photo-1551024709-8f23befc6f87': null,
    'photo-1554224155-6726b3ff858f': null,
    'photo-1556761175-b413da4baf72': null,
};

/**
 * Extract the CDN photo-id from any `images.unsplash.com/...` URL. Returns
 * `null` if the URL is not an Unsplash CDN URL or doesn't contain a
 * recognizable photo slug.
 */
export function extractUnsplashPhotoId(url: string | null | undefined): string | null {
    if (!url) return null;
    const match = url.match(/images\.unsplash\.com\/(photo-[a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

/**
 * Look up attribution for a known CDN photo-id, or extract the id from a
 * URL and look that up. Returns `null` if the id is unknown to the map or
 * has not yet been populated.
 */
export function lookupAttributionForUrl(
    url: string | null | undefined,
): UnsplashAttribution | null {
    const id = extractUnsplashPhotoId(url);
    if (!id) return null;
    return UNSPLASH_ATTRIBUTION_MAP[id] ?? null;
}
