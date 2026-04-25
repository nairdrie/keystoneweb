'use client';

import { useState, useEffect } from 'react';
import {
    Package, Loader2, ChevronDown, ChevronRight, Clock,
    CheckCircle2, Truck, XCircle, DollarSign, Mail, Phone, MapPin, AlertTriangle, Download
} from 'lucide-react';

interface Order {
    id: string;
    items: Array<{ name: string; price_cents: number; qty: number; variants?: Record<string, string> }>;
    subtotal_cents: number;
    shipping_cents: number;
    shipping_method: string | null;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    shipping_address: { line1?: string; city?: string; region?: string; province?: string; postal?: string; country?: string } | null;
    status: 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';
    payment_method: 'none' | 'etransfer' | 'stripe';
    payment_status: 'unpaid' | 'pending' | 'paid';
    notes: string | null;
    tracking_number: string | null;
    tracking_carrier: string | null;
    tax_cents: number | null;
    tax_label: string | null;
    created_at: string;
}

const STATUS_CONFIG = {
    pending: { label: 'Pending', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
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

interface OrdersPanelProps {
    siteId: string;
}

export default function OrdersPanel({ siteId }: OrdersPanelProps) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    // Cancel reason modal
    const [cancelTarget, setCancelTarget] = useState<string | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelling, setCancelling] = useState(false);
    // Ship (tracking) modal
    const [shipTarget, setShipTarget] = useState<string | null>(null);
    const [shipCarrier, setShipCarrier] = useState('');
    const [shipTracking, setShipTracking] = useState('');
    const [shipping, setShipping] = useState(false);

    useEffect(() => {
        if (!expanded) return;
        loadOrders();
    }, [siteId, expanded]);

    const loadOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/products/orders?siteId=${siteId}`);
            const data = await res.json();
            setOrders(data.orders || []);
        } catch (err) {
            console.error('Failed to load orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateOrder = async (orderId: string, updates: { status?: string; payment_status?: string; cancellationReason?: string; tracking_number?: string; tracking_carrier?: string }) => {
        setUpdatingId(orderId);
        try {
            const res = await fetch('/api/products/orders', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, ...updates }),
            });
            const data = await res.json();
            if (data.order) {
                setOrders(orders.map(o => o.id === orderId ? data.order : o));
            }
        } catch (err) {
            console.error('Failed to update order:', err);
        } finally {
            setUpdatingId(null);
        }
    };

    const handleCancelConfirm = async () => {
        if (!cancelTarget) return;
        setCancelling(true);
        await updateOrder(cancelTarget, { status: 'cancelled', cancellationReason: cancelReason || undefined });
        setCancelling(false);
        setCancelTarget(null);
        setCancelReason('');
    };

    const handleShipConfirm = async () => {
        if (!shipTarget) return;
        setShipping(true);
        await updateOrder(shipTarget, {
            status: 'shipped',
            tracking_number: shipTracking.trim() || undefined,
            tracking_carrier: shipCarrier.trim() || undefined,
        });
        setShipping(false);
        setShipTarget(null);
        setShipTracking('');
        setShipCarrier('');
    };

    const filteredOrders = filterStatus === 'all'
        ? orders
        : orders.filter(o => o.status === filterStatus);

    return (
        <>
        {/* Tracking number modal (Mark Shipped) */}
        {shipTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Truck className="w-5 h-5 text-violet-500 flex-shrink-0" />
                        <h3 className="text-sm font-bold text-slate-900">Mark Shipped</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">
                        Add tracking info (optional) — the customer will receive a shipping notification email with a link to the carrier's tracker.
                    </p>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Carrier</label>
                    <input
                        type="text"
                        value={shipCarrier}
                        onChange={e => setShipCarrier(e.target.value)}
                        placeholder="Canada Post, UPS, FedEx..."
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Tracking number</label>
                    <input
                        type="text"
                        value={shipTracking}
                        onChange={e => setShipTracking(e.target.value)}
                        placeholder="e.g. 1Z999AA10123456784"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-violet-400 font-mono"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setShipTarget(null); setShipCarrier(''); setShipTracking(''); }}
                            className="flex-1 px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleShipConfirm}
                            disabled={shipping}
                            className="flex-1 px-3 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                            {shipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                            Mark Shipped
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Cancel / Refund reason modal */}
        {cancelTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <h3 className="text-sm font-bold text-slate-900">Cancel Order</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">
                        A cancellation email will be sent to the customer. If this order was paid by card, a Stripe refund will be issued automatically.
                    </p>
                    <textarea
                        value={cancelReason}
                        onChange={e => setCancelReason(e.target.value)}
                        placeholder="Reason (optional)"
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-400 mb-3"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setCancelTarget(null); setCancelReason(''); }}
                            className="flex-1 px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                        >
                            Keep Order
                        </button>
                        <button
                            onClick={handleCancelConfirm}
                            disabled={cancelling}
                            className="flex-1 px-3 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                            {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Confirm Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Package className="w-4 h-4 text-slate-500" />
                    Orders {orders.length > 0 && `(${orders.length})`}
                </span>
                {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {expanded && (
                <div className="border-t border-slate-200">
                    {loading ? (
                        <div className="py-8 text-center">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-sm">
                            No orders yet
                        </div>
                    ) : (
                        <>
                            {/* Filter tabs + export */}
                            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                                <div className="flex gap-1 overflow-x-auto flex-1">
                                    {['all', 'pending', 'confirmed', 'shipped', 'completed', 'cancelled'].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setFilterStatus(s)}
                                            className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                                                filterStatus === s
                                                    ? 'bg-slate-800 text-white'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                            }`}
                                        >
                                            {s === 'all' ? `All (${orders.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${orders.filter(o => o.status === s).length})`}
                                        </button>
                                    ))}
                                </div>
                                <a
                                    href={`/api/products/orders/export?siteId=${siteId}`}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
                                    title="Export orders to CSV"
                                >
                                    <Download className="w-3 h-3" />
                                    Export
                                </a>
                            </div>

                            {/* Order list */}
                            <div className="px-4 pb-4 space-y-2 max-h-[400px] overflow-y-auto">
                                {filteredOrders.map(order => {
                                    const sc = STATUS_CONFIG[order.status];
                                    const ps = PAYMENT_STATUS_LABELS[order.payment_status];
                                    const StatusIcon = sc.icon;
                                    const isOpen = expandedOrder === order.id;
                                    const orderTotal = order.subtotal_cents + (order.shipping_cents || 0) + (order.tax_cents || 0);
                                    const total = `$${(orderTotal / 100).toFixed(2)}`;
                                    const refId = `ORDER-${order.id.slice(0, 8).toUpperCase()}`;
                                    const date = new Date(order.created_at).toLocaleDateString('en-US', {
                                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                    });

                                    return (
                                        <div key={order.id} className={`border rounded-lg overflow-hidden ${sc.bg}`}>
                                            <button
                                                onClick={() => setExpandedOrder(isOpen ? null : order.id)}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
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
                                                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                            </button>

                                            {isOpen && (
                                                <div className="px-3 pb-3 space-y-3 border-t border-slate-200/50">
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

                                                    {/* Shipping + totals */}
                                                    {(order.shipping_cents > 0 || order.shipping_method) && (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-600 flex items-center gap-1">
                                                                <Truck className="w-3 h-3" />
                                                                Shipping{order.shipping_method ? ` (${order.shipping_method})` : ''}
                                                            </span>
                                                            <span className="text-slate-900 font-medium">
                                                                {order.shipping_cents > 0 ? `$${(order.shipping_cents / 100).toFixed(2)}` : 'Free'}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {order.tax_cents && order.tax_cents > 0 ? (
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-600">{order.tax_label || 'Tax'}</span>
                                                            <span className="text-slate-900 font-medium">${(order.tax_cents / 100).toFixed(2)}</span>
                                                        </div>
                                                    ) : null}

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

                                                    {/* Payment info */}
                                                    <div>
                                                        <p className="text-xs font-semibold text-slate-600 mb-1">Payment</p>
                                                        <p className="text-xs text-slate-700">
                                                            Method: {order.payment_method === 'etransfer' ? 'Interac e-Transfer' : order.payment_method === 'stripe' ? 'Stripe' : order.payment_method}
                                                        </p>
                                                    </div>

                                                    {/* Tracking info */}
                                                    {order.tracking_number && (
                                                        <div>
                                                            <p className="text-xs font-semibold text-slate-600 mb-1">Tracking</p>
                                                            <p className="text-xs text-slate-700 flex items-center gap-1">
                                                                <Truck className="w-3 h-3 text-slate-400" />
                                                                {order.tracking_carrier ? `${order.tracking_carrier} · ` : ''}
                                                                <span className="font-mono">{order.tracking_number}</span>
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Customer notes */}
                                                    {order.notes && (
                                                        <div>
                                                            <p className="text-xs font-semibold text-slate-600 mb-1">Customer notes</p>
                                                            <p className="text-xs text-slate-700 whitespace-pre-wrap">{order.notes}</p>
                                                        </div>
                                                    )}

                                                    {/* Actions */}
                                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                                        {/* Combined Mark Paid & Confirm for e-transfer pending orders */}
                                                        {order.payment_method === 'etransfer' && order.payment_status !== 'paid' && order.status === 'pending' && (
                                                            <button
                                                                onClick={() => updateOrder(order.id, { status: 'confirmed', payment_status: 'paid' })}
                                                                disabled={updatingId === order.id}
                                                                className="px-2.5 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                                            >
                                                                {updatingId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                                                                Mark Paid & Confirm
                                                            </button>
                                                        )}
                                                        {/* Separate Mark Paid for non-etransfer or already confirmed orders */}
                                                        {order.payment_status !== 'paid' && !(order.payment_method === 'etransfer' && order.status === 'pending') && (
                                                            <button
                                                                onClick={() => updateOrder(order.id, { payment_status: 'paid' })}
                                                                disabled={updatingId === order.id}
                                                                className="px-2.5 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                                            >
                                                                {updatingId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                                                                Mark Paid
                                                            </button>
                                                        )}
                                                        {/* Separate Confirm for non-etransfer pending orders */}
                                                        {order.status === 'pending' && order.payment_method !== 'etransfer' && (
                                                            <button
                                                                onClick={() => updateOrder(order.id, { status: 'confirmed' })}
                                                                disabled={updatingId === order.id}
                                                                className="px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                                            >
                                                                Confirm
                                                            </button>
                                                        )}
                                                        {order.status === 'confirmed' && (
                                                            <button
                                                                onClick={() => { setShipTarget(order.id); setShipCarrier(order.tracking_carrier || ''); setShipTracking(order.tracking_number || ''); }}
                                                                disabled={updatingId === order.id}
                                                                className="px-2.5 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                                                            >
                                                                Mark Shipped
                                                            </button>
                                                        )}
                                                        {(order.status === 'shipped' || order.status === 'confirmed') && (
                                                            <button
                                                                onClick={() => updateOrder(order.id, { status: 'completed' })}
                                                                disabled={updatingId === order.id}
                                                                className="px-2.5 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                                            >
                                                                Complete
                                                            </button>
                                                        )}
                                                        {order.status !== 'cancelled' && order.status !== 'completed' && (
                                                            <button
                                                                onClick={() => setCancelTarget(order.id)}
                                                                disabled={updatingId === order.id}
                                                                className="px-2.5 py-1.5 text-xs font-medium bg-red-100 text-red-600 rounded-lg hover:bg-red-200 disabled:opacity-50"
                                                            >
                                                                Cancel / Refund
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {filteredOrders.length === 0 && (
                                    <p className="text-center text-slate-400 text-sm py-4">No orders matching this filter</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
        </>
    );
}
