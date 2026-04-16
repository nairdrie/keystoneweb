'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Minus, ShoppingBag, Trash2, Loader2, Check, ArrowRight, User, Mail, Phone, CreditCard, DollarSign, Truck, AlertCircle, Package } from 'lucide-react';
import { useCart } from './CartProvider';
import AddressAutocomplete from './AddressAutocomplete';
import { COUNTRIES, REGIONS, getCountryName } from '@/lib/shipping-data';

interface PaymentMethods {
    etransfer?: boolean;
    stripe?: boolean;
}

interface EcommerceSettings {
    payment_methods: PaymentMethods;
    etransfer_email: string | null;
    shipping_required?: boolean;
}

interface ShippingResult {
    zone: { id: string; name: string; is_local_pickup: boolean };
    shippingCents: number;
    shippingLabel: string;
    freeThresholdCents: number | null;
}

type Step = 'cart' | 'address' | 'payment' | 'confirmation';

interface CartDrawerProps {
    siteId: string;
    palette: Record<string, string>;
}

export default function CartDrawer({ siteId, palette }: CartDrawerProps) {
    const cart = useCart();
    const [step, setStep] = useState<Step>('cart');
    const [submitting, setSubmitting] = useState(false);
    const [confirmation, setConfirmation] = useState<any>(null);
    const [form, setForm] = useState({
        name: '', email: '', phone: '',
        line1: '', city: '', region: '', postal: '', country: 'CA',
    });
    const [selectedPayment, setSelectedPayment] = useState<'etransfer' | 'stripe'>('etransfer');
    const [ecomSettings, setEcomSettings] = useState<EcommerceSettings | null>(null);
    const [stripeConnected, setStripeConnected] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    // Shipping
    const [shippingResult, setShippingResult] = useState<ShippingResult | null>(null);
    const [shippingError, setShippingError] = useState<string | null>(null);
    const [shippingLoading, setShippingLoading] = useState(false);
    const [noZonesConfigured, setNoZonesConfigured] = useState(false);

    const shippingRequired = ecomSettings?.shipping_required !== false;

    // Fetch ecommerce settings when drawer opens
    useEffect(() => {
        if (!cart?.isCartOpen || settingsLoaded) return;
        (async () => {
            try {
                const res = await fetch(`/api/products/settings?siteId=${siteId}`);
                const data = await res.json();
                setEcomSettings(data.settings);
                setStripeConnected(data.stripeConnected || false);

                const pm = data.settings?.payment_methods || {};
                if (pm.stripe && data.stripeConnected) {
                    setSelectedPayment('stripe');
                } else {
                    setSelectedPayment('etransfer');
                }
            } catch (err) {
                console.error('Failed to load ecommerce settings:', err);
            } finally {
                setSettingsLoaded(true);
            }
        })();
    }, [cart?.isCartOpen, siteId, settingsLoaded]);

    // Calculate shipping when address is complete or when moving to payment step
    const calculateShipping = useCallback(async () => {
        if (!form.country || !shippingRequired) return;

        setShippingLoading(true);
        setShippingError(null);
        setNoZonesConfigured(false);

        try {
            const res = await fetch('/api/shipping-zones/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteId,
                    country: form.country,
                    region: form.region,
                    subtotalCents: cart?.subtotalCents || 0,
                }),
            });
            const data = await res.json();

            if (data.error === 'no_zones') {
                setNoZonesConfigured(true);
                setShippingResult(null);
            } else if (data.error === 'no_zone') {
                setShippingError(data.message || "We don't currently ship to this area.");
                setShippingResult(null);
            } else if (data.zone) {
                setShippingResult(data);
            }
        } catch {
            setShippingError('Failed to calculate shipping.');
        } finally {
            setShippingLoading(false);
        }
    }, [siteId, form.country, form.region, cart?.subtotalCents, shippingRequired]);

    if (!cart || !cart.isCartOpen) return null;

    const pSecondary = palette.secondary || '#dc2626';
    const currency = cart.items[0]?.currency || 'CAD';
    const subtotal = cart.subtotalCents;
    const shippingCents = shippingResult?.shippingCents ?? 0;
    const totalCents = subtotal + (shippingRequired ? shippingCents : 0);
    const subtotalStr = `$${(subtotal / 100).toFixed(2)}`;
    const totalStr = `$${(totalCents / 100).toFixed(2)}`;

    // Available payment methods
    const pm = ecomSettings?.payment_methods || {};
    const availableMethods: Array<{ key: 'etransfer' | 'stripe'; label: string; desc: string; icon: typeof CreditCard }> = [];
    if (pm.stripe && stripeConnected) {
        availableMethods.push({ key: 'stripe', label: 'Credit / Debit Card', desc: 'Pay securely with Stripe', icon: CreditCard });
    }
    if (pm.etransfer) {
        availableMethods.push({ key: 'etransfer', label: 'Interac e-Transfer', desc: 'Send payment via Interac', icon: DollarSign });
    }

    // Validation helpers
    const addressComplete = form.line1.trim() && form.city.trim() && form.region.trim() && form.postal.trim() && form.country;
    const contactComplete = form.name.trim() && form.email.trim();
    const canPlaceOrder = contactComplete && (!shippingRequired || (addressComplete && shippingResult && !shippingError));

    // Region options for selected country
    const regionOptions = REGIONS[form.country] || [];

    const handleAddressPlaceSelected = (fields: { line1: string; city: string; region: string; postal: string; country: string }) => {
        setForm(f => ({ ...f, ...fields }));
        // Reset shipping when address changes
        setShippingResult(null);
        setShippingError(null);
    };

    const handleProceedToPayment = async () => {
        if (shippingRequired) {
            await calculateShipping();
        }
        setStep('payment');
    };

    const handleCheckout = async () => {
        if (!canPlaceOrder) return;
        setSubmitting(true);

        try {
            const orderRes = await fetch('/api/products/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteId,
                    items: cart.items.map(i => ({
                        productId: i.productId,
                        name: i.name,
                        price_cents: i.price_cents,
                        qty: i.qty,
                        currency: i.currency,
                        variants: i.variants,
                        image: i.image,
                    })),
                    customerName: form.name,
                    customerEmail: form.email,
                    customerPhone: form.phone || undefined,
                    shippingAddress: shippingRequired ? {
                        line1: form.line1,
                        city: form.city,
                        region: form.region,
                        postal: form.postal,
                        country: form.country,
                    } : undefined,
                    shippingCents: shippingRequired ? shippingCents : 0,
                    shippingMethod: shippingRequired ? (shippingResult?.shippingLabel || '') : undefined,
                    paymentMethod: selectedPayment,
                }),
            });

            const orderData = await orderRes.json();
            if (!orderRes.ok) {
                console.error('Order creation failed:', orderData);
                setSubmitting(false);
                return;
            }

            // Handle Stripe payment — use stripeOrderId for self-fulfilled items in a split order
            const stripeOrderId = orderData.stripeOrderId || orderData.order?.id;
            if (selectedPayment === 'stripe' && stripeOrderId && !orderData.childOrders) {
                const currentUrl = window.location.href;
                const stripeRes = await fetch('/api/stripe/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId: stripeOrderId,
                        successUrl: `${currentUrl}${currentUrl.includes('?') ? '&' : '?'}order_success=${orderData.order.id}`,
                        cancelUrl: currentUrl,
                    }),
                });

                const stripeData = await stripeRes.json();
                if (stripeData.url) {
                    cart.clearCart();
                    window.location.href = stripeData.url;
                    return;
                } else {
                    console.error('Stripe checkout failed:', stripeData);
                }
            }

            // Handle split orders with Stripe for self-fulfilled portion
            if (orderData.stripeOrderId && orderData.childOrders) {
                const currentUrl = window.location.href;
                const stripeRes = await fetch('/api/stripe/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId: orderData.stripeOrderId,
                        successUrl: `${currentUrl}${currentUrl.includes('?') ? '&' : '?'}order_success=${orderData.order.id}`,
                        cancelUrl: currentUrl,
                    }),
                });

                const stripeData = await stripeRes.json();
                if (stripeData.url) {
                    cart.clearCart();
                    window.location.href = stripeData.url;
                    return;
                }
            }

            // Handle vendor Stripe checkout sessions (sequential for each vendor)
            if (orderData.vendorStripeOrders?.length > 0) {
                for (const vendorOrder of orderData.vendorStripeOrders) {
                    const currentUrl = window.location.href;
                    const stripeRes = await fetch('/api/stripe/checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderId: vendorOrder.orderId,
                            successUrl: `${currentUrl}${currentUrl.includes('?') ? '&' : '?'}order_success=${orderData.order.id}`,
                            cancelUrl: currentUrl,
                        }),
                    });

                    const stripeData = await stripeRes.json();
                    if (stripeData.url) {
                        cart.clearCart();
                        window.location.href = stripeData.url;
                        return;
                    }
                }
            }

            // For e-transfer / none / mixed with external: show confirmation
            setConfirmation(orderData);
            setStep('confirmation');
            cart.clearCart();
        } catch (err) {
            console.error('Checkout error:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        cart.setCartOpen(false);
        setTimeout(() => {
            setStep('cart');
            setConfirmation(null);
            setShippingResult(null);
            setShippingError(null);
        }, 300);
    };

    const stepTitle = step === 'cart' ? 'Your Cart' : step === 'address' ? 'Shipping Address' : step === 'payment' ? 'Review & Pay' : 'Order Confirmed';

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex justify-end" onClick={handleClose}>
            <div className="absolute inset-0 bg-black/30" />

            <div
                className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5" />
                        {stepTitle}
                    </h2>
                    <button onClick={handleClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
                </div>

                {/* Step indicator */}
                {step !== 'confirmation' && cart.items.length > 0 && (
                    <div className="px-5 pt-3 pb-1 flex items-center gap-1.5 text-xs">
                        {(['cart', ...(shippingRequired ? ['address'] : []), 'payment'] as Step[]).map((s, i, arr) => (
                            <span key={s} className="flex items-center gap-1.5">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    s === step ? 'bg-slate-900 text-white' :
                                    arr.indexOf(step) > i ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                                }`}>{i + 1}</span>
                                <span className={`${s === step ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                                    {s === 'cart' ? 'Cart' : s === 'address' ? 'Address' : 'Pay'}
                                </span>
                                {i < arr.length - 1 && <span className="text-slate-300 mx-0.5">—</span>}
                            </span>
                        ))}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {/* ── Cart step ── */}
                    {step === 'cart' && (
                        <div className="p-5">
                            {cart.items.length === 0 ? (
                                <div className="text-center py-12">
                                    <ShoppingBag className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                                    <p className="text-slate-500 font-medium">Your cart is empty</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {cart.items.map((item, i) => (
                                        <div key={`${item.productId}-${i}`} className="flex gap-3">
                                            {item.image && (
                                                <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-slate-900 text-sm truncate">{item.name}</h4>
                                                {item.variants && Object.keys(item.variants).length > 0 && (
                                                    <p className="text-xs text-slate-500">{Object.entries(item.variants).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>
                                                )}
                                                <p className="text-sm font-bold mt-1" style={{ color: pSecondary }}>${(item.price_cents / 100).toFixed(2)}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <button onClick={() => cart.removeFromCart(item.productId, item.variants)} className="p-0.5 hover:bg-red-50 rounded text-red-400">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                                <div className="flex items-center gap-1 border border-slate-200 rounded-lg">
                                                    <button onClick={() => cart.updateQty(item.productId, item.qty - 1, item.variants)} className="p-1 hover:bg-slate-50">
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                    <span className="text-sm font-medium w-6 text-center">{item.qty}</span>
                                                    <button onClick={() => cart.updateQty(item.productId, item.qty + 1, item.variants)} className="p-1 hover:bg-slate-50">
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Address step ── */}
                    {step === 'address' && (
                        <div className="p-5 space-y-4">
                            {/* Contact info */}
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Full Name *</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Smith" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Email *</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="john@email.com" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Phone</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="(555) 123-4567" />
                                </div>
                            </div>

                            {/* Shipping address */}
                            <div className="pt-2 border-t border-slate-100">
                                <p className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
                                    <Truck className="w-4 h-4 text-slate-500" /> Shipping Address
                                </p>

                                {/* Country */}
                                <div className="mb-2">
                                    <label className="text-xs font-medium text-slate-600 block mb-1">Country *</label>
                                    <select
                                        value={form.country}
                                        onChange={e => setForm({ ...form, country: e.target.value, region: '' })}
                                        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {COUNTRIES.map(c => (
                                            <option key={c.code} value={c.code}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Street address with autocomplete */}
                                <div className="mb-2">
                                    <label className="text-xs font-medium text-slate-600 block mb-1">Street Address *</label>
                                    <AddressAutocomplete
                                        value={form.line1}
                                        onChange={val => setForm({ ...form, line1: val })}
                                        onPlaceSelected={handleAddressPlaceSelected}
                                        placeholder="Street address"
                                    />
                                </div>

                                {/* City + Region */}
                                <div className="flex gap-2 mb-2">
                                    <div className="flex-1">
                                        <label className="text-xs font-medium text-slate-600 block mb-1">City *</label>
                                        <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="City" />
                                    </div>
                                    <div className="w-28">
                                        <label className="text-xs font-medium text-slate-600 block mb-1">
                                            {form.country === 'US' ? 'State' : 'Province'} *
                                        </label>
                                        {regionOptions.length > 0 ? (
                                            <select
                                                value={form.region}
                                                onChange={e => setForm({ ...form, region: e.target.value })}
                                                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">Select</option>
                                                {regionOptions.map(r => (
                                                    <option key={r.code} value={r.code}>{r.code}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input type="text" value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Region" />
                                        )}
                                    </div>
                                </div>

                                {/* Postal */}
                                <div>
                                    <label className="text-xs font-medium text-slate-600 block mb-1">Postal / ZIP Code *</label>
                                    <input type="text" value={form.postal} onChange={e => setForm({ ...form, postal: e.target.value })} className="w-40 px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={form.country === 'US' ? '10001' : 'A1B 2C3'} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Payment step ── */}
                    {step === 'payment' && (
                        <div className="p-5 space-y-4">
                            {/* Contact info (shown here when no shipping step) */}
                            {!shippingRequired && (
                                <>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 block mb-1">Full Name *</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Smith" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 block mb-1">Email *</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="john@email.com" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 block mb-1">Phone</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="(555) 123-4567" />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Order summary */}
                            <div className="bg-slate-50 rounded-xl p-3 text-sm">
                                {cart.items.map((item, i) => (
                                    <div key={i} className="flex justify-between py-1">
                                        <span className="text-slate-600">{item.qty}x {item.name}</span>
                                        <span className="font-medium text-slate-900">${(item.price_cents * item.qty / 100).toFixed(2)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between pt-2 mt-2 border-t border-slate-200">
                                    <span className="text-slate-600">Subtotal</span>
                                    <span className="font-medium text-slate-900">{subtotalStr}</span>
                                </div>

                                {shippingRequired && (
                                    <div className="flex justify-between py-1">
                                        <span className="text-slate-600 flex items-center gap-1">
                                            <Truck className="w-3.5 h-3.5" />
                                            Shipping
                                            {shippingResult && <span className="text-xs text-slate-400">({shippingResult.shippingLabel})</span>}
                                        </span>
                                        {shippingLoading ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                                        ) : shippingResult ? (
                                            <span className="font-medium text-slate-900">
                                                {shippingCents === 0 ? 'Free' : `$${(shippingCents / 100).toFixed(2)}`}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-400">—</span>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-between pt-2 mt-1 border-t border-slate-200">
                                    <span className="font-bold text-slate-900">Total</span>
                                    <span className="font-bold" style={{ color: pSecondary }}>{totalStr}</span>
                                </div>

                                {/* Free shipping threshold hint */}
                                {shippingRequired && shippingResult?.freeThresholdCents && shippingCents > 0 && (
                                    <p className="text-xs text-green-600 mt-1">
                                        Spend ${((shippingResult.freeThresholdCents - subtotal) / 100).toFixed(2)} more for free shipping!
                                    </p>
                                )}
                            </div>

                            {/* Shipping errors */}
                            {shippingRequired && shippingError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-700">{shippingError}</p>
                                </div>
                            )}

                            {shippingRequired && noZonesConfigured && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-amber-700">This store is not yet set up for shipping. Please contact the store owner.</p>
                                </div>
                            )}

                            {/* Shipping info (if local pickup) */}
                            {shippingResult?.zone.is_local_pickup && (
                                <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 flex items-start gap-2">
                                    <Package className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-violet-700">Local pickup — no shipping charge</p>
                                </div>
                            )}

                            {/* Shipping address summary */}
                            {shippingRequired && addressComplete && (
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-xs font-semibold text-slate-600">Ship to</p>
                                        <button onClick={() => setStep('address')} className="text-xs text-blue-600 hover:underline">Change</button>
                                    </div>
                                    <p className="text-sm text-slate-800">{form.name}</p>
                                    <p className="text-xs text-slate-500">{form.line1}, {form.city}, {form.region} {form.postal}, {getCountryName(form.country)}</p>
                                </div>
                            )}

                            {/* Payment Method Selection */}
                            {availableMethods.length > 1 && (
                                <div>
                                    <label className="text-sm font-medium text-slate-700 block mb-2">Payment Method</label>
                                    <div className="space-y-2">
                                        {availableMethods.map(method => {
                                            const Icon = method.icon;
                                            const isSelected = selectedPayment === method.key;
                                            return (
                                                <button
                                                    key={method.key}
                                                    onClick={() => setSelectedPayment(method.key)}
                                                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 transition-all text-left ${
                                                        isSelected
                                                            ? 'border-blue-500 bg-blue-50'
                                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                                    }`}
                                                >
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                        isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                        <Icon className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className={`text-sm font-semibold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{method.label}</p>
                                                        <p className="text-xs text-slate-500">{method.desc}</p>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                        isSelected ? 'border-blue-500' : 'border-slate-300'
                                                    }`}>
                                                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Confirmation step ── */}
                    {step === 'confirmation' && confirmation && (
                        <div className="p-5 text-center py-12">
                            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: pSecondary + '20' }}>
                                <Check className="w-8 h-8" style={{ color: pSecondary }} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Order Placed!</h2>
                            <p className="text-slate-600 mb-4">{confirmation.confirmationMessage}</p>
                            <p className="text-sm font-mono text-slate-500">
                                Ref: ORDER-{confirmation.order?.id?.slice(0, 8).toUpperCase()}
                            </p>

                            {confirmation.paymentInstructions?.type === 'etransfer' && (
                                <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
                                    <h3 className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-1.5">
                                        <DollarSign className="w-4 h-4" />
                                        Payment via Interac e-Transfer
                                    </h3>
                                    <p className="text-sm text-amber-700">Send <strong>${confirmation.paymentInstructions.amount} {confirmation.paymentInstructions.currency}</strong> to:</p>
                                    <p className="text-sm font-mono font-bold text-amber-900 my-1">{confirmation.paymentInstructions.email}</p>
                                    <p className="text-xs text-amber-600">Reference: <strong>{confirmation.paymentInstructions.reference}</strong></p>
                                    <p className="text-xs text-amber-500 mt-2">Your order will be confirmed once payment is received.</p>
                                </div>
                            )}

                            {/* Mixed cart: show vendor items pending external payment */}
                            {confirmation.childOrders?.some((co: any) => co.paymentMethod === 'external') && (
                                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
                                    <h3 className="font-bold text-blue-800 text-sm mb-2 flex items-center gap-1.5">
                                        <Mail className="w-4 h-4" />
                                        Next Steps
                                    </h3>
                                    <p className="text-sm text-blue-700 mb-2">
                                        Some items in your order are fulfilled by a partner. You'll receive a separate email with payment instructions for:
                                    </p>
                                    {confirmation.childOrders
                                        .filter((co: any) => co.paymentMethod === 'external')
                                        .map((co: any, i: number) => (
                                            <p key={i} className="text-sm text-blue-900 font-medium">
                                                {co.vendorName} — ${(co.subtotalCents / 100).toFixed(2)}
                                            </p>
                                        ))
                                    }
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer buttons ── */}
                {step === 'cart' && cart.items.length > 0 && (
                    <div className="border-t border-slate-200 px-5 py-4 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Subtotal ({cart.itemCount} items)</span>
                            <span className="font-bold text-lg text-slate-900">{subtotalStr} {currency}</span>
                        </div>
                        <button
                            onClick={() => setStep(shippingRequired ? 'address' : 'payment')}
                            className="w-full py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: pSecondary }}
                        >
                            Checkout <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {step === 'address' && (
                    <div className="border-t border-slate-200 px-5 py-4 space-y-2">
                        <button
                            onClick={handleProceedToPayment}
                            disabled={!contactComplete || !addressComplete}
                            className="w-full py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40"
                            style={{ backgroundColor: pSecondary }}
                        >
                            {shippingLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                            Continue to Payment
                        </button>
                        <button onClick={() => setStep('cart')} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700">
                            &#8592; Back to cart
                        </button>
                    </div>
                )}

                {step === 'payment' && (
                    <div className="border-t border-slate-200 px-5 py-4 space-y-2">
                        <button
                            onClick={handleCheckout}
                            disabled={submitting || !canPlaceOrder || (shippingRequired && (!!shippingError || noZonesConfigured))}
                            className="w-full py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40"
                            style={{ backgroundColor: selectedPayment === 'stripe' ? '#635BFF' : pSecondary }}
                        >
                            {submitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : selectedPayment === 'stripe' ? (
                                <CreditCard className="w-5 h-5" />
                            ) : (
                                <Check className="w-5 h-5" />
                            )}
                            {selectedPayment === 'stripe'
                                ? `Pay ${totalStr} with Card`
                                : `Place Order — ${totalStr} (e-Transfer)`
                            }
                        </button>
                        <button onClick={() => setStep(shippingRequired ? 'address' : 'cart')} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700">
                            &#8592; Back
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
