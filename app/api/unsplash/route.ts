import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/unsplash?query=...&page=1&per_page=20
 * Server-side proxy for Unsplash search API. Keeps the API key secret.
 */
export async function GET(request: NextRequest) {
    try {
        const accessKey = process.env.UNSPLASH_ACCESS_KEY;
        if (!accessKey) {
            return NextResponse.json(
                { error: 'Unsplash API not configured' },
                { status: 500 }
            );
        }

        const query = request.nextUrl.searchParams.get('query') || 'nature';
        const page = request.nextUrl.searchParams.get('page') || '1';
        const perPage = request.nextUrl.searchParams.get('per_page') || '20';

        const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&orientation=landscape`;

        const res = await fetch(url, {
            headers: {
                Authorization: `Client-ID ${accessKey}`,
            },
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Unsplash API error:', res.status, errorText);
            return NextResponse.json(
                { error: 'Unsplash API error', status: res.status },
                { status: res.status }
            );
        }

        const data = await res.json();

        // Return a simplified response with only what the client needs
        const photos = data.results.map((photo: any) => ({
            id: photo.id,
            urls: {
                small: photo.urls.small,
                regular: photo.urls.regular,
                full: photo.urls.full,
            },
            alt: photo.alt_description || photo.description || '',
            width: photo.width,
            height: photo.height,
            photographer: {
                name: photo.user.name,
                username: photo.user.username,
                profileUrl: `https://unsplash.com/@${photo.user.username}?utm_source=keystoneweb&utm_medium=referral`,
            },
            unsplashUrl: `https://unsplash.com/photos/${photo.id}?utm_source=keystoneweb&utm_medium=referral`,
            downloadEndpoint: photo.links.download_location,
        }));

        return NextResponse.json({
            photos,
            totalPages: data.total_pages,
            total: data.total,
        });
    } catch (error) {
        console.error('Unsplash proxy error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
