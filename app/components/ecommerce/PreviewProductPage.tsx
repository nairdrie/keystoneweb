'use client';

import { useState, useEffect } from 'react';
import ProductPage from './ProductPage';
import { Loader2 } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';

export default function PreviewProductPage({ productId, siteId, palette, siteName }: { productId: string, siteId: string, palette: Record<string, string>, siteName: string }) {
    const [product, setProduct] = useState<any>(null);
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Using the same editor context
    const context = useEditorContext();

    useEffect(() => {
        let mounted = true;
        const fetchProduct = async () => {
            try {
                // Fetch the specific product 
                const res = await fetch(`/api/products?siteId=${siteId}`);
                if (!res.ok) throw new Error('Failed to load products');

                const data = await res.json();
                const products = data.products || [];

                if (mounted) {
                    const found = products.find((p: any) => p.id === productId);
                    if (found) {
                        setProduct(found);
                        setAllProducts(products.filter((p: any) => p.is_active));
                    } else {
                        setError('Product not found or not active');
                    }
                }
            } catch (err: any) {
                if (mounted) setError(err.message);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchProduct();
        return () => { mounted = false; };
    }, [productId, siteId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Preview Error</h2>
                <p className="text-slate-500">{error || 'Product not found'}</p>
                <button
                    onClick={() => {
                        // Go back by opening the URL without productId
                        const url = new URL(window.location.href);
                        url.searchParams.delete('productId');
                        window.history.replaceState({}, '', url.toString());
                        window.location.reload(); // Simple reload to go back to page preview
                    }}
                    className="mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 font-medium transition-colors"
                >
                    Back to Page
                </button>
            </div>
        );
    }

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
