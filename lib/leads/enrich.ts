// Lead enrichment for one-click site generation.
//
// Pulls everything we can learn about a lead's business from public sources
// before the AI build runs:
//   1. Google Places (New) — place lookup + details: verified contact info,
//      hours, rating, review snippets, and Business Profile photos.
//   2. Claude vision over the Business Profile photos — brand color and
//      style direction extracted from the business's real imagery.
//   3. The business's existing website (when it has one) — title/description
//      meta for extra copy context.
//
// Everything degrades gracefully: each source is optional and failures
// produce a partial enrichment, never an error for the whole generation.

const PLACES_BASE = 'https://places.googleapis.com/v1';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const VISION_MODEL = process.env.LEADS_VISION_MODEL || 'claude-sonnet-4-6';

const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'googleMapsUri',
  'location',
  'rating',
  'userRatingCount',
  'regularOpeningHours.weekdayDescriptions',
  'editorialSummary',
  'reviews',
  'photos',
].join(',');

export interface LeadPlaceDetails {
  placeId: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  mapsUri: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  reviewCount: number | null;
  hours: string[] | null;
  editorialSummary: string | null;
}

export interface LeadReviewSnippet {
  rating: number | null;
  text: string;
}

export interface LeadBranding {
  primary?: string;
  secondary?: string;
  accent?: string;
  styleKeywords?: string[];
  imageryNotes?: string;
}

export interface LeadWebsiteMeta {
  title?: string;
  description?: string;
}

export interface LeadEnrichment {
  place?: LeadPlaceDetails;
  reviews?: LeadReviewSnippet[];
  photoUrls?: string[];
  branding?: LeadBranding;
  websiteMeta?: LeadWebsiteMeta;
  errors?: string[];
}

export interface EnrichLeadInput {
  businessName: string;
  city?: string | null;
  region?: string | null;
  address?: string | null;
  website?: string | null;
  // Known Google place_id (e.g. from a promoted lead_prospect) skips the search.
  placeId?: string | null;
}

export async function enrichLead(input: EnrichLeadInput): Promise<LeadEnrichment> {
  const enrichment: LeadEnrichment = {};
  const errors: string[] = [];

  // ── Google Places ──────────────────────────────────────────────────────────
  try {
    const placeId = input.placeId || await findPlaceId(input);
    if (placeId) {
      const details = await fetchPlaceDetails(placeId);
      if (details) {
        enrichment.place = details.place;
        enrichment.reviews = details.reviews;
        if (details.photoNames.length > 0) {
          enrichment.photoUrls = await resolvePhotoUrls(details.photoNames.slice(0, 8));
        }
      }
    }
  } catch (err) {
    errors.push(`places: ${errorMessage(err)}`);
  }

  // ── Brand colors/style from Business Profile photos ───────────────────────
  if (enrichment.photoUrls && enrichment.photoUrls.length > 0) {
    try {
      const branding = await analyzeBrandingFromPhotos(enrichment.photoUrls.slice(0, 3), input.businessName);
      if (branding) enrichment.branding = branding;
    } catch (err) {
      errors.push(`branding: ${errorMessage(err)}`);
    }
  }

  // ── Existing website meta ──────────────────────────────────────────────────
  const website = input.website || enrichment.place?.website;
  if (website) {
    try {
      const meta = await fetchWebsiteMeta(website);
      if (meta) enrichment.websiteMeta = meta;
    } catch (err) {
      errors.push(`website: ${errorMessage(err)}`);
    }
  }

  if (errors.length > 0) enrichment.errors = errors;
  return enrichment;
}

async function findPlaceId(input: EnrichLeadInput): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const locationHint = [input.city, input.region].filter(Boolean).join(', ');
  const textQuery = [input.businessName, input.address || locationHint].filter(Boolean).join(', ');

  const response = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify({ textQuery, maxResultCount: 3 }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`searchText ${response.status}`);
  }
  const data = (await response.json()) as { places?: Array<{ id?: string; displayName?: { text?: string } }> };
  const places = data.places ?? [];
  if (places.length === 0) return null;

  // Prefer a result whose name actually overlaps the lead's business name to
  // avoid enriching the wrong business with confident-looking data.
  const target = normalizeName(input.businessName);
  const match = places.find((p) => {
    const candidate = normalizeName(p.displayName?.text || '');
    return candidate && (candidate.includes(target) || target.includes(candidate));
  });
  return (match ?? places[0]).id ?? null;
}

async function fetchPlaceDetails(placeId: string): Promise<{
  place: LeadPlaceDetails;
  reviews: LeadReviewSnippet[];
  photoNames: string[];
} | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': DETAILS_FIELD_MASK,
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`place details ${response.status}`);
  }

  const data = (await response.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    googleMapsUri?: string;
    location?: { latitude?: number; longitude?: number };
    rating?: number;
    userRatingCount?: number;
    regularOpeningHours?: { weekdayDescriptions?: string[] };
    editorialSummary?: { text?: string };
    reviews?: Array<{ rating?: number; text?: { text?: string } }>;
    photos?: Array<{ name?: string }>;
  };

  const reviews: LeadReviewSnippet[] = (data.reviews ?? [])
    .map((review) => ({
      rating: typeof review.rating === 'number' ? review.rating : null,
      text: review.text?.text?.trim() ?? '',
    }))
    .filter((review) => review.text.length > 0)
    .slice(0, 5)
    .map((review) => ({ ...review, text: review.text.slice(0, 400) }));

  return {
    place: {
      placeId: data.id ?? placeId,
      name: data.displayName?.text ?? null,
      address: data.formattedAddress ?? null,
      phone: data.nationalPhoneNumber ?? data.internationalPhoneNumber ?? null,
      website: data.websiteUri ?? null,
      mapsUri: data.googleMapsUri ?? null,
      latitude: data.location?.latitude ?? null,
      longitude: data.location?.longitude ?? null,
      rating: typeof data.rating === 'number' ? data.rating : null,
      reviewCount: typeof data.userRatingCount === 'number' ? data.userRatingCount : null,
      hours: data.regularOpeningHours?.weekdayDescriptions ?? null,
      editorialSummary: data.editorialSummary?.text ?? null,
    },
    reviews,
    photoNames: (data.photos ?? []).map((photo) => photo.name).filter((name): name is string => Boolean(name)),
  };
}

// Resolve photo resource names to stable public googleusercontent URLs via the
// media endpoint's skipHttpRedirect mode.
async function resolvePhotoUrls(photoNames: string[]): Promise<string[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  const urls = await Promise.all(photoNames.map(async (name) => {
    try {
      const response = await fetch(
        `${PLACES_BASE}/${name}/media?maxWidthPx=1600&skipHttpRedirect=true`,
        { headers: { 'X-Goog-Api-Key': apiKey }, cache: 'no-store' },
      );
      if (!response.ok) return null;
      const data = (await response.json()) as { photoUri?: string };
      return data.photoUri ?? null;
    } catch {
      return null;
    }
  }));

  return urls.filter((url): url is string => Boolean(url));
}

const BRANDING_SYSTEM_PROMPT = `You are a brand designer. You are shown photos from a small business's Google Business Profile (storefront, interior, work, food, vehicles, signage, etc.).

Derive a website branding direction from what you actually see. If signage or branded materials show clear brand colors, use them; otherwise propose colors that match the mood and materials of the imagery.

Color constraints (the website renderer requires these relationships):
- "primary" must be a DARK, readable ink color (it is used for body/heading text).
- "secondary" is the brand's stronger mid-tone or saturated color (used for buttons/CTAs).
- "accent" must be a VERY LIGHT tint usable as a section background.

Return ONLY a JSON object (no markdown fences):
{
  "primary": "#hex",
  "secondary": "#hex",
  "accent": "#hex",
  "styleKeywords": ["3-6 short adjectives, e.g. rustic, premium, playful"],
  "imageryNotes": "1-2 sentences describing what the photos show and the visual mood, for a designer who cannot see them"
}`;

async function analyzeBrandingFromPhotos(photoUrls: string[], businessName: string): Promise<LeadBranding | null> {
  const apiKey = process.env.AI_BUILDER_API_KEY;
  if (!apiKey) return null;

  const images = await Promise.all(photoUrls.map(fetchImageAsBase64));
  const validImages = images.filter((img): img is { mediaType: string; base64: string } => Boolean(img));
  if (validImages.length === 0) return null;

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 1024,
      system: BRANDING_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...validImages.map((img) => ({
              type: 'image',
              source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
            })),
            {
              type: 'text',
              text: `These are Google Business Profile photos for "${businessName}". Return the branding JSON as instructed.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`vision ${response.status}`);
  }

  const data = await response.json();
  const raw: string = data.content?.[0]?.text?.trim() ?? '';
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  const branding: LeadBranding = {};
  for (const key of ['primary', 'secondary', 'accent'] as const) {
    const value = parsed[key];
    if (typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value.trim())) {
      branding[key] = value.trim().toLowerCase();
    }
  }
  if (Array.isArray(parsed.styleKeywords)) {
    branding.styleKeywords = parsed.styleKeywords
      .filter((keyword): keyword is string => typeof keyword === 'string')
      .map((keyword) => keyword.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 6);
  }
  if (typeof parsed.imageryNotes === 'string' && parsed.imageryNotes.trim()) {
    branding.imageryNotes = parsed.imageryNotes.trim().slice(0, 500);
  }

  return Object.keys(branding).length > 0 ? branding : null;
}

async function fetchImageAsBase64(url: string): Promise<{ mediaType: string; base64: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!response.ok) return null;

    const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType)) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    // Anthropic vision caps base64 images at 5 MB.
    if (buffer.length === 0 || buffer.length > 4.5 * 1024 * 1024) return null;
    return { mediaType: contentType, base64: buffer.toString('base64') };
  } catch {
    return null;
  }
}

async function fetchWebsiteMeta(website: string): Promise<LeadWebsiteMeta | null> {
  const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KeystoneBot/1.0)' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 250_000);

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descriptionMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)
      ?? html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);

    const meta: LeadWebsiteMeta = {};
    if (titleMatch?.[1]) meta.title = decodeEntities(titleMatch[1]).trim().slice(0, 200);
    if (descriptionMatch?.[1]) meta.description = decodeEntities(descriptionMatch[1]).trim().slice(0, 500);
    return Object.keys(meta).length > 0 ? meta : null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
