'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, Minus, Plus, ChevronLeft, ChevronRight, Check, ArrowLeft, Package, Truck, Shield } from 'lucide-react';
import { useCart } from './CartProvider';

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
}

interface ProductPageProps {
    product: Product;
    siteId: string;
    palette: Record<string, string>;
    siteName?: string;
    allProducts?: Product[];
}

export default function ProductPage({ product, siteId, palette, siteName, allProducts }: ProductPageProps) {
    const cart = useCart();
    const [selectedImage, setSelectedImage] = useState(0);
    const [qty, setQty] = useState(1);
    const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
    const [added, setAdded] = useState(false);
    const [imageZoomed, setImageZoomed] = useState(false);

    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const hasDiscount = product.compare_at_cents && product.compare_at_cents > product.price_cents;
    const discountPct = hasDiscount ? Math.round((1 - product.price_cents / product.compare_at_cents!) * 100) : 0;
    const outOfStock = product.inventory_count === 0;
    const lowStock = product.inventory_count > 0 && product.inventory_count <= 5;
    const relatedProducts = (allProducts || []).filter(p => p.id !== product.id && p.is_active).slice(0, 4);

    // Default variant selections
    useEffect(() => {
        const defaults: Record<string, string> = {};
        product.variants?.forEach(v => {
            if (v.options?.length > 0) defaults[v.name] = v.options[0];
        });
        setSelectedVariants(defaults);
    }, [product]);

    const handleAddToCart = () => {
        if (!cart || outOfStock) return;
        cart.addToCart({
            productId: product.id,
            name: product.name,
            price_cents: product.price_cents,
            currency: product.currency,
            qty,
            image: product.images?.[0],
            variants: Object.keys(selectedVariants).length > 0 ? selectedVariants : undefined,
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
    };

    const prevImage = () => setSelectedImage((selectedImage - 1 + (product.images?.length || 1)) % (product.images?.length || 1));
    const nextImage = () => setSelectedImage((selectedImage + 1) % (product.images?.length || 1));

    return (
        <div className="min-h-screen bg-white">
            {/* Breadcrumbs */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <nav className="flex items-center gap-2 text-sm text-slate-500">
                    <a href="/" className="hover:text-slate-900 transition-colors">Home</a>
                    <span>/</span>
                    <a href="/#products" className="hover:text-slate-900 transition-colors">Products</a>
                    <span>/</span>
                    <span className="text-slate-900 font-medium truncate">{product.name}</span>
                </nav>
            </div>

            {/* Main Product Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">

                    {/* ── Left: Image Gallery ── */}
                    <div className="space-y-4">
                        {/* Main Image */}
                        <div
                            className="relative aspect-square bg-slate-50 rounded-2xl overflow-hidden group cursor-zoom-in"
                            onClick={() => setImageZoomed(!imageZoomed)}
                        >
                            {product.images?.[selectedImage] ? (
                                <img
                                    src={product.images[selectedImage]}
                                    alt={product.name}
                                    className={`w-full h-full object-cover transition-transform duration-500 ${imageZoomed ? 'scale-150' : 'group-hover:scale-105'}`}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-24 h-24 text-slate-200" />
                                </div>
                            )}

                            {/* Discount badge */}
                            {hasDiscount && (
                                <div className="absolute top-4 left-4 px-3 py-1.5 text-sm font-bold text-white rounded-lg shadow-lg" style={{ backgroundColor: pSecondary }}>
                                    {discountPct}% OFF
                                </div>
                            )}

                            {/* Out of stock overlay */}
                            {outOfStock && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <span className="text-white font-bold text-xl tracking-wide">SOLD OUT</span>
                                </div>
                            )}

                            {/* Nav arrows */}
                            {product.images && product.images.length > 1 && (
                                <>
                                    <button onClick={(e) => { e.stopPropagation(); prevImage(); }} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ChevronLeft className="w-5 h-5 text-slate-700" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); nextImage(); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ChevronRight className="w-5 h-5 text-slate-700" />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Thumbnail strip */}
                        {product.images && product.images.length > 1 && (
                            <div className="flex gap-3 overflow-x-auto pb-1">
                                {product.images.map((img, i) => (
                                    <button
                                        key={i}
                                        onClick={() => { setSelectedImage(i); setImageZoomed(false); }}
                                        className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${i === selectedImage ? 'border-slate-900 shadow-md' : 'border-slate-200 hover:border-slate-400'
                                            }`}
                                    >
                                        <img src={img} alt="" className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Right: Product Details ── */}
                    <div className="flex flex-col">
                        {/* Name */}
                        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">{product.name}</h1>

                        {/* Price */}
                        <div className="flex items-baseline gap-3 mt-4">
                            <span className="text-3xl font-bold" style={{ color: pSecondary }}>
                                ${(product.price_cents / 100).toFixed(2)}
                            </span>
                            {hasDiscount && (
                                <span className="text-xl text-slate-400 line-through">
                                    ${(product.compare_at_cents! / 100).toFixed(2)}
                                </span>
                            )}
                            <span className="text-sm text-slate-400 uppercase">{product.currency}</span>
                            {hasDiscount && (
                                <span className="text-xs font-bold px-2 py-1 rounded-full text-white" style={{ backgroundColor: pSecondary }}>
                                    Save ${((product.compare_at_cents! - product.price_cents) / 100).toFixed(2)}
                                </span>
                            )}
                        </div>

                        {/* Stock status */}
                        {lowStock && (
                            <p className="mt-2 text-sm font-semibold text-amber-600 flex items-center gap-1">
                                ⚡ Only {product.inventory_count} left in stock — order soon
                            </p>
                        )}

                        {/* Divider */}
                        <div className="border-t border-slate-100 my-6" />

                        {/* Description */}
                        {product.description && (
                            <div className="prose prose-slate prose-sm max-w-none mb-6">
                                <p className="text-slate-600 leading-relaxed whitespace-pre-line">{product.description}</p>
                            </div>
                        )}

                        {/* Variants */}
                        {product.variants && product.variants.length > 0 && (
                            <div className="space-y-5 mb-6">
                                {product.variants.map(variant => (
                                    <div key={variant.name}>
                                        <label className="text-sm font-semibold text-slate-900 block mb-2.5">
                                            {variant.name}: <span className="font-normal text-slate-500">{selectedVariants[variant.name]}</span>
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {variant.options.map(option => {
                                                const isSelected = selectedVariants[variant.name] === option;
                                                return (
                                                    <button
                                                        key={option}
                                                        onClick={() => setSelectedVariants({ ...selectedVariants, [variant.name]: option })}
                                                        className={`min-w-[3rem] px-4 py-2.5 text-sm font-medium rounded-xl border-2 transition-all ${isSelected
                                                                ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                                                                : 'border-slate-200 text-slate-700 hover:border-slate-400 hover:shadow-sm'
                                                            }`}
                                                    >
                                                        {option}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Quantity + Add to Cart */}
                        <div className="flex items-center gap-4 mb-6">
                            <div className="flex items-center border-2 border-slate-200 rounded-xl overflow-hidden">
                                <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-3 hover:bg-slate-50 transition-colors">
                                    <Minus className="w-4 h-4 text-slate-600" />
                                </button>
                                <span className="w-12 text-center font-bold text-slate-900">{qty}</span>
                                <button onClick={() => setQty(qty + 1)} className="px-3 py-3 hover:bg-slate-50 transition-colors">
                                    <Plus className="w-4 h-4 text-slate-600" />
                                </button>
                            </div>

                            <button
                                onClick={handleAddToCart}
                                disabled={outOfStock || added}
                                className={`flex-1 py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-lg hover:shadow-xl disabled:shadow-none ${added ? 'bg-green-600 text-white' : outOfStock ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'text-white hover:-translate-y-0.5'
                                    }`}
                                style={!added && !outOfStock ? { backgroundColor: pSecondary } : {}}
                            >
                                {added ? (
                                    <><Check className="w-5 h-5" /> Added to Cart!</>
                                ) : outOfStock ? (
                                    'Sold Out'
                                ) : (
                                    <><ShoppingCart className="w-5 h-5" /> Add to Cart — ${(product.price_cents * qty / 100).toFixed(2)}</>
                                )}
                            </button>
                        </div>

                        {/* Trust badges */}
                        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                            <div className="flex flex-col items-center text-center gap-1.5 py-3">
                                <Truck className="w-5 h-5 text-slate-400" />
                                <span className="text-xs text-slate-500 font-medium">Fast Shipping</span>
                            </div>
                            <div className="flex flex-col items-center text-center gap-1.5 py-3">
                                <Shield className="w-5 h-5 text-slate-400" />
                                <span className="text-xs text-slate-500 font-medium">Secure Checkout</span>
                            </div>
                            <div className="flex flex-col items-center text-center gap-1.5 py-3">
                                <ArrowLeft className="w-5 h-5 text-slate-400" />
                                <span className="text-xs text-slate-500 font-medium">Easy Returns</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Related Products ── */}
                {relatedProducts.length > 0 && (
                    <div className="mt-20 pt-12 border-t border-slate-100">
                        <h2 className="text-2xl font-bold text-slate-900 mb-8">You may also like</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                            {relatedProducts.map(rp => (
                                <a
                                    key={rp.id}
                                    href={`/product/${rp.id}`}
                                    className="group rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all hover:border-slate-300"
                                >
                                    <div className="aspect-square bg-slate-50 overflow-hidden">
                                        {rp.images?.[0] ? (
                                            <img src={rp.images[0]} alt={rp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package className="w-10 h-10 text-slate-200" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <h3 className="font-semibold text-sm text-slate-900 truncate">{rp.name}</h3>
                                        <span className="text-sm font-bold" style={{ color: pSecondary }}>${(rp.price_cents / 100).toFixed(2)}</span>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
