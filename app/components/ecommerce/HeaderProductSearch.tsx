'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import { usePathname, useRouter } from 'next/navigation';

interface Product {
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    currency: string;
    images: string[];
    is_active: boolean;
    status: string;
}

export default function HeaderProductSearch({ color = '#475569' }: { color?: string }) {
    const context = useEditorContext();
    const pathname = usePathname();
    const router = useRouter();
    const isEditor = pathname?.startsWith('/editor') || pathname?.startsWith('/design');

    const hasProductBlock =
        context?.blocks?.some(b => b.type === 'productGrid') ||
        !!context?.siteContent?.__hasProductBlock;

    const showSearch = context?.siteContent?.headerShowProductSearch !== false;

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery('');
                setResults([]);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Focus input when opened
    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    const doSearch = useCallback(async (term: string) => {
        if (!term.trim() || !context?.siteId) {
            setResults([]);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/products?siteId=${context.siteId}&search=${encodeURIComponent(term)}`);
            const data = await res.json();
            setResults(data.products || []);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [context?.siteId]);

    const handleInputChange = (value: string) => {
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(value), 300);
    };

    const handleSelect = (product: Product) => {
        setOpen(false);
        setQuery('');
        setResults([]);
        if (!isEditor) {
            router.push(`/product/${product.id}`);
        }
    };

    const formatPrice = (cents: number, currency: string) => {
        return new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: currency || 'CAD',
        }).format(cents / 100);
    };

    if (!hasProductBlock || !showSearch) return null;

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="relative p-2 rounded-full hover:bg-slate-100 transition-colors"
                style={{ color }}
                aria-label="Search products"
            >
                <Search className="w-5 h-5" />
            </button>
        );
    }

    return (
        <div ref={containerRef} className="relative">
            {/* Search input */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="Search products..."
                    className="flex-1 text-sm text-slate-800 outline-none bg-transparent min-w-0"
                />
                {loading ? (
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />
                ) : (
                    <button
                        onClick={() => { setOpen(false); setQuery(''); setResults([]); }}
                        className="p-0.5 hover:bg-slate-100 rounded-full transition-colors shrink-0"
                    >
                        <X className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                )}
            </div>

            {/* Results dropdown */}
            {query.trim() && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-[100] max-h-80 overflow-y-auto">
                    {loading && results.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                        </div>
                    ) : results.length === 0 ? (
                        <div className="py-6 text-center text-sm text-slate-500">
                            No products found for &ldquo;{query}&rdquo;
                        </div>
                    ) : (
                        <div className="py-1">
                            {results.map((product) => (
                                <button
                                    key={product.id}
                                    onClick={() => handleSelect(product)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                                >
                                    {product.images?.[0] ? (
                                        <img
                                            src={product.images[0]}
                                            alt={product.name}
                                            className="w-10 h-10 rounded-lg object-cover shrink-0 bg-slate-100"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center">
                                            <Search className="w-4 h-4 text-slate-300" />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-slate-800 truncate">
                                            {product.name}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {formatPrice(product.price_cents, product.currency)}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
