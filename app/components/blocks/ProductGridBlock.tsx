'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorContext } from '@/lib/editor-context';
import { useCart } from '../ecommerce/CartProvider';
import {
    Package, Plus, Trash2, Loader2, ShoppingCart, X,
    ImageIcon, Upload, Send, Search,
    ChevronLeft, ChevronRight, Tag, Lock, Crown,
} from 'lucide-react';
import CsvImportModal from '@/app/components/csv-import/CsvImportModal';
import { useRouter, usePathname } from 'next/navigation';
import StoreSettingsPanel from '../ecommerce/StoreSettingsPanel';
import OrdersPanel from '../ecommerce/OrdersPanel';

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
    tags: string[];
    tier_prices?: Array<{ packageId: string; priceCents: number }>;
    allowed_package_ids?: string[];
    effective_price_cents?: number;
    public_price_cents?: number;
    matched_package_id?: string | null;
    can_purchase?: boolean;
    gate_reason?: 'guest' | 'wrong-tier' | null;
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
        return (
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center gap-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                    <div className="font-bold text-slate-800 mb-1">Manage Products in Admin</div>
                    <div className="text-sm text-slate-500 mb-4">Add, edit, and manage your products and store settings from your Admin Dashboard.</div>
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

    return <ProductGrid siteId={siteId} palette={palette} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDITOR: Product Manager
// ═══════════════════════════════════════════════════════════════════════════════

export function ProductManager({ siteId, palette }: { siteId: string; palette: Record<string, string> }) {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [showDraftModal, setShowDraftModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [membershipEditProduct, setMembershipEditProduct] = useState<Product | null>(null);

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
                        {products.length === 0 && !searchQuery && !filterCategory && !filterStatus && (
                            <p className="text-sm text-slate-400 text-center py-4">No products yet. Add your first product below.</p>
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
                                            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">{product.category}</span>
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
                                    onClick={() => setMembershipEditProduct(product)}
                                    title="Membership pricing & access"
                                    className="p-1.5 rounded border border-slate-200 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 shrink-0"
                                >
                                    <Crown className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleToggle(product)} className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 shrink-0">
                                    {product.is_active ? 'Hide' : 'Show'}
                                </button>
                                <button onClick={() => handleDelete(product.id)} className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 shrink-0">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
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
                        )}

                        {!showAdd ? (
                            <button
                                onClick={() => setShowAdd(true)}
                                className="w-full py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 font-bold text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Add Product
                            </button>
                        ) : (
                            <AddProductForm
                                siteId={siteId}
                                onAdded={product => { fetchProducts(currentPage, searchQuery, filterCategory, filterStatus); setShowAdd(false); }}
                                onCancel={() => setShowAdd(false)}
                            />
                        )}
                    </div>
                </div>

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

                {/* Store Settings */}
                <div className="mt-4">
                    <StoreSettingsPanel siteId={siteId} />
                </div>

                {/* Orders */}
                <div className="mt-4">
                    <OrdersPanel siteId={siteId} />
                </div>
            </div>
        </section>
    );
}

// ─── Add Product Form (with image upload + variants) ────────────────────────────

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

function AddProductForm({ siteId, onAdded, onCancel }: {
    siteId: string;
    onAdded: (p: Product) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [compareAt, setCompareAt] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [inventory, setInventory] = useState('-1');
    const [variants, setVariants] = useState<Array<{ name: string; options: string }>>([]);
    const [tierPrices, setTierPrices] = useState<Record<string, string>>({}); // packageId -> dollars
    const [allowedPackageIds, setAllowedPackageIds] = useState<string[]>([]);
    const [gateEnabled, setGateEnabled] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [tierError, setTierError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const packages = useMembershipPackages(siteId);
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
        setTierError(null);

        // Convert variant strings to structured format
        const structuredVariants = variants
            .filter(v => v.name.trim() && v.options.trim())
            .map(v => ({
                name: v.name.trim(),
                options: v.options.split(',').map(o => o.trim()).filter(Boolean),
            }));

        const publicPriceCents = Math.round(parseFloat(price) * 100);

        // Build tier_prices array from the enabled rows.
        const tier_prices: Array<{ packageId: string; priceCents: number }> = [];
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
            tier_prices.push({ packageId, priceCents: cents });
        }

        setSaving(true);
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                siteId,
                name,
                description: description || null,
                price_cents: publicPriceCents,
                compare_at_cents: compareAt ? Math.round(parseFloat(compareAt) * 100) : null,
                images,
                variants: structuredVariants,
                inventory_count: parseInt(inventory),
                vendor_id: vendorId || null,
                tier_prices,
                allowed_package_ids: gateEnabled ? allowedPackageIds : [],
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            setTierError(data.error || 'Failed to add product');
            setSaving(false);
            return;
        }
        if (data.product) onAdded(data.product);
        setSaving(false);
    };

    return (
        <div className="border-2 border-blue-200 bg-blue-50/30 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">Add Product</h4>
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

            {/* Save */}
            <button
                onClick={handleSave}
                disabled={saving || !name.trim() || !price}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Product
            </button>
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

function ProductGrid({ siteId, palette }: { siteId: string; palette: Record<string, string> }) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const cart = useCart();
    const router = useRouter();
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor') || pathname?.startsWith('/design');

    const pSecondary = palette.secondary || '#dc2626';

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/products?siteId=${siteId}`);
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();
                setProducts((data.products || []).filter((p: Product) => p.is_active));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        })();
    }, [siteId]);

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
        if (!cart || product.inventory_count === 0 || product.can_purchase === false) return;

        // Default to first variant options
        const defaultVariants: Record<string, string> = {};
        product.variants?.forEach(v => {
            if (v.options?.length > 0) defaultVariants[v.name] = v.options[0];
        });

        cart.addToCart({
            productId: product.id,
            name: product.name,
            price_cents: product.effective_price_cents ?? product.price_cents,
            currency: product.currency,
            qty: 1,
            image: product.images?.[0],
            variants: Object.keys(defaultVariants).length > 0 ? defaultVariants : undefined,
        });
    };

    return (
        <section className="py-16 px-4" id="products">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {products.map(product => {
                        const effectivePriceCents = product.effective_price_cents ?? product.price_cents;
                        const hasDiscount = product.compare_at_cents && product.compare_at_cents > effectivePriceCents;
                        const outOfStock = product.inventory_count === 0;
                        const isGated = product.can_purchase === false;
                        const isMemberPrice = !!product.matched_package_id
                            && typeof product.public_price_cents === 'number'
                            && product.public_price_cents > effectivePriceCents;

                        return (
                            <a
                                key={product.id}
                                href={isEditor ? `#` : `/product/${product.id}`}
                                onClick={(e) => {
                                    if (isEditor) {
                                        e.preventDefault();
                                        const url = new URL(window.location.href);
                                        url.searchParams.set('productId', product.id);
                                        router.push(url.pathname + url.search, { scroll: true });
                                    }
                                }}
                                className="group rounded-xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all hover:border-slate-300 bg-white"
                            >
                                {/* Image */}
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

                                    {/* Quick add button */}
                                    {!outOfStock && !isGated && (
                                        <button
                                            onClick={(e) => handleQuickAdd(e, product)}
                                            className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                                            style={{ color: pSecondary }}
                                        >
                                            <ShoppingCart className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="p-3.5">
                                    <h3 className="font-semibold text-slate-900 text-sm truncate group-hover:text-blue-700 transition-colors">{product.name}</h3>
                                    {product.description && (
                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{product.description}</p>
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
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
