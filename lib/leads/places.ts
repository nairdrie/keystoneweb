// Google Places API (New) client for the lead-discovery cron.
// Mirrors the pattern in app/api/seo/places/route.ts (X-Goog-Api-Key +
// X-Goog-FieldMask) but adds the fields we need for prospects (websiteUri,
// types) and supports pagination via pageToken.
//
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search

const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

// Rough bounding box covering the GTA. We pass this as locationBias so that
// city-name queries don't bleed into Hamilton, Guelph, Barrie, etc.
const GTA_BOUNDS = {
  low: { latitude: 43.40, longitude: -79.95 },
  high: { latitude: 44.05, longitude: -78.80 },
};

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.types',
  'places.addressComponents',
  // Quality signals: rating + review count tell us whether a no-website
  // business is actually active (worth a call) or a dead/ghost listing.
  // businessStatus lets us drop permanently/temporarily closed businesses.
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'nextPageToken',
].join(',');

export interface PlaceResult {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  website: string | null;
  types: string[];
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PlacesSearchResult {
  places: PlaceResult[];
  nextPageToken: string | null;
}

export class PlacesApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'PlacesApiError';
  }
}

export async function searchTextGta(params: {
  niche: string;
  city: string;
  pageToken?: string | null;
  pageSize?: number;
}): Promise<PlacesSearchResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new PlacesApiError('GOOGLE_PLACES_API_KEY not configured', 503);
  }

  const body: Record<string, unknown> = {
    textQuery: `${params.niche} in ${params.city}, Ontario`,
    maxResultCount: Math.min(params.pageSize ?? 20, 20),
    locationBias: { rectangle: GTA_BOUNDS },
  };
  if (params.pageToken) {
    body.pageToken = params.pageToken;
  }

  const response = await fetch(PLACES_TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new PlacesApiError(
      `Places searchText failed: ${response.status}`,
      response.status,
      errBody,
    );
  }

  const data = (await response.json()) as {
    places?: RawPlace[];
    nextPageToken?: string;
  };

  return {
    places: (data.places ?? []).map(normalize),
    nextPageToken: data.nextPageToken ?? null,
  };
}

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  types?: string[];
  addressComponents?: Array<{ types?: string[]; shortText?: string; longText?: string }>;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
}

function normalize(p: RawPlace): PlaceResult {
  const components: Record<string, string> = {};
  for (const c of p.addressComponents ?? []) {
    const t = c.types?.[0];
    if (!t) continue;
    components[t] = c.longText ?? c.shortText ?? '';
  }

  return {
    placeId: p.id ?? '',
    name: p.displayName?.text ?? '',
    formattedAddress: p.formattedAddress ?? null,
    city: components['locality'] || components['sublocality'] || null,
    region: components['administrative_area_level_1'] || null,
    postalCode: components['postal_code'] || null,
    country: components['country'] || null,
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    types: p.types ?? [],
    rating: typeof p.rating === 'number' ? p.rating : null,
    reviewCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    businessStatus: p.businessStatus ?? null,
    latitude: p.location?.latitude ?? null,
    longitude: p.location?.longitude ?? null,
  };
}
