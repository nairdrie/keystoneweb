import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';

/**
 * GET /sitemap.xml (on custom domain sites)
 *
 * Generates a per-site sitemap listing all published pages.
 * Merchants can submit this directly to Google Search Console.
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

  const siteBase = `https://${cleanDomain}`;

  const [{ data: pages }, { data: posts }] = await Promise.all([
    supabase
      .from('pages')
      .select('slug, updated_at')
      .eq('site_id', site.id),
    supabase
      .from('blog_posts')
      .select('slug, published_at, created_at')
      .eq('site_id', site.id)
      .eq('is_published', true)
      .eq('is_archived', false),
  ]);

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

  for (const post of posts || []) {
    const postUrl = `${siteBase}/blog/${post.slug}`;
    const lastMod = (post.published_at || post.created_at)
      ? new Date(post.published_at || post.created_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    sitemap += `
  <url>
    <loc>${postUrl}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
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
