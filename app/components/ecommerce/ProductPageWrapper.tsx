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
    options?: Array<{ name: string; values: Array<{ label: string; priceModifierCents: number }>; defaultIndex: number }>;
    inventory_count: number;
    is_active: boolean;
    category?: string | null;
    tags?: string[];
    effective_price_cents?: number;
    public_price_cents?: number;
    matched_package_id?: string | null;
    can_purchase?: boolean;
    gate_reason?: 'guest' | 'wrong-tier' | null;
}

interface Props {
    product: Product;
    siteId: string;
    palette: Record<string, string>;
    siteName: string;
    allProducts: Product[];
    navContent: Record<string, any>;
    templateId: string;
    productsPagePath?: string;
}

export default function ProductPageWrapper({ product, siteId, palette, siteName, allProducts, productsPagePath }: Props) {
    return (
        <ProductPage
            product={product}
            siteId={siteId}
            palette={palette}
            siteName={siteName}
            allProducts={allProducts}
            productsPagePath={productsPagePath}
        />
    );
}
