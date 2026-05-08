'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    CheckCircle2,
    Loader2,
    AlertTriangle,
    Package,
    Truck,
    Clock,
    XCircle,
    Mail,
    DollarSign,
} from 'lucide-react';

type Item = {
    name: string;
    qty: number;
    priceCents: number;
    variants?: Record<string, string> | null;
};

type ChildOrder = {
    id: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    subtotalCents: number;
    shippingCents: number;
    vendorName: string | null;
    items: Item[];
};

type Order = {
    id: string;
    siteName: string | null;
    currency: string;
    status: 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled' | string;
    paymentStatus: 'unpaid' | 'pending' | 'paid' | string;
    paymentMethod: string;
    items: Item[];
    subtotalCents: number;
    shippingCents: number;
    shippingMethod: string | null;
    taxCents: number;
    taxLabel: string | null;
    customerName: string;
    customerEmail: string;
    shippingAddress: {
        line1?: string;
        line2?: string;
        city?: string;
        province?: string;
        region?: string;
        postal?: string;
        country?: string;
    } | null;
    trackingNumber: string | null;
    trackingCarrier: string | null;
    createdAt: string;
    updatedAt: string;
    etransferEmail: string | null;
    childOrders: ChildOrder[];
};

const POLL_MS = 4000;
const POLL_LIMIT_MS = 5 * 60_000;

export default function OrderConfirmation() {
    const params = useSearchParams();
    const orderId = params.get('orderId');
    const [order, setOrder] = useState<Order | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const startedAt = useRef<number>(Date.now());
    const cartCleared = useRef(false);

    useEffect(() => {
        if (!orderId) {
            setError('Missing order reference');
            setLoading(false);
            return;
        }

        let cancelled = false;

        const fetchOnce = async () => {
            try {
                const res = await fetch(`/api/public/orders/${orderId}`);
                if (!res.ok) {
                    if (cancelled) return false;
                    setError(res.status === 404 ? 'Order not found' : 'Could not load order');
                    setLoading(false);
                    return false;
                }
                const data: Order = await res.json();
                if (cancelled) return false;
                setOrder(data);
                setLoading(false);
                setError(null);

                if (!cartCleared.current) {
                    try {
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && key.startsWith('cart_') && !key.startsWith('cart_clear_')) {
                                const siteId = key.slice('cart_'.length);
                                localStorage.setItem(`cart_clear_${siteId}`, '1');
                            }
                        }
                    } catch { }
                    cartCleared.current = true;
                }

                // Keep polling while payment is still settling, the order isn't terminal,
                // or while we're within the polling window after arrival. Once it's paid +
                // confirmed (or shipped/completed/cancelled) and a few minutes have passed
                // we let the page go static — users can refresh to get updates.
                const settled =
                    data.paymentStatus === 'paid' &&
                    (data.status === 'confirmed' || data.status === 'shipped' || data.status === 'completed' || data.status === 'cancelled');
                const expired = Date.now() - startedAt.current > POLL_LIMIT_MS;
                return !settled && !expired;
            } catch {
                if (cancelled) return false;
                return Date.now() - startedAt.current <= POLL_LIMIT_MS;
            }
        };

        const loop = async () => {
            const keepGoing = await fetchOnce();
            if (cancelled) return;
            if (keepGoing) setTimeout(loop, POLL_MS);
        };

        loop();
        return () => { cancelled = true; };
    }, [orderId]);

    if (loading) {
        return (
            <Centered>
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
                <h1 className="text-xl font-bold text-slate-900 mb-1">Loading your order…</h1>
                <p className="text-sm text-slate-500">Just a moment.</p>
            </Centered>
        );
    }

    if (error || !order) {
        return (
            <Centered>
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h1 className="text-xl font-bold text-slate-900 mb-1">{error || 'Order not found'}</h1>
                <p className="text-sm text-slate-600 mb-5">
                    Check the link in your confirmation email, or contact the merchant if the issue persists.
                </p>
                <a href="/" className="inline-block px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg">
                    Back to store
                </a>
            </Centered>
        );
    }

    const refId = `ORDER-${order.id.slice(0, 8).toUpperCase()}`;
    const subtotal = (order.subtotalCents / 100).toFixed(2);
    const shipping = (order.shippingCents / 100).toFixed(2);
    const tax = (order.taxCents / 100).toFixed(2);
    const total = ((order.subtotalCents + order.shippingCents + order.taxCents) / 100).toFixed(2);

    const showEtransferInstructions =
        order.paymentMethod === 'etransfer' && order.paymentStatus !== 'paid' && order.etransferEmail;

    return (
        <div className="min-h-[60vh] px-4 py-10 sm:py-14 bg-slate-50">
            <div className="max-w-2xl mx-auto space-y-5">
                {/* Header */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 text-center">
                    <HeadlineIcon order={order} />
                    <h1 className="text-2xl font-bold text-slate-900 mb-1">{headlineTitle(order)}</h1>
                    <p className="text-sm text-slate-600">
                        {headlineSubtitle(order)}
                    </p>
                    <p className="mt-3 text-xs font-mono text-slate-500">Ref: {refId}</p>
                    <p className="mt-2 text-xs text-slate-400">
                        Bookmark this page or use the link in your confirmation email to check on your order anytime.
                    </p>
                </div>

                {/* E-transfer instructions */}
                {showEtransferInstructions && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                        <h2 className="font-bold text-amber-900 text-sm mb-2 flex items-center gap-1.5">
                            <DollarSign className="w-4 h-4" /> Complete your payment via Interac e-Transfer
                        </h2>
                        <p className="text-sm text-amber-800">
                            Send <strong>${total} {order.currency}</strong> to:
                        </p>
                        <p className="text-base font-mono font-bold text-amber-900 my-1 break-all">
                            {order.etransferEmail}
                        </p>
                        <p className="text-xs text-amber-700">
                            Include this reference in the message: <strong>{refId}</strong>
                        </p>
                        <p className="text-xs text-amber-600 mt-2">
                            Your order will be marked as confirmed once the merchant receives payment. This page will update automatically.
                        </p>
                    </div>
                )}

                {/* Status timeline */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
                    <h2 className="text-sm font-bold text-slate-900 mb-4">Order status</h2>
                    <Timeline order={order} />
                    {order.trackingNumber && (
                        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                                <Truck className="w-3.5 h-3.5" />
                                <span>Tracking</span>
                            </div>
                            <p className="text-sm font-mono text-slate-900">{order.trackingNumber}</p>
                            {order.trackingCarrier && (
                                <p className="text-xs text-slate-500 mt-0.5">{order.trackingCarrier}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Items */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
                    <h2 className="text-sm font-bold text-slate-900 mb-4">Items</h2>
                    <ul className="divide-y divide-slate-100">
                        {order.items.map((item, i) => (
                            <li key={i} className="py-3 flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                                    {item.variants && Object.values(item.variants).length > 0 && (
                                        <p className="text-xs text-slate-500">{Object.values(item.variants).join(', ')}</p>
                                    )}
                                    <p className="text-xs text-slate-500 mt-0.5">Qty {item.qty}</p>
                                </div>
                                <div className="text-sm font-semibold text-slate-900 whitespace-nowrap">
                                    ${((item.priceCents * item.qty) / 100).toFixed(2)}
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-1.5 text-sm">
                        <Row label="Subtotal" value={`$${subtotal}`} />
                        {order.shippingCents > 0 || order.shippingMethod ? (
                            <Row
                                label={`Shipping${order.shippingMethod ? ` (${order.shippingMethod})` : ''}`}
                                value={order.shippingCents > 0 ? `$${shipping}` : 'Free'}
                            />
                        ) : null}
                        {order.taxCents > 0 && (
                            <Row label={order.taxLabel || 'Tax'} value={`$${tax}`} />
                        )}
                        <div className="flex justify-between pt-2 mt-2 border-t border-slate-200">
                            <span className="text-sm font-bold text-slate-900">Total</span>
                            <span className="text-base font-bold text-slate-900">${total} {order.currency}</span>
                        </div>
                    </div>
                </div>

                {/* Customer / shipping */}
                {(order.shippingAddress || order.customerEmail) && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 grid sm:grid-cols-2 gap-5">
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Confirmation sent to</h3>
                            <p className="text-sm text-slate-900 break-all">{order.customerEmail}</p>
                            <p className="text-xs text-slate-500 mt-1">{order.customerName}</p>
                        </div>
                        {order.shippingAddress && order.shippingAddress.line1 && (
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Shipping to</h3>
                                <p className="text-sm text-slate-900">{order.shippingAddress.line1}</p>
                                {order.shippingAddress.line2 && (
                                    <p className="text-sm text-slate-900">{order.shippingAddress.line2}</p>
                                )}
                                <p className="text-sm text-slate-500">
                                    {[
                                        order.shippingAddress.city,
                                        order.shippingAddress.province || order.shippingAddress.region,
                                        order.shippingAddress.postal,
                                    ].filter(Boolean).join(', ')}
                                </p>
                                {order.shippingAddress.country && (
                                    <p className="text-sm text-slate-500">{order.shippingAddress.country}</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="text-center">
                    <a
                        href="/"
                        className="inline-block px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                    >
                        Continue shopping
                    </a>
                </div>
            </div>
        </div>
    );
}

function Centered({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
                {children}
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="text-slate-900">{value}</span>
        </div>
    );
}

function HeadlineIcon({ order }: { order: Order }) {
    if (order.status === 'cancelled') {
        return <XCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />;
    }
    if (order.status === 'shipped' || order.status === 'completed') {
        return <Truck className="w-12 h-12 text-emerald-600 mx-auto mb-3" />;
    }
    if (order.paymentStatus === 'paid') {
        return <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />;
    }
    if (order.paymentStatus === 'pending') {
        return <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-3 animate-spin" />;
    }
    return <Clock className="w-12 h-12 text-amber-500 mx-auto mb-3" />;
}

function headlineTitle(order: Order): string {
    if (order.status === 'cancelled') return 'Order cancelled';
    if (order.status === 'shipped') return 'Your order has shipped';
    if (order.status === 'completed') return 'Order complete';
    if (order.paymentStatus === 'paid') return 'Order confirmed';
    if (order.paymentStatus === 'pending') return 'Confirming your payment…';
    if (order.paymentMethod === 'etransfer') return 'Order received';
    return 'Order placed';
}

function headlineSubtitle(order: Order): string {
    if (order.status === 'cancelled') return 'This order was cancelled. Any payment will be refunded by the merchant.';
    if (order.status === 'shipped') return `Thanks ${firstName(order.customerName)}! It's on its way.`;
    if (order.paymentStatus === 'paid') return `Thanks ${firstName(order.customerName)}! We've sent a confirmation to your email.`;
    if (order.paymentStatus === 'pending') return 'This usually takes a few seconds.';
    if (order.paymentMethod === 'etransfer') return `Thanks ${firstName(order.customerName)}! Send the e-Transfer below to finish your order.`;
    return `Thanks ${firstName(order.customerName)}!`;
}

function firstName(name: string): string {
    if (!name) return '';
    return name.split(/\s+/)[0];
}

type Step = {
    label: string;
    state: 'done' | 'current' | 'todo';
    Icon: React.ComponentType<{ className?: string }>;
    detail?: string;
};

function Timeline({ order }: { order: Order }) {
    const steps: Step[] = buildSteps(order);
    return (
        <ol className="space-y-3">
            {steps.map((s, i) => {
                const tone =
                    s.state === 'done' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                        : s.state === 'current' ? 'text-blue-600 bg-blue-50 border-blue-200'
                            : 'text-slate-400 bg-slate-50 border-slate-200';
                return (
                    <li key={i} className="flex items-start gap-3">
                        <div className={`mt-0.5 w-7 h-7 shrink-0 rounded-full border flex items-center justify-center ${tone}`}>
                            <s.Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${s.state === 'todo' ? 'text-slate-400' : 'text-slate-900'}`}>
                                {s.label}
                            </p>
                            {s.detail && <p className="text-xs text-slate-500 mt-0.5">{s.detail}</p>}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

function buildSteps(order: Order): Step[] {
    const cancelled = order.status === 'cancelled';
    const paid = order.paymentStatus === 'paid';
    const confirmed = order.status === 'confirmed' || order.status === 'shipped' || order.status === 'completed';
    const shipped = order.status === 'shipped' || order.status === 'completed';

    if (cancelled) {
        return [
            { label: 'Order placed', state: 'done', Icon: Package, detail: new Date(order.createdAt).toLocaleString() },
            { label: 'Cancelled', state: 'current', Icon: XCircle },
        ];
    }

    return [
        {
            label: 'Order placed',
            state: 'done',
            Icon: Package,
            detail: new Date(order.createdAt).toLocaleString(),
        },
        {
            label: paid ? 'Payment received' : order.paymentMethod === 'etransfer' ? 'Awaiting e-Transfer' : 'Payment processing',
            state: paid ? 'done' : 'current',
            Icon: paid ? CheckCircle2 : order.paymentMethod === 'etransfer' ? Mail : Loader2,
        },
        {
            label: confirmed ? 'Confirmed by merchant' : 'Confirmation pending',
            state: confirmed ? 'done' : paid ? 'current' : 'todo',
            Icon: CheckCircle2,
        },
        {
            label: shipped ? 'Shipped' : 'Awaiting shipment',
            state: shipped ? 'done' : confirmed ? 'current' : 'todo',
            Icon: Truck,
            detail: shipped && order.trackingCarrier ? order.trackingCarrier : undefined,
        },
    ];
}
