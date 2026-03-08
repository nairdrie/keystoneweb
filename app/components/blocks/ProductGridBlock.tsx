'use client';

import { useState, useEffect, useRef } from 'react';
import { useEditorContext } from '@/lib/editor-context';
import { useCart } from '../ecommerce/CartProvider';
import {
    Package, Plus, Trash2, Loader2, ShoppingCart, X,
    ImageIcon, Upload, GripVertical
} from 'lucide-react';
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
        return <ProductManager siteId={siteId} palette={palette} />;
    }

    return <ProductGrid siteId={siteId} palette={palette} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDITOR: Product Manager
// ═══════════════════════════════════════════════════════════════════════════════

function ProductManager({ siteId, palette }: { siteId: string; palette: Record<string, string> }) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);

    useEffect(() => {
        (async () => {
            const res = await fetch(`/api/products?siteId=${siteId}`);
            const data = await res.json();
            setProducts(data.products || []);
            setLoading(false);
        })();
    }, [siteId]);

    const handleDelete = async (productId: string) => {
        await fetch(`/api/products?id=${productId}`, { method: 'DELETE' });
        setProducts(products.filter(p => p.id !== productId));
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

    return (
        <section className="py-12 px-4">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white border-2 border-blue-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-blue-50 px-6 py-4 border-b border-blue-200">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Package className="w-5 h-5 text-blue-600" />
                            Product Catalog
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">{products.length} product{products.length !== 1 ? 's' : ''}</p>
                    </div>

                    <div className="p-6 space-y-3">
                        {products.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-4">No products yet. Add your first product below.</p>
                        )}

                        {products.map(product => (
                            <div key={product.id} className={`flex items-center gap-3 p-3 rounded-lg border ${product.is_active ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                                {product.images?.[0] ? (
                                    <img src={product.images[0]} alt={product.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        <ImageIcon className="w-5 h-5 text-slate-400" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-slate-900 text-sm truncate">{product.name}</h4>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-sm font-bold text-green-700">${(product.price_cents / 100).toFixed(2)}</span>
                                        {product.compare_at_cents && (
                                            <span className="text-xs text-slate-400 line-through">${(product.compare_at_cents / 100).toFixed(2)}</span>
                                        )}
                                        {product.variants?.length > 0 && (
                                            <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{product.variants.map(v => v.name).join(', ')}</span>
                                        )}
                                        {product.inventory_count >= 0 && (
                                            <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{product.inventory_count} in stock</span>
                                        )}
                                    </div>
                                </div>
                                <button onClick={() => handleToggle(product)} className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600">
                                    {product.is_active ? 'Hide' : 'Show'}
                                </button>
                                <button onClick={() => handleDelete(product.id)} className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}

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
                                onAdded={product => { setProducts([...products, product]); setShowAdd(false); }}
                                onCancel={() => setShowAdd(false)}
                            />
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

// ─── Add Product Form (with image upload + variants) ────────────────────────────

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
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

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

        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                siteId,
                name,
                description: description || null,
                price_cents: Math.round(parseFloat(price) * 100),
                compare_at_cents: compareAt ? Math.round(parseFloat(compareAt) * 100) : null,
                images,
                variants: structuredVariants,
                inventory_count: parseInt(inventory),
            }),
        });

        const data = await res.json();
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
                                <img src={img} alt="" className="w-full h-full object-cover" />
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

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER: Product Grid (links to product pages)
// ═══════════════════════════════════════════════════════════════════════════════

function ProductGrid({ siteId, palette }: { siteId: string; palette: Record<string, string> }) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const cart = useCart();
    const router = useRouter();
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor');

    const pSecondary = palette.secondary || '#dc2626';

    useEffect(() => {
        (async () => {
            const res = await fetch(`/api/products?siteId=${siteId}`);
            const data = await res.json();
            setProducts((data.products || []).filter((p: Product) => p.is_active));
            setLoading(false);
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

    return (
        <section className="py-16 px-4" id="products">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {products.map(product => {
                        const hasDiscount = product.compare_at_cents && product.compare_at_cents > product.price_cents;
                        const outOfStock = product.inventory_count === 0;

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

                                    {/* Quick add button */}
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

                                {/* Info */}
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
                    })}
                </div>
            </div>
        </section>
    );
}
