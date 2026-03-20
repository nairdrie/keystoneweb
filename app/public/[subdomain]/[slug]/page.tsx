import { createClient } from '@/lib/db/supabase-server';
import EditorContent from '@/app/(app)/editor/editor-content-v2';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import LanguageSelector from '@/app/components/LanguageSelector';
import JsonLdScript from '@/app/components/JsonLdScript';
import { BusinessProfile } from '@/lib/types/sites';
import {
    fetchTranslationsConfig,
    fetchSiteTranslations,
    fetchPageTranslations,
    resolveTranslatedContent,
    isLanguageCode,
} from '@/lib/translations/resolve';

export const dynamic = 'force-dynamic';

export default async function PublicSiteDynamicPage({
    params,
}: {
    params: Promise<{ subdomain: string; slug: string }>;
}) {
    const { subdomain, slug } = await params;

    try {
        const supabase = await createClient();

        // Fetch the published site by subdomain
        const { data: site, error } = await supabase
            .from('sites')
            .select('id, selected_template_id, published_data, business_profile, translations_config, translations')
            .eq('published_domain', subdomain)
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

        const translationsConfig = site.translations_config as any;

        // Check if this slug is actually a language code (e.g., /fr = home page in French)
        if (isLanguageCode(slug, translationsConfig)) {
            return renderHomePage(supabase, site, subdomain, slug);
        }

        // Otherwise, render the specific page (no language prefix = default language)
        return renderPage(supabase, site, subdomain, slug, translationsConfig?.defaultLanguage || 'en');
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

/**
 * Render the home page in a specific language.
 */
async function renderHomePage(
    supabase: any,
    site: any,
    subdomain: string,
    language: string,
) {
    const config = site.translations_config;
    const defaultLang = config?.defaultLanguage || 'en';

    // Fetch home page
    const { data: homePage } = await supabase
        .from('pages')
        .select('published_data, translations')
        .eq('site_id', site.id)
        .eq('slug', 'home')
        .single();

    const pagePublishData = homePage?.published_data || {};
    const sitePublishData = site.published_data || {};

    // Apply translations
    const translatedSiteData = resolveTranslatedContent(
        sitePublishData,
        site.translations,
        language,
        defaultLang,
    );
    const translatedPageData = resolveTranslatedContent(
        pagePublishData,
        homePage?.translations,
        language,
        defaultLang,
    );

    // Fetch all pages for navigation
    const { data: allPages } = await supabase
        .from('pages')
        .select('id, slug, title')
        .eq('site_id', site.id);

    const mergedPublishData = {
        ...translatedSiteData,
        ...translatedPageData,
        __pages: allPages || [],
        __currentLanguage: language,
        __translationsConfig: config,
    };

    const TemplateComp = await getTemplateComponent(site.selected_template_id);
    const metadata = await getTemplateMetadata(site.selected_template_id);
    const paletteData = resolvePalette(sitePublishData, metadata);

    return (
        <>
            {site.business_profile && (
                <JsonLdScript
                    businessProfile={site.business_profile as BusinessProfile}
                    siteUrl={`https://${subdomain}.kswd.ca/${language}`}
                    socialLinks={(mergedPublishData as any).socialLinks}
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
                    updatedAt: '',
                }}
                precomputedPalette={paletteData}
            >
                {TemplateComp && <TemplateComp palette={paletteData} isEditMode={false} />}
            </EditorContent>
        </>
    );
}

/**
 * Render a specific page (optionally with translations).
 */
async function renderPage(
    supabase: any,
    site: any,
    subdomain: string,
    pageSlug: string,
    language: string,
) {
    const config = site.translations_config;
    const defaultLang = config?.defaultLanguage || 'en';

    const { data: routePage, error: pageError } = await supabase
        .from('pages')
        .select('published_data, translations')
        .eq('site_id', site.id)
        .eq('slug', pageSlug)
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

    const sitePublishData = site.published_data || {};
    const pagePublishData = routePage.published_data || {};

    // Apply translations if not default language
    const translatedSiteData = resolveTranslatedContent(
        sitePublishData,
        site.translations,
        language,
        defaultLang,
    );
    const translatedPageData = resolveTranslatedContent(
        pagePublishData,
        routePage.translations,
        language,
        defaultLang,
    );

    const { data: allPages } = await supabase
        .from('pages')
        .select('id, slug, title')
        .eq('site_id', site.id);

    const mergedPublishData = {
        ...translatedSiteData,
        ...translatedPageData,
        __pages: allPages || [],
        __currentLanguage: language,
        __translationsConfig: config,
    };

    const TemplateComp = await getTemplateComponent(site.selected_template_id);
    const metadata = await getTemplateMetadata(site.selected_template_id);
    const paletteData = resolvePalette(sitePublishData, metadata);

    return (
        <>
            {site.business_profile && (
                <JsonLdScript
                    businessProfile={site.business_profile as BusinessProfile}
                    siteUrl={`https://${subdomain}.kswd.ca/${pageSlug}`}
                    socialLinks={(mergedPublishData as any).socialLinks}
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
                    updatedAt: '',
                }}
                precomputedPalette={paletteData}
            >
                {TemplateComp && <TemplateComp palette={paletteData} isEditMode={false} />}
            </EditorContent>
        </>
    );
}

function resolvePalette(siteData: Record<string, any>, metadata: any): Record<string, string> {
    if (!metadata) return {};
    const palettesObj = metadata.palettes || {};
    // Always use site-level palette settings for consistency across all pages
    const requestedPalette = siteData.__selectedPalette || 'default';
    if (requestedPalette === 'custom') {
        const defaultPalette = palettesObj['default'] || {};
        return {
            primary: siteData.__customPalette_primary || defaultPalette.primary || '',
            secondary: siteData.__customPalette_secondary || defaultPalette.secondary || '',
            accent: siteData.__customPalette_accent || defaultPalette.accent || '',
        };
    }
    return palettesObj[requestedPalette] || palettesObj['default'] || {};
}
