import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { buildJsonLd, type Block, type SocialLinks } from '@/lib/seo/jsonld';
import { extractTestimonials } from '@/lib/seo/testimonials';
import { PUBLISHED_ROOT } from '@/lib/env/domain';
import type { BusinessProfile } from '@/lib/types/sites';

/**
 * Returns the live JSON-LD payload that the public site is currently emitting
 * for a given page. Used by the admin "Schema" tab to render a preview of
 * every schema block + a "Source" explanation per entry.
 */
export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('siteId');
  const pageId = req.nextUrl.searchParams.get('pageId');
  if (!siteId) return NextResponse.json({ error: 'siteId is required' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, business_profile, published_domain, custom_domain, published_data, design_data')
    .eq('id', siteId)
    .single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  if (site.user_id && site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let pagePublished: Record<string, unknown> | null = null;
  let pageDesign: Record<string, unknown> | null = null;
  let pageSlug = 'home';
  let pageTitle = '';

  if (pageId) {
    const { data: page } = await supabase
      .from('pages')
      .select('slug, title, display_name, published_data, design_data')
      .eq('id', pageId)
      .eq('site_id', siteId)
      .single();
    if (page) {
      pagePublished = page.published_data as Record<string, unknown> | null;
      pageDesign = page.design_data as Record<string, unknown> | null;
      pageSlug = page.slug;
      pageTitle = page.display_name || page.title;
    }
  }

  const sitePublished = (site.published_data as Record<string, unknown>) || {};
  const siteDesign = (site.design_data as Record<string, unknown>) || {};

  // Prefer published data, fall back to design data so the preview works for
  // unpublished drafts too.
  const merged = {
    ...(siteDesign || {}),
    ...(sitePublished || {}),
    ...(pageDesign || {}),
    ...(pagePublished || {}),
  } as Record<string, unknown>;

  const siteUrl = site.custom_domain
    ? `https://${site.custom_domain}`
    : `https://${site.published_domain || 'preview'}.${PUBLISHED_ROOT}`;
  const pageUrl = pageSlug === 'home' ? siteUrl : `${siteUrl}/${pageSlug}`;
  const blocks = (Array.isArray((merged as { blocks?: unknown[] }).blocks) ? (merged as { blocks: Block[] }).blocks : []) as Block[];

  const breadcrumbs =
    pageSlug === 'home'
      ? []
      : [
          { name: 'Home', url: siteUrl },
          { name: pageTitle || pageSlug, url: pageUrl },
        ];

  const entries = buildJsonLd({
    businessProfile: site.business_profile as BusinessProfile | null,
    socialLinks: (merged as { socialLinks?: SocialLinks }).socialLinks,
    testimonials: extractTestimonials(merged),
    blocks,
    breadcrumbs,
    siteUrl,
    pageUrl,
    pageTitle: (merged as { seoTitle?: string }).seoTitle || pageTitle,
    pageDescription: (merged as { seoDescription?: string }).seoDescription,
    isHomePage: pageSlug === 'home',
  });

  return NextResponse.json({ entries, pageUrl, pageSlug });
}
