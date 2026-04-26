import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';

/**
 * GET /robots.txt (on *.kswd.ca published subdomain sites)
 *
 * Returns 404 for unknown subdomains. For published sites, points crawlers
 * at the canonical custom domain when one is configured (so the subdomain
 * isn't indexed as a duplicate of the merchant's own domain).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> },
) {
  const { subdomain } = await params;
  const supabase = createAdminClient();

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, custom_domain')
    .eq('published_domain', subdomain)
    .eq('is_published', true)
    .single();

  if (siteError || !site) {
    return new NextResponse('Site not found', { status: 404 });
  }

  const subdomainHost = `${subdomain}.kswd.ca`;
  const canonicalHost = site.custom_domain || subdomainHost;
  const sitemapHost = canonicalHost;

  // If a custom domain exists, treat the .kswd.ca host as a duplicate and
  // disallow indexing so we don't compete with the merchant's own domain.
  const body = site.custom_domain
    ? `User-agent: *
Disallow: /

Sitemap: https://${sitemapHost}/sitemap.xml
`
    : `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /design
Disallow: /editor
Disallow: /preview

Sitemap: https://${sitemapHost}/sitemap.xml
`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
    },
  });
}
