import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/unsplash/download
 * Triggers Unsplash's download tracking endpoint.
 * Required by Unsplash API guidelines when a user selects a photo.
 * 
 * Body: { downloadEndpoint: string }
 */
export async function POST(request: NextRequest) {
    try {
        const accessKey = process.env.UNSPLASH_ACCESS_KEY;
        if (!accessKey) {
            return NextResponse.json(
                { error: 'Unsplash API not configured' },
                { status: 500 }
            );
        }

        const { downloadEndpoint } = await request.json();

        if (!downloadEndpoint) {
            return NextResponse.json(
                { error: 'Missing downloadEndpoint' },
                { status: 400 }
            );
        }

        // Call Unsplash's download tracking endpoint
        // This URL comes from photo.links.download_location in the search response
        const separator = downloadEndpoint.includes('?') ? '&' : '?';
        const trackingUrl = `${downloadEndpoint}${separator}client_id=${accessKey}`;

        const res = await fetch(trackingUrl);

        if (!res.ok) {
            console.error('Unsplash download tracking failed:', res.status);
            // Don't fail the request — tracking is best-effort
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Unsplash download tracking error:', error);
        // Don't fail — tracking is best-effort
        return NextResponse.json({ success: true });
    }
}
