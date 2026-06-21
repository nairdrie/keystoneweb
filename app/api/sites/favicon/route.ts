import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('siteId');

  if (!siteId) {
    return new NextResponse('Missing siteId', { status: 400 });
  }

  try {
    const supabase = await createClient();

    // Fetch site to get the logo URL
    const { data: site, error } = await supabase
      .from('sites')
      .select('published_data')
      .eq('id', siteId)
      .single();

    const faviconUrl = site?.published_data?.faviconLogo || site?.published_data?.siteLogo;
    if (error || !faviconUrl) {
      // Fallback to a default transparent pixel or a generic icon if no logo
      return new NextResponse(null, { status: 404 });
    }

    const logoUrl = faviconUrl;

    // Fetch the actual image
    const imageRes = await fetch(logoUrl);
    if (!imageRes.ok) {
      return new NextResponse('Failed to fetch logo', { status: 500 });
    }

    const contentType = imageRes.headers.get('content-type') || 'image/x-icon';
    const buffer = await imageRes.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        // Safe to cache aggressively: the favicon <link> href carries a `v`
        // token derived from the favicon URL, so a changed favicon produces a
        // new request URL and bypasses this cache entirely.
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving favicon:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
