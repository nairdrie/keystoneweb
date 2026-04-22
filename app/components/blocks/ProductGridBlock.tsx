'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorContext } from '@/lib/editor-context';
import { useCart } from '../ecommerce/CartProvider';
import {
    Package, Plus, Trash2, Loader2, ShoppingCart, X,
    ImageIcon, Upload, Download, Send, Search,
    ChevronLeft, ChevronRight, Tag, Pencil,
} from 'lucide-react';
import CsvImportModal from '@/app/components/csv-import/CsvImportModal';
import { useRouter, usePathname } from 'next/navigation';

// ─── Types ──────────────────────────────────────────────────────────────────────

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
    sort_order: number;
    status: string;
    category: string | null;
    subcategory: string | null;
    tags: string[];
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

    if (isEditMode) {
        return <ProductGridBlockEditMode siteId={siteId} data={data} updateContent={updateContent} />;
    }

    return <ProductGrid siteId={siteId} palette={palette} data={data} />;
}

function ProductGridBlockEditMode({ siteId, data, updateContent }: { siteId: string; data: any; updateContent: (key: string, value: any) => void }) {
    const [categoryTree, setCategoryTree] = useState<Record<string, string[]>>({});
    const categoryFilter: string = data?.categoryFilter || '';
    const subcategoryFilter: string = data?.subcategoryFilter || '';

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

    const categories = Object.keys(categoryTree).sort();
    const subcategories = categoryFilter ? (categoryTree[categoryFilter] || []) : [];

    return (
        <div className="py-12 px-6 flex flex-col items-center justify-center text-center gap-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-slate-400" />
            </div>
            <div className="w-full max-w-sm">
                <div className="font-bold text-slate-800 mb-1">Manage Products in Admin</div>
                <div className="text-sm text-slate-500 mb-4">Add, edit, and manage your products and store settings from your Admin Dashboard.</div>

                <div className="text-left mb-4 space-y-2">
                    <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Show category</label>
                        <select
                            value={categoryFilter}
                            onChange={e => {
                                const next = e.target.value;
                                updateContent('categoryFilter', next);
                                // Clear subcategory when category changes, since it's scoped to the parent.
                                if (subcategoryFilter) updateContent('subcategoryFilter', '');
                            }}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All categories</option>
                            {categories.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    {categoryFilter && subcategories.length > 0 && (
                        <div>
                            <label className="text-xs font-semibold text-slate-600 mb-1 block">Show subcategory</label>
                            <select
                                value={subcategoryFilter}
                                onChange={e => updateContent('subcategoryFilter', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">All {categoryFilter}</option>
                                {subcategories.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <p className="text-[11px] text-slate-400">
                        When scoped to a specific category or subcategory, the sidebar is hidden on the live site.
                    </p>
                </div>

                <button
                    onClick={() => window.open(`/admin/ecommerce?siteId=${siteId}`, '_blank')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                    <Package className="w-4 h-4" />
                    Manage Products
                </button>
            </div>
        </div>
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
    const modalBackdropDown = useRef(false);

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
        setSearchQuery(value);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            setCurrentPage(1);
            fetchProducts(1, value, filterCategory, filterStatus);
        }, 300);
    };

    const handleFilterCategory = (cat: string) => {
        setFilterCategory(cat);
        setCurrentPage(1);
        fetchProducts(1, searchQuery, cat, filterStatus);
    };

    const handleFilterStatus = (s: string) => {
        setFilterStatus(s);
        setCurrentPage(1);
        fetchProducts(1, searchQuery, filterCategory, s);
    };

    const handlePageChange = (page: number) => {
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
                            <div key={product.id} className={`flex items-center gap-3 p-3 rounded-lg border ${product.status === 'draft' ? 'border-amber-200 bg-amber-50/40' : product.is_active ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
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
            </div>
        </section>
    );
}

// ─── Product Form (add + edit, with image upload + variants) ───────────────────

function ProductForm({ siteId, product, onSaved, onCancel }: {
    siteId: string;
    product?: Product;
    onSaved: (p: Product) => void;
    onCancel: () => void;
}) {
    const isEdit = !!product;
    const [name, setName] = useState(product?.name ?? '');
    const [description, setDescription] = useState(product?.description ?? '');
    const [price, setPrice] = useState(product ? (product.price_cents / 100).toFixed(2) : '');
    const [compareAt, setCompareAt] = useState(product?.compare_at_cents ? (product.compare_at_cents / 100).toFixed(2) : '');
    const [images, setImages] = useState<string[]>(product?.images ?? []);
    const [inventory, setInventory] = useState(product ? String(product.inventory_count) : '-1');
    const [category, setCategory] = useState(product?.category ?? '');
    const [subcategory, setSubcategory] = useState(product?.subcategory ?? '');
    const [tags, setTags] = useState((product?.tags ?? []).join(', '));
    const [categoryTree, setCategoryTree] = useState<Record<string, string[]>>({});
    const [variants, setVariants] = useState<Array<{ name: string; options: string }>>(
        product?.variants?.map(v => ({ name: v.name, options: (v.options ?? []).join(', ') })) ?? []
    );
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const [vendorId, setVendorId] = useState<string>('');
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

    const handleSave = async () => {
        if (!name.trim() || !price) return;
        setSaving(true);

        // Convert variant strings to structured format
        const structuredVariants = variants
            .filter(v => v.name.trim() && v.options.trim())
            .map(v => ({
                name: v.name.trim(),
                options: v.options.split(',').map(o => o.trim()).filter(Boolean),
            }));

        const parsedTags = tags
            .split(',')
            .map(t => t.trim())
            .filter(Boolean);

        const payload = {
            name,
            description: description || null,
            price_cents: Math.round(parseFloat(price) * 100),
            compare_at_cents: compareAt ? Math.round(parseFloat(compareAt) * 100) : null,
            images,
            variants: structuredVariants,
            inventory_count: parseInt(inventory),
            category: category.trim() || null,
            subcategory: category.trim() && subcategory.trim() ? subcategory.trim() : null,
            tags: parsedTags,
            vendor_id: vendorId || null,
        };

        const res = await fetch('/api/products', {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(isEdit ? { id: product!.id, ...payload } : { siteId, ...payload }),
        });

        const data = await res.json();
        if (data.product) onSaved(data.product);
        setSaving(false);
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">{isEdit ? 'Edit Product' : 'Add Product'}</h4>
                <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
            </div>

            {/* Name */}
            <input
                type="text" placeholder="Product name" value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />

            {/* Description */}
            <textarea
                placeholder="Product description" value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                rows={3}
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
            </div>

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

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER: Product Grid (links to product pages)
// ═══════════════════════════════════════════════════════════════════════════════

type SortKey = 'featured' | 'popular' | 'az' | 'za';

function ProductGrid({ siteId, palette, data }: { siteId: string; palette: Record<string, string>; data?: any }) {
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
    const isEditor = pathname?.startsWith('/editor') || pathname?.startsWith('/design');

    const blockCategory: string = data?.categoryFilter || '';
    const blockSubcategory: string = data?.subcategoryFilter || '';
    const lockedToCategory = !!blockCategory;
    const variant: 'grid' | 'gridWithSidebar' | 'list' = data?.variant || 'grid';
    const effectiveVariant = lockedToCategory && variant === 'gridWithSidebar' ? 'grid' : variant;
    const pSecondary = palette.secondary || '#dc2626';

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
        return <section className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></section>;
    }

    if (products.length === 0) {
        return (
            <section className="py-16 text-center text-slate-400">
                <Package className="w-10 h-10 mx-auto mb-3" />
                <p className="font-medium">Products coming soon</p>
            </section>
        );
    }

    const handleQuickAdd = (e: React.MouseEvent, product: Product) => {
        e.preventDefault();
        e.stopPropagation();
        if (!cart || product.inventory_count === 0) return;

        // Default to first variant options
        const defaultVariants: Record<string, string> = {};
        product.variants?.forEach(v => {
            if (v.options?.length > 0) defaultVariants[v.name] = v.options[0];
        });

        cart.addToCart({
            productId: product.id,
            name: product.name,
            price_cents: product.price_cents,
            currency: product.currency,
            qty: 1,
            image: product.images?.[0],
            variants: Object.keys(defaultVariants).length > 0 ? defaultVariants : undefined,
        });
    };

    const handleProductNav = (e: React.MouseEvent, product: Product) => {
        if (isEditor) {
            e.preventDefault();
            const url = new URL(window.location.href);
            url.searchParams.set('productId', product.id);
            router.push(url.pathname + url.search, { scroll: true });
        }
    };

    const productHref = (product: Product) => isEditor ? '#' : `/product/${product.id}`;

    const nbc = blockCategory.toLowerCase();
    const nbs = blockSubcategory.toLowerCase();
    const nac = activeCategory.toLowerCase();
    const nas = activeSubcategory.toLowerCase();

    const filteredProducts = products.filter(p => {
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

    const renderCard = (product: Product) => {
        const hasDiscount = !!product.compare_at_cents && product.compare_at_cents > product.price_cents;
        const outOfStock = product.inventory_count === 0;
        return (
            <a
                key={product.id}
                href={productHref(product)}
                onClick={(e) => handleProductNav(e, product)}
                className="group rounded-xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all hover:border-slate-300 bg-white"
            >
                <div className="aspect-square bg-slate-50 relative overflow-hidden">
                    {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-12 h-12 text-slate-200" />
                        </div>
                    )}
                    {hasDiscount && (
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-1 text-xs font-bold text-white rounded-lg shadow-md" style={{ backgroundColor: pSecondary }}>
                            SALE
                        </span>
                    )}
                    {outOfStock && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white font-bold text-sm tracking-wide">SOLD OUT</span>
                        </div>
                    )}
                    {!outOfStock && (
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
                    <h3 className="font-semibold text-slate-900 text-sm truncate group-hover:text-blue-700 transition-colors">{product.name}</h3>
                    {product.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{product.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                        <span className="font-bold text-base" style={{ color: pSecondary }}>${(product.price_cents / 100).toFixed(2)}</span>
                        {hasDiscount && (
                            <span className="text-xs text-slate-400 line-through">${(product.compare_at_cents! / 100).toFixed(2)}</span>
                        )}
                    </div>
                </div>
            </a>
        );
    };

    const renderListRow = (product: Product) => {
        const hasDiscount = !!product.compare_at_cents && product.compare_at_cents > product.price_cents;
        const outOfStock = product.inventory_count === 0;
        return (
            <a
                key={product.id}
                href={productHref(product)}
                onClick={(e) => handleProductNav(e, product)}
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
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 text-base sm:text-lg group-hover:text-blue-700 transition-colors">{product.name}</h3>
                        {hasDiscount && (
                            <span className="px-2 py-0.5 text-[10px] font-bold text-white rounded" style={{ backgroundColor: pSecondary }}>SALE</span>
                        )}
                    </div>
                    {product.description && (
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{product.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                        <span className="font-bold text-lg" style={{ color: pSecondary }}>${(product.price_cents / 100).toFixed(2)}</span>
                        {hasDiscount && (
                            <span className="text-sm text-slate-400 line-through">${(product.compare_at_cents! / 100).toFixed(2)}</span>
                        )}
                    </div>
                </div>
                {!outOfStock && (
                    <button
                        onClick={(e) => handleQuickAdd(e, product)}
                        className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all flex-shrink-0"
                        style={{ backgroundColor: pSecondary }}
                    >
                        <ShoppingCart className="w-4 h-4" /> Add
                    </button>
                )}
            </a>
        );
    };

    if (effectiveVariant === 'list') {
        return (
            <section className="py-16 px-4" id="products">
                <div className="max-w-5xl mx-auto">
                    <Toolbar />
                    <div className="space-y-4">
                        {visibleProducts.map(renderListRow)}
                    </div>
                </div>
            </section>
        );
    }

    if (effectiveVariant === 'gridWithSidebar') {
        const sidebarCategories = Object.keys(categoryTree).sort();
        return (
            <section className="py-16 px-4" id="products">
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
                        <Toolbar />
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                            {visibleProducts.map(renderCard)}
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    // Default: grid
    return (
        <section className="py-16 px-4" id="products">
            <div className="max-w-7xl mx-auto">
                <Toolbar />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {visibleProducts.map(renderCard)}
                </div>
            </div>
        </section>
    );
}
