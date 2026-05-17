'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorContext } from '@/lib/editor-context';
import { useCart } from '../ecommerce/CartProvider';
import {
    Package, Plus, Trash2, Loader2, ShoppingCart, X,
    ImageIcon, Upload, Download, Send, Search,
    ChevronLeft, ChevronRight, Tag, Pencil, Lock, Crown, Star,
    Square, CheckSquare, Minus, SlidersHorizontal,
    FolderTree,
} from 'lucide-react';
import CsvImportModal from '@/app/components/csv-import/CsvImportModal';
import ProductCategoriesManager from './ProductCategoriesManager';
import ProductDescriptionEditor from '../ProductDescriptionEditor';
import EditableButton, { type ButtonIconData, type ButtonLinkData } from '@/app/components/EditableButton';
import EditableText from '@/app/components/EditableText';
import { stripHtml } from '@/lib/ecommerce/description';
import { resolvePaletteColor } from '@/lib/palette-colors';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Reveal, { useStaggerSec } from '@/app/components/Reveal';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Product {
    id: string;
    name: string;
    brand: string | null;
    description: string | null;
    price_cents: number;
    compare_at_cents: number | null;
    currency: string;
    images: string[];
    variants: Array<{ name: string; options: string[] }>;
    options?: Array<{ name: string; values: Array<{ label: string; priceModifierCents: number }>; defaultIndex: number }>;
    inventory_count: number;
    is_active: boolean;
    is_featured: boolean;
    sort_order: number;
    status: string;
    category: string | null;
    subcategory: string | null;
    tags: string[];
    tier_prices?: Array<{ packageId: string; priceCents: number }>;
    allowed_package_ids?: string[];
    effective_price_cents?: number;
    public_price_cents?: number;
    matched_package_id?: string | null;
    can_purchase?: boolean;
    gate_reason?: 'guest' | 'wrong-tier' | null;
    external_url?: string | null;
    vendor_id?: string | null;
    weight_grams?: number | null;
    length_mm?: number | null;
    width_mm?: number | null;
    height_mm?: number | null;
}

interface ProductGridBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function ProductGridBlock({ id, data, isEditMode, palette, updateContent }: ProductGridBlockProps) {
    const context = useEditorContext();
    const siteId = context?.siteId;

    if (!siteId) {
        return <div className="py-12 text-center text-slate-400">Product block requires a saved site.</div>;
    }

    return (
        <ProductGrid
            siteId={siteId}
            palette={palette}
            data={data}
            isEditMode={isEditMode}
            updateContent={updateContent}
        />
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDITOR: Product Manager
// ═══════════════════════════════════════════════════════════════════════════════

export function ProductManager({ siteId, palette }: { siteId: string; palette: Record<string, string> }) {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [publishing, setPublishing] = useState(false);
    const [showDraftModal, setShowDraftModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [membershipEditProduct, setMembershipEditProduct] = useState<Product | null>(null);
    const modalBackdropDown = useRef(false);

    // Vendor list (fetched once for bulk edit)
    const [vendors, setVendors] = useState<Array<{ id: string; name: string; payment_mode: string; is_default: boolean }>>([]);
    // Multi-select state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showBulkEdit, setShowBulkEdit] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/vendors?siteId=${siteId}`);
                const data = await res.json();
                setVendors(data.vendors || []);
            } catch { /* vendors not critical */ }
        })();
    }, [siteId]);

    const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

    const isFormOpen = !!editingProduct || showAdd;
    const closeForm = useCallback(() => {
        setEditingProduct(null);
        setShowAdd(false);
    }, []);

    // ESC-to-close + body scroll lock while the edit/add modal is open.
    useEffect(() => {
        if (!isFormOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeForm(); };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [isFormOpen, closeForm]);

    // Search, filter & pagination
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalProducts, setTotalProducts] = useState(0);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const ITEMS_PER_PAGE = 25;

    const fetchProducts = useCallback(async (page = 1, search = '', category = '', status = '') => {
        try {
            const params = new URLSearchParams({ siteId, page: String(page), limit: String(ITEMS_PER_PAGE) });
            if (search) params.set('search', search);
            if (category) params.set('category', category);
            if (status) params.set('status', status);

            const res = await fetch(`/api/products?${params}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setProducts(data.products || []);
            setCategories(data.categories || []);
            setTotalPages(data.pagination?.totalPages ?? 1);
            setTotalProducts(data.pagination?.total ?? 0);
        } catch (err) {
            console.error(err);
        }
    }, [siteId]);

    useEffect(() => {
        (async () => {
            await fetchProducts();
            setLoading(false);
        })();
    }, [fetchProducts]);

    const handleSearch = (value: string) => {
        clearSelection();
        setSearchQuery(value);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            setCurrentPage(1);
            fetchProducts(1, value, filterCategory, filterStatus);
        }, 300);
    };

    const handleFilterCategory = (cat: string) => {
        clearSelection();
        setFilterCategory(cat);
        setCurrentPage(1);
        fetchProducts(1, searchQuery, cat, filterStatus);
    };

    const handleFilterStatus = (s: string) => {
        clearSelection();
        setFilterStatus(s);
        setCurrentPage(1);
        fetchProducts(1, searchQuery, filterCategory, s);
    };

    const handlePageChange = (page: number) => {
        clearSelection();
        setCurrentPage(page);
        fetchProducts(page, searchQuery, filterCategory, filterStatus);
    };

    const handleDelete = async (productId: string) => {
        await fetch(`/api/products?id=${productId}`, { method: 'DELETE' });
        fetchProducts(currentPage, searchQuery, filterCategory, filterStatus);
    };

    const handlePublishAll = async () => {
        setPublishing(true);
        const res = await fetch('/api/products', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteId, publishAll: true }),
        });
        if (res.ok) {
            await fetchProducts(currentPage, searchQuery, filterCategory, filterStatus);
        }
        setPublishing(false);
    };

    const handleImported = async () => {
        setCurrentPage(1);
        setSearchQuery('');
        setFilterCategory('');
        setFilterStatus('');
        await fetchProducts(1);
    };

    const handleToggle = async (product: Product) => {
        const res = await fetch('/api/products', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: product.id, is_active: !product.is_active }),
        });
        const data = await res.json();
        if (data.product) setProducts(products.map(p => p.id === product.id ? data.product : p));
    };

    const handleToggleFeatured = async (product: Product) => {
        const res = await fetch('/api/products', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: product.id, is_featured: !product.is_featured }),
        });
        const data = await res.json();
        if (data.product) setProducts(products.map(p => p.id === product.id ? data.product : p));
    };

    if (loading) {
        return <section className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></section>;
    }

    const draftCount = products.filter(p => p.status === 'draft').length;

    const paginationBar = totalPages > 1 ? (
        <div className="flex items-center justify-between py-2">
            <p className="text-xs text-slate-400">
                Page {currentPage} of {totalPages} ({totalProducts} total)
            </p>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                </button>
                <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                </button>
            </div>
        </div>
    ) : null;

    return (
        <section className="py-12 px-4">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white border-2 border-blue-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-blue-50 px-6 py-4 border-b border-blue-200">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Package className="w-5 h-5 text-blue-600" />
                                    Product Catalog
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">{totalProducts} product{totalProducts !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {selectedIds.size > 0 && (
                                    <button
                                        onClick={() => setShowBulkEdit(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                                    >
                                        <SlidersHorizontal className="w-3.5 h-3.5" />
                                        Bulk Edit ({selectedIds.size})
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowImportModal(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    Import
                                </button>
                                <a
                                    href={`/api/products/export?siteId=${siteId}`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Export
                                </a>
                                {/* Draft count badge + popover */}
                                <div className="relative">
                                    <button
                                        onClick={() => draftCount > 0 && setShowDraftModal(v => !v)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${draftCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 cursor-pointer' : 'bg-slate-50 border-slate-200 text-slate-400 cursor-default'}`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${draftCount > 0 ? 'bg-amber-400' : 'bg-slate-300'}`} />
                                        {draftCount} draft{draftCount !== 1 ? 's' : ''}
                                    </button>
                                    {showDraftModal && draftCount > 0 && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setShowDraftModal(false)} />
                                            <div className="absolute top-full right-0 mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-56">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Not yet live</p>
                                                <div className="space-y-1.5">
                                                    {products.filter(p => p.status === 'draft').map(p => (
                                                        <div key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                                            <span className="truncate">{p.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <button onClick={handlePublishAll} disabled={publishing || draftCount === 0}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                    {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    Publish Drafts
                                </button>
                            </div>
                        </div>

                        {/* Search & Filters */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    if (selectedIds.size === products.length && products.length > 0) {
                                        clearSelection();
                                    } else {
                                        setSelectedIds(new Set(products.map(p => p.id)));
                                    }
                                }}
                                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors shrink-0 px-1"
                                title={selectedIds.size === products.length ? 'Deselect all' : 'Select all on this page'}
                            >
                                {selectedIds.size === 0
                                    ? <Square className="w-4 h-4" />
                                    : selectedIds.size === products.length
                                        ? <CheckSquare className="w-4 h-4 text-blue-600" />
                                        : <Minus className="w-4 h-4 text-blue-500" />
                                }
                                <span>{selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}</span>
                            </button>
                            <div className="relative flex-1 min-w-[180px]">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search products..."
                                    value={searchQuery}
                                    onChange={e => handleSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                            {categories.length > 0 && (
                                <select
                                    value={filterCategory}
                                    onChange={e => handleFilterCategory(e.target.value)}
                                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                    <option value="">All Categories</option>
                                    {categories.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            )}
                            <button
                                onClick={() => setShowCategoryManager(true)}
                                className="flex items-center gap-1 px-2 py-1.5 text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors"
                                title="Add, rename, or delete categories"
                            >
                                <FolderTree className="w-3.5 h-3.5" />
                                Manage Categories
                            </button>
                            <select
                                value={filterStatus}
                                onChange={e => handleFilterStatus(e.target.value)}
                                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            >
                                <option value="">All Status</option>
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                            </select>
                        </div>
                    </div>

                    <div className="p-6 space-y-3">
                        {paginationBar}

                        {products.length === 0 && !searchQuery && !filterCategory && !filterStatus && (
                            <p className="text-sm text-slate-400 text-center py-4">No products yet. Click "Add Product" below to create your first one.</p>
                        )}

                        {products.length === 0 && (searchQuery || filterCategory || filterStatus) && (
                            <p className="text-sm text-slate-400 text-center py-4">No products match your filters.</p>
                        )}

                        {products.map(product => (
                            <div key={product.id} className={`flex items-center gap-3 p-3 rounded-lg border ${selectedIds.has(product.id) ? 'border-blue-400 bg-blue-50/40' : product.status === 'draft' ? 'border-amber-200 bg-amber-50/40' : product.is_active ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedIds(prev => {
                                            const next = new Set(prev);
                                            if (next.has(product.id)) next.delete(product.id);
                                            else next.add(product.id);
                                            return next;
                                        });
                                    }}
                                    className="text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                                    title={selectedIds.has(product.id) ? 'Deselect' : 'Select'}
                                >
                                    {selectedIds.has(product.id)
                                        ? <CheckSquare className="w-4 h-4 text-blue-600" />
                                        : <Square className="w-4 h-4" />
                                    }
                                </button>
                                {product.images?.[0] ? (
                                    <img src={product.images[0]} alt={product.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        <ImageIcon className="w-5 h-5 text-slate-400" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-slate-900 text-sm truncate">{product.name}</h4>
                                        {product.status === 'draft' && (
                                            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200">Draft</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-sm font-bold text-green-700">${(product.price_cents / 100).toFixed(2)}</span>
                                        {product.compare_at_cents && (
                                            <span className="text-xs text-slate-400 line-through">${(product.compare_at_cents / 100).toFixed(2)}</span>
                                        )}
                                        {product.category && (
                                            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                                {product.category}{product.subcategory ? ` › ${product.subcategory}` : ''}
                                            </span>
                                        )}
                                        {product.variants?.length > 0 && (
                                            <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{product.variants.map(v => v.name).join(', ')}</span>
                                        )}
                                        {product.inventory_count >= 0 && (
                                            <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{product.inventory_count} in stock</span>
                                        )}
                                    </div>
                                    {product.tags?.length > 0 && (
                                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                                            <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                                            {product.tags.slice(0, 4).map(tag => (
                                                <span key={tag} className="text-[10px] text-slate-500 bg-slate-50 px-1 py-0.5 rounded">{tag}</span>
                                            ))}
                                            {product.tags.length > 4 && (
                                                <span className="text-[10px] text-slate-400">+{product.tags.length - 4}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleToggleFeatured(product)}
                                    title={product.is_featured ? 'Unfeature product' : 'Mark as featured'}
                                    className={`p-1.5 rounded border shrink-0 transition-colors ${product.is_featured ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-slate-200 text-slate-400 hover:bg-amber-50 hover:text-amber-500'}`}
                                >
                                    <Star className={`w-4 h-4 ${product.is_featured ? 'fill-amber-400' : ''}`} />
                                </button>
                                <button
                                    onClick={() => setMembershipEditProduct(product)}
                                    title="Membership pricing & access"
                                    className="p-1.5 rounded border border-slate-200 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 shrink-0"
                                >
                                    <Crown className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleToggle(product)} className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 shrink-0">
                                    {product.is_active ? 'Hide' : 'Show'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowAdd(false);
                                        setEditingProduct(product);
                                    }}
                                    className="p-1 hover:bg-blue-50 rounded text-slate-500 hover:text-blue-600 shrink-0"
                                    title="Edit product"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(product.id)} className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 shrink-0">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}

                        {paginationBar && <div className="pt-3 border-t border-slate-100">{paginationBar}</div>}

                        <button
                            onClick={() => { setEditingProduct(null); setShowAdd(true); }}
                            className="w-full py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 font-bold text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Product
                        </button>
                    </div>
                </div>

                {/* Add / Edit product modal */}
                {isFormOpen && (
                    <div
                        className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4"
                        onMouseDown={(e) => { modalBackdropDown.current = e.target === e.currentTarget; }}
                        onClick={(e) => {
                            if (modalBackdropDown.current && e.target === e.currentTarget) {
                                closeForm();
                            }
                            modalBackdropDown.current = false;
                        }}
                    >
                        <div className="w-full max-w-lg my-8" onClick={e => e.stopPropagation()}>
                            <ProductForm
                                key={editingProduct?.id ?? 'new'}
                                siteId={siteId}
                                product={editingProduct ?? undefined}
                                onSaved={() => {
                                    fetchProducts(currentPage, searchQuery, filterCategory, filterStatus);
                                    closeForm();
                                }}
                                onCancel={closeForm}
                            />
                        </div>
                    </div>
                )}

                {showImportModal && (
                    <CsvImportModal
                        siteId={siteId}
                        type="products"
                        onClose={() => setShowImportModal(false)}
                        onImported={handleImported}
                    />
                )}

                {membershipEditProduct && (
                    <MembershipPricingModal
                        siteId={siteId}
                        product={membershipEditProduct}
                        onClose={() => setMembershipEditProduct(null)}
                        onSaved={updated => {
                            setProducts(products.map(p => p.id === updated.id ? updated : p));
                            setMembershipEditProduct(null);
                        }}
                    />
                )}

                {showBulkEdit && selectedIds.size > 0 && (
                    <BulkEditModal
                        siteId={siteId}
                        selectedProducts={products.filter(p => selectedIds.has(p.id))}
                        vendors={vendors}
                        onClose={() => setShowBulkEdit(false)}
                        onSaved={() => {
                            setShowBulkEdit(false);
                            clearSelection();
                            fetchProducts(currentPage, searchQuery, filterCategory, filterStatus);
                        }}
                    />
                )}

                <ProductCategoriesManager
                    siteId={siteId}
                    isOpen={showCategoryManager}
                    onClose={() => setShowCategoryManager(false)}
                    onChanged={() => fetchProducts(currentPage, searchQuery, filterCategory, filterStatus)}
                />
            </div>
        </section>
    );
}

// ─── Bulk Edit Modal ────────────────────────────────────────────────────────────

function BulkEditModal({
    siteId,
    selectedProducts,
    vendors,
    onClose,
    onSaved,
}: {
    siteId: string;
    selectedProducts: Product[];
    vendors: Array<{ id: string; name: string; payment_mode: string; is_default: boolean }>;
    onClose: () => void;
    onSaved: () => void;
}) {
    const count = selectedProducts.length;
    const packages = useMembershipPackages(siteId);

    const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
    const markDirty = (field: string) =>
        setDirtyFields(prev => { const n = new Set(prev); n.add(field); return n; });

    function allSame<T>(getter: (p: Product) => T): { same: boolean; value: T } {
        const first = getter(selectedProducts[0]);
        const same = selectedProducts.every(p => getter(p) === first);
        return { same, value: first };
    }

    const statusInfo = allSame(p => p.status);
    const isActiveInfo = allSame(p => p.is_active);
    const isFeaturedInfo = allSame(p => p.is_featured);
    const vendorInfo = allSame(p => p.vendor_id ?? '');
    const categoryInfo = allSame(p => p.category ?? '');
    const tagsInfo = allSame(p => (p.tags ?? []).join(', '));
    const brandInfo = allSame(p => p.brand ?? '');
    const allowedPackagesInfo = allSame(p => (p.allowed_package_ids ?? []).slice().sort().join(','));
    const gateEnabledInfo = allSame(p => (p.allowed_package_ids ?? []).length > 0);

    const [status, setStatus] = useState(statusInfo.same ? statusInfo.value : '');
    const [isActive, setIsActive] = useState(isActiveInfo.same ? isActiveInfo.value : true);
    const [isFeatured, setIsFeatured] = useState(isFeaturedInfo.same ? isFeaturedInfo.value : false);
    const [vendorId, setVendorId] = useState(vendorInfo.same ? vendorInfo.value : '');
    const [category, setCategory] = useState(categoryInfo.same ? categoryInfo.value : '');
    const [tags, setTags] = useState(tagsInfo.same ? tagsInfo.value : '');
    const [brand, setBrand] = useState(brandInfo.same ? brandInfo.value : '');

    // Membership pricing — one input per package. Accepts "12.50" (absolute $) or "20%" (% off public).
    // Blank means "leave unchanged". The "clear all member prices" toggle replaces tier_prices with [].
    const [tierInputs, setTierInputs] = useState<Record<string, string>>({});
    const [clearTiers, setClearTiers] = useState(false);
    const [gateEnabled, setGateEnabled] = useState<boolean>(gateEnabledInfo.same ? gateEnabledInfo.value : false);
    const [allowedPackageIds, setAllowedPackageIds] = useState<string[]>(
        allowedPackagesInfo.same && selectedProducts[0]?.allowed_package_ids
            ? selectedProducts[0].allowed_package_ids
            : []
    );

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fieldLabels: Record<string, string> = {
        status: 'Status', is_active: 'Active', is_featured: 'Featured',
        vendor_id: 'Vendor', category: 'Category', tags: 'Tags', brand: 'Brand',
        member_pricing: 'Member pricing', member_access: 'Member-only access',
    };

    const handleSave = async () => {
        if (dirtyFields.size === 0) { onClose(); return; }
        setSaving(true);
        setError(null);

        const payload: Record<string, any> = { ids: selectedProducts.map(p => p.id) };
        if (dirtyFields.has('status')) payload.status = status;
        if (dirtyFields.has('is_active')) payload.is_active = isActive;
        if (dirtyFields.has('is_featured')) payload.is_featured = isFeatured;
        if (dirtyFields.has('vendor_id')) payload.vendor_id = vendorId || null;
        if (dirtyFields.has('category')) payload.category = category.trim() || null;
        if (dirtyFields.has('tags')) payload.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
        if (dirtyFields.has('brand')) payload.brand = brand.trim() || null;

        if (dirtyFields.has('member_pricing')) {
            if (clearTiers) {
                payload.member_pricing = { clear: true };
            } else {
                const tiers: Array<{ packageId: string; absoluteCents?: number; percentOff?: number }> = [];
                for (const [packageId, raw] of Object.entries(tierInputs) as Array<[string, string]>) {
                    const trimmed = (raw || '').trim();
                    if (!trimmed) continue;
                    const pctMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*%\s*(?:off)?$/i);
                    if (pctMatch) {
                        const pct = parseFloat(pctMatch[1]);
                        if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
                            setError(`Invalid percent for ${packages.find(p => p.id === packageId)?.name || packageId}: must be 0–100%`);
                            setSaving(false);
                            return;
                        }
                        tiers.push({ packageId, percentOff: pct });
                    } else {
                        const dollarMatch = trimmed.replace(/[$,]/g, '');
                        const num = parseFloat(dollarMatch);
                        if (!Number.isFinite(num) || num < 0) {
                            setError(`Invalid price for ${packages.find(p => p.id === packageId)?.name || packageId}`);
                            setSaving(false);
                            return;
                        }
                        tiers.push({ packageId, absoluteCents: Math.round(num * 100) });
                    }
                }
                if (tiers.length === 0) {
                    setError('Enter at least one member price, or toggle "clear all member prices".');
                    setSaving(false);
                    return;
                }
                payload.member_pricing = { tiers };
            }
        }

        if (dirtyFields.has('member_access')) {
            payload.allowed_package_ids = gateEnabled ? allowedPackageIds : [];
        }

        const res = await fetch('/api/products', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Failed to save'); setSaving(false); return; }
        onSaved();
    };

    const renderToggle = (
        value: boolean,
        info: { same: boolean },
        field: string,
        setValue: (v: boolean) => void,
        activeColor: string,
    ) => {
        const isMixed = !info.same && !dirtyFields.has(field);
        return (
            <button
                type="button"
                onClick={() => {
                    const next = info.same || dirtyFields.has(field) ? !value : true;
                    setValue(next);
                    markDirty(field);
                }}
                title={isMixed ? 'Mixed values — click to set' : ''}
            >
                {isMixed
                    ? <Minus className="w-5 h-5 text-slate-400" />
                    : (
                        <span className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? activeColor : 'bg-slate-200'}`}>
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                        </span>
                    )
                }
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-5 h-5 text-blue-600" />
                        <h3 className="font-bold text-slate-900">Bulk Edit</h3>
                        <span className="text-sm text-slate-500">— {count} product{count !== 1 ? 's' : ''}</span>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
                        <X className="w-4 h-4 text-slate-500" />
                    </button>
                </div>

                <p className="px-5 pt-3 text-[11px] text-slate-500">
                    Only fields you change will be applied. Mixed values are shown as <Minus className="w-3 h-3 inline" /> or "(varies)".
                </p>

                <div className="px-5 py-4 space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-700 mb-1 block">Status</label>
                        <select
                            value={dirtyFields.has('status') ? status : (statusInfo.same ? status : '')}
                            onChange={e => { setStatus(e.target.value); markDirty('status'); }}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {!statusInfo.same && !dirtyFields.has('status') && <option value="">(varies)</option>}
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700">Active (visible in store)</label>
                        {renderToggle(isActive, isActiveInfo, 'is_active', setIsActive, 'bg-blue-600')}
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            <Star className="w-3.5 h-3.5 text-amber-400" /> Featured
                        </label>
                        {renderToggle(isFeatured, isFeaturedInfo, 'is_featured', setIsFeatured, 'bg-amber-400')}
                    </div>

                    {vendors.length > 0 && (
                        <div>
                            <label className="text-xs font-semibold text-slate-700 mb-1 block">Fulfilled by</label>
                            <select
                                value={dirtyFields.has('vendor_id') ? (vendorId ?? '') : (vendorInfo.same ? vendorId : '')}
                                onChange={e => { setVendorId(e.target.value); markDirty('vendor_id'); }}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {!vendorInfo.same && !dirtyFields.has('vendor_id') && <option value="">(varies)</option>}
                                <option value="">Your Store (self-fulfilled)</option>
                                {vendors.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}{v.is_default ? ' ★' : ''} — {v.payment_mode}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-semibold text-slate-700 mb-1 block">Category</label>
                        <input
                            type="text"
                            value={dirtyFields.has('category') ? category : (categoryInfo.same ? category : '')}
                            placeholder={!categoryInfo.same && !dirtyFields.has('category') ? '(varies)' : 'e.g. Apparel'}
                            onChange={e => { setCategory(e.target.value); markDirty('category'); }}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-700 mb-1 block">Tags</label>
                        <input
                            type="text"
                            value={dirtyFields.has('tags') ? tags : (tagsInfo.same ? tags : '')}
                            placeholder={!tagsInfo.same && !dirtyFields.has('tags') ? '(varies)' : 'comma-separated'}
                            onChange={e => { setTags(e.target.value); markDirty('tags'); }}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-700 mb-1 block">Brand</label>
                        <input
                            type="text"
                            value={dirtyFields.has('brand') ? brand : (brandInfo.same ? brand : '')}
                            placeholder={!brandInfo.same && !dirtyFields.has('brand') ? '(varies)' : 'e.g. Nike'}
                            onChange={e => { setBrand(e.target.value); markDirty('brand'); }}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {packages.length > 0 && (
                        <div className="pt-3 border-t border-slate-100 space-y-3">
                            <div className="flex items-center gap-2">
                                <Crown className="w-4 h-4 text-emerald-600" />
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Member pricing</h4>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Enter a dollar amount (e.g. <code className="px-1 bg-slate-100 rounded">12.50</code>) or a percent off the public price (e.g. <code className="px-1 bg-slate-100 rounded">20%</code>). Leave blank to keep each product's current price. Prices are clamped to ≤ public price per product.
                            </p>
                            <div className="space-y-2">
                                {packages.map(pkg => (
                                    <div key={pkg.id} className="flex items-center gap-2">
                                        <label className="flex-1 text-xs font-medium text-slate-700 truncate">{pkg.name}</label>
                                        <input
                                            type="text"
                                            disabled={clearTiers}
                                            value={tierInputs[pkg.id] ?? ''}
                                            placeholder="12.50 or 20%"
                                            onChange={e => {
                                                setTierInputs(t => ({ ...t, [pkg.id]: e.target.value }));
                                                markDirty('member_pricing');
                                            }}
                                            className="w-32 px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                                        />
                                    </div>
                                ))}
                            </div>
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={clearTiers}
                                    onChange={e => { setClearTiers(e.target.checked); markDirty('member_pricing'); }}
                                />
                                Clear all member prices on selected products
                            </label>

                            <div className="pt-2 flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5 text-slate-500" /> Restrict purchase to members
                                </label>
                                {renderToggle(gateEnabled, gateEnabledInfo, 'member_access', setGateEnabled, 'bg-emerald-600')}
                            </div>
                            {gateEnabled && (
                                <div className="space-y-1.5 pl-1">
                                    {packages.map(pkg => {
                                        const checked = allowedPackageIds.includes(pkg.id);
                                        return (
                                            <label key={pkg.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={e => {
                                                        setAllowedPackageIds(prev => e.target.checked
                                                            ? [...prev, pkg.id]
                                                            : prev.filter(id => id !== pkg.id));
                                                        markDirty('member_access');
                                                    }}
                                                />
                                                {pkg.name}
                                            </label>
                                        );
                                    })}
                                    {allowedPackageIds.length === 0 && (
                                        <p className="text-[11px] text-amber-600">Pick at least one package, or turn off the restriction to allow everyone.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {error && <p className="text-xs text-red-600">{error}</p>}
                </div>

                <div className="px-5 py-4 border-t border-slate-100 space-y-3">
                    {dirtyFields.size > 0 && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            Saving will update <strong>{[...dirtyFields].map(f => fieldLabels[f] || f).join(', ')}</strong> for {count} product{count !== 1 ? 's' : ''}.
                        </p>
                    )}
                    <div className="flex items-center justify-end gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || dirtyFields.size === 0}
                            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 flex items-center gap-2"
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Product Form (add + edit, with image upload + variants) ───────────────────

interface MembershipPackage {
    id: string;
    name: string;
    price_cents: number;
    billing_interval: string;
}

function useMembershipPackages(siteId: string) {
    const [packages, setPackages] = useState<MembershipPackage[]>([]);
    useEffect(() => {
        let cancelled = false;
        fetch(`/api/membership/packages?siteId=${siteId}`)
            .then(r => r.ok ? r.json() : { packages: [] })
            .then(d => { if (!cancelled) setPackages(d.packages || []); })
            .catch(() => { if (!cancelled) setPackages([]); });
        return () => { cancelled = true; };
    }, [siteId]);
    return packages;
}

function ProductForm({ siteId, product, onSaved, onCancel }: {
    siteId: string;
    product?: Product;
    onSaved: (p: Product) => void;
    onCancel: () => void;
}) {
    const isEdit = !!product;
    const [name, setName] = useState(product?.name ?? '');
    const [brand, setBrand] = useState(product?.brand ?? '');
    const [description, setDescription] = useState(product?.description ?? '');
    const [price, setPrice] = useState(product ? (product.price_cents / 100).toFixed(2) : '');
    const [compareAt, setCompareAt] = useState(product?.compare_at_cents ? (product.compare_at_cents / 100).toFixed(2) : '');
    const [images, setImages] = useState<string[]>(product?.images ?? []);
    const [inventory, setInventory] = useState(product ? String(product.inventory_count) : '-1');
    // Shipping physical dimensions — used for live carrier rate quoting.
    const [weightG, setWeightG] = useState(product?.weight_grams ? String(product.weight_grams) : '');
    const [lengthMm, setLengthMm] = useState(product?.length_mm ? String(product.length_mm) : '');
    const [widthMm, setWidthMm] = useState(product?.width_mm ? String(product.width_mm) : '');
    const [heightMm, setHeightMm] = useState(product?.height_mm ? String(product.height_mm) : '');
    const [category, setCategory] = useState(product?.category ?? '');
    const [subcategory, setSubcategory] = useState(product?.subcategory ?? '');
    const [tags, setTags] = useState((product?.tags ?? []).join(', '));
    const [categoryTree, setCategoryTree] = useState<Record<string, string[]>>({});
    const [variants, setVariants] = useState<Array<{ name: string; options: string }>>(
        product?.variants?.map(v => ({ name: v.name, options: (v.options ?? []).join(', ') })) ?? []
    );
    type OptionDraftValue = { label: string; priceModifier: string };
    type OptionDraft = { name: string; values: OptionDraftValue[]; defaultIndex: number };
    const [options, setOptions] = useState<OptionDraft[]>(
        product?.options?.map(o => ({
            name: o.name,
            values: (o.values ?? []).map(v => ({
                label: v.label,
                priceModifier: v.priceModifierCents ? (v.priceModifierCents / 100).toFixed(2) : '',
            })),
            defaultIndex: Number.isInteger(o.defaultIndex) ? Math.max(0, Math.min(o.defaultIndex, (o.values?.length || 1) - 1)) : 0,
        })) ?? []
    );
    const [tierPrices, setTierPrices] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        if (product?.tier_prices) {
            for (const tp of product.tier_prices) {
                init[tp.packageId] = (tp.priceCents / 100).toFixed(2);
            }
        }
        return init;
    });
    const [allowedPackageIds, setAllowedPackageIds] = useState<string[]>(
        product?.allowed_package_ids ?? []
    );
    const [externalUrl, setExternalUrl] = useState(product?.external_url ?? '');
    const [isFeatured, setIsFeatured] = useState<boolean>(!!product?.is_featured);
    const [gateEnabled, setGateEnabled] = useState(
        (product?.allowed_package_ids ?? []).length > 0
    );
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [tierError, setTierError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const packages = useMembershipPackages(siteId);
    const [vendorId, setVendorId] = useState<string>(product?.vendor_id ?? '');
    const [vendors, setVendors] = useState<Array<{ id: string; name: string; payment_mode: string; is_default: boolean }>>([]);

    // Load vendors for this site
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/vendors?siteId=${siteId}`);
                const data = await res.json();
                setVendors(data.vendors || []);
            } catch (err) {
                // Vendors not available — that's fine
            }
        })();
    }, [siteId]);

    const defaultVendor = vendors.find(v => v.is_default);

    // Pull the category tree so the user can quickly pick an existing
    // category and auto-populate the subcategory autocomplete options.
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/products?siteId=${siteId}&limit=1`);
                if (!res.ok) return;
                const d = await res.json();
                setCategoryTree(d.categoryTree || {});
            } catch {}
        })();
    }, [siteId]);

    const existingCategories = Object.keys(categoryTree).sort();
    const subcategorySuggestions = category ? (categoryTree[category] || []) : [];

    // Image upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        const newImages = [...images];

        for (const file of Array.from(files)) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('siteId', siteId);

            const res = await fetch('/api/sites/upload-image', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            if (data.imageUrl) {
                newImages.push(data.imageUrl);
            }
        }

        setImages(newImages);
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
    };

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    // Variant management
    const addVariantGroup = () => {
        setVariants([...variants, { name: '', options: '' }]);
    };

    const updateVariant = (index: number, field: 'name' | 'options', value: string) => {
        const updated = [...variants];
        updated[index] = { ...updated[index], [field]: value };
        setVariants(updated);
    };

    const removeVariant = (index: number) => {
        setVariants(variants.filter((_, i) => i !== index));
    };

    // Option (price-modifying) management
    const addOptionGroup = () => {
        setOptions([...options, { name: '', values: [{ label: '', priceModifier: '' }], defaultIndex: 0 }]);
    };
    const updateOptionGroup = (gi: number, patch: Partial<OptionDraft>) => {
        setOptions(prev => prev.map((g, i) => i === gi ? { ...g, ...patch } : g));
    };
    const removeOptionGroup = (gi: number) => {
        setOptions(prev => prev.filter((_, i) => i !== gi));
    };
    const addOptionValue = (gi: number) => {
        setOptions(prev => prev.map((g, i) => i === gi
            ? { ...g, values: [...g.values, { label: '', priceModifier: '' }] }
            : g));
    };
    const updateOptionValue = (gi: number, vi: number, patch: Partial<OptionDraftValue>) => {
        setOptions(prev => prev.map((g, i) => i === gi
            ? { ...g, values: g.values.map((v, j) => j === vi ? { ...v, ...patch } : v) }
            : g));
    };
    const removeOptionValue = (gi: number, vi: number) => {
        setOptions(prev => prev.map((g, i) => {
            if (i !== gi) return g;
            const values = g.values.filter((_, j) => j !== vi);
            const defaultIndex = Math.max(0, Math.min(g.defaultIndex, values.length - 1));
            return { ...g, values, defaultIndex };
        }));
    };

    const handleSave = async () => {
        if (!name.trim() || !price) return;
        setTierError(null);

        const trimmedExternalUrl = externalUrl.trim();
        if (trimmedExternalUrl && !/^https?:\/\//i.test(trimmedExternalUrl)) {
            setTierError('External URL must start with http:// or https://');
            return;
        }

        // Convert variant strings to structured format
        const structuredVariants = variants
            .filter(v => v.name.trim() && v.options.trim())
            .map(v => ({
                name: v.name.trim(),
                options: v.options.split(',').map(o => o.trim()).filter(Boolean),
            }));

        // Convert option drafts; drop incomplete groups; validate price modifiers.
        const structuredOptions: Array<{ name: string; values: Array<{ label: string; priceModifierCents: number }>; defaultIndex: number }> = [];
        for (const g of options) {
            const groupName = g.name.trim();
            if (!groupName) continue;
            const cleanValues: Array<{ label: string; priceModifierCents: number }> = [];
            for (const v of g.values) {
                const label = v.label.trim();
                if (!label) continue;
                const dollars = (v.priceModifier || '').trim();
                let cents = 0;
                if (dollars) {
                    const n = parseFloat(dollars);
                    if (!Number.isFinite(n) || n < 0) {
                        setTierError(`Option "${groupName}" has an invalid price modifier`);
                        return;
                    }
                    cents = Math.round(n * 100);
                }
                cleanValues.push({ label, priceModifierCents: cents });
            }
            if (cleanValues.length === 0) continue;
            const defaultIndex = Math.max(0, Math.min(g.defaultIndex, cleanValues.length - 1));
            structuredOptions.push({ name: groupName, values: cleanValues, defaultIndex });
        }

        const publicPriceCents = Math.round(parseFloat(price) * 100);

        const tier_prices_arr: Array<{ packageId: string; priceCents: number }> = [];
        for (const [packageId, dollars] of Object.entries(tierPrices)) {
            const trimmed = (dollars || '').trim();
            if (!trimmed) continue;
            const cents = Math.round(parseFloat(trimmed) * 100);
            if (!Number.isFinite(cents) || cents < 0) {
                setTierError('Tier prices must be non-negative numbers');
                return;
            }
            if (cents > publicPriceCents) {
                setTierError('Tier price cannot exceed the public price');
                return;
            }
            tier_prices_arr.push({ packageId, priceCents: cents });
        }

        const parsedTags = tags
            .split(',')
            .map(t => t.trim())
            .filter(Boolean);

        const payload = {
            name,
            brand: brand.trim() || null,
            description: description || null,
            price_cents: publicPriceCents,
            compare_at_cents: compareAt ? Math.round(parseFloat(compareAt) * 100) : null,
            images,
            variants: structuredVariants,
            options: structuredOptions,
            inventory_count: parseInt(inventory),
            category: category.trim() || null,
            subcategory: category.trim() && subcategory.trim() ? subcategory.trim() : null,
            tags: parsedTags,
            vendor_id: vendorId || null,
            tier_prices: tier_prices_arr,
            allowed_package_ids: gateEnabled ? allowedPackageIds : [],
            external_url: externalUrl.trim() || null,
            is_featured: isFeatured,
            weight_grams: weightG.trim() ? parseInt(weightG, 10) : null,
            length_mm: lengthMm.trim() ? parseInt(lengthMm, 10) : null,
            width_mm: widthMm.trim() ? parseInt(widthMm, 10) : null,
            height_mm: heightMm.trim() ? parseInt(heightMm, 10) : null,
        };

        setSaving(true);
        const res = await fetch('/api/products', {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(isEdit ? { id: product!.id, ...payload } : { siteId, ...payload }),
        });

        const data = await res.json();
        if (!res.ok) {
            setTierError(data.error || 'Failed to save product');
            setSaving(false);
            return;
        }
        if (data.product) onSaved(data.product);
        setSaving(false);
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">{isEdit ? 'Edit Product' : 'Add Product'}</h4>
                <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
            </div>

            {/* Brand */}
            <input
                type="text" placeholder="Brand (optional, e.g. Nike)" value={brand}
                onChange={e => setBrand(e.target.value)}
                className="w-full px-3 py-2 text-xs uppercase tracking-wider border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />

            {/* Name */}
            <input
                type="text" placeholder="Product name" value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />

            {/* Description */}
            <ProductDescriptionEditor
                value={description}
                onChange={setDescription}
                placeholder="Product description — supports bullet points, headings, links"
            />

            {/* Images */}
            <div>
                <label className="text-xs font-semibold text-slate-700 mb-2 block">Product Images</label>
                {images.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-2">
                        {images.map((img, i) => (
                            <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
                                <img src={img} alt={`Product image ${i + 1}`} className="w-full h-full object-cover" />
                                <button
                                    onClick={() => removeImage(i)}
                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                >
                                    <X className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                />
                <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Uploading...' : 'Upload Images'}
                </button>
            </div>

            {/* Price */}
            <div className="flex gap-3">
                <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Price ($) *</label>
                    <input type="number" step="0.01" min="0" value={price}
                        onChange={e => setPrice(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                </div>
                <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Compare at ($)</label>
                    <input type="number" step="0.01" min="0" value={compareAt}
                        onChange={e => setCompareAt(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        placeholder="Original price"
                    />
                </div>
            </div>

            {/* Inventory */}
            <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Inventory (-1 = unlimited)</label>
                <input type="number" value={inventory} onChange={e => setInventory(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
            </div>

            {/* Shipping dimensions (required for live carrier rate quoting). */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50/50">
                <div>
                    <p className="text-xs font-semibold text-slate-700">Shipping (optional)</p>
                    <p className="text-[11px] text-slate-500">Weight and box dimensions — required if any zone uses live carrier rates.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                        <label className="text-[11px] font-medium text-slate-600 mb-1 block">Weight (g)</label>
                        <input type="number" min="0" step="1" value={weightG} onChange={e => setWeightG(e.target.value)}
                            className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            placeholder="500"
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-slate-600 mb-1 block">Length (mm)</label>
                        <input type="number" min="0" step="1" value={lengthMm} onChange={e => setLengthMm(e.target.value)}
                            className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            placeholder="200"
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-slate-600 mb-1 block">Width (mm)</label>
                        <input type="number" min="0" step="1" value={widthMm} onChange={e => setWidthMm(e.target.value)}
                            className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            placeholder="150"
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-slate-600 mb-1 block">Height (mm)</label>
                        <input type="number" min="0" step="1" value={heightMm} onChange={e => setHeightMm(e.target.value)}
                            className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            placeholder="50"
                        />
                    </div>
                </div>
            </div>

            {/* External URL */}
            <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">External URL (optional)</label>
                <input
                    type="url"
                    value={externalUrl}
                    onChange={e => setExternalUrl(e.target.value)}
                    placeholder="https://example.com/product-listing"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                    If set, clicking this product opens this URL in a new tab instead of the built-in product page. The Add-to-Cart button is hidden — use this for affiliate links or products fulfilled on a third-party site.
                </p>
            </div>

            {/* Category + Subcategory */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Category</label>
                    <input
                        type="text"
                        value={category}
                        onChange={e => {
                            const next = e.target.value;
                            setCategory(next);
                            if (next.trim() !== category.trim() && subcategory) {
                                const list = categoryTree[next.trim()] || [];
                                if (!list.includes(subcategory)) setSubcategory('');
                            }
                        }}
                        list={`product-categories-${isEdit ? product!.id : 'new'}`}
                        placeholder="e.g. Apparel"
                        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    {existingCategories.length > 0 && (
                        <datalist id={`product-categories-${isEdit ? product!.id : 'new'}`}>
                            {existingCategories.map(c => <option key={c} value={c} />)}
                        </datalist>
                    )}
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Subcategory</label>
                    <input
                        type="text"
                        value={subcategory}
                        onChange={e => setSubcategory(e.target.value)}
                        list={`product-subcategories-${isEdit ? product!.id : 'new'}`}
                        placeholder={category ? 'e.g. T-Shirts' : 'Pick a category first'}
                        disabled={!category.trim()}
                        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                    />
                    {subcategorySuggestions.length > 0 && (
                        <datalist id={`product-subcategories-${isEdit ? product!.id : 'new'}`}>
                            {subcategorySuggestions.map(s => <option key={s} value={s} />)}
                        </datalist>
                    )}
                </div>
            </div>
            <p className="text-[11px] text-slate-400 -mt-2">
                Used for the storefront sidebar tree and block-level scoping. Subcategories are scoped to their parent category — the same name under different categories is treated as distinct.
            </p>

            {/* Tags */}
            <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Tags</label>
                <input
                    type="text"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    placeholder="comma-separated (e.g. sale, new, summer)"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">Used to suggest related products on the detail page.</p>
            </div>

            {/* Featured */}
            <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-amber-50/40">
                <button
                    type="button"
                    onClick={() => setIsFeatured(v => !v)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 mt-0.5 ${isFeatured ? 'bg-amber-400' : 'bg-slate-200'}`}
                    aria-pressed={isFeatured}
                >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${isFeatured ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                </button>
                <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer" onClick={() => setIsFeatured(v => !v)}>
                        <Star className={`w-3.5 h-3.5 ${isFeatured ? 'text-amber-500 fill-amber-400' : 'text-slate-400'}`} />
                        Featured product
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">Mark this product as featured so it can appear in "Featured" Products blocks on the home page.</p>
                </div>
            </div>

            {/* Vendor / Fulfillment */}
            {vendors.length > 0 && (
                <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Fulfilled by</label>
                    <select
                        value={vendorId}
                        onChange={e => setVendorId(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="">
                            {defaultVendor ? `Use default (${defaultVendor.name})` : 'Your Store (self-fulfilled)'}
                        </option>
                        {vendors.map(v => (
                            <option key={v.id} value={v.id}>
                                {v.name}{v.is_default ? ' ★ default' : ''} — {v.payment_mode}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">
                        {defaultVendor
                            ? `Leave as "Use default" to fulfill through ${defaultVendor.name}. Pick a specific vendor to override.`
                            : 'Select a vendor if this product is fulfilled by a third party.'}
                    </p>
                </div>
            )}

            {/* Variants */}
            <div>
                <label className="text-xs font-semibold text-slate-700 mb-2 block">Variants</label>
                {variants.map((v, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                        <input
                            type="text"
                            placeholder="Name (e.g. Size)"
                            value={v.name}
                            onChange={e => updateVariant(i, 'name', e.target.value)}
                            className="w-1/3 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <input
                            type="text"
                            placeholder="Options (comma-separated: S, M, L, XL)"
                            value={v.options}
                            onChange={e => updateVariant(i, 'options', e.target.value)}
                            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <button onClick={() => removeVariant(i)} className="p-2 hover:bg-red-50 rounded text-red-400">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                <button
                    onClick={addVariantGroup}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                    <Plus className="w-3.5 h-3.5" /> Add variant (e.g. Size, Color)
                </button>
                <p className="text-[11px] text-slate-400 mt-1">
                    Variants are equal-price choices like Size or Colour. For required selections that change the price (e.g. Single vs Case of 24), use Options below.
                </p>
            </div>

            {/* Options (required, price-modifying) */}
            <div>
                <label className="text-xs font-semibold text-slate-700 mb-2 block">Options</label>
                <p className="text-[11px] text-slate-400 mb-2">
                    Required selections that adjust the price. The default value is what's selected when the customer lands on the page.
                </p>
                {options.map((g, gi) => (
                    <div key={gi} className="border border-slate-200 rounded-lg p-3 mb-2 space-y-2 bg-slate-50/50">
                        <div className="flex gap-2 items-center">
                            <input
                                type="text"
                                placeholder="Option name (e.g. Quantity)"
                                value={g.name}
                                onChange={e => updateOptionGroup(gi, { name: e.target.value })}
                                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <button
                                type="button"
                                onClick={() => removeOptionGroup(gi)}
                                className="p-2 hover:bg-red-50 rounded text-red-400"
                                title="Remove option"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            <div className="grid grid-cols-[16px_1fr_120px_24px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                <span>Default</span>
                                <span>Label</span>
                                <span>Price modifier ($)</span>
                                <span></span>
                            </div>
                            {g.values.map((v, vi) => (
                                <div key={vi} className="grid grid-cols-[16px_1fr_120px_24px] gap-2 items-center">
                                    <input
                                        type="radio"
                                        name={`option-default-${gi}`}
                                        checked={g.defaultIndex === vi}
                                        onChange={() => updateOptionGroup(gi, { defaultIndex: vi })}
                                        className="accent-blue-600"
                                        title="Set as default selection"
                                    />
                                    <input
                                        type="text"
                                        placeholder="e.g. Single"
                                        value={v.label}
                                        onChange={e => updateOptionValue(gi, vi, { label: e.target.value })}
                                        className="px-2 py-1.5 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        value={v.priceModifier}
                                        onChange={e => updateOptionValue(gi, vi, { priceModifier: e.target.value })}
                                        className="px-2 py-1.5 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeOptionValue(gi, vi)}
                                        disabled={g.values.length <= 1}
                                        className="p-1 hover:bg-red-50 rounded text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Remove value"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => addOptionValue(gi)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" /> Add value
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={addOptionGroup}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                    <Plus className="w-3.5 h-3.5" /> Add option (e.g. Quantity, Pack Size)
                </button>
            </div>

            {/* Membership pricing */}
            {packages.length > 0 && (
                <div className="border-t border-slate-200 pt-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Crown className="w-4 h-4 text-emerald-600" />
                        <label className="text-xs font-bold text-slate-700">Membership pricing</label>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                        Override the price for members of specific packages. Members never pay more than the public price.
                    </p>
                    <div className="space-y-1.5">
                        {packages.map(pkg => (
                            <div key={pkg.id} className="flex items-center gap-2">
                                <span className="flex-1 text-xs text-slate-700 truncate">{pkg.name}</span>
                                <span className="text-[10px] text-slate-400">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={tierPrices[pkg.id] || ''}
                                    placeholder="—"
                                    onChange={e => setTierPrices({ ...tierPrices, [pkg.id]: e.target.value })}
                                    className="w-24 px-2 py-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        ))}
                    </div>
                    {tierError && <p className="mt-2 text-[11px] text-red-600">{tierError}</p>}
                </div>
            )}

            {/* Purchase access gating */}
            {packages.length > 0 && (
                <div className="border-t border-slate-200 pt-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Lock className="w-4 h-4 text-slate-500" />
                        <label className="text-xs font-bold text-slate-700">Purchase access</label>
                    </div>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="gate-mode"
                                checked={!gateEnabled}
                                onChange={() => { setGateEnabled(false); setAllowedPackageIds([]); }}
                                className="accent-blue-600"
                            />
                            <span className="text-xs text-slate-700">Anyone can buy</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="gate-mode"
                                checked={gateEnabled}
                                onChange={() => setGateEnabled(true)}
                                className="accent-blue-600"
                            />
                            <span className="text-xs text-slate-700">Only members of selected packages</span>
                        </label>
                        {gateEnabled && (
                            <div className="pl-6 space-y-1.5 pt-1">
                                {packages.map(pkg => {
                                    const checked = allowedPackageIds.includes(pkg.id);
                                    return (
                                        <label key={pkg.id} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={e => {
                                                    setAllowedPackageIds(e.target.checked
                                                        ? [...allowedPackageIds, pkg.id]
                                                        : allowedPackageIds.filter(id => id !== pkg.id));
                                                }}
                                                className="accent-blue-600"
                                            />
                                            <span className="text-xs text-slate-700">{pkg.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Save / Cancel */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                    onClick={onCancel}
                    disabled={saving}
                    className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg disabled:opacity-40 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving || !name.trim() || !price}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEdit ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
                    {isEdit ? 'Save Changes' : 'Add Product'}
                </button>
            </div>
        </div>
    );
}

// ─── Membership Pricing & Access Modal (edit existing product) ──────────────────

function MembershipPricingModal({
    siteId, product, onClose, onSaved,
}: {
    siteId: string;
    product: Product;
    onClose: () => void;
    onSaved: (p: Product) => void;
}) {
    const packages = useMembershipPackages(siteId);
    const [tierPrices, setTierPrices] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        for (const t of (product.tier_prices || [])) {
            initial[t.packageId] = (t.priceCents / 100).toFixed(2);
        }
        return initial;
    });
    const [gateEnabled, setGateEnabled] = useState((product.allowed_package_ids || []).length > 0);
    const [allowedPackageIds, setAllowedPackageIds] = useState<string[]>(product.allowed_package_ids || []);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const publicPriceCents = product.price_cents;

    const handleSave = async () => {
        setError(null);
        const tier_prices: Array<{ packageId: string; priceCents: number }> = [];
        for (const [packageId, dollars] of Object.entries(tierPrices)) {
            const trimmed = (dollars || '').trim();
            if (!trimmed) continue;
            const cents = Math.round(parseFloat(trimmed) * 100);
            if (!Number.isFinite(cents) || cents < 0) {
                setError('Tier prices must be non-negative numbers');
                return;
            }
            if (cents > publicPriceCents) {
                setError('Tier price cannot exceed the public price');
                return;
            }
            tier_prices.push({ packageId, priceCents: cents });
        }

        setSaving(true);
        const res = await fetch('/api/products', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: product.id,
                tier_prices,
                allowed_package_ids: gateEnabled ? allowedPackageIds : [],
            }),
        });
        const data = await res.json();
        setSaving(false);
        if (!res.ok) {
            setError(data.error || 'Failed to save');
            return;
        }
        if (data.product) onSaved({ ...product, ...data.product });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-emerald-600" />
                        <h3 className="font-bold text-slate-900">Membership pricing &amp; access</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
                        <X className="w-4 h-4 text-slate-500" />
                    </button>
                </div>
                <div className="px-5 py-4 space-y-5">
                    <div className="text-xs text-slate-500">
                        Editing <span className="font-semibold text-slate-700">{product.name}</span> — public price
                        <span className="font-semibold text-slate-700"> ${(publicPriceCents / 100).toFixed(2)}</span>
                    </div>

                    {packages.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">
                            Create membership packages in the Membership admin to offer tiered pricing or gated access.
                        </p>
                    ) : (
                        <>
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Member prices</label>
                                <p className="text-[11px] text-slate-500 mb-2">
                                    Leave blank to charge the public price. Members never pay more than the public price.
                                </p>
                                <div className="space-y-1.5">
                                    {packages.map(pkg => (
                                        <div key={pkg.id} className="flex items-center gap-2">
                                            <span className="flex-1 text-xs text-slate-700 truncate">{pkg.name}</span>
                                            <span className="text-[10px] text-slate-400">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={tierPrices[pkg.id] || ''}
                                                placeholder="—"
                                                onChange={e => setTierPrices({ ...tierPrices, [pkg.id]: e.target.value })}
                                                className="w-24 px-2 py-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-2">Purchase access</label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={!gateEnabled}
                                            onChange={() => { setGateEnabled(false); setAllowedPackageIds([]); }}
                                            className="accent-blue-600"
                                        />
                                        <span className="text-xs text-slate-700">Anyone can buy</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={gateEnabled}
                                            onChange={() => setGateEnabled(true)}
                                            className="accent-blue-600"
                                        />
                                        <span className="text-xs text-slate-700">Only members of selected packages</span>
                                    </label>
                                    {gateEnabled && (
                                        <div className="pl-6 space-y-1.5 pt-1">
                                            {packages.map(pkg => {
                                                const checked = allowedPackageIds.includes(pkg.id);
                                                return (
                                                    <label key={pkg.id} className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={e => {
                                                                setAllowedPackageIds(e.target.checked
                                                                    ? [...allowedPackageIds, pkg.id]
                                                                    : allowedPackageIds.filter(id => id !== pkg.id));
                                                            }}
                                                            className="accent-blue-600"
                                                        />
                                                        <span className="text-xs text-slate-700">{pkg.name}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {error && <p className="text-xs text-red-600">{error}</p>}
                </div>
                <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || packages.length === 0}
                        className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 flex items-center gap-2"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER: Product Grid (links to product pages)
// ═══════════════════════════════════════════════════════════════════════════════

type SortKey = 'featured' | 'popular' | 'az' | 'za';

function ProductGrid({
    siteId,
    palette,
    data,
    isEditMode = false,
    updateContent,
}: {
    siteId: string;
    palette: Record<string, string>;
    data?: any;
    isEditMode?: boolean;
    updateContent?: (key: string, value: any) => void;
}) {
    const staggerSec = useStaggerSec();
    const [products, setProducts] = useState<Product[]>([]);
    const [categoryTree, setCategoryTree] = useState<Record<string, string[]>>({});
    const [popularity, setPopularity] = useState<Record<string, number>>({});
    const [popularityLoaded, setPopularityLoaded] = useState(false);
    // Sidebar navigation state: the currently-selected category/subcategory.
    // Subcategory is scoped to a category (cleared when category changes).
    const [activeCategory, setActiveCategory] = useState<string>('');
    const [activeSubcategory, setActiveSubcategory] = useState<string>('');
    const [sortBy, setSortBy] = useState<SortKey>('featured');
    const [loading, setLoading] = useState(true);
    const cart = useCart();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isEditor = pathname?.startsWith('/editor') || pathname?.startsWith('/design');

    const blockCategory: string = data?.categoryFilter || '';
    const blockSubcategory: string = data?.subcategoryFilter || '';

    // Allow nav-menu links (and other deep links) to scope this block via
    // ?category=…&subcategory=… query params. Block-level filters always win.
    const queryCategory = searchParams?.get('category') || '';
    const querySubcategory = searchParams?.get('subcategory') || '';

    // Seed the sidebar selection from the URL on first render and whenever the
    // query params change (e.g. user navigates between menu links on the same page).
    useEffect(() => {
        if (blockCategory) return; // block is locked, query params don't apply
        setActiveCategory(queryCategory);
        setActiveSubcategory(queryCategory ? querySubcategory : '');
    }, [queryCategory, querySubcategory, blockCategory]);
    const featuredOnly: boolean = !!data?.featuredOnly;
    const showSeeMore: boolean = !!data?.showSeeMore;
    // Prefer EditableButton-style fields; fall back to legacy seeMoreLabel/seeMoreHref.
    const seeMoreLabel: string = (data?.seeMore ?? data?.seeMoreLabel ?? '').toString().trim() || 'View all';
    const seeMoreLink: Partial<ButtonLinkData> | undefined =
        (data?.seeMoreLink as Partial<ButtonLinkData> | undefined)
        ?? (data?.seeMoreHref ? { linkType: 'custom', href: String(data.seeMoreHref) } : undefined);
    const seeMoreIcon: ButtonIconData | undefined = data?.seeMoreIcon as ButtonIconData | undefined;
    const seeMoreHref: string = (seeMoreLink?.href ?? '').toString().trim();
    const hasSeeMoreTarget = !!(seeMoreLink?.pageId || seeMoreLink?.blockId || seeMoreHref);
    const featuredHeading: string = (data?.featuredHeading ?? '').toString();
    const featuredHeadingStyles = data?.featuredHeading__styles;
    const defaultFeaturedHeading = featuredOnly
        ? `Featured${blockCategory ? ` — ${blockCategory}` : ''}${blockSubcategory ? ` › ${blockSubcategory}` : ''}`
        : `${blockCategory || 'Our Products'}${blockSubcategory ? ` — ${blockSubcategory}` : ''}`;
    // Backward-compat: featured-only blocks always rendered a title before this
    // toggle existed, so default `showTitle` to `featuredOnly` when unset.
    const showTitle: boolean = typeof data?.showTitle === 'boolean' ? data.showTitle : featuredOnly;
    const lockedToCategory = !!blockCategory;
    const variant: 'grid' | 'gridWithSidebar' | 'list' | 'row' = data?.variant || 'grid';
    const effectiveVariant = lockedToCategory && variant === 'gridWithSidebar' ? 'grid' : variant;
    const pSecondary = palette.secondary || '#dc2626';
    const sectionBg = resolvePaletteColor(data?.backgroundColor, palette, '#ffffff') || '#ffffff';
    // Carousel autoscroll settings (row variant only)
    const autoScroll: boolean = data?.autoScroll !== false;
    const autoScrollIntervalSec: number = typeof data?.autoScrollIntervalSec === 'number' ? data.autoScrollIntervalSec : 5;
    const autoScrollPauseOnHover: boolean = data?.autoScrollPauseOnHover !== false;

    const handleSeeMoreSave = (key: string, value: any) => {
        updateContent?.(key, value);
    };

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/products?siteId=${siteId}`);
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();
                setProducts((data.products || []).filter((p: Product) => p.is_active));
                setCategoryTree(data.categoryTree || {});
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        })();
    }, [siteId]);

    useEffect(() => {
        if (sortBy !== 'popular' || popularityLoaded) return;
        (async () => {
            try {
                const res = await fetch(`/api/products/popularity?siteId=${siteId}`);
                if (res.ok) {
                    const d = await res.json();
                    setPopularity(d.popularity || {});
                }
            } catch {
                // ignore — sort falls back to 0-counts (stable order)
            } finally {
                setPopularityLoaded(true);
            }
        })();
    }, [sortBy, siteId, popularityLoaded]);

    if (loading) {
        return <section className="py-16 text-center" style={{ backgroundColor: sectionBg }}><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></section>;
    }

    if (products.length === 0) {
        return (
            <section className="py-16 text-center text-slate-400" style={{ backgroundColor: sectionBg }}>
                <Package className="w-10 h-10 mx-auto mb-3" />
                <p className="font-medium">Products coming soon</p>
                {isEditMode && (
                    <p className="mt-2 text-xs text-slate-400">Add products from the &ldquo;Manage Products&rdquo; button above.</p>
                )}
            </section>
        );
    }

    const handleQuickAdd = (e: React.MouseEvent, product: Product) => {
        e.preventDefault();
        e.stopPropagation();
        if (!cart || product.inventory_count === 0 || product.can_purchase === false) return;

        // Default to first variant options
        const defaultVariants: Record<string, string> = {};
        product.variants?.forEach(v => {
            if (v.options?.length > 0) defaultVariants[v.name] = v.options[0];
        });

        // Default to each option group's default value, and apply its price modifier.
        const defaultOptions: Record<string, string> = {};
        let optionModifierCents = 0;
        (product.options ?? []).forEach(g => {
            const def = g.values[g.defaultIndex] || g.values[0];
            if (def) {
                defaultOptions[g.name] = def.label;
                optionModifierCents += def.priceModifierCents || 0;
            }
        });

        cart.addToCart({
            productId: product.id,
            name: product.name,
            price_cents: (product.effective_price_cents ?? product.price_cents) + optionModifierCents,
            currency: product.currency,
            qty: 1,
            image: product.images?.[0],
            variants: Object.keys(defaultVariants).length > 0 ? defaultVariants : undefined,
            options: Object.keys(defaultOptions).length > 0 ? defaultOptions : undefined,
        });
    };

    const isExternal = (p: Product) =>
        !!p.external_url && /^https?:\/\//i.test(p.external_url);

    const handleProductNav = (e: React.MouseEvent, product: Product) => {
        if (isEditor) {
            e.preventDefault();
            const url = new URL(window.location.href);
            url.searchParams.set('productId', product.id);
            router.push(url.pathname + url.search, { scroll: true });
        }
    };

    const productHref = (product: Product) => {
        if (isEditor) return '#';
        if (isExternal(product)) return product.external_url as string;
        return `/product/${product.id}`;
    };

    const nbc = blockCategory.toLowerCase();
    const nbs = blockSubcategory.toLowerCase();
    const nac = activeCategory.toLowerCase();
    const nas = activeSubcategory.toLowerCase();

    const filteredProducts = products.filter(p => {
        if (featuredOnly && !p.is_featured) return false;
        const cat = (p.category || '').toLowerCase();
        const sub = (p.subcategory || '').toLowerCase();
        if (lockedToCategory) {
            if (cat !== nbc) return false;
            if (nbs && sub !== nbs) return false;
            return true;
        }
        if (nac && cat !== nac) return false;
        if (nas && sub !== nas) return false;
        return true;
    });

    // When the block is scoped to featured/category and there's nothing to
    // show, hide the section entirely instead of rendering an empty grid —
    // home pages often stack several scoped Products blocks and a missing
    // collection should disappear cleanly rather than leave a hole.
    // In edit mode, keep the block visible so the editor can still tweak settings.
    if (filteredProducts.length === 0 && (featuredOnly || lockedToCategory) && !isEditMode) {
        return null;
    }
    if (filteredProducts.length === 0 && isEditMode) {
        return (
            <section className="py-16 text-center text-slate-400" style={{ backgroundColor: sectionBg }} id="products">
                <Package className="w-10 h-10 mx-auto mb-3" />
                <p className="font-medium">No products match the current filters</p>
                <p className="mt-1 text-xs text-slate-400">
                    {featuredOnly && 'Featured-only is on. '}
                    {lockedToCategory && `Scoped to "${blockCategory}${blockSubcategory ? ' › ' + blockSubcategory : ''}". `}
                    Adjust filters in the Settings panel.
                </p>
            </section>
        );
    }

    const visibleProducts = [...filteredProducts].sort((a, b) => {
        switch (sortBy) {
            case 'az': return a.name.localeCompare(b.name);
            case 'za': return b.name.localeCompare(a.name);
            case 'popular': return (popularity[b.id] || 0) - (popularity[a.id] || 0);
            case 'featured':
            default: return (a.sort_order || 0) - (b.sort_order || 0);
        }
    });

    const Toolbar = () => (
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <p className="text-sm text-slate-500">
                {visibleProducts.length} {visibleProducts.length === 1 ? 'product' : 'products'}
            </p>
            <label className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Sort by</span>
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortKey)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                    <option value="featured">Featured</option>
                    <option value="popular">Popular</option>
                    <option value="az">Alphabetical: A–Z</option>
                    <option value="za">Alphabetical: Z–A</option>
                </select>
            </label>
        </div>
    );

    const renderCard = (product: Product, index: number = 0) => {
        const effectivePriceCents = product.effective_price_cents ?? product.price_cents;
        const hasDiscount = !!product.compare_at_cents && product.compare_at_cents > effectivePriceCents;
        const outOfStock = product.inventory_count === 0;
        const isGated = product.can_purchase === false;
        const external = isExternal(product);
        const isMemberPrice = !!product.matched_package_id
            && typeof product.public_price_cents === 'number'
            && product.public_price_cents > effectivePriceCents;

        return (
            <Reveal key={product.id} delay={index * staggerSec}>
            <a
                href={productHref(product)}
                onClick={(e) => handleProductNav(e, product)}
                target={external && !isEditor ? '_blank' : undefined}
                rel={external && !isEditor ? 'noopener' : undefined}
                className="group block rounded-xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all hover:border-slate-300 bg-white"
            >
                <div className="aspect-square bg-slate-50 relative overflow-hidden">
                    {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-12 h-12 text-slate-200" />
                        </div>
                    )}
                    {isMemberPrice && (
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-1 text-xs font-bold text-white rounded-lg shadow-md bg-emerald-600 inline-flex items-center gap-1">
                            <Crown className="w-3 h-3" /> MEMBER
                        </span>
                    )}
                    {!isMemberPrice && hasDiscount && (
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-1 text-xs font-bold text-white rounded-lg shadow-md" style={{ backgroundColor: pSecondary }}>
                            SALE
                        </span>
                    )}
                    {outOfStock && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white font-bold text-sm tracking-wide">SOLD OUT</span>
                        </div>
                    )}
                    {isGated && !outOfStock && (
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1.5">
                            <Lock className="w-6 h-6 text-white" />
                            <span className="text-white font-bold text-xs tracking-wide px-2 text-center">
                                {product.gate_reason === 'guest' ? 'SIGN IN TO PURCHASE' : 'MEMBERS ONLY'}
                            </span>
                        </div>
                    )}
                    {!outOfStock && !isGated && !external && (
                        <button
                            onClick={(e) => handleQuickAdd(e, product)}
                            className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                            style={{ color: pSecondary }}
                        >
                            <ShoppingCart className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className="p-3.5">
                    {product.brand && (
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">{product.brand}</p>
                    )}
                    <h3 className="font-semibold text-slate-900 text-sm truncate group-hover:text-blue-700 transition-colors">{product.name}</h3>
                    {product.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{stripHtml(product.description)}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                        <span className="font-bold text-base" style={{ color: pSecondary }}>${(effectivePriceCents / 100).toFixed(2)}</span>
                        {isMemberPrice && (
                            <span className="text-xs text-slate-400 line-through">${(product.public_price_cents! / 100).toFixed(2)}</span>
                        )}
                        {!isMemberPrice && hasDiscount && (
                            <span className="text-xs text-slate-400 line-through">${(product.compare_at_cents! / 100).toFixed(2)}</span>
                        )}
                    </div>
                </div>
            </a>
            </Reveal>
        );
    };

    const renderListRow = (product: Product, index: number = 0) => {
        const hasDiscount = !!product.compare_at_cents && product.compare_at_cents > product.price_cents;
        const outOfStock = product.inventory_count === 0;
        const external = isExternal(product);
        return (
            <Reveal key={product.id} delay={index * staggerSec}>
            <a
                href={productHref(product)}
                onClick={(e) => handleProductNav(e, product)}
                target={external && !isEditor ? '_blank' : undefined}
                rel={external && !isEditor ? 'noopener' : undefined}
                className="group flex items-center gap-4 sm:gap-6 p-4 rounded-xl border border-slate-200 hover:shadow-lg transition-all hover:border-slate-300 bg-white"
            >
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg bg-slate-50 relative overflow-hidden flex-shrink-0">
                    {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-slate-200" />
                        </div>
                    )}
                    {outOfStock && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white font-bold text-[10px] tracking-wide">SOLD OUT</span>
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    {product.brand && (
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{product.brand}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 text-base sm:text-lg group-hover:text-blue-700 transition-colors">{product.name}</h3>
                        {hasDiscount && (
                            <span className="px-2 py-0.5 text-[10px] font-bold text-white rounded" style={{ backgroundColor: pSecondary }}>SALE</span>
                        )}
                    </div>
                    {product.description && (
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{stripHtml(product.description)}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                        <span className="font-bold text-lg" style={{ color: pSecondary }}>${(product.price_cents / 100).toFixed(2)}</span>
                        {hasDiscount && (
                            <span className="text-sm text-slate-400 line-through">${(product.compare_at_cents! / 100).toFixed(2)}</span>
                        )}
                    </div>
                </div>
                {!outOfStock && !external && (
                    <button
                        onClick={(e) => handleQuickAdd(e, product)}
                        className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all flex-shrink-0"
                        style={{ backgroundColor: pSecondary }}
                    >
                        <ShoppingCart className="w-4 h-4" /> Add
                    </button>
                )}
            </a>
            </Reveal>
        );
    };

    // Show the see-more button whenever the toggle is on (edit mode shows it for editing
    // even before a target is configured). On the published site, hide if no target exists.
    const renderSeeMoreButton = (className: string, style?: React.CSSProperties) => {
        if (!showSeeMore) return null;
        if (!isEditMode && !hasSeeMoreTarget) return null;
        return (
            <EditableButton
                contentKey="seeMore"
                label={seeMoreLabel}
                linkData={seeMoreLink}
                iconData={seeMoreIcon}
                defaultLabel="View all"
                isEditMode={isEditMode}
                onSave={handleSeeMoreSave}
                className={className}
                style={style}
                defaultShape="rounded"
                defaultFill="filled"
                palette={palette}
            />
        );
    };

    const seeMoreButton = renderSeeMoreButton(
        'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all',
        { backgroundColor: pSecondary, color: '#ffffff' },
    );

    const inlineSeeMore = renderSeeMoreButton(
        'inline-flex items-center gap-1 text-sm font-semibold hover:underline',
        { color: pSecondary },
    );

    const titleRow = showTitle ? (
        <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
                <EditableText
                    contentKey="featuredHeading"
                    content={featuredHeading}
                    defaultValue={defaultFeaturedHeading}
                    isEditMode={isEditMode}
                    onSave={handleSeeMoreSave}
                    as="span"
                    styleData={featuredHeadingStyles}
                />
            </h3>
            {inlineSeeMore}
        </div>
    ) : null;

    if (effectiveVariant === 'row') {
        return (
            <section className="py-12 px-4" id="products" style={{ backgroundColor: sectionBg }}>
                <div className="max-w-7xl mx-auto">
                    {titleRow}
                    <ProductCarouselRow
                        autoScroll={autoScroll && !isEditMode}
                        intervalSec={autoScrollIntervalSec}
                        pauseOnHover={autoScrollPauseOnHover}
                    >
                        {visibleProducts.map(p => (
                            <div key={p.id} data-product-card className="snap-start flex-shrink-0 w-56 sm:w-64 md:w-72">
                                {renderCard(p)}
                            </div>
                        ))}
                    </ProductCarouselRow>
                    {!showTitle && seeMoreButton && (
                        <div className="mt-6 flex justify-center">{seeMoreButton}</div>
                    )}
                </div>
            </section>
        );
    }

    if (effectiveVariant === 'list') {
        return (
            <section className="py-16 px-4" id="products" style={{ backgroundColor: sectionBg }}>
                <div className="max-w-5xl mx-auto">
                    {titleRow}
                    {!showTitle && <Toolbar />}
                    <div className="space-y-4">
                        {visibleProducts.map(renderListRow)}
                    </div>
                    {seeMoreButton && (
                        <div className="mt-8 flex justify-center">{seeMoreButton}</div>
                    )}
                </div>
            </section>
        );
    }

    if (effectiveVariant === 'gridWithSidebar') {
        const sidebarCategories = Object.keys(categoryTree).sort();
        return (
            <section className="py-16 px-4" id="products" style={{ backgroundColor: sectionBg }}>
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
                    <aside className="lg:sticky lg:top-24 lg:self-start">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Categories</h4>
                        <ul className="space-y-1">
                            <li>
                                <button
                                    onClick={() => { setActiveCategory(''); setActiveSubcategory(''); }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!activeCategory ? 'bg-slate-900 text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
                                >
                                    All Products
                                </button>
                            </li>
                            {sidebarCategories.map(cat => {
                                const subs = categoryTree[cat] || [];
                                const isActive = activeCategory === cat;
                                return (
                                    <li key={cat}>
                                        <button
                                            onClick={() => {
                                                if (activeCategory === cat) {
                                                    // Re-clicking the active category clears the subcategory filter
                                                    // (show everything in the category).
                                                    setActiveSubcategory('');
                                                } else {
                                                    setActiveCategory(cat);
                                                    setActiveSubcategory('');
                                                }
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${isActive && !activeSubcategory ? 'bg-slate-900 text-white font-semibold' : isActive ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
                                        >
                                            {cat}
                                        </button>
                                        {isActive && subs.length > 0 && (
                                            <ul className="mt-1 mb-1 ml-3 border-l border-slate-200 space-y-0.5">
                                                {subs.map(sub => (
                                                    <li key={sub}>
                                                        <button
                                                            onClick={() => setActiveSubcategory(activeSubcategory === sub ? '' : sub)}
                                                            className={`w-full text-left pl-3 pr-2 py-1.5 rounded-md text-xs transition-colors ${activeSubcategory === sub ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
                                                        >
                                                            {sub}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </aside>
                    <div>
                        {titleRow}
                        {!showTitle && <Toolbar />}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                            {visibleProducts.map(renderCard)}
                        </div>
                        {!showTitle && seeMoreButton && (
                            <div className="mt-8 flex justify-center">{seeMoreButton}</div>
                        )}
                    </div>
                </div>
            </section>
        );
    }

    // Default: grid
    return (
        <section className="py-16 px-4" id="products" style={{ backgroundColor: sectionBg }}>
            <div className="max-w-7xl mx-auto">
                {showTitle ? titleRow : !featuredOnly && <Toolbar />}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {visibleProducts.map(renderCard)}
                </div>
                {!showTitle && seeMoreButton && (
                    <div className="mt-8 flex justify-center">{seeMoreButton}</div>
                )}
            </div>
        </section>
    );
}

// ─── Carousel row ───────────────────────────────────────────────────────────────
// Smoothly auto-scrolls product-by-product. Pauses on hover/focus/touch by default,
// and respects prefers-reduced-motion.

function ProductCarouselRow({
    autoScroll,
    intervalSec,
    pauseOnHover,
    children,
}: {
    autoScroll: boolean;
    intervalSec: number;
    pauseOnHover: boolean;
    children: React.ReactNode;
}) {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [paused, setPaused] = useState(false);
    const [canScrollPrev, setCanScrollPrev] = useState(false);
    const [canScrollNext, setCanScrollNext] = useState(false);

    const measure = useCallback(() => {
        const el = scrollerRef.current;
        if (!el) return;
        const max = el.scrollWidth - el.clientWidth;
        setCanScrollPrev(el.scrollLeft > 4);
        setCanScrollNext(el.scrollLeft < max - 4);
    }, []);

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;
        measure();
        el.addEventListener('scroll', measure, { passive: true });
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => {
            el.removeEventListener('scroll', measure);
            ro.disconnect();
        };
    }, [measure, children]);

    const scrollByOne = useCallback((dir: 1 | -1) => {
        const el = scrollerRef.current;
        if (!el) return;
        const card = el.querySelector<HTMLElement>('[data-product-card]');
        const gap = 24; // matches gap-4 / md:gap-6
        const step = (card?.offsetWidth ?? 240) + gap;
        const max = el.scrollWidth - el.clientWidth;
        let next = el.scrollLeft + dir * step;
        if (dir === 1 && next >= max - 4) next = 0;
        else if (dir === -1 && next <= 4) next = max;
        el.scrollTo({ left: next, behavior: 'smooth' });
    }, []);

    useEffect(() => {
        if (!autoScroll || paused) return;
        if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const id = window.setInterval(() => scrollByOne(1), Math.max(2000, intervalSec * 1000));
        return () => window.clearInterval(id);
    }, [autoScroll, paused, intervalSec, scrollByOne]);

    const handleEnter = () => { if (pauseOnHover) setPaused(true); };
    const handleLeave = () => { if (pauseOnHover) setPaused(false); };

    return (
        <div
            className="relative"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
        >
            <div
                ref={scrollerRef}
                className="-mx-4 px-4 overflow-x-auto scroll-smooth no-scrollbar"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                <style>{`.no-scrollbar::-webkit-scrollbar{display:none;}`}</style>
                <div className="flex gap-4 md:gap-6 pb-2 snap-x snap-mandatory">
                    {children}
                </div>
            </div>
            {canScrollPrev && (
                <button
                    type="button"
                    onClick={() => scrollByOne(-1)}
                    aria-label="Previous"
                    className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/95 shadow-lg border border-slate-200 items-center justify-center text-slate-700 hover:bg-white transition"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
            )}
            {canScrollNext && (
                <button
                    type="button"
                    onClick={() => scrollByOne(1)}
                    aria-label="Next"
                    className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/95 shadow-lg border border-slate-200 items-center justify-center text-slate-700 hover:bg-white transition"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            )}
        </div>
    );
}
