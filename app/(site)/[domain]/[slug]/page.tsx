import { createClient } from '@/lib/db/supabase-server';
import EditorContent from '@/app/(app)/editor/editor-content-v2';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import JsonLdScript from '@/app/components/JsonLdScript';
import { BusinessProfile } from '@/lib/types/sites';

export const dynamic = 'force-dynamic';

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

        // Fetch all pages for navigation links
        const { data: allPages } = await supabase
            .from('pages')
            .select('id, slug, title')
            .eq('site_id', site.id);

        const pagePublishData = routePage.published_data || {};
        const sitePublishData = site.published_data || {};
        const mergedPublishData = {
            ...sitePublishData,
            ...pagePublishData,
            __pages: allPages || []
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
                {site.business_profile && (
                    <JsonLdScript
                        businessProfile={site.business_profile as BusinessProfile}
                        siteUrl={`https://${domain}/${slug}`}
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
