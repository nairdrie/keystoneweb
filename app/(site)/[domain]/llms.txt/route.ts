import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { buildLlmsTxt } from '@/lib/seo/llms-txt';
import type { BusinessProfile } from '@/lib/types/sites';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const cleanDomain = domain.replace(/^www\./, '');
  const supabase = createAdminClient();

  const { data: site } = await supabase
    .from('sites')
    .select('id, business_profile, published_data')
    .eq('custom_domain', cleanDomain)
    .eq('is_published', true)
    .single();

  if (!site) return new NextResponse('Not found', { status: 404 });

  const siteUrl = `https://${cleanDomain}`;
  const businessProfile = site.business_profile as BusinessProfile | null;
  const designData = (site.published_data as { siteTitle?: string; seoTitle?: string; seoDescription?: string; tagline?: string; description?: string }) || {};
  const businessName = businessProfile?.legalName || designData.seoTitle || designData.siteTitle || cleanDomain;
  const description = designData.seoDescription || designData.tagline || designData.description;

  const [{ data: pages }, { data: blogPosts }] = await Promise.all([
    supabase
      .from('pages')
      .select('slug, title, display_name, design_data')
      .eq('site_id', site.id)
      .order('nav_order', { ascending: true }),
    supabase
      .from('blog_posts')
      .select('slug, title, excerpt')
      .eq('site_id', site.id)
      .eq('is_published', true)
      .eq('is_archived', false)
      .limit(100),
  ]);

  const llmsTxt = buildLlmsTxt({
    siteUrl,
    businessName,
    description,
    businessProfile,
    pages: (pages || []).map(p => ({
      slug: p.slug,
      title: p.title,
      displayName: p.display_name,
      seoDescription: (p.design_data as { seoDescription?: string } | null)?.seoDescription || null,
    })),
    blogPosts: blogPosts || [],
  });

  return new NextResponse(llmsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
    },
  });
}
