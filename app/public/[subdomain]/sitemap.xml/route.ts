import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';

/**
 * GET /sitemap.xml (on published subdomain sites)
 *
 * Generates a per-site sitemap listing all published pages.
 * Merchants can submit this directly to Google Search Console.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> },
) {
  const { subdomain } = await params;
  const supabase = createAdminClient();

  // Look up the published site
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, custom_domain')
    .eq('published_domain', subdomain)
    .eq('is_published', true)
    .single();

  if (siteError || !site) {
    return new NextResponse('Site not found', { status: 404 });
  }

  // Prefer custom domain for URLs if available
  const siteBase = site.custom_domain
    ? `https://${site.custom_domain}`
    : `https://${subdomain}.kswd.ca`;

  // Fetch all pages
  const { data: pages } = await supabase
    .from('pages')
    .select('slug, updated_at')
    .eq('site_id', site.id);

  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  for (const page of pages || []) {
    const pageUrl = page.slug === 'home' ? siteBase : `${siteBase}/${page.slug}`;
    const lastMod = page.updated_at
      ? new Date(page.updated_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    sitemap += `
  <url>
    <loc>${pageUrl}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page.slug === 'home' ? '1.0' : '0.7'}</priority>
  </url>`;
  }

  sitemap += '\n</urlset>';

  return new NextResponse(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
    },
  });
}
