'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Package } from 'lucide-react';

interface LowStockProduct {
    id: string;
    name: string;
    inventory_count: number;
    images?: string[];
    price_cents: number;
}

interface LowStockPanelProps {
    siteId: string;
    /** Inventory at or below this count counts as "low". Default 5. */
    threshold?: number;
    /** Maximum products to list. Default 10. */
    limit?: number;
}

/**
 * Compact owner-facing panel highlighting products that are running low
 * on inventory so the owner can restock before stockouts cause angry customers.
 */
export default function LowStockPanel({ siteId, threshold = 5, limit = 10 }: LowStockPanelProps) {
    const [products, setProducts] = useState<LowStockProduct[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                // Pull up to 100 so we can sort the "lowest first" client-side.
                const res = await fetch(`/api/products?siteId=${siteId}&limit=100`);
                if (!res.ok) return;
                const data = await res.json();
                const all: LowStockProduct[] = data.products || [];
                const low = all
                    .filter(p => p.inventory_count > 0 && p.inventory_count <= threshold)
                    .sort((a, b) => a.inventory_count - b.inventory_count)
                    .slice(0, limit);
                if (mounted) setProducts(low);
            } catch {
                // swallow
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [siteId, threshold, limit]);

    if (loading) {
        return (
            <div className="border-2 border-slate-200 rounded-xl px-5 py-4 flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking inventory...
            </div>
        );
    }

    if (products.length === 0) return null;

    return (
        <div className="border-2 border-amber-200 bg-amber-50/40 rounded-xl overflow-hidden mb-4">
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-amber-900">
                    Low stock — {products.length} product{products.length === 1 ? '' : 's'} running low
                </h3>
            </div>
            <ul className="divide-y divide-amber-100">
                {products.map(p => (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                        {p.images?.[0] ? (
                            <img src={p.images[0]} alt={p.name} className="w-9 h-9 rounded-md object-cover flex-shrink-0" />
                        ) : (
                            <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                                <Package className="w-4 h-4 text-slate-400" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                            <p className="text-xs text-slate-500">${(p.price_cents / 100).toFixed(2)}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.inventory_count <= 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {p.inventory_count} left
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
