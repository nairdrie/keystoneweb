import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy for Google Places API (New/v1).
 * 
 * GET /api/seo/places?query=Acme+Plumbing+Toronto
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
    // Places API (New) - Search Text
    // https://developers.google.com/maps/documentation/places/web-service/search-text
    const url = 'https://places.googleapis.com/v1/places:searchText';
    
    // We request specific fields via the FieldMask header to control costs and data
    const fieldMask = [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.location',
      'places.nationalPhoneNumber',
      'places.addressComponents'
    ].join(',');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 5,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('Google Places API (New) error:', response.status, errData);
      return NextResponse.json({ 
        error: `Google API Error: ${response.status}`,
        message: errData.error?.message || 'Failed to search places'
      }, { status: response.status });
    }

    const data = await response.json();

    if (!data.places || data.places.length === 0) {
      return NextResponse.json({ places: [] });
    }

    const places = data.places.map((place: any) => {
      // Parse address components
      const components: Record<string, string> = {};
      for (const comp of place.addressComponents || []) {
        const type = comp.types?.[0];
        if (type) components[type] = comp.shortText || comp.longText;
      }

      return {
        placeId: place.id,
        name: place.displayName?.text || '',
        formattedAddress: place.formattedAddress,
        latitude: place.location?.latitude ?? null,
        longitude: place.location?.longitude ?? null,
        telephone: place.nationalPhoneNumber || null,
        streetNumber: components['street_number'] || '',
        route: components['route'] || '',
        addressLocality: components['locality'] || components['sublocality'] || '',
        addressRegion: components['administrative_area_level_1'] || '',
        postalCode: components['postal_code'] || '',
        addressCountry: components['country'] || '',
      };
    });

    return NextResponse.json({ places });
  } catch (err) {
    console.error('Google Places proxy error:', err);
    return NextResponse.json({ error: 'Internal server error during place search' }, { status: 500 });
  }
}
