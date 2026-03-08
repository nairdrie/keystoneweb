'use client';

import { ShoppingCart } from 'lucide-react';
import { useCart } from './CartProvider';

/**
 * Floating cart button shown on published sites when there are items in the cart.
 * Click to open the CartDrawer.
 */
export default function CartButton({ accentColor }: { accentColor?: string }) {
    const cart = useCart();
    if (!cart || cart.itemCount === 0) return null;

    return (
        <button
            onClick={() => cart.setCartOpen(true)}
            className="fixed bottom-6 right-6 z-[9990] w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white hover:scale-110 transition-transform"
            style={{ backgroundColor: accentColor || '#111827' }}
            aria-label="Open cart"
        >
            <ShoppingCart className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center">
                {cart.itemCount}
            </span>
        </button>
    );
}
