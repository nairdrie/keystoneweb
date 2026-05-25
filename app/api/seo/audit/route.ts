import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { runAudit, type AuditInput } from '@/lib/seo/audit';
import { PUBLISHED_ROOT } from '@/lib/env/domain';
import type { BusinessProfile } from '@/lib/types/sites';
import type { Block, SocialLinks } from '@/lib/seo/jsonld';

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId is required' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, business_profile, design_data, published_data, is_published, published_at, published_domain, custom_domain')
    .eq('id', siteId)
    .single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  if (site.user_id && site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [{ data: pagesData }, { data: logs }, { count: blogCount }] = await Promise.all([
    supabase
      .from('pages')
      .select('id, slug, title, display_name, design_data, is_visible_in_nav')
      .eq('site_id', siteId)
      .order('nav_order', { ascending: true }),
    supabase
      .from('site_404_logs')
      .select('path, hit_count')
      .eq('site_id', siteId)
      .eq('resolved', false)
      .order('hit_count', { ascending: false })
      .limit(50),
    supabase
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('is_published', true),
  ]);

  const siteDesign = (site.design_data as Record<string, unknown>) || {};
  const sitePublished = (site.published_data as Record<string, unknown>) || {};
  const socialLinks = ((siteDesign.socialLinks as SocialLinks | undefined) || (sitePublished.socialLinks as SocialLinks | undefined)) ?? null;

  const siteUrl = site.custom_domain
    ? `https://${site.custom_domain}`
    : `https://${site.published_domain || 'preview'}.${PUBLISHED_ROOT}`;

  const pages: AuditInput['pages'] = (pagesData || []).map(p => {
    const dd = (p.design_data as Record<string, unknown>) || {};
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      displayName: p.display_name,
      seoTitle: (dd.seoTitle as string) ?? '',
      seoDescription: (dd.seoDescription as string) ?? '',
      robotsNoindex: !!dd.robotsNoindex,
      blocks: (Array.isArray(dd.blocks) ? (dd.blocks as Block[]) : []),
      isVisibleInNav: p.is_visible_in_nav,
    };
  });

  const translationsConfig = (siteDesign.translationsConfig || sitePublished.__translationsConfig) as { defaultLanguage?: string } | undefined;

  const audit = runAudit({
    siteUrl,
    isPublished: !!site.is_published,
    publishedAt: site.published_at,
    hasCustomDomain: !!site.custom_domain,
    businessProfile: site.business_profile as BusinessProfile | null,
    socialLinks,
    pages,
    unresolvedLogs: logs || [],
    hasBlogPosts: (blogCount ?? 0) > 0,
    hasLlmsTxt: !!site.is_published,
    language: translationsConfig?.defaultLanguage || null,
  });

  return NextResponse.json(audit);
}
