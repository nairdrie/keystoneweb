'use client';

import { ShoppingCart } from 'lucide-react';
import { useCart } from './CartProvider';
import { useEditorContext } from '@/lib/editor-context';

/**
 * Cart icon to go in the header navigation.
 * Only shows when the current page has a productGrid block,
 * or when the site-level __hasProductBlock flag is set.
 */
export default function HeaderCartIcon({ color = '#475569' }: { color?: string }) {
    const cart = useCart();
    const context = useEditorContext();

    const hasProductBlock =
        context?.blocks?.some(b => b.type === 'productGrid') ||
        !!context?.siteContent?.__hasProductBlock;

    if (!cart || !hasProductBlock) return null;

    return (
        <button
            onClick={() => cart.setCartOpen(true)}
            className="relative p-2 rounded-full hover:bg-slate-100 transition-colors"
            style={{ color }}
            aria-label="Open cart"
        >
            <ShoppingCart className="w-5 h-5" />
            {cart.itemCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center translate-x-1/4 -translate-y-1/4">
                    {cart.itemCount}
                </span>
            )}
        </button>
    );
}
