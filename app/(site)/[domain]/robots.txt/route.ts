import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';

/**
 * GET /robots.txt (on custom-domain published sites)
 *
 * Returns 404 if the domain isn't a published Keystone site so search engines
 * don't get a generic policy for parked/unknown hosts. Otherwise allows all
 * crawlers, blocks API/admin/preview paths, and points to the per-site sitemap.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params;
  const cleanDomain = domain.replace('www.', '');
  const supabase = createAdminClient();

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id')
    .eq('custom_domain', cleanDomain)
    .eq('is_published', true)
    .single();

  if (siteError || !site) {
    return new NextResponse('Site not found', { status: 404 });
  }

  const robotsTxt = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /design
Disallow: /editor
Disallow: /preview

Sitemap: https://${cleanDomain}/sitemap.xml
`;

  return new NextResponse(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
    },
  });
}
