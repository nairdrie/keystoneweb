'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Minus, ShoppingBag, Trash2, Loader2, Check, ArrowRight, User, Mail, Phone, MapPin } from 'lucide-react';
import { useCart } from './CartProvider';

interface CartDrawerProps {
    siteId: string;
    palette: Record<string, string>;
}

export default function CartDrawer({ siteId, palette }: CartDrawerProps) {
    const cart = useCart();
    const [step, setStep] = useState<'cart' | 'checkout' | 'confirmation'>('cart');
    const [submitting, setSubmitting] = useState(false);
    const [confirmation, setConfirmation] = useState<any>(null);
    const [form, setForm] = useState({ name: '', email: '', phone: '', line1: '', city: '', province: '', postal: '' });

    if (!cart || !cart.isCartOpen) return null;

    const pSecondary = palette.secondary || '#dc2626';
    const currency = cart.items[0]?.currency || 'CAD';
    const total = `$${(cart.subtotalCents / 100).toFixed(2)}`;

    const handleCheckout = async () => {
        if (!form.name.trim() || !form.email.trim()) return;
        setSubmitting(true);

        const res = await fetch('/api/products/orders', {
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
                })),
                customerName: form.name,
                customerEmail: form.email,
                customerPhone: form.phone || undefined,
                shippingAddress: form.line1 ? {
                    line1: form.line1,
                    city: form.city,
                    province: form.province,
                    postal: form.postal,
                } : undefined,
                paymentMethod: 'none', // TODO: support etransfer option
            }),
        });

        const data = await res.json();
        if (res.ok) {
            setConfirmation(data);
            setStep('confirmation');
            cart.clearCart();
        }
        setSubmitting(false);
    };

    const handleClose = () => {
        cart.setCartOpen(false);
        // Reset to cart view after closing
        setTimeout(() => { setStep('cart'); setConfirmation(null); }, 300);
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex justify-end" onClick={handleClose}>
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/30" />

            {/* Drawer */}
            <div
                className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5" />
                        {step === 'cart' ? 'Your Cart' : step === 'checkout' ? 'Checkout' : 'Order Confirmed'}
                    </h2>
                    <button onClick={handleClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {/* Cart Items */}
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

                    {/* Checkout Form */}
                    {step === 'checkout' && (
                        <div className="p-5 space-y-4">
                            {/* Order summary */}
                            <div className="bg-slate-50 rounded-xl p-3 text-sm">
                                {cart.items.map((item, i) => (
                                    <div key={i} className="flex justify-between py-1">
                                        <span className="text-slate-600">{item.qty}x {item.name}</span>
                                        <span className="font-medium text-slate-900">${(item.price_cents * item.qty / 100).toFixed(2)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between pt-2 mt-2 border-t border-slate-200">
                                    <span className="font-bold text-slate-900">Total</span>
                                    <span className="font-bold" style={{ color: pSecondary }}>{total}</span>
                                </div>
                            </div>

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

                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Shipping Address</label>
                                <div className="space-y-2">
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input type="text" value={form.line1} onChange={e => setForm({ ...form, line1: e.target.value })} className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Street address" />
                                    </div>
                                    <div className="flex gap-2">
                                        <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="flex-1 px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="City" />
                                        <input type="text" value={form.province} onChange={e => setForm({ ...form, province: e.target.value })} className="w-20 px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Prov" />
                                    </div>
                                    <input type="text" value={form.postal} onChange={e => setForm({ ...form, postal: e.target.value })} className="w-32 px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Postal code" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Confirmation */}
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
                                    <h3 className="font-bold text-amber-800 text-sm mb-2">💸 Payment via Interac e-Transfer</h3>
                                    <p className="text-sm text-amber-700">Send <strong>${confirmation.paymentInstructions.amount} {confirmation.paymentInstructions.currency}</strong> to:</p>
                                    <p className="text-sm font-mono font-bold text-amber-900 my-1">{confirmation.paymentInstructions.email}</p>
                                    <p className="text-xs text-amber-600">Reference: <strong>{confirmation.paymentInstructions.reference}</strong></p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'cart' && cart.items.length > 0 && (
                    <div className="border-t border-slate-200 px-5 py-4 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Subtotal ({cart.itemCount} items)</span>
                            <span className="font-bold text-lg text-slate-900">{total} {currency}</span>
                        </div>
                        <button
                            onClick={() => setStep('checkout')}
                            className="w-full py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: pSecondary }}
                        >
                            Checkout <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {step === 'checkout' && (
                    <div className="border-t border-slate-200 px-5 py-4 space-y-2">
                        <button
                            onClick={handleCheckout}
                            disabled={submitting || !form.name.trim() || !form.email.trim()}
                            className="w-full py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40"
                            style={{ backgroundColor: pSecondary }}
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                            Place Order — {total}
                        </button>
                        <button onClick={() => setStep('cart')} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700">
                            ← Back to cart
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
