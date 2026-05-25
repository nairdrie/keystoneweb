import { createClient } from '@/lib/db/supabase-server';
import { notFound } from 'next/navigation';
import EditorContent from '@/app/(app)/editor/editor-content-v2';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import JsonLdScript from '@/app/components/JsonLdScript';
import SiteAnalyticsTracker from '@/app/components/SiteAnalyticsTracker';
import { BusinessProfile } from '@/lib/types/sites';
import { extractTestimonials } from '@/lib/seo/testimonials';
import type { Block, SocialLinks } from '@/lib/seo/jsonld';
import {
    isMemberSystemRoute,
    renderMemberSystemPage,
} from '@/lib/membership/system-routes';
import type { Metadata } from 'next';
import {
    buildSiteMetadata,
    cleanSeoTitle,
    cleanSeoDescription,
    buildCanonicalUrl,
    buildHreflangAlternates,
} from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
    params,
}: {
    params: Promise<{ domain: string; slug: string }>;
}): Promise<Metadata> {
    const { domain, slug } = await params;
    const supabase = await createClient();
    const cleanDomain = domain.replace('www.', '');

    const { data: site } = await supabase
        .from('sites')
        .select('id, published_data, published_domain, business_profile, translations_config, site_slug')
        .eq('custom_domain', cleanDomain)
        .eq('is_published', true)
        .single();

    if (!site) return { title: 'Page Not Found' };

    const siteData = (site.published_data as any) || {};
    const siteTitle = cleanSeoTitle(siteData, site.site_slug || cleanDomain);

    const { data: page } = await supabase
        .from('pages')
        .select('published_data, title')
        .eq('site_id', site.id)
        .eq('slug', slug)
        .single();

    const pageData = (page?.published_data as any) || {};
    const pageTitle = pageData.seoTitle || page?.title || slug;
    const description = pageData.seoDescription || cleanSeoDescription(siteData);
    const canonicalUrl = buildCanonicalUrl(site.published_domain, cleanDomain, slug);
    const alternateLanguages = buildHreflangAlternates(
        buildCanonicalUrl(site.published_domain, cleanDomain),
        site.translations_config,
        slug,
    );

    return buildSiteMetadata({
        siteTitle,
        pageTitle: `${pageTitle} | ${siteTitle}`,
        description,
        canonicalUrl,
        publishedData: { ...siteData, ...pageData },
        businessProfile: site.business_profile,
        alternateLanguages,
    });
}

export default async function CustomDomainDynamicPage({
    params,
}: {
    params: Promise<{ domain: string; slug: string }>;
}) {
    const { domain, slug } = await params;

    try {
        const supabase = await createClient();

        // Fetch the published site by custom domain
        const { data: site, error } = await supabase
            .from('sites')
            .select('id, selected_template_id, published_data, business_profile, translations_config, published_at, updated_at')
            .eq('custom_domain', domain)
            .eq('is_published', true)
            .single();

        if (error || !site) {
            notFound();
        }

        // Check if this is a membership system route
        // Use precomputed flag from publish time to avoid scanning all pages
        if (isMemberSystemRoute(slug) && !!(site.published_data as any)?.__hasMembershipBlock) {
            const { data: allPagesCheck } = await supabase
                .from('pages')
                .select('id, slug, title')
                .eq('site_id', site.id);
            const systemPage = await renderMemberSystemPage({ site, slug, allPages: allPagesCheck || [] });
            if (systemPage) return systemPage;
        }

        // Fetch the specific page
        const { data: routePage, error: pageError } = await supabase
            .from('pages')
            .select('id, published_data')
            .eq('site_id', site.id)
            .eq('slug', slug)
            .single();

        if (pageError || !routePage) {
            notFound();
        }

        // Fetch all pages for navigation links (lightweight: no published_data needed)
        const { data: allPages } = await supabase
            .from('pages')
            .select('id, slug, title')
            .eq('site_id', site.id);

        const pagePublishData = routePage.published_data || {};
        const sitePublishData = site.published_data || {};

        // Use precomputed flags from publish time
        const hasProductBlock = !!(sitePublishData as any).__hasProductBlock;
        const hasMembershipBlock = !!(sitePublishData as any).__hasMembershipBlock;
        const hasChatSupportBlock = !!(sitePublishData as any).__hasChatSupportBlock;

        const mergedPublishData = {
            ...sitePublishData,
            ...pagePublishData,
            __pages: (allPages || []).map(({ id, slug, title }: any) => ({ id, slug, title })),
            __currentPageId: routePage.id,
            __hasProductBlock: hasProductBlock,
            __hasMembershipBlock: hasMembershipBlock,
            __hasChatSupportBlock: hasChatSupportBlock,
        };

        const TemplateComp = await getTemplateComponent(site.selected_template_id);
        const metadata = await getTemplateMetadata(site.selected_template_id);

        let paletteData: Record<string, string> = {};
        if (metadata) {
            const palettesObj = metadata.palettes || {};
            // Prioritize site-level palette settings for consistency across all pages
            const requestedPalette = sitePublishData.__selectedPalette || 'default';
            if (requestedPalette === 'custom') {
                const defaultPalette = palettesObj['default'] || {};
                paletteData = {
                    primary: sitePublishData.__customPalette_primary || defaultPalette.primary || '',
                    secondary: sitePublishData.__customPalette_secondary || defaultPalette.secondary || '',
                    accent: sitePublishData.__customPalette_accent || defaultPalette.accent || '',
                };
            } else {
                paletteData = palettesObj[requestedPalette] || palettesObj['default'] || {};
            }
        }

        const siteUrl = `https://${domain}`;
        const pageUrl = `${siteUrl}/${slug}`;
        const subBlocks: Block[] = Array.isArray((mergedPublishData as { blocks?: unknown[] }).blocks)
            ? ((mergedPublishData as { blocks: Block[] }).blocks)
            : [];
        const subPageDisplayName = (pagePublishData as { displayName?: string; title?: string }).displayName
            || (pagePublishData as { title?: string }).title
            || slug;
        const subBreadcrumbs = [
            { name: 'Home', url: siteUrl },
            { name: subPageDisplayName, url: pageUrl },
        ];

        return (
            <>
                <SiteAnalyticsTracker siteId={site.id} />
                <JsonLdScript
                    businessProfile={site.business_profile as BusinessProfile | null}
                    siteUrl={siteUrl}
                    pageUrl={pageUrl}
                    socialLinks={(mergedPublishData as { socialLinks?: SocialLinks }).socialLinks}
                    testimonials={extractTestimonials(mergedPublishData)}
                    blocks={subBlocks}
                    breadcrumbs={subBreadcrumbs}
                    pageTitle={(pagePublishData as { seoTitle?: string }).seoTitle || subPageDisplayName}
                    pageDescription={(pagePublishData as { seoDescription?: string }).seoDescription}
                    datePublished={(site as any).published_at}
                    dateModified={(site as any).updated_at}
                    language={((site as any).translations_config as any)?.defaultLanguage || 'en'}
                />

                <EditorContent
                    isPublicView={true}
                    publicSiteData={{
                        id: site.id,
                        userId: null,
                        selectedTemplateId: site.selected_template_id,
                        businessType: '',
                        category: '',
                        designData: mergedPublishData,
                        isPublished: true,
                        createdAt: '',
                        updatedAt: ''
                    }}
                    precomputedPalette={paletteData}
                >
                    {TemplateComp && <TemplateComp palette={paletteData} isEditMode={false} />}
                </EditorContent>
            </>
        );
    } catch (error) {
        // Don't swallow Next.js control-flow errors (redirect/notFound).
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === 'string' && (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND'))) {
            throw error;
        }
        console.error('Error rendering dynamic page:', error);
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">Error Loading Page</h1>
                </div>
            </div>
        );
    }
}
