import { createClient } from '@/lib/db/supabase-server';
import EditorContent from '@/app/(app)/editor/editor-content-v2';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import JsonLdScript from '@/app/components/JsonLdScript';
import SiteAnalyticsTracker from '@/app/components/SiteAnalyticsTracker';
import { BusinessProfile } from '@/lib/types/sites';
import { extractTestimonials } from '@/lib/seo/testimonials';
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
            .select('id, selected_template_id, published_data, business_profile')
            .eq('custom_domain', domain)
            .eq('is_published', true)
            .single();

        if (error || !site) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-slate-900 mb-4">Site Not Found</h1>
                    </div>
                </div>
            );
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
            .select('published_data')
            .eq('site_id', site.id)
            .eq('slug', slug)
            .single();

        if (pageError || !routePage) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-slate-900 mb-4">Page Not Found</h1>
                        <a href="/" className="text-blue-600 hover:underline">← Back to home</a>
                    </div>
                </div>
            );
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

        return (
            <>
                <SiteAnalyticsTracker siteId={site.id} />
                {site.business_profile && (
                    <JsonLdScript
                        businessProfile={site.business_profile as BusinessProfile}
                        siteUrl={`https://${domain}/${slug}`}
                        socialLinks={(mergedPublishData as any).socialLinks}
                        testimonials={extractTestimonials(mergedPublishData)}
                    />
                )}
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
