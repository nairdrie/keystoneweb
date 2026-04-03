import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/pexels?query=...&page=1&per_page=15
 * Server-side proxy for Pexels video search API. Keeps the API key secret.
 */
export async function GET(request: NextRequest) {
    try {
        const apiKey = process.env.PEXELS_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Pexels API not configured' },
                { status: 500 }
            );
        }

        const query = request.nextUrl.searchParams.get('query') || 'nature';
        const page = request.nextUrl.searchParams.get('page') || '1';
        const perPage = request.nextUrl.searchParams.get('per_page') || '15';

        const url = `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&orientation=landscape`;

        const res = await fetch(url, {
            headers: { Authorization: apiKey },
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Pexels API error:', res.status, errorText);
            return NextResponse.json(
                { error: 'Pexels API error', status: res.status },
                { status: res.status }
            );
        }

        const data = await res.json();

        const videos = (data.videos || []).map((video: any) => {
            // Pick best landscape MP4: prefer 1280px wide, fall back to highest available
            const mp4Files = (video.video_files || []).filter(
                (f: any) => f.file_type === 'video/mp4' && f.link
            );

            // Prefer landscape files (width >= height)
            const landscape = mp4Files.filter((f: any) => (f.width || 0) >= (f.height || 0));
            const candidates = landscape.length > 0 ? landscape : mp4Files;

            // Sort by width descending, pick <=1920 first, else largest
            const sorted = [...candidates].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
            const hd = sorted.find((f: any) => (f.width || 0) <= 1920 && (f.width || 0) >= 1280);
            const best = hd || sorted[0];

            if (!best) return null;

            return {
                id: video.id,
                image: video.image,
                duration: video.duration,
                width: video.width,
                height: video.height,
                videoUrl: best.link,
                // Also keep a smaller preview for hover play (find smallest landscape)
                previewUrl: (candidates.sort((a: any, b: any) => (a.width || 0) - (b.width || 0))[0] || best).link,
                user: {
                    name: video.user?.name || '',
                    url: video.user?.url || 'https://www.pexels.com',
                },
                pexelsUrl: video.url,
            };
        }).filter(Boolean);

        return NextResponse.json({
            videos,
            totalResults: data.total_results || 0,
            page: data.page || 1,
        });
    } catch (error) {
        console.error('Pexels proxy error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
