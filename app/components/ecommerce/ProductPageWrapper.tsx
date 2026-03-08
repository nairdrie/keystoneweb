'use client';

import ProductPage from '@/app/components/ecommerce/ProductPage';

/**
 * Client wrapper to render the ProductPage component within the
 * CartProvider context (already provided by EditorContent).
 * 
 * We render the nav header from the site's template, then the product page below.
 */

interface Product {
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    compare_at_cents: number | null;
    currency: string;
    images: string[];
    variants: Array<{ name: string; options: string[] }>;
    inventory_count: number;
    is_active: boolean;
}

interface Props {
    product: Product;
    siteId: string;
    palette: Record<string, string>;
    siteName: string;
    allProducts: Product[];
    navContent: Record<string, any>;
    templateId: string;
}

export default function ProductPageWrapper({ product, siteId, palette, siteName, allProducts }: Props) {
    return (
        <ProductPage
            product={product}
            siteId={siteId}
            palette={palette}
            siteName={siteName}
            allProducts={allProducts}
        />
    );
}
