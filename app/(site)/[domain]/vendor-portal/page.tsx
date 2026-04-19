'use client';

import { useState, useEffect } from 'react';
import { Package, Loader2, CheckCircle2, Truck, Clock, XCircle, Mail, Phone, MapPin, DollarSign, ChevronDown, ChevronRight } from 'lucide-react';

interface VendorOrder {
    id: string;
    items: Array<{ name: string; price_cents: number; qty: number; variants?: Record<string, string> }>;
    subtotal_cents: number;
    shipping_cents: number;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    shipping_address: any;
    status: string;
    payment_method: string;
    payment_status: string;
    created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    pending: { label: 'Pending', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    pending_external: { label: 'Awaiting Payment', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
    confirmed: { label: 'Confirmed', icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
    shipped: { label: 'Shipped', icon: Truck, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
    completed: { label: 'Completed', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
    cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    unpaid: { label: 'Unpaid', cls: 'text-red-600 bg-red-50' },
    pending: { label: 'Payment Pending', cls: 'text-amber-600 bg-amber-50' },
    paid: { label: 'Paid', cls: 'text-green-600 bg-green-50' },
};

export default function VendorPortalPage() {
    const [token, setToken] = useState<string | null>(null);
    const [vendor, setVendor] = useState<{ id: string; name: string; contact_email: string } | null>(null);
    const [siteName, setSiteName] = useState('Store');
    const [orders, setOrders] = useState<VendorOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('token');
        setToken(t);

        if (!t) {
            setError('Missing portal access token');
            setLoading(false);
            return;
        }

        (async () => {
            try {
                const res = await fetch(`/api/vendor-portal?token=${t}`);
                const data = await res.json();
                if (!res.ok) {
                    setError(data.error || 'Failed to load portal');
                    return;
                }
                setVendor(data.vendor);
                setSiteName(data.siteName);
                setOrders(data.orders);
            } catch (err) {
                setError('Failed to connect to portal');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const updateOrder = async (orderId: string, updates: { status?: string; payment_status?: string }) => {
        if (!token) return;
        setUpdatingId(orderId);
        try {
            const res = await fetch('/api/vendor-portal', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, orderId, ...updates }),
            });
            const data = await res.json();
            if (data.order) {
                setOrders(orders.map((o: VendorOrder) => o.id === orderId ? data.order : o));
            }
        } catch (err) {
            console.error('Failed to update order:', err);
        } finally {
            setUpdatingId(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <XCircle className="w-12 h-12 mx-auto text-red-400 mb-3" />
                    <h1 className="text-lg font-bold text-slate-900 mb-1">Access Error</h1>
                    <p className="text-slate-500">{error}</p>
                </div>
            </div>
        );
    }

    const pendingOrders = orders.filter((o: VendorOrder) => o.status === 'pending_external' || (o.status === 'pending' && o.payment_status !== 'paid'));
    const activeOrders = orders.filter((o: VendorOrder) => ['confirmed', 'shipped'].includes(o.status));
    const completedOrders = orders.filter((o: VendorOrder) => ['completed', 'cancelled'].includes(o.status));

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-xl font-bold text-slate-900">Vendor Portal</h1>
                    <p className="text-sm text-slate-500">{vendor?.name} — Orders from {siteName}</p>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-6 space-y-6">
                {/* Action Required */}
                {pendingOrders.length > 0 && (
                    <div>
                        <h2 className="text-sm font-bold text-orange-700 mb-2 flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            Action Required ({pendingOrders.length})
                        </h2>
                        <div className="space-y-2">
                            {pendingOrders.map(order => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    expanded={expandedOrder === order.id}
                                    onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                    onUpdate={updateOrder}
                                    updatingId={updatingId}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Active Orders */}
                {activeOrders.length > 0 && (
                    <div>
                        <h2 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-1.5">
                            <Package className="w-4 h-4" />
                            Active Orders ({activeOrders.length})
                        </h2>
                        <div className="space-y-2">
                            {activeOrders.map(order => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    expanded={expandedOrder === order.id}
                                    onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                    onUpdate={updateOrder}
                                    updatingId={updatingId}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Completed */}
                {completedOrders.length > 0 && (
                    <div>
                        <h2 className="text-sm font-bold text-green-700 mb-2 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            Completed ({completedOrders.length})
                        </h2>
                        <div className="space-y-2">
                            {completedOrders.map(order => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    expanded={expandedOrder === order.id}
                                    onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                    onUpdate={updateOrder}
                                    updatingId={updatingId}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {orders.length === 0 && (
                    <div className="text-center py-12">
                        <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-500 font-medium">No orders yet</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function OrderCard({ order, expanded, onToggle, onUpdate, updatingId }: {
    order: VendorOrder;
    expanded: boolean;
    onToggle: () => void;
    onUpdate: (orderId: string, updates: { status?: string; payment_status?: string }) => void;
    updatingId: string | null;
}) {
    const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    const ps = PAYMENT_STATUS_LABELS[order.payment_status];
    const StatusIcon = sc.icon;
    const orderTotal = order.subtotal_cents + (order.shipping_cents || 0);
    const total = `$${(orderTotal / 100).toFixed(2)}`;
    const refId = `ORDER-${order.id.slice(0, 8).toUpperCase()}`;
    const date = new Date(order.created_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    const isUpdating = updatingId === order.id;

    return (
        <div className={`border rounded-lg overflow-hidden bg-white ${sc.bg}`}>
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
                <StatusIcon className={`w-4 h-4 flex-shrink-0 ${sc.color}`} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">{order.customer_name}</span>
                        <span className="text-xs font-bold text-slate-900">{total}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500 font-mono">{refId}</span>
                        <span className="text-xs text-slate-400">{date}</span>
                    </div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ps.cls}`}>
                    {ps.label}
                </span>
                {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-200/50">
                    {/* Items */}
                    <div className="pt-2">
                        <p className="text-xs font-semibold text-slate-600 mb-1">Items</p>
                        {order.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-xs py-0.5">
                                <span className="text-slate-700">
                                    {item.qty}x {item.name}
                                    {item.variants && Object.keys(item.variants).length > 0 && (
                                        <span className="text-slate-400 ml-1">({Object.values(item.variants).join(', ')})</span>
                                    )}
                                </span>
                                <span className="text-slate-900 font-medium">${(item.price_cents * item.qty / 100).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>

                    {/* Customer info */}
                    <div>
                        <p className="text-xs font-semibold text-slate-600 mb-1">Customer</p>
                        <div className="space-y-0.5 text-xs text-slate-700">
                            <p className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> {order.customer_email}</p>
                            {order.customer_phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {order.customer_phone}</p>}
                            {order.shipping_address && (
                                <p className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    {[order.shipping_address.line1, order.shipping_address.city, order.shipping_address.region || order.shipping_address.province, order.shipping_address.postal, order.shipping_address.country].filter(Boolean).join(', ')}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {(order.status === 'pending_external' || order.status === 'pending') && order.payment_status !== 'paid' && (
                            <button
                                onClick={() => onUpdate(order.id, { status: 'confirmed', payment_status: 'paid' })}
                                disabled={isUpdating}
                                className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                            >
                                {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                                Mark Paid & Confirm
                            </button>
                        )}
                        {order.status === 'confirmed' && (
                            <button
                                onClick={() => onUpdate(order.id, { status: 'shipped' })}
                                disabled={isUpdating}
                                className="px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1"
                            >
                                {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Truck className="w-3 h-3" />}
                                Mark Shipped
                            </button>
                        )}
                        {(order.status === 'shipped' || order.status === 'confirmed') && (
                            <button
                                onClick={() => onUpdate(order.id, { status: 'completed' })}
                                disabled={isUpdating}
                                className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                            >
                                {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                Complete
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
