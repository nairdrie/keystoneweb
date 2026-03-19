import { createClient } from '@/lib/db/supabase-server';
import EditorContent from '@/app/(app)/editor/editor-content-v2';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import {
    isLanguageCode,
    resolveTranslatedContent,
} from '@/lib/translations/resolve';

export const dynamic = 'force-dynamic';

/**
 * Handles routes like /fr/about — a language-prefixed page.
 * [slug] = language code (e.g., "fr")
 * [pageSlug] = page slug (e.g., "about")
 *
 * If [slug] is NOT a valid language code, this is a 404.
 */
export default async function PublicSiteTranslatedPage({
    params,
}: {
    params: Promise<{ subdomain: string; slug: string; pageSlug: string }>;
}) {
    const { subdomain, slug: langCode, pageSlug } = await params;

    try {
        const supabase = await createClient();

        const { data: site, error } = await supabase
            .from('sites')
            .select('id, selected_template_id, published_data, translations_config, translations')
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

        const config = site.translations_config as any;

        // Verify this is actually a language code
        if (!isLanguageCode(langCode, config)) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-slate-900 mb-4">Page Not Found</h1>
                        <a href="/" className="text-blue-600 hover:underline">← Back to home</a>
                    </div>
                </div>
            );
        }

        const defaultLang = config?.defaultLanguage || 'en';

        // Fetch the specific page
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
                        <a href={`/${langCode}`} className="text-blue-600 hover:underline">← Back to home</a>
                    </div>
                </div>
            );
        }

        const sitePublishData = site.published_data || {};
        const pagePublishData = routePage.published_data || {};

        // Apply translations
        const translatedSiteData = resolveTranslatedContent(
            sitePublishData,
            site.translations,
            langCode,
            defaultLang,
        );
        const translatedPageData = resolveTranslatedContent(
            pagePublishData,
            routePage.translations,
            langCode,
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
            __currentLanguage: langCode,
            __translationsConfig: config,
        };

        const TemplateComp = await getTemplateComponent(site.selected_template_id);
        const metadata = await getTemplateMetadata(site.selected_template_id);

        let paletteData: Record<string, string> = {};
        if (metadata) {
            const palettesObj = metadata.palettes || {};
            const requestedPalette = mergedPublishData.__selectedPalette || 'default';
            if (requestedPalette === 'custom') {
                const defaultPalette = palettesObj['default'] || {};
                paletteData = {
                    primary: mergedPublishData.__customPalette_primary || defaultPalette.primary || '',
                    secondary: mergedPublishData.__customPalette_secondary || defaultPalette.secondary || '',
                    accent: mergedPublishData.__customPalette_accent || defaultPalette.accent || '',
                };
            } else {
                paletteData = palettesObj[requestedPalette] || palettesObj['default'] || {};
            }
        }

        return (
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
        );
    } catch (error) {
        console.error('Error rendering translated page:', error);
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">Error Loading Page</h1>
                </div>
            </div>
        );
    }
}
