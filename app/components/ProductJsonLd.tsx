interface ProductJsonLdProps {
    product: {
        id: string;
        name: string;
        description?: string | null;
        price_cents: number;
        compare_at_cents?: number | null;
        currency: string;
        images?: string[];
        inventory_count?: number;
        category?: string | null;
        tags?: string[] | null;
    };
    productUrl: string;
    siteName?: string;
}

/**
 * Emits <script type="application/ld+json"> with a Schema.org Product block
 * so product pages are eligible for Google Shopping rich results.
 */
export default function ProductJsonLd({ product, productUrl, siteName }: ProductJsonLdProps) {
    const availability =
        product.inventory_count === 0
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock';

    const jsonLd: Record<string, any> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description || product.name,
        sku: product.id,
        offers: {
            '@type': 'Offer',
            url: productUrl,
            priceCurrency: product.currency || 'CAD',
            price: (product.price_cents / 100).toFixed(2),
            availability,
            itemCondition: 'https://schema.org/NewCondition',
        },
    };

    if (product.images && product.images.length > 0) {
        jsonLd.image = product.images;
    }

    if (product.category) {
        jsonLd.category = product.category;
    }

    if (siteName) {
        jsonLd.brand = {
            '@type': 'Brand',
            name: siteName,
        };
    }

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
    );
}
