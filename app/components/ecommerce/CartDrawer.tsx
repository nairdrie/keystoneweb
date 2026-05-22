'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Minus, ShoppingBag, Trash2, Loader2, Check, ArrowRight, User, Mail, Phone, CreditCard, DollarSign, Truck, AlertCircle, Package, Building2, LogIn } from 'lucide-react';
import { useCart } from './CartProvider';
import { useMember } from '@/app/components/membership/MemberProvider';
import AddressAutocomplete from './AddressAutocomplete';
import PayPalButton from './PayPalButton';
import { COUNTRIES, REGIONS, getCountryName } from '@/lib/shipping-data';
import ConvergeLightbox from './ConvergeLightbox';
import CloverIframe from '../checkout/CloverIframe';
import { getMarketingTracking } from '@/lib/marketing/utm-capture';

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

interface ShippingOption {
    id: string;
    label: string;
    amount_cents: number;
    carrier?: string;
    service_token?: string;
    zone_id: string;
}

interface ShippingResult {
    zone: { id: string; name: string; is_local_pickup: boolean };
    options: ShippingOption[];
    selectedId: string;
    freeThresholdCents: number | null;
}

interface AddressSuggestion {
    line1: string; line2?: string; city: string; region: string; postal: string; country: string;
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
    const memberCtx = useMember();
    const member = memberCtx?.member ?? null;
    const [step, setStep] = useState<Step>('cart');
    const [submitting, setSubmitting] = useState(false);
    const [confirmation, setConfirmation] = useState<any>(null);
    const [form, setForm] = useState({
        name: '', email: '', phone: '',
        line1: '', city: '', region: '', postal: '', country: 'CA',
        notes: '',
    });
    const [profileHydrated, setProfileHydrated] = useState(false);
    const [saveProfile, setSaveProfile] = useState(true);
    const [marketingOptIn, setMarketingOptIn] = useState(false);

    // Inline passwordless sign-in panel (OTP). Toggled from the "Sign in" entry
    // above the contact fields; verifying calls /api/membership/me via the
    // member context refresh so the form prefills from the server profile.
    type SignInState = 'closed' | 'email' | 'code';
    const [signInState, setSignInState] = useState<SignInState>('closed');
    const [signInEmail, setSignInEmail] = useState('');
    const [signInCode, setSignInCode] = useState('');
    const [signInBusy, setSignInBusy] = useState(false);
    const [signInError, setSignInError] = useState<string | null>(null);
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

    // Address validation (Shippo) — only surfaced when Shippo proposes a correction.
    const [addressSuggestion, setAddressSuggestion] = useState<AddressSuggestion | null>(null);
    const [addressDismissed, setAddressDismissed] = useState(false);

    const mouseDownOnOverlayRef = useRef(false);

    // Mixed-cart orchestration
    const [paymentSteps, setPaymentSteps] = useState<PaymentStep[]>([]);
    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [convergeToken, setConvergeToken] = useState<string | null>(null);
    const [convergeDemoMode, setConvergeDemoMode] = useState(false);
    const [stepError, setStepError] = useState<string | null>(null);
    const [redirectingTo, setRedirectingTo] = useState<string | null>(null);
    const [cloverChargeData, setCloverChargeData] = useState<{
        orderId: string;
        publicKey: string;
        merchantId: string;
        sandboxMode: boolean;
        amountCents: number;
    } | null>(null);

    const shippingRequired = ecomSettings?.shipping_required !== false;

    // After a successful checkout we hand the customer off to a public order-tracking
    // page so they can check status, see shipping updates, etc. The cart drawer's old
    // "Order Placed!" inline view is kept as a fallback for the rare case we've lost
    // track of the order id mid-flow.
    const redirectToOrderConfirmation = (orderId: string | undefined | null) => {
        cart?.clearCart();
        if (orderId) {
            window.location.assign(`/order-confirmation?orderId=${encodeURIComponent(orderId)}`);
            return;
        }
        setStep('confirmation');
        setSubmitting(false);
    };

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

    // Hydrate the contact + shipping form from a saved profile so returning
    // shoppers don't retype on every visit. Signed-in members win over the
    // anonymous localStorage cache (cross-device); otherwise we fall back to
    // the per-browser cache. `notes` is intentionally never persisted so it
    // can't carry over from a previous order.
    useEffect(() => {
        if (profileHydrated) return;
        if (memberCtx?.isLoading) return; // wait for member fetch to settle
        try {
            if (member) {
                const cf = (member.customFields || {}) as Record<string, any>;
                setForm(f => ({
                    ...f,
                    name: f.name || member.name || '',
                    email: f.email || member.email || '',
                    phone: f.phone || cf.phone || '',
                    line1: f.line1 || cf.line1 || '',
                    city: f.city || cf.city || '',
                    region: f.region || cf.region || '',
                    postal: f.postal || cf.postal || '',
                    country: cf.country || f.country,
                }));
                setMarketingOptIn(!!member.marketingOptIn);
            } else {
                const stored = localStorage.getItem(`checkout_profile_${siteId}`);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setForm(f => ({ ...f, ...parsed, notes: f.notes }));
                }
            }
        } catch { }
        setProfileHydrated(true);
    }, [siteId, profileHydrated, member, memberCtx?.isLoading]);

    const handleSignInRequest = async () => {
        const targetEmail = (signInEmail || form.email).trim();
        if (!targetEmail) {
            setSignInError('Enter your email first.');
            return;
        }
        setSignInBusy(true);
        setSignInError(null);
        try {
            await fetch('/api/membership/otp/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId, email: targetEmail }),
            });
            setSignInEmail(targetEmail);
            setSignInState('code');
        } catch (err: any) {
            setSignInError(err?.message || 'Could not send code');
        } finally {
            setSignInBusy(false);
        }
    };

    const handleSignInVerify = async () => {
        if (!signInCode.trim() || !signInEmail.trim()) return;
        setSignInBusy(true);
        setSignInError(null);
        try {
            const res = await fetch('/api/membership/otp/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId, email: signInEmail, code: signInCode }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setSignInError(data?.error || 'Invalid code');
                return;
            }
            // Re-fetch member; the prefill effect rehydrates the form once
            // memberCtx.member updates. Reset the panel.
            await memberCtx?.refresh();
            setProfileHydrated(false);
            setSignInState('closed');
            setSignInCode('');
        } catch (err: any) {
            setSignInError(err?.message || 'Verification failed');
        } finally {
            setSignInBusy(false);
        }
    };

    // Persist contact + shipping to localStorage as the user types so the
    // next visit is pre-filled. Debounced to avoid thrashing storage.
    useEffect(() => {
        if (!profileHydrated) return;
        const t = setTimeout(() => {
            try {
                const { notes: _omit, ...rest } = form;
                localStorage.setItem(`checkout_profile_${siteId}`, JSON.stringify(rest));
            } catch { }
        }, 500);
        return () => clearTimeout(t);
    }, [form, profileHydrated, siteId]);

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
                    postal: form.postal,
                    city: form.city,
                    line1: form.line1,
                    subtotalCents: cart?.subtotalCents || 0,
                    items: (cart?.items || []).map(i => ({ productId: i.productId, qty: i.qty })),
                }),
            });
            const data = await res.json();

            if (data.error === 'no_zones') {
                setNoZonesConfigured(true);
                setShippingResult(null);
            } else if (data.error === 'no_zone') {
                setShippingError(data.message || "We don't currently ship to this area.");
                setShippingResult(null);
            } else if (data.error === 'no_rates') {
                setShippingError(data.message || "Live shipping rates aren't available for this address.");
                setShippingResult(null);
            } else if (Array.isArray(data.options) && data.options.length > 0) {
                setShippingResult({
                    zone: data.zone,
                    options: data.options,
                    selectedId: data.default_id || data.options[0].id,
                    freeThresholdCents: data.freeThresholdCents ?? null,
                });
            }
        } catch {
            setShippingError('Failed to calculate shipping.');
        } finally {
            setShippingLoading(false);
        }
    }, [siteId, form.country, form.region, form.postal, form.city, form.line1, cart?.subtotalCents, cart?.items, shippingRequired]);

    // Run Shippo address validation once we have a complete address. Errors are
    // swallowed (returns valid=true) so a Shippo outage never blocks checkout.
    const validateShippingAddress = useCallback(async () => {
        if (!shippingRequired) return true;
        if (!form.line1 || !form.city || !form.country) return true;
        try {
            const res = await fetch('/api/shipping/validate-address', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteId,
                    address: {
                        line1: form.line1, city: form.city, region: form.region,
                        postal: form.postal, country: form.country,
                    },
                }),
            });
            const data = await res.json();
            if (data?.error === 'not_configured') return true;
            // Only prompt when Shippo gives back a corrected address that actually differs.
            const c = data?.corrected;
            const differs = c && (
                (c.line1 || '').toLowerCase() !== form.line1.toLowerCase() ||
                (c.city || '').toLowerCase() !== form.city.toLowerCase() ||
                (c.postal || '').replace(/\s/g, '').toLowerCase() !== form.postal.replace(/\s/g, '').toLowerCase() ||
                (c.region || '').toLowerCase() !== form.region.toLowerCase()
            );
            if (differs && !addressDismissed) {
                setAddressSuggestion(c);
                return false;
            }
            return true;
        } catch {
            return true;
        }
    }, [siteId, shippingRequired, form.line1, form.city, form.region, form.postal, form.country, addressDismissed]);

    const acceptAddressSuggestion = () => {
        if (!addressSuggestion) return;
        setForm(f => ({
            ...f,
            line1: addressSuggestion.line1,
            city: addressSuggestion.city,
            region: addressSuggestion.region,
            postal: addressSuggestion.postal,
            country: addressSuggestion.country,
        }));
        setAddressSuggestion(null);
        setShippingResult(null);
    };
    const dismissAddressSuggestion = () => {
        setAddressSuggestion(null);
        setAddressDismissed(true);
    };

    // Auto-initialize Clover when the customer reaches the payment step
    useEffect(() => {
        if (!cart?.isCartOpen || step !== 'payment' || selectedPayment !== 'clover') return;
        if (cloverChargeData || submitting) return;
        const addressFilled = form.line1.trim() && form.city.trim() && form.region.trim() && form.postal.trim() && form.country;
        const contactFilled = form.name.trim() && form.email.trim();
        const ready = contactFilled && (!shippingRequired || (addressFilled && shippingResult && !shippingError));
        if (!ready) return;
        handleCheckout();
    }, [step, selectedPayment]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!cart || !cart.isCartOpen) return null;

    const pSecondary = palette.secondary || '#dc2626';
    const currency = cart.items[0]?.currency || 'CAD';
    const subtotal = cart.subtotalCents;
    const selectedShippingOption = shippingResult?.options.find(o => o.id === shippingResult?.selectedId) || null;
    const shippingCents = selectedShippingOption?.amount_cents ?? 0;
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
        setAddressDismissed(false);
    };

    const handleProceedToPayment = async () => {
        if (shippingRequired) {
            const ok = await validateShippingAddress();
            if (!ok) return; // suggestion banner is now visible — wait for user to accept/dismiss
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
                shippingMethod: shippingRequired ? (selectedShippingOption?.label || '') : undefined,
                shippingServiceToken: shippingRequired ? (selectedShippingOption?.service_token || null) : undefined,
                shippingCarrier: shippingRequired ? (selectedShippingOption?.carrier || null) : undefined,
                paymentMethod,
                notes: form.notes.trim() || undefined,
                saveProfile: !member ? saveProfile : undefined,
                marketingOptIn: !member ? marketingOptIn : undefined,
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
                    shippingMethod: shippingRequired ? (selectedShippingOption?.label || '') : undefined,
                    shippingServiceToken: shippingRequired ? (selectedShippingOption?.service_token || null) : undefined,
                    shippingCarrier: shippingRequired ? (selectedShippingOption?.carrier || null) : undefined,
                    paymentMethod: selectedPayment,
                    notes: form.notes.trim() || undefined,
                    saveProfile: !member ? saveProfile : undefined,
                    marketingOptIn: !member ? marketingOptIn : undefined,
                    tracking: getMarketingTracking(),
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

            if (steps.length === 0) {
                // No payment steps (e-transfer or none) — hand off to the tracking page
                redirectToOrderConfirmation(orderData.order?.id);
                return;
            }

            if (steps.length === 1) {
                // Single payment — execute directly without showing split-pay UI
                setPaymentSteps(steps);
                setCurrentStepIdx(0);
                await executePaymentStep(steps[0]);
                // Keep `submitting` true; redirecting overlay takes over for redirect processors.
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
                redirectToOrderConfirmation(orderData.order?.id);
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
            setRedirectingTo('Stripe');
            const currentUrl = window.location.href;
            const origin = window.location.origin;
            const trackingOrderId = confirmation?.order?.id || step.orderId;
            const stripeRes = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: step.orderId,
                    successUrl: `${origin}/order-confirmation?orderId=${encodeURIComponent(trackingOrderId)}`,
                    cancelUrl: currentUrl,
                }),
            });
            const stripeData = await stripeRes.json();
            if (stripeData.url) {
                window.location.href = stripeData.url;
            } else {
                setRedirectingTo(null);
                setSubmitting(false);
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
                    setSubmitting(false);
                    updateStepStatus(idx, 'failed');
                    setStepError(data.error || 'Failed to prepare Converge payment');
                    return;
                }
                setSubmitting(false);
                setConvergeDemoMode(!!data.demoMode);
                setConvergeToken(data.token);
            } catch (err: any) {
                setSubmitting(false);
                updateStepStatus(idx, 'failed');
                setStepError(err.message || 'Converge error');
            }
            return;
        }

        if (step.processor === 'clover') {
            updateStepStatus(idx, 'processing');
            try {
                const res = await fetch(`/api/clover/config?orderId=${step.orderId}`);
                const data = await res.json();
                if (!res.ok || !data.publicKey) {
                    setSubmitting(false);
                    updateStepStatus(idx, 'failed');
                    setStepError(data.error || 'Failed to initialize Clover payment');
                    return;
                }
                setCloverChargeData({
                    orderId: step.orderId,
                    publicKey: data.publicKey,
                    merchantId: data.merchantId,
                    sandboxMode: data.sandboxMode,
                    amountCents: data.amountCents,
                });
                setSubmitting(false);
            } catch (err: any) {
                setSubmitting(false);
                updateStepStatus(idx, 'failed');
                setStepError(err.message || 'Clover error');
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
            // All vendor payment steps complete — send the customer to the tracking page
            // for the parent order so they see one unified confirmation.
            redirectToOrderConfirmation(confirmation?.order?.id || paymentSteps[0]?.orderId);
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

    const handleCloverSuccess = () => {
        const idx = currentStepIdx;
        setCloverChargeData(null);
        updateStepStatus(idx, 'completed');
        setTimeout(() => advanceToNextStep(idx + 1), 300);
    };

    const handleCloverError = (message: string) => {
        setCloverChargeData(null);
        updateStepStatus(currentStepIdx, 'failed');
        setStepError(message);
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
                    shippingMethod: shippingRequired ? (selectedShippingOption?.label || '') : undefined,
                    shippingServiceToken: shippingRequired ? (selectedShippingOption?.service_token || null) : undefined,
                    shippingCarrier: shippingRequired ? (selectedShippingOption?.carrier || null) : undefined,
                    paymentMethod: 'paypal',
                    notes: form.notes.trim() || undefined,
                    saveProfile: !member ? saveProfile : undefined,
                    marketingOptIn: !member ? marketingOptIn : undefined,
                    tracking: getMarketingTracking(),
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
        redirectToOrderConfirmation(data.order?.id || pendingOrderId);
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
            setCloverChargeData(null);
            setStepError(null);
        }, 300);
    };

    const stepTitle =
        step === 'cart' ? 'Your Cart' :
        step === 'address' ? 'Shipping Address' :
        step === 'payment' ? 'Review & Pay' :
        step === 'split-pay' ? `Payment ${currentStepIdx + 1} of ${paymentSteps.length}` :
        'Order Confirmed';

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex justify-end"
            onMouseDown={e => {
                mouseDownOnOverlayRef.current = e.target === e.currentTarget;
            }}
            onClick={e => {
                if (e.target === e.currentTarget && mouseDownOnOverlayRef.current) {
                    handleClose();
                }
                mouseDownOnOverlayRef.current = false;
            }}
        >
            <div className="absolute inset-0 bg-black/30" />

            <div
                className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
            >
                {/* Redirect overlay — shown while we wait for the payment processor
                    to hand back a hosted-checkout URL and the browser to navigate. */}
                {redirectingTo && (
                    <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3 px-6 text-center">
                        <Loader2 className="w-10 h-10 animate-spin" style={{ color: pSecondary }} />
                        <p className="text-base font-semibold text-slate-900">Redirecting to {redirectingTo}…</p>
                        <p className="text-xs text-slate-500">Please don't close this window.</p>
                    </div>
                )}

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
                                    {s === 'cart' ? 'Cart' : s === 'address' ? 'Address & Shipping' : 'Payment Information'}
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
                            {/* Returning customer: passwordless sign-in by email code.
                                Falls back to the password sign-in page (with returnTo
                                so the cart auto-reopens) for customers who prefer that. */}
                            {!member && (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                                    {signInState === 'closed' ? (
                                        <div className="flex items-center justify-between gap-3 px-3 py-2">
                                            <span className="text-xs text-slate-600 flex items-center gap-1.5">
                                                <LogIn className="w-3.5 h-3.5 text-slate-400" />
                                                Already have an account?
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSignInEmail(form.email || '');
                                                    setSignInError(null);
                                                    setSignInState('email');
                                                }}
                                                className="text-xs font-bold text-blue-600 hover:underline"
                                            >
                                                Sign in
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="px-3 py-3 space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-xs font-semibold text-slate-700">
                                                    {signInState === 'email'
                                                        ? 'Sign in with an email code'
                                                        : `Code sent to ${signInEmail}`}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSignInState('closed');
                                                        setSignInError(null);
                                                        setSignInCode('');
                                                    }}
                                                    className="p-0.5 text-slate-400 hover:text-slate-700"
                                                    aria-label="Cancel sign-in"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            {signInState === 'email' ? (
                                                <>
                                                    <input
                                                        type="email"
                                                        value={signInEmail}
                                                        onChange={e => setSignInEmail(e.target.value)}
                                                        placeholder="you@example.com"
                                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleSignInRequest}
                                                        disabled={signInBusy || !signInEmail.trim()}
                                                        className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                                                    >
                                                        {signInBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                                        Email me a code
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        autoComplete="one-time-code"
                                                        maxLength={6}
                                                        value={signInCode}
                                                        onChange={e => setSignInCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                        placeholder="123456"
                                                        className="w-full px-3 py-2 text-center text-lg font-mono tracking-[0.5em] border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleSignInVerify}
                                                        disabled={signInBusy || signInCode.length !== 6}
                                                        className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                                                    >
                                                        {signInBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                                        Verify code
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSignInState('email');
                                                            setSignInCode('');
                                                            setSignInError(null);
                                                        }}
                                                        className="w-full py-1 text-[11px] text-slate-500 hover:text-slate-700"
                                                    >
                                                        Use a different email
                                                    </button>
                                                </>
                                            )}

                                            {signInError && (
                                                <p className="text-[11px] text-red-600 flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> {signInError}
                                                </p>
                                            )}

                                            <a
                                                href={(() => {
                                                    if (typeof window === 'undefined') return '/signin';
                                                    const here = new URL(window.location.href);
                                                    here.searchParams.set('openCart', '1');
                                                    return `/signin?returnTo=${encodeURIComponent(here.pathname + here.search)}`;
                                                })()}
                                                className="block text-center text-[11px] text-slate-500 hover:text-slate-700"
                                            >
                                                Use password instead
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}

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
                                        onChange={e => {
                                            setForm({ ...form, country: e.target.value, region: '' });
                                            setShippingResult(null);
                                            setAddressDismissed(false);
                                        }}
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

                            {/* Save profile + marketing consent (Shopify-style:
                                save-info pre-checked, marketing opt-in unchecked).
                                Hidden for already-signed-in members — their profile
                                is already saved server-side. */}
                            {!member && (
                                <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                                    <label className="flex items-start gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={saveProfile}
                                            onChange={e => setSaveProfile(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <span className="text-sm text-slate-700">
                                            Save my info for a faster checkout next time
                                        </span>
                                    </label>
                                    <label className="flex items-start gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={marketingOptIn}
                                            onChange={e => setMarketingOptIn(e.target.checked)}
                                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <span className="text-sm text-slate-700">
                                            Email me about new products and promotions
                                        </span>
                                    </label>
                                </div>
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
                                    <div className="py-1">
                                        {/* Single-option (flat/free/local): inline summary.
                                            Multi-option (carrier rates): radio list so the customer picks. */}
                                        {shippingResult && shippingResult.options.length > 1 ? (
                                            <div>
                                                <div className="flex items-center gap-1 text-slate-600 mb-1.5">
                                                    <Truck className="w-3.5 h-3.5" />
                                                    <span>Shipping</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {shippingResult.options.map(opt => {
                                                        const isSelected = opt.id === shippingResult.selectedId;
                                                        return (
                                                            <label
                                                                key={opt.id}
                                                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer text-xs ${isSelected ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    name="shipping_option"
                                                                    checked={isSelected}
                                                                    onChange={() => setShippingResult(prev => prev ? { ...prev, selectedId: opt.id } : prev)}
                                                                    className="text-blue-500"
                                                                />
                                                                <span className="flex-1 text-slate-700 truncate">{opt.label}</span>
                                                                <span className="font-semibold text-slate-900">
                                                                    {opt.amount_cents === 0 ? 'Free' : `$${(opt.amount_cents / 100).toFixed(2)}`}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between">
                                                <span className="text-slate-600 flex items-center gap-1">
                                                    <Truck className="w-3.5 h-3.5" />
                                                    Shipping
                                                    {selectedShippingOption && <span className="text-xs text-slate-400">({selectedShippingOption.label})</span>}
                                                </span>
                                                {shippingLoading ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                                                ) : selectedShippingOption ? (
                                                    <span className="font-medium text-slate-900">
                                                        {shippingCents === 0 ? 'Free' : `$${(shippingCents / 100).toFixed(2)}`}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </div>
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

                            {/* Address suggestion (from Shippo address validation) */}
                            {shippingRequired && addressSuggestion && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p className="text-xs font-bold text-blue-900 mb-1">Did you mean this address?</p>
                                    <p className="text-sm text-blue-800">
                                        {addressSuggestion.line1}{addressSuggestion.line2 ? `, ${addressSuggestion.line2}` : ''}
                                    </p>
                                    <p className="text-sm text-blue-800">
                                        {addressSuggestion.city}, {addressSuggestion.region} {addressSuggestion.postal}
                                    </p>
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={acceptAddressSuggestion}
                                            className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                        >
                                            Use this address
                                        </button>
                                        <button
                                            onClick={dismissAddressSuggestion}
                                            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                                        >
                                            Keep mine
                                        </button>
                                    </div>
                                </div>
                            )}

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

                            {/* Clover payment form — auto-rendered when Clover is selected */}
                            {selectedPayment === 'clover' && (
                                <div>
                                    {cloverChargeData ? (
                                        <CloverIframe
                                            {...cloverChargeData}
                                            currency={currency}
                                            onSuccess={() => {
                                                const finishedOrderId = cloverChargeData?.orderId;
                                                setCloverChargeData(null);
                                                redirectToOrderConfirmation(finishedOrderId);
                                            }}
                                            onError={(msg) => {
                                                setCloverChargeData(null);
                                                setStepError(msg);
                                                setSubmitting(false);
                                            }}
                                            palette={palette}
                                        />
                                    ) : submitting ? (
                                        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-6">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Preparing payment form…
                                        </div>
                                    ) : null}
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
                                    ) : paymentSteps[currentStepIdx].processor === 'clover' && cloverChargeData ? (
                                        <div>
                                            <p className="text-sm text-slate-600 mb-3 text-center">
                                                Paying <strong>{paymentSteps[currentStepIdx].vendorName}</strong>
                                            </p>
                                            <CloverIframe
                                                {...cloverChargeData}
                                                currency={cart.items[0]?.currency || 'USD'}
                                                onSuccess={handleCloverSuccess}
                                                onError={handleCloverError}
                                                palette={palette}
                                            />
                                        </div>
                                    ) : paymentSteps[currentStepIdx].processor === 'clover' ? (
                                        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Loading payment form…
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
                        ) : selectedPayment !== 'clover' ? (
                            <button
                                onClick={handleCheckout}
                                disabled={submitting || !canPlaceOrder || (shippingRequired && (!!shippingError || noZonesConfigured))}
                                className="w-full py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40"
                                style={{ backgroundColor: (selectedPayment === 'stripe' || selectedPayment === 'converge') ? '#635BFF' : pSecondary }}
                            >
                                {submitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (selectedPayment === 'stripe' || selectedPayment === 'converge') ? (
                                    <CreditCard className="w-5 h-5" />
                                ) : (
                                    <Check className="w-5 h-5" />
                                )}
                                {selectedPayment === 'stripe' || selectedPayment === 'converge'
                                    ? `Pay ${totalStr} with Card`
                                    : `Place Order — ${totalStr} (e-Transfer)`
                                }
                            </button>
                        ) : null}
                        {stepError && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700">{stepError}</p>
                            </div>
                        )}
                        {!cloverChargeData && (
                            <button onClick={() => setStep(shippingRequired ? 'address' : 'cart')} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700">
                                &#8592; Back
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
