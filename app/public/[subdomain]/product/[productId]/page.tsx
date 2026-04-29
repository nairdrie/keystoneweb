import { createClient } from '@/lib/db/supabase-server';
import EditorContent from '@/app/(app)/editor/editor-content-v2';
import SiteAnalyticsTracker from '@/app/components/SiteAnalyticsTracker';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import ProductPageClient from '@/app/components/ecommerce/ProductPageWrapper';
import ProductJsonLd from '@/app/components/ProductJsonLd';
import SiteNotFound from '@/app/components/SiteNotFound';
import { getCurrentMember } from '@/lib/membership/current-member';
import { resolveProductAccess } from '@/lib/ecommerce/resolve-price';
import { PUBLISHED_ROOT } from '@/lib/env/domain';
import type { Metadata } from 'next';
import { buildSiteMetadata, buildCanonicalUrl, cleanSeoTitle } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
    params,
}: {
    params: Promise<{ subdomain: string; productId: string }>;
}): Promise<Metadata> {
    const { subdomain, productId } = await params;
    const supabase = await createClient();

    const { data: site } = await supabase
        .from('sites')
        .select('id, published_data, custom_domain, site_slug')
        .eq('published_domain', subdomain)
        .eq('is_published', true)
        .single();

    if (!site) return { title: 'Product Not Found' };

    const { data: product } = await supabase
        .from('products')
        .select('name, description, images')
        .eq('id', productId)
        .eq('site_id', site.id)
        .eq('is_active', true)
        .single();

    if (!product) return { title: 'Product Not Found' };

    const sitePublishData = (site.published_data as any) || {};
    const siteTitle = cleanSeoTitle(sitePublishData, site.site_slug || subdomain);
    const description = (product.description || product.name).slice(0, 160);
    const productImage = product.images?.[0];
    const canonicalUrl = `${buildCanonicalUrl(subdomain, site.custom_domain)}/product/${productId}`;

    return buildSiteMetadata({
        siteTitle,
        pageTitle: `${product.name} — ${siteTitle}`,
        description,
        canonicalUrl,
        ogImage: productImage || null,
        publishedData: sitePublishData,
    });
}

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
            .select('id, selected_template_id, published_data, site_slug')
            .eq('published_domain', subdomain)
            .eq('is_published', true)
            .single();

        if (siteError || !site) {
            return (
                <SiteNotFound 
                    message="Start building to claim this subdomain."
                    ctaText="Login to start building"
                    domain={`${subdomain}.${PUBLISHED_ROOT}`}
                />
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

        // Resolve the viewing member's price/access for this product.
        const member = await getCurrentMember(site.id);
        const access = resolveProductAccess(product, member);
        const resolvedProduct = {
            ...product,
            effective_price_cents: access.priceCents,
            public_price_cents: access.publicPriceCents,
            matched_package_id: access.matchedPackageId,
            can_purchase: access.canPurchase,
            gate_reason: access.gateReason,
        };

        // Fetch all products for "related products"
        const { data: allProductsRaw } = await supabase
            .from('products')
            .select('*')
            .eq('site_id', site.id)
            .eq('is_active', true)
            .order('sort_order');
        const allProducts = (allProductsRaw || []).map(p => {
            const r = resolveProductAccess(p, member);
            return {
                ...p,
                effective_price_cents: r.priceCents,
                public_price_cents: r.publicPriceCents,
                matched_package_id: r.matchedPackageId,
                can_purchase: r.canPurchase,
                gate_reason: r.gateReason,
            };
        });

        // Get template + palette
        const { data: homePage } = await supabase
            .from('pages')
            .select('published_data')
            .eq('site_id', site.id)
            .eq('slug', 'home')
            .single();

        const pagePublishData = homePage?.published_data || {};
        const sitePublishData = site.published_data || {};

        // Fetch all pages for navigation links + find the page with productGrid block
        const { data: allPages } = await supabase
            .from('pages')
            .select('id, slug, title, published_data')
            .eq('site_id', site.id);

        // Find the page that contains the productGrid block
        let productsPagePath = '/#products';
        for (const p of (allPages || [])) {
            const blocks = (p.published_data as any)?.blocks || [];
            if (blocks.some((b: any) => b.type === 'productGrid')) {
                productsPagePath = p.slug === 'home' ? '/#products' : `/${p.slug}#products`;
                break;
            }
        }

        const mergedPublishData = {
            ...sitePublishData,
            ...pagePublishData,
            __pages: (allPages || []).map(({ id, slug, title }) => ({ id, slug, title }))
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

        const productUrl = `${buildCanonicalUrl(subdomain, null)}/product/${productId}`;

        return (
            <>
            <SiteAnalyticsTracker siteId={site.id} />
            <ProductJsonLd
                product={product}
                productUrl={productUrl}
                siteName={site.site_slug || subdomain}
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
                {TemplateComp ? (
                    <TemplateComp palette={paletteData} isEditMode={false}>
                        <ProductPageClient
                            product={resolvedProduct}
                            siteId={site.id}
                            palette={paletteData}
                            siteName={site.site_slug || ''}
                            allProducts={allProducts}
                            navContent={mergedPublishData}
                            templateId={site.selected_template_id}
                            productsPagePath={productsPagePath}
                        />
                    </TemplateComp>
                ) : (
                    <ProductPageClient
                        product={resolvedProduct}
                        siteId={site.id}
                        palette={paletteData}
                        siteName={site.site_slug || ''}
                        allProducts={allProducts}
                        navContent={mergedPublishData}
                        templateId={site.selected_template_id}
                    />
                )}
            </EditorContent>
            </>
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
