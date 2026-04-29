'use client';

import { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Minus, Plus, ChevronLeft, ChevronRight, Check, ArrowLeft, Package, Truck, Shield, Lock, X, ZoomIn } from 'lucide-react';
import { useCart } from './CartProvider';
import { isHtmlDescription } from '@/lib/ecommerce/description';

interface Product {
    id: string;
    name: string;
    brand?: string | null;
    description: string | null;
    price_cents: number;
    compare_at_cents: number | null;
    currency: string;
    images: string[];
    variants: Array<{ name: string; options: string[] }>;
    inventory_count: number;
    is_active: boolean;
    category?: string | null;
    tags?: string[];
    effective_price_cents?: number;
    public_price_cents?: number;
    matched_package_id?: string | null;
    can_purchase?: boolean;
    gate_reason?: 'guest' | 'wrong-tier' | null;
}

interface ProductPageProps {
    product: Product;
    siteId: string;
    palette: Record<string, string>;
    siteName?: string;
    allProducts?: Product[];
    productsPagePath?: string;
}

/** Score candidates by shared tags + same category, return top N. */
function getRelatedProducts(current: Product, all: Product[], limit = 4): Product[] {
    const candidates = all.filter(p => p.id !== current.id && p.is_active);
    if (candidates.length === 0) return [];

    const currentTags = new Set((current.tags || []).map(t => t.toLowerCase()));
    const currentCategory = current.category?.toLowerCase() || '';

    const scored = candidates.map(p => {
        let score = 0;
        // +2 per shared tag
        for (const tag of (p.tags || [])) {
            if (currentTags.has(tag.toLowerCase())) score += 2;
        }
        // +3 for same category
        if (currentCategory && p.category?.toLowerCase() === currentCategory) score += 3;
        return { product: p, score };
    });

    // Sort by score desc, then by sort_order for ties
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(s => s.product);
}

export default function ProductPage({ product, siteId, palette, siteName, allProducts, productsPagePath }: ProductPageProps) {
    const cart = useCart();
    const [selectedImage, setSelectedImage] = useState(0);
    const [qty, setQty] = useState(1);
    const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
    const [added, setAdded] = useState(false);
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxZoomed, setLightboxZoomed] = useState(false);
    const [lightboxOrigin, setLightboxOrigin] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
    const mainImageRef = useRef<HTMLDivElement | null>(null);

    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const effectivePriceCents = product.effective_price_cents ?? product.price_cents;
    const hasDiscount = product.compare_at_cents && product.compare_at_cents > effectivePriceCents;
    const discountPct = hasDiscount ? Math.round((1 - effectivePriceCents / product.compare_at_cents!) * 100) : 0;
    const outOfStock = product.inventory_count === 0;
    const lowStock = product.inventory_count > 0 && product.inventory_count <= 5;
    const relatedProducts = getRelatedProducts(product, allProducts || []);
    const productsHref = productsPagePath || '/#products';
    const canPurchase = product.can_purchase !== false;
    const gateReason = product.gate_reason || null;
    const isMemberPrice = !!product.matched_package_id
        && typeof product.public_price_cents === 'number'
        && product.public_price_cents > effectivePriceCents;

    // Default variant selections
    useEffect(() => {
        const defaults: Record<string, string> = {};
        product.variants?.forEach(v => {
            if (v.options?.length > 0) defaults[v.name] = v.options[0];
        });
        setSelectedVariants(defaults);
    }, [product]);

    const handleAddToCart = () => {
        if (!cart || outOfStock || !canPurchase) return;
        cart.addToCart({
            productId: product.id,
            name: product.name,
            price_cents: effectivePriceCents,
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

    const handleMainImageHover = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setHoverPos({ x, y });
    };

    const openLightbox = () => {
        setLightboxOpen(true);
        setLightboxZoomed(false);
        setLightboxOrigin({ x: 50, y: 50 });
    };

    // Lightbox keyboard nav + body scroll lock
    useEffect(() => {
        if (!lightboxOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setLightboxOpen(false);
            else if (e.key === 'ArrowLeft') prevImage();
            else if (e.key === 'ArrowRight') nextImage();
        };
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lightboxOpen, selectedImage, product.images?.length]);

    const handleLightboxImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setLightboxOrigin({ x, y });
        setLightboxZoomed(z => !z);
    };

    const handleLightboxImageMove = (e: React.MouseEvent<HTMLImageElement>) => {
        if (!lightboxZoomed) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setLightboxOrigin({ x, y });
    };

    const descriptionIsHtml = isHtmlDescription(product.description);

    return (
        <div className="min-h-screen bg-white">
            {/* Breadcrumbs */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <nav className="flex items-center gap-2 text-sm text-slate-500">
                    <a href="/" className="hover:text-slate-900 transition-colors">Home</a>
                    <span>/</span>
                    <a href={productsHref} className="hover:text-slate-900 transition-colors">Products</a>
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
                            ref={mainImageRef}
                            className="relative aspect-square bg-slate-50 rounded-2xl overflow-hidden group cursor-zoom-in"
                            onClick={openLightbox}
                            onMouseMove={handleMainImageHover}
                            onMouseLeave={() => setHoverPos(null)}
                        >
                            {product.images?.[selectedImage] ? (
                                <img
                                    src={product.images[selectedImage]}
                                    alt={product.name}
                                    draggable={false}
                                    className="w-full h-full object-cover transition-transform duration-300 ease-out will-change-transform"
                                    style={hoverPos ? {
                                        transform: 'scale(1.6)',
                                        transformOrigin: `${hoverPos.x}% ${hoverPos.y}%`,
                                    } : undefined}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-24 h-24 text-slate-200" />
                                </div>
                            )}

                            {/* Zoom hint */}
                            {product.images?.[selectedImage] && (
                                <div className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <ZoomIn className="w-4 h-4 text-slate-700" />
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
                                        onClick={() => { setSelectedImage(i); setHoverPos(null); }}
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
                        {/* Brand */}
                        {product.brand && (
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2">{product.brand}</p>
                        )}
                        {/* Name */}
                        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">{product.name}</h1>

                        {/* Price */}
                        <div className="flex items-baseline gap-3 mt-4 flex-wrap">
                            <span className="text-3xl font-bold" style={{ color: pSecondary }}>
                                ${(effectivePriceCents / 100).toFixed(2)}
                            </span>
                            {isMemberPrice && (
                                <span className="text-xl text-slate-400 line-through">
                                    ${(product.public_price_cents! / 100).toFixed(2)}
                                </span>
                            )}
                            {!isMemberPrice && hasDiscount && (
                                <span className="text-xl text-slate-400 line-through">
                                    ${(product.compare_at_cents! / 100).toFixed(2)}
                                </span>
                            )}
                            <span className="text-sm text-slate-400 uppercase">{product.currency}</span>
                            {isMemberPrice && (
                                <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-600 text-white inline-flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Member price
                                </span>
                            )}
                            {!isMemberPrice && hasDiscount && (
                                <span className="text-xs font-bold px-2 py-1 rounded-full text-white" style={{ backgroundColor: pSecondary }}>
                                    Save ${((product.compare_at_cents! - effectivePriceCents) / 100).toFixed(2)}
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
                            descriptionIsHtml ? (
                                <div
                                    className="prose prose-slate prose-sm max-w-none mb-6 text-slate-600 leading-relaxed prose-headings:text-slate-900 prose-a:text-blue-600 prose-strong:text-slate-900"
                                    dangerouslySetInnerHTML={{ __html: product.description }}
                                />
                            ) : (
                                <div className="prose prose-slate prose-sm max-w-none mb-6">
                                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">{product.description}</p>
                                </div>
                            )
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

                        {/* Quantity + Add to Cart / Gated CTA */}
                        {canPurchase ? (
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
                                        <><ShoppingCart className="w-5 h-5" /> Add to Cart — ${(effectivePriceCents * qty / 100).toFixed(2)}</>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="mb-6 p-5 rounded-xl border-2 border-slate-200 bg-slate-50 text-center space-y-3">
                                <Lock className="w-8 h-8 mx-auto text-slate-400" />
                                <div>
                                    <p className="text-base font-bold text-slate-900">
                                        {gateReason === 'guest' ? 'Members only' : 'Membership required'}
                                    </p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {gateReason === 'guest'
                                            ? 'Sign in with an eligible membership to purchase this product.'
                                            : 'Your current membership plan does not include access to this product.'}
                                    </p>
                                </div>
                                <a
                                    href={gateReason === 'guest' ? '/signin' : '/member'}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-bold text-sm hover:opacity-90 transition-opacity"
                                    style={{ backgroundColor: pPrimary }}
                                >
                                    {gateReason === 'guest' ? 'Sign in' : 'View Membership Plans'}
                                </a>
                            </div>
                        )}

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

            {/* ── Lightbox / Zoom Modal ── */}
            {lightboxOpen && product.images?.[selectedImage] && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${product.name} image viewer`}
                    onClick={() => setLightboxOpen(false)}
                >
                    {/* Close */}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
                        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Counter */}
                    {product.images.length > 1 && (
                        <div className="absolute top-5 left-5 text-white/80 text-sm font-medium tabular-nums">
                            {selectedImage + 1} / {product.images.length}
                        </div>
                    )}

                    {/* Prev/Next */}
                    {product.images.length > 1 && (
                        <>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); prevImage(); setLightboxZoomed(false); }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                                aria-label="Previous image"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); nextImage(); setLightboxZoomed(false); }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                                aria-label="Next image"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </>
                    )}

                    {/* Image */}
                    <div
                        className="relative max-w-[95vw] max-h-[90vh] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={product.images[selectedImage]}
                            alt={product.name}
                            draggable={false}
                            onClick={handleLightboxImageClick}
                            onMouseMove={handleLightboxImageMove}
                            onMouseLeave={() => { if (lightboxZoomed) setLightboxOrigin({ x: 50, y: 50 }); }}
                            className={`max-w-[95vw] max-h-[90vh] object-contain select-none transition-transform duration-200 ease-out ${lightboxZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                            style={{
                                transform: lightboxZoomed ? 'scale(2.2)' : 'scale(1)',
                                transformOrigin: `${lightboxOrigin.x}% ${lightboxOrigin.y}%`,
                            }}
                        />
                    </div>

                    {/* Thumbnail strip */}
                    {product.images.length > 1 && (
                        <div
                            className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto px-2"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {product.images.map((img, i) => (
                                <button
                                    key={i}
                                    onClick={() => { setSelectedImage(i); setLightboxZoomed(false); setLightboxOrigin({ x: 50, y: 50 }); }}
                                    className={`flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-all ${i === selectedImage ? 'border-white' : 'border-white/30 hover:border-white/70'}`}
                                    aria-label={`View image ${i + 1}`}
                                >
                                    <img src={img} alt="" className="w-full h-full object-cover" draggable={false} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
