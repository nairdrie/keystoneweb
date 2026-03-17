import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy for Google Places Text Search API.
 * Keeps the API key server-side and prevents direct client exposure.
 *
 * GET /api/seo/places?query=Acme+Plumbing+Vancouver
 * Returns a list of place candidates with address, phone, and coordinates.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query');

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ places: [] });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Places API not configured' }, { status: 503 });
  }

  try {
    // Text Search to get candidate place IDs
    const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    searchUrl.searchParams.set('query', query);
    searchUrl.searchParams.set('key', apiKey);

    const searchRes = await fetch(searchUrl.toString(), { cache: 'no-store' });
    if (!searchRes.ok) {
      throw new Error(`Places Text Search failed: ${searchRes.status}`);
    }

    const searchData = await searchRes.json();

    if (searchData.status === 'ZERO_RESULTS' || !searchData.results?.length) {
      return NextResponse.json({ places: [] });
    }

    // Return up to 5 candidates with the fields needed for JSON-LD
    const candidates = searchData.results.slice(0, 5).map((place: any) => ({
      placeId: place.place_id,
      name: place.name,
      formattedAddress: place.formatted_address,
      // Geometry is included in Text Search results
      latitude: place.geometry?.location?.lat ?? null,
      longitude: place.geometry?.location?.lng ?? null,
    }));

    // Enrich first candidate (and up to 5) with phone number via Place Details
    const enriched = await Promise.all(
      candidates.map(async (candidate: any) => {
        try {
          const detailUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
          detailUrl.searchParams.set('place_id', candidate.placeId);
          detailUrl.searchParams.set('fields', 'formatted_phone_number,address_component');
          detailUrl.searchParams.set('key', apiKey);

          const detailRes = await fetch(detailUrl.toString(), { cache: 'no-store' });
          if (!detailRes.ok) return candidate;

          const detailData = await detailRes.json();
          const result = detailData.result || {};

          // Parse address components
          const components: Record<string, string> = {};
          for (const comp of result.address_components || []) {
            const type = comp.types?.[0];
            if (type) components[type] = comp.short_name || comp.long_name;
          }

          return {
            ...candidate,
            telephone: result.formatted_phone_number || null,
            streetNumber: components['street_number'] || '',
            route: components['route'] || '',
            addressLocality: components['locality'] || components['sublocality'] || '',
            addressRegion: components['administrative_area_level_1'] || '',
            postalCode: components['postal_code'] || '',
            addressCountry: components['country'] || '',
          };
        } catch {
          return candidate;
        }
      })
    );

    return NextResponse.json({ places: enriched });
  } catch (err) {
    console.error('Google Places proxy error:', err);
    return NextResponse.json({ error: 'Failed to search places' }, { status: 500 });
  }
}
