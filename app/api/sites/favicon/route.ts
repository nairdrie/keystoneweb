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

    if (error || !site?.published_data?.siteLogo) {
      // Fallback to a default transparent pixel or a generic icon if no logo
      return new NextResponse(null, { status: 404 });
    }

    const logoUrl = site.published_data.siteLogo;

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
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Error serving favicon:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
