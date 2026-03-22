import { createClient } from '@/lib/db/supabase-server';
import EditorContent from '@/app/(app)/editor/editor-content-v2';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import ProductPageClient from '@/app/components/ecommerce/ProductPageWrapper';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({
    params,
}: {
    params: Promise<{ subdomain: string; productId: string }>;
}) {
    const { subdomain, productId } = await params;

    try {
        const supabase = await createClient();

        // Fetch the published site by subdomain
        const { data: site, error: siteError } = await supabase
            .from('sites')
            .select('id, selected_template_id, published_data')
            .eq('published_domain', subdomain)
            .eq('is_published', true)
            .single();

        if (siteError || !site) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-slate-900 mb-4">Site Not Found</h1>
                    </div>
                </div>
            );
        }

        // Fetch the product
        const { data: product, error: prodError } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .eq('site_id', site.id)
            .eq('is_active', true)
            .single();

        if (prodError || !product) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-slate-900 mb-4">Product Not Found</h1>
                        <a href="/" className="text-blue-600 hover:underline">← Back to store</a>
                    </div>
                </div>
            );
        }

        // Fetch all products for "related products"
        const { data: allProducts } = await supabase
            .from('products')
            .select('*')
            .eq('site_id', site.id)
            .eq('is_active', true)
            .order('sort_order');

        // Get template + palette
        const { data: homePage } = await supabase
            .from('pages')
            .select('published_data')
            .eq('site_id', site.id)
            .eq('slug', 'home')
            .single();

        const pagePublishData = homePage?.published_data || {};
        const sitePublishData = site.published_data || {};

        // Fetch all pages for navigation links
        const { data: allPages } = await supabase
            .from('pages')
            .select('id, slug, title')
            .eq('site_id', site.id);

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
                {TemplateComp ? (
                    <TemplateComp palette={paletteData} isEditMode={false}>
                        <ProductPageClient
                            product={product}
                            siteId={site.id}
                            palette={paletteData}
                            siteName={mergedPublishData.siteTitle || ''}
                            allProducts={allProducts || []}
                            navContent={mergedPublishData}
                            templateId={site.selected_template_id}
                        />
                    </TemplateComp>
                ) : (
                    <ProductPageClient
                        product={product}
                        siteId={site.id}
                        palette={paletteData}
                        siteName={mergedPublishData.siteTitle || ''}
                        allProducts={allProducts || []}
                        navContent={mergedPublishData}
                        templateId={site.selected_template_id}
                    />
                )}
            </EditorContent>
        );
    } catch (error) {
        console.error('Error rendering product page:', error);
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">Error Loading Product</h1>
                </div>
            </div>
        );
    }
}
