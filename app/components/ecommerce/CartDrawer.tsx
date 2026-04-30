'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Minus, ShoppingBag, Trash2, Loader2, Check, ArrowRight, User, Mail, Phone, CreditCard, DollarSign, Truck, AlertCircle, Package, Building2 } from 'lucide-react';
import { useCart } from './CartProvider';
import AddressAutocomplete from './AddressAutocomplete';
import PayPalButton from './PayPalButton';
import { COUNTRIES, REGIONS, getCountryName } from '@/lib/shipping-data';
import ConvergeLightbox from './ConvergeLightbox';

interface PaymentMethods {
    etransfer?: boolean;
    stripe?: boolean;
    paypal?: boolean;
    converge?: boolean;
    clover?: boolean;
}

interface EcommerceSettings {
    payment_methods: PaymentMethods;
    etransfer_email: string | null;
    shipping_required?: boolean;
    tax_rate_bps?: number;
    tax_label?: string | null;
    tax_enabled?: boolean;
}

interface ShippingResult {
    zone: { id: string; name: string; is_local_pickup: boolean };
    shippingCents: number;
    shippingLabel: string;
    freeThresholdCents: number | null;
}

type Step = 'cart' | 'address' | 'payment' | 'split-pay' | 'confirmation';

/** A pending payment step in a mixed-cart checkout. */
interface PaymentStep {
    orderId: string;
    vendorName: string;
    subtotalCents: number;
    shippingCents: number;
    processor: 'stripe-self' | 'stripe-vendor' | 'converge' | 'clover' | 'external';
    demoMode?: boolean;
    sandboxMode?: boolean;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
}

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
        notes: '',
    });
    const [selectedPayment, setSelectedPayment] = useState<'etransfer' | 'stripe' | 'paypal' | 'converge' | 'clover'>('etransfer');
    const [ecomSettings, setEcomSettings] = useState<EcommerceSettings | null>(null);
    const [stripeConnected, setStripeConnected] = useState(false);
    const [paypalConnected, setPaypalConnected] = useState(false);
    const [paypalMerchantId, setPaypalMerchantId] = useState<string | null>(null);
    const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
    const [paypalError, setPaypalError] = useState<string | null>(null);
    const [convergeConnected, setConvergeConnected] = useState(false);
    const [convergeDemoModeSite, setConvergeDemoModeSite] = useState(false);
    const [cloverConnected, setCloverConnected] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    // Shipping
    const [shippingResult, setShippingResult] = useState<ShippingResult | null>(null);
    const [shippingError, setShippingError] = useState<string | null>(null);
    const [shippingLoading, setShippingLoading] = useState(false);
    const [noZonesConfigured, setNoZonesConfigured] = useState(false);

    // Mixed-cart orchestration
    const [paymentSteps, setPaymentSteps] = useState<PaymentStep[]>([]);
    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [convergeToken, setConvergeToken] = useState<string | null>(null);
    const [convergeDemoMode, setConvergeDemoMode] = useState(false);
    const [stepError, setStepError] = useState<string | null>(null);

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
                setPaypalConnected(data.paypalConnected || false);
                setPaypalMerchantId(data.paypalMerchantId || null);
                setConvergeConnected(data.convergeConnected || false);
                setConvergeDemoModeSite(data.convergeDemoMode || false);
                setCloverConnected(data.cloverConnected || false);

                const pm = data.settings?.payment_methods || {};
                if (pm.stripe && data.stripeConnected) {
                    setSelectedPayment('stripe');
                } else if (pm.paypal && data.paypalConnected) {
                    setSelectedPayment('paypal');
                } else if (pm.converge && data.convergeConnected) {
                    setSelectedPayment('converge');
                } else if (pm.clover && data.cloverConnected) {
                    setSelectedPayment('clover');
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
    // Flat-rate tax: applied to e-transfer checkouts always; applied to Stripe
    // only when Stripe automatic_tax is OFF (otherwise Stripe calculates it).
    const taxRateBps = ecomSettings?.tax_rate_bps || 0;
    const taxLabel = ecomSettings?.tax_label || 'Tax';
    const shouldApplyFlatTax = taxRateBps > 0 && !(selectedPayment === 'stripe' && ecomSettings?.tax_enabled);
    const taxableBaseCents = subtotal + (shippingRequired ? shippingCents : 0);
    const taxCents = shouldApplyFlatTax ? Math.round(taxableBaseCents * taxRateBps / 10000) : 0;
    const totalCents = subtotal + (shippingRequired ? shippingCents : 0) + taxCents;
    const subtotalStr = `$${(subtotal / 100).toFixed(2)}`;
    const totalStr = `$${(totalCents / 100).toFixed(2)}`;
    const taxStr = `$${(taxCents / 100).toFixed(2)}`;

    // Available payment methods
    const pm = ecomSettings?.payment_methods || {};
    const availableMethods: Array<{ key: 'etransfer' | 'stripe' | 'paypal' | 'converge' | 'clover'; label: string; desc: string; icon: typeof CreditCard }> = [];
    if (pm.stripe && stripeConnected) {
        availableMethods.push({ key: 'stripe', label: 'Credit / Debit Card', desc: 'Pay securely with Stripe', icon: CreditCard });
    }
    if (pm.paypal && paypalConnected) {
        availableMethods.push({ key: 'paypal', label: 'PayPal or Card', desc: 'PayPal wallet or pay as guest with a card', icon: CreditCard });
    }
    if (pm.converge && convergeConnected) {
        availableMethods.push({ key: 'converge', label: 'Credit / Debit Card', desc: 'Pay securely via Converge', icon: CreditCard });
    }
    if (pm.clover && cloverConnected) {
        availableMethods.push({ key: 'clover', label: 'Credit / Debit Card', desc: 'Pay securely via Clover', icon: CreditCard });
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

    const createOrderRow = async (paymentMethod: 'etransfer' | 'stripe' | 'paypal') => {
        const orderRes = await fetch('/api/products/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                siteId,
                items: cart!.items.map(i => ({
                    productId: i.productId,
                    name: i.name,
                    price_cents: i.price_cents,
                    qty: i.qty,
                    currency: i.currency,
                    variants: i.variants,
                    options: i.options,
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
                paymentMethod,
                notes: form.notes.trim() || undefined,
            }),
        });

        const orderData = await orderRes.json();
        if (!orderRes.ok) {
            throw new Error(orderData?.error || 'Order creation failed');
        }
        return orderData;
    };

    const handleCheckout = async () => {
        if (!canPlaceOrder) return;
        setSubmitting(true);
        setStepError(null);

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
                    options: i.options,
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
                    notes: form.notes.trim() || undefined,
                }),
            });

            const orderData = await orderRes.json();
            if (!orderRes.ok) {
                console.error('Order creation failed:', orderData);
                setStepError(orderData.error || 'Failed to create order');
                setSubmitting(false);
                return;
            }

            setConfirmation(orderData);

            // Build an ordered list of payment steps. Single-source orders have 0 or 1 step.
            const steps: PaymentStep[] = [];

            // Non-split single order (no childOrders)
            if (!orderData.childOrders) {
                if (selectedPayment === 'stripe') {
                    steps.push({
                        orderId: orderData.order.id,
                        vendorName: 'Your Order',
                        subtotalCents: orderData.order.subtotal_cents,
                        shippingCents: orderData.order.shipping_cents || 0,
                        processor: 'stripe-self',
                        status: 'pending',
                    });
                } else if (selectedPayment === 'converge') {
                    steps.push({
                        orderId: orderData.order.id,
                        vendorName: 'Your Order',
                        subtotalCents: orderData.order.subtotal_cents,
                        shippingCents: orderData.order.shipping_cents || 0,
                        processor: 'converge',
                        status: 'pending',
                    });
                } else if (selectedPayment === 'clover') {
                    steps.push({
                        orderId: orderData.order.id,
                        vendorName: 'Your Order',
                        subtotalCents: orderData.order.subtotal_cents,
                        shippingCents: orderData.order.shipping_cents || 0,
                        processor: 'clover',
                        status: 'pending',
                    });
                }
                // etransfer / paypal / none — no step needed here (PayPal has its own button, etransfer goes to confirmation)
            } else {
                // Split order — one step per payment source
                if (orderData.stripeOrderId) {
                    steps.push({
                        orderId: orderData.stripeOrderId,
                        vendorName: 'Your Store',
                        subtotalCents: 0, // filled below
                        shippingCents: 0,
                        processor: 'stripe-self',
                        status: 'pending',
                    });
                }
                for (const vs of (orderData.vendorStripeOrders || [])) {
                    steps.push({
                        orderId: vs.orderId,
                        vendorName: vs.vendorName,
                        subtotalCents: 0,
                        shippingCents: 0,
                        processor: 'stripe-vendor',
                        status: 'pending',
                    });
                }
                for (const vc of (orderData.vendorConvergeOrders || [])) {
                    steps.push({
                        orderId: vc.orderId,
                        vendorName: vc.vendorName,
                        subtotalCents: vc.subtotalCents,
                        shippingCents: vc.shippingCents,
                        processor: 'converge',
                        demoMode: vc.demoMode,
                        status: 'pending',
                    });
                }
                for (const vcl of (orderData.vendorCloverOrders || [])) {
                    steps.push({
                        orderId: vcl.orderId,
                        vendorName: vcl.vendorName,
                        subtotalCents: vcl.subtotalCents,
                        shippingCents: vcl.shippingCents,
                        processor: 'clover',
                        sandboxMode: vcl.sandboxMode,
                        status: 'pending',
                    });
                }
                for (const co of (orderData.childOrders || [])) {
                    if (co.paymentMethod === 'external') {
                        steps.push({
                            orderId: co.id,
                            vendorName: co.vendorName || 'Vendor',
                            subtotalCents: co.subtotalCents,
                            shippingCents: co.shippingCents || 0,
                            processor: 'external',
                            status: 'completed', // external = no in-checkout payment; treated as done immediately
                        });
                    }
                }
            }

            cart.clearCart();

            if (steps.length === 0) {
                // No payment steps (e-transfer or none) — show confirmation directly
                setStep('confirmation');
                setSubmitting(false);
                return;
            }

            if (steps.length === 1) {
                // Single payment — execute directly without showing split-pay UI
                setPaymentSteps(steps);
                setCurrentStepIdx(0);
                setSubmitting(false);
                await executePaymentStep(steps[0]);
                return;
            }

            // Multi-step: show the split-pay UI
            setPaymentSteps(steps);
            setCurrentStepIdx(0);
            setStep('split-pay');
            setSubmitting(false);

            // Kick off the first non-completed step
            const firstPending = steps.findIndex(s => s.status === 'pending');
            if (firstPending >= 0) {
                setCurrentStepIdx(firstPending);
                await executePaymentStep(steps[firstPending]);
            } else {
                setStep('confirmation');
            }
        } catch (err) {
            console.error('Checkout error:', err);
            setStepError('An unexpected error occurred.');
            setSubmitting(false);
        }
    };

    const updateStepStatus = (idx: number, status: PaymentStep['status']) => {
        setPaymentSteps(prev => prev.map((s, i) => i === idx ? { ...s, status } : s));
    };

    const executePaymentStep = async (step: PaymentStep) => {
        setStepError(null);
        const idx = paymentSteps.findIndex(s => s.orderId === step.orderId);

        if (step.processor === 'stripe-self' || step.processor === 'stripe-vendor') {
            updateStepStatus(idx, 'processing');
            const currentUrl = window.location.href;
            const stripeRes = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: step.orderId,
                    successUrl: `${currentUrl}${currentUrl.includes('?') ? '&' : '?'}order_success=${confirmation?.order?.id || step.orderId}&step=${idx + 1}`,
                    cancelUrl: currentUrl,
                }),
            });
            const stripeData = await stripeRes.json();
            if (stripeData.url) {
                window.location.href = stripeData.url;
            } else {
                updateStepStatus(idx, 'failed');
                setStepError(stripeData.error || 'Stripe checkout failed to start');
            }
            return;
        }

        if (step.processor === 'converge') {
            updateStepStatus(idx, 'processing');
            try {
                const res = await fetch('/api/converge/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: step.orderId }),
                });
                const data = await res.json();
                if (!res.ok || !data.token) {
                    updateStepStatus(idx, 'failed');
                    setStepError(data.error || 'Failed to prepare Converge payment');
                    return;
                }
                setConvergeDemoMode(!!data.demoMode);
                setConvergeToken(data.token);
            } catch (err: any) {
                updateStepStatus(idx, 'failed');
                setStepError(err.message || 'Converge error');
            }
            return;
        }

        if (step.processor === 'clover') {
            updateStepStatus(idx, 'processing');
            const res = await fetch('/api/clover/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: step.orderId }),
            });
            const data = await res.json();
            if (data.href) {
                window.location.href = data.href;
            } else {
                updateStepStatus(idx, 'failed');
                setStepError(data.error || 'Failed to start Clover checkout');
            }
            return;
        }

        if (step.processor === 'external') {
            updateStepStatus(idx, 'completed');
            advanceToNextStep(idx + 1);
        }
    };

    const advanceToNextStep = (fromIdx: number) => {
        const next = paymentSteps.slice(fromIdx).findIndex(s => s.status === 'pending');
        if (next < 0) {
            setStep('confirmation');
            return;
        }
        const nextIdx = fromIdx + next;
        setCurrentStepIdx(nextIdx);
        executePaymentStep(paymentSteps[nextIdx]);
    };

    const handleConvergeApproval = async (response: any) => {
        const idx = currentStepIdx;
        const step = paymentSteps[idx];
        setConvergeToken(null);
        try {
            const verifyRes = await fetch('/api/converge/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: step.orderId,
                    sslTxnId: response.ssl_txn_id,
                }),
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
                updateStepStatus(idx, 'completed');
                setTimeout(() => advanceToNextStep(idx + 1), 300);
            } else {
                updateStepStatus(idx, 'failed');
                setStepError(verifyData.error || 'Payment verification failed');
            }
        } catch (err: any) {
            updateStepStatus(idx, 'failed');
            setStepError(err.message || 'Verification error');
        }
    };

    const handleRetryStep = () => {
        setStepError(null);
        updateStepStatus(currentStepIdx, 'pending');
        executePaymentStep(paymentSteps[currentStepIdx]);
    };

    const handleSkipStep = () => {
        setStepError(null);
        updateStepStatus(currentStepIdx, 'skipped');
        advanceToNextStep(currentStepIdx + 1);
    };

    const handlePaypalCreateOrder = async (): Promise<string> => {
        setPaypalError(null);
        let orderId = pendingOrderId;
        if (!orderId) {
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
                    options: i.options,
                        image: i.image,
                    })),
                    customerName: form.name,
                    customerEmail: form.email,
                    customerPhone: form.phone || undefined,
                    shippingAddress: shippingRequired ? {
                        line1: form.line1, city: form.city, region: form.region,
                        postal: form.postal, country: form.country,
                    } : undefined,
                    shippingCents: shippingRequired ? shippingCents : 0,
                    shippingMethod: shippingRequired ? (shippingResult?.shippingLabel || '') : undefined,
                    paymentMethod: 'paypal',
                    notes: form.notes.trim() || undefined,
                }),
            });
            const orderData = await orderRes.json();
            orderId = orderData.order?.id;
            if (!orderId) throw new Error('Could not create order');
            setPendingOrderId(orderId);
        }
        const res = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId }),
        });
        const data = await res.json();
        if (!res.ok || !data.paypalOrderId) {
            throw new Error(data?.error || 'Failed to create PayPal order');
        }
        return data.paypalOrderId;
    };

    const handlePaypalApprove = async (paypalOrderId: string) => {
        if (!pendingOrderId) {
            setPaypalError('Missing order reference');
            return;
        }
        const res = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: pendingOrderId, paypalOrderId }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            setPaypalError(data?.error || 'PayPal capture failed');
            return;
        }
        setConfirmation({
            order: data.order || { id: pendingOrderId },
            confirmationMessage: 'Your payment has been processed.',
        });
        setStep('confirmation');
        cart.clearCart();
    };

    const handleClose = () => {
        cart.setCartOpen(false);
        setTimeout(() => {
            setStep('cart');
            setConfirmation(null);
            setShippingResult(null);
            setShippingError(null);
            setPendingOrderId(null);
            setPaypalError(null);
        }, 300);
    };

    const stepTitle =
        step === 'cart' ? 'Your Cart' :
        step === 'address' ? 'Shipping Address' :
        step === 'payment' ? 'Review & Pay' :
        step === 'split-pay' ? `Payment ${currentStepIdx + 1} of ${paymentSteps.length}` :
        'Order Confirmed';

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
                {step !== 'confirmation' && step !== 'split-pay' && cart.items.length > 0 && (
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
                                                {item.options && Object.keys(item.options).length > 0 && (
                                                    <p className="text-xs text-slate-500">{Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>
                                                )}
                                                <p className="text-sm font-bold mt-1" style={{ color: pSecondary }}>${(item.price_cents / 100).toFixed(2)}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <button onClick={() => cart.removeFromCart(item.productId, item.variants, item.options)} className="p-0.5 hover:bg-red-50 rounded text-red-400">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                                <div className="flex items-center gap-1 border border-slate-200 rounded-lg">
                                                    <button onClick={() => cart.updateQty(item.productId, item.qty - 1, item.variants, item.options)} className="p-1 hover:bg-slate-50">
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                    <span className="text-sm font-medium w-6 text-center">{item.qty}</span>
                                                    <button onClick={() => cart.updateQty(item.productId, item.qty + 1, item.variants, item.options)} className="p-1 hover:bg-slate-50">
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

                            {/* Order notes */}
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Order notes (optional)</label>
                                <textarea
                                    value={form.notes}
                                    onChange={e => setForm({ ...form, notes: e.target.value.slice(0, 500) })}
                                    rows={2}
                                    placeholder="Allergy info, delivery instructions, gift message..."
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>

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

                                {taxCents > 0 && (
                                    <div className="flex justify-between py-1">
                                        <span className="text-slate-600">{taxLabel}</span>
                                        <span className="font-medium text-slate-900">{taxStr}</span>
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
                                                    onClick={() => {
                                                        setSelectedPayment(method.key);
                                                        setPendingOrderId(null);
                                                        setPaypalError(null);
                                                    }}
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

                    {/* ── Split-Pay step (mixed cart orchestration) ── */}
                    {step === 'split-pay' && (
                        <div className="p-5 space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center flex-shrink-0">
                                        <AlertCircle className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-bold text-blue-900">Split Checkout</h3>
                                        <p className="text-xs text-blue-700 mt-1">
                                            Your cart contains items from multiple sources, each with its own secure payment step. We'll guide you through each one. Your shipping address is already saved.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Steps list */}
                            <div className="space-y-2">
                                {paymentSteps.map((ps, i) => {
                                    const isCurrent = i === currentStepIdx && step === 'split-pay';
                                    const stepColor =
                                        ps.status === 'completed' ? 'green' :
                                        ps.status === 'failed' ? 'red' :
                                        ps.status === 'processing' ? 'blue' :
                                        ps.status === 'skipped' ? 'slate' :
                                        isCurrent ? 'blue' : 'slate';
                                    const procLabel =
                                        ps.processor === 'stripe-self' ? 'Credit/Debit' :
                                        ps.processor === 'stripe-vendor' ? 'Stripe' :
                                        ps.processor === 'converge' ? 'Credit Card' :
                                        ps.processor === 'clover' ? 'Credit Card' :
                                        'Vendor contacts you';
                                    const statusLabel =
                                        ps.status === 'completed' ? 'Paid' :
                                        ps.status === 'failed' ? 'Failed' :
                                        ps.status === 'processing' ? 'Processing…' :
                                        ps.status === 'skipped' ? 'Skipped' :
                                        isCurrent ? 'Current' : 'Pending';

                                    const total = (ps.subtotalCents + ps.shippingCents) / 100;
                                    return (
                                        <div
                                            key={ps.orderId}
                                            className={`border-2 rounded-xl p-3 transition-colors ${
                                                isCurrent
                                                    ? 'border-blue-500 bg-blue-50/50'
                                                    : ps.status === 'completed'
                                                        ? 'border-green-200 bg-green-50/30'
                                                        : ps.status === 'failed'
                                                            ? 'border-red-200 bg-red-50/30'
                                                            : 'border-slate-200 bg-white'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-${stepColor}-100 text-${stepColor}-700`}>
                                                    {ps.status === 'completed' ? <Check className="w-4 h-4" /> :
                                                     ps.status === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                                     ps.status === 'failed' ? <X className="w-4 h-4" /> :
                                                     i + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                        <p className="text-sm font-semibold text-slate-800 truncate">{ps.vendorName}</p>
                                                    </div>
                                                    <p className="text-xs text-slate-500">{procLabel}{total > 0 ? ` — $${total.toFixed(2)}` : ''}</p>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full bg-${stepColor}-100 text-${stepColor}-700`}>
                                                    {statusLabel}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Current step detail */}
                            {paymentSteps[currentStepIdx] && (
                                <div className="bg-slate-50 rounded-xl p-4">
                                    {paymentSteps[currentStepIdx].processor === 'external' ? (
                                        <div className="flex items-start gap-2">
                                            <Mail className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                                            <p className="text-sm text-slate-600">
                                                <strong>{paymentSteps[currentStepIdx].vendorName}</strong> will contact you by email to arrange payment and delivery. No action needed right now.
                                            </p>
                                        </div>
                                    ) : paymentSteps[currentStepIdx].processor === 'converge' ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <p className="text-sm text-slate-600 text-center">
                                                Paying <strong>{paymentSteps[currentStepIdx].vendorName}</strong> via secure card form.
                                            </p>
                                            {paymentSteps[currentStepIdx].status === 'processing' && (
                                                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-600 text-center">
                                            Redirecting to secure payment for <strong>{paymentSteps[currentStepIdx].vendorName}</strong>…
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Error display */}
                            {stepError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm text-red-700">{stepError}</p>
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={handleRetryStep}
                                                className="text-xs font-semibold text-red-700 hover:underline"
                                            >
                                                Retry
                                            </button>
                                            <button
                                                onClick={handleSkipStep}
                                                className="text-xs text-slate-500 hover:underline"
                                            >
                                                Skip this step
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Converge Lightbox trigger */}
                            {convergeToken && paymentSteps[currentStepIdx]?.processor === 'converge' && (
                                <ConvergeLightbox
                                    token={convergeToken}
                                    demoMode={convergeDemoMode}
                                    onApproval={handleConvergeApproval}
                                    onDeclined={(r) => {
                                        setConvergeToken(null);
                                        updateStepStatus(currentStepIdx, 'failed');
                                        setStepError(r.ssl_result_message || 'Card declined');
                                    }}
                                    onError={(e) => {
                                        setConvergeToken(null);
                                        updateStepStatus(currentStepIdx, 'failed');
                                        setStepError(typeof e === 'string' ? e : 'Payment error');
                                    }}
                                    onCancelled={() => {
                                        setConvergeToken(null);
                                        updateStepStatus(currentStepIdx, 'pending');
                                    }}
                                />
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
                                                {co.vendorName} — ${((co.subtotalCents + (co.shippingCents || 0)) / 100).toFixed(2)}
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
                        {selectedPayment === 'paypal' && paypalMerchantId ? (
                            <div>
                                {canPlaceOrder && !(shippingRequired && (!!shippingError || noZonesConfigured)) ? (
                                    <PayPalButton
                                        merchantId={paypalMerchantId}
                                        currency={currency}
                                        createOrder={handlePaypalCreateOrder}
                                        onApprove={handlePaypalApprove}
                                        onError={err => setPaypalError(err?.message || 'PayPal error')}
                                        onCancel={() => setPaypalError(null)}
                                    />
                                ) : (
                                    <div className="py-3 text-center text-sm text-slate-400">
                                        Complete the form above to continue to PayPal.
                                    </div>
                                )}
                                {paypalError && (
                                    <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> {paypalError}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={handleCheckout}
                                disabled={submitting || !canPlaceOrder || (shippingRequired && (!!shippingError || noZonesConfigured))}
                                className="w-full py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40"
                                style={{ backgroundColor: (selectedPayment === 'stripe' || selectedPayment === 'converge' || selectedPayment === 'clover') ? '#635BFF' : pSecondary }}
                            >
                                {submitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (selectedPayment === 'stripe' || selectedPayment === 'converge' || selectedPayment === 'clover') ? (
                                    <CreditCard className="w-5 h-5" />
                                ) : (
                                    <Check className="w-5 h-5" />
                                )}
                                {selectedPayment === 'stripe' || selectedPayment === 'converge' || selectedPayment === 'clover'
                                    ? `Pay ${totalStr} with Card`
                                    : `Place Order — ${totalStr} (e-Transfer)`
                                }
                            </button>
                        )}
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
