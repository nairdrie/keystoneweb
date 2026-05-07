'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface CartItem {
    productId: string;
    name: string;
    price_cents: number;
    currency: string;
    qty: number;
    image?: string;
    variants?: Record<string, string>; // e.g. { Size: "M", Color: "Red" }
    options?: Record<string, string>;  // e.g. { Quantity: "Case of 24" } — affects price
}

interface CartContextType {
    items: CartItem[];
    addToCart: (item: CartItem) => void;
    removeFromCart: (productId: string, variants?: Record<string, string>, options?: Record<string, string>) => void;
    updateQty: (productId: string, qty: number, variants?: Record<string, string>, options?: Record<string, string>) => void;
    clearCart: () => void;
    isCartOpen: boolean;
    setCartOpen: (open: boolean) => void;
    itemCount: number;
    subtotalCents: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function useCart() {
    return useContext(CartContext);
}

// Generate a unique key for a cart item (product + variant + option combo)
function itemKey(productId: string, variants?: Record<string, string>, options?: Record<string, string>): string {
    const varStr = variants ? Object.entries(variants).sort().map(([k, v]) => `${k}:${v}`).join('|') : '';
    const optStr = options ? Object.entries(options).sort().map(([k, v]) => `${k}:${v}`).join('|') : '';
    return `${productId}::${varStr}::${optStr}`;
}

export function CartProvider({ children, siteId }: { children: ReactNode; siteId: string }) {
    const storageKey = `cart_${siteId}`;
    const [items, setItems] = useState<CartItem[]>([]);
    const [isCartOpen, setCartOpen] = useState(false);

    // Load from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) setItems(JSON.parse(stored));
        } catch { }
    }, [storageKey]);

    // Save to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(items));
        } catch { }
    }, [items, storageKey]);

    const addToCart = useCallback((item: CartItem) => {
        setItems(prev => {
            const key = itemKey(item.productId, item.variants, item.options);
            const existing = prev.find(i => itemKey(i.productId, i.variants, i.options) === key);
            if (existing) {
                return prev.map(i => itemKey(i.productId, i.variants, i.options) === key
                    ? { ...i, qty: i.qty + item.qty } : i);
            }
            return [...prev, item];
        });
        setCartOpen(true);
    }, []);

    const removeFromCart = useCallback((productId: string, variants?: Record<string, string>, options?: Record<string, string>) => {
        const key = itemKey(productId, variants, options);
        setItems(prev => prev.filter(i => itemKey(i.productId, i.variants, i.options) !== key));
    }, []);

    const updateQty = useCallback((productId: string, qty: number, variants?: Record<string, string>, options?: Record<string, string>) => {
        const key = itemKey(productId, variants, options);
        if (qty <= 0) {
            setItems(prev => prev.filter(i => itemKey(i.productId, i.variants, i.options) !== key));
        } else {
            setItems(prev => prev.map(i => itemKey(i.productId, i.variants, i.options) === key ? { ...i, qty } : i));
        }
    }, []);

    const clearCart = useCallback(() => {
        setItems([]);
        try { localStorage.removeItem(storageKey); } catch { }
    }, [storageKey]);

    // Clear cart when returning from a successful payment redirect (Stripe / Clover).
    // Stripe sends the user back with ?order_success=... ; Clover's return page sets
    // a sentinel in localStorage when payment is confirmed paid.
    useEffect(() => {
        try {
            const url = new URL(window.location.href);
            if (url.searchParams.has('order_success')) {
                localStorage.removeItem(storageKey);
                setItems([]);
            }
            const sentinelKey = `cart_clear_${siteId}`;
            if (localStorage.getItem(sentinelKey)) {
                localStorage.removeItem(storageKey);
                localStorage.removeItem(sentinelKey);
                setItems([]);
            }
            // Reopen the cart drawer when the user returns from sign-in or any
            // flow that wants to drop them back into checkout.
            if (url.searchParams.get('openCart') === '1') {
                setCartOpen(true);
                url.searchParams.delete('openCart');
                window.history.replaceState(null, '', url.toString());
            }
        } catch { }
    }, [storageKey, siteId]);

    const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
    const subtotalCents = items.reduce((sum, i) => sum + i.price_cents * i.qty, 0);

    return (
        <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQty, clearCart, isCartOpen, setCartOpen, itemCount, subtotalCents }}>
            {children}
        </CartContext.Provider>
    );
}
