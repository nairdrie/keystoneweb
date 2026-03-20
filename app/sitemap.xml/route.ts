import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';

export async function GET() {
  const supabase = createAdminClient();

  // 1. Fetch all published sites
  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select('id, custom_domain, published_domain, updated_at')
    .eq('is_published', true);

  if (sitesError) {
    console.error('Error fetching sites for sitemap:', sitesError);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }

  // 2. Build the sitemap entries
  const baseUrl = 'https://kswd.ca';
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Marketing Pages -->
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/pricing</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/templates</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;

  // 3. Add entries for each published site and its pages
  for (const site of sites || []) {
    const siteBase = site.custom_domain 
      ? `https://${site.custom_domain}` 
      : `https://${site.published_domain}.kswd.ca`;

    // Fetch pages for this site
    const { data: pages } = await supabase
      .from('pages')
      .select('slug, updated_at')
      .eq('site_id', site.id);

    for (const page of pages || []) {
      const pageUrl = page.slug === 'home' ? siteBase : `${siteBase}/${page.slug}`;
      const lastMod = page.updated_at ? new Date(page.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      
      sitemap += `
  <url>
    <loc>${pageUrl}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page.slug === 'home' ? '0.9' : '0.6'}</priority>
  </url>`;
    }
  }

  sitemap += '\n</urlset>';

  return new NextResponse(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
    },
  });
}
