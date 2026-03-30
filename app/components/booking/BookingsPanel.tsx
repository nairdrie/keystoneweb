'use client';

import { useState, useEffect } from 'react';
import {
    Calendar, Loader2, ChevronDown, ChevronRight, Clock,
    CheckCircle2, XCircle, Mail, Phone, AlertTriangle,
} from 'lucide-react';

interface Booking {
    id: string;
    booking_date: string;
    start_time: string;
    end_time: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    status: 'pending' | 'confirmed' | 'cancelled';
    payment_method: 'none' | 'etransfer' | 'stripe';
    payment_status: 'unpaid' | 'pending' | 'paid';
    notes: string | null;
    created_at: string;
    service: { name: string; duration_minutes: number; price_cents: number; currency: string } | null;
}

const STATUS_CONFIG = {
    pending: { label: 'Pending', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    confirmed: { label: 'Confirmed', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
    cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    unpaid: { label: 'Unpaid', cls: 'text-red-600 bg-red-50' },
    pending: { label: 'Awaiting Payment', cls: 'text-amber-600 bg-amber-50' },
    paid: { label: 'Paid', cls: 'text-green-600 bg-green-50' },
};

interface BookingsPanelProps {
    siteId: string;
}

export default function BookingsPanel({ siteId }: BookingsPanelProps) {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(true);
    const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('upcoming');
    // Cancel reason modal state
    const [cancelTarget, setCancelTarget] = useState<string | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        if (!expanded) return;
        loadBookings();
    }, [siteId, expanded]);

    const loadBookings = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/bookings/manage?siteId=${siteId}`);
            const data = await res.json();
            setBookings(data.bookings || []);
        } catch (err) {
            console.error('Failed to load bookings:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateBooking = async (bookingId: string, updates: { status?: string; payment_status?: string; cancellationReason?: string }) => {
        setUpdatingId(bookingId);
        try {
            const res = await fetch('/api/bookings/manage', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId, ...updates }),
            });
            const data = await res.json();
            if (data.booking) {
                setBookings(bookings.map(b => b.id === bookingId ? { ...b, ...data.booking } : b));
            }
        } catch (err) {
            console.error('Failed to update booking:', err);
        } finally {
            setUpdatingId(null);
        }
    };

    const handleCancelConfirm = async () => {
        if (!cancelTarget) return;
        setCancelling(true);
        await updateBooking(cancelTarget, { status: 'cancelled', cancellationReason: cancelReason || undefined });
        setCancelling(false);
        setCancelTarget(null);
        setCancelReason('');
    };

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    const isUpcoming = (b: Booking) => {
        if (b.status === 'cancelled') return false;
        if (b.booking_date > today) return true;
        if (b.booking_date < today) return false;
        // Same day — check if end time has passed
        const [hh, mm] = b.end_time.split(':').map(Number);
        const endTime = new Date(now);
        endTime.setHours(hh, mm, 0, 0);
        return now < endTime;
    };

    const filteredBookings = bookings.filter(b => {
        if (filterStatus === 'upcoming') return isUpcoming(b);
        if (filterStatus === 'past') return !isUpcoming(b) && b.status !== 'cancelled';
        return b.status === filterStatus;
    });

    const upcomingCount = bookings.filter(isUpcoming).length;

    return (
        <>
            {/* Cancel reason modal */}
            {cancelTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                            <h3 className="text-sm font-bold text-slate-900">Cancel Booking</h3>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                            A cancellation email will be sent to the customer. Optionally add a reason.
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
                                Keep Booking
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
                        <Calendar className="w-4 h-4 text-slate-500" />
                        Bookings {upcomingCount > 0 && `(${upcomingCount} upcoming)`}
                    </span>
                    {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>

                {expanded && (
                    <div className="border-t border-slate-200">
                        {loading ? (
                            <div className="py-8 text-center">
                                <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                            </div>
                        ) : bookings.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 text-sm">No bookings yet</div>
                        ) : (
                            <>
                                {/* Filter tabs */}
                                <div className="flex gap-1 px-4 pt-3 pb-2 overflow-x-auto">
                                    {[
                                        { id: 'upcoming', label: `Upcoming (${bookings.filter(isUpcoming).length})` },
                                        { id: 'past', label: `Past (${bookings.filter(b => !isUpcoming(b) && b.status !== 'cancelled').length})` },
                                        { id: 'cancelled', label: `Cancelled (${bookings.filter(b => b.status === 'cancelled').length})` },
                                    ].map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => setFilterStatus(f.id)}
                                            className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                                                filterStatus === f.id
                                                    ? 'bg-slate-800 text-white'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Booking list */}
                                <div className="px-4 pb-4 space-y-2 max-h-[450px] overflow-y-auto">
                                    {filteredBookings.length === 0 && (
                                        <p className="text-center text-slate-400 text-sm py-4">No bookings in this category</p>
                                    )}
                                    {filteredBookings.map(booking => {
                                        const sc = STATUS_CONFIG[booking.status];
                                        const ps = PAYMENT_STATUS_LABELS[booking.payment_status];
                                        const StatusIcon = sc.icon;
                                        const isOpen = expandedBooking === booking.id;
                                        const refId = booking.id.slice(0, 8).toUpperCase();
                                        const dateStr = new Date(booking.booking_date + 'T12:00:00').toLocaleDateString('en-US', {
                                            weekday: 'short', month: 'short', day: 'numeric',
                                        });
                                        const formatTime = (t: string) => {
                                            const [hh, mm] = t.split(':').map(Number);
                                            const period = hh >= 12 ? 'PM' : 'AM';
                                            const dh = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
                                            return `${dh}:${mm.toString().padStart(2, '0')} ${period}`;
                                        };

                                        return (
                                            <div key={booking.id} className={`border rounded-lg overflow-hidden ${sc.bg}`}>
                                                <button
                                                    onClick={() => setExpandedBooking(isOpen ? null : booking.id)}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                                                >
                                                    <StatusIcon className={`w-4 h-4 flex-shrink-0 ${sc.color}`} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-semibold text-slate-900 truncate">{booking.customer_name}</span>
                                                            <span className="text-xs text-slate-500 font-medium">{booking.service?.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-xs text-slate-600">{dateStr} · {formatTime(booking.start_time)}</span>
                                                            <span className="text-xs text-slate-400 font-mono">{refId}</span>
                                                        </div>
                                                    </div>
                                                    {booking.payment_method !== 'none' && (
                                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ps.cls}`}>
                                                            {ps.label}
                                                        </span>
                                                    )}
                                                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                                                </button>

                                                {isOpen && (
                                                    <div className="px-3 pb-3 space-y-3 border-t border-slate-200/50">
                                                        {/* Service + time */}
                                                        <div className="pt-2">
                                                            <p className="text-xs font-semibold text-slate-600 mb-1">Appointment</p>
                                                            <p className="text-xs text-slate-700">
                                                                {booking.service?.name} · {booking.service?.duration_minutes} min
                                                                {booking.service && booking.service.price_cents > 0
                                                                    ? ` · $${(booking.service.price_cents / 100).toFixed(2)} ${booking.service.currency}`
                                                                    : ''}
                                                            </p>
                                                            <p className="text-xs text-slate-600 mt-0.5">
                                                                {dateStr} · {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
                                                            </p>
                                                        </div>

                                                        {/* Customer info */}
                                                        <div>
                                                            <p className="text-xs font-semibold text-slate-600 mb-1">Customer</p>
                                                            <div className="space-y-0.5 text-xs text-slate-700">
                                                                <p className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> {booking.customer_email}</p>
                                                                {booking.customer_phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {booking.customer_phone}</p>}
                                                                {booking.notes && <p className="text-slate-500 italic mt-1">"{booking.notes}"</p>}
                                                            </div>
                                                        </div>

                                                        {/* Payment info */}
                                                        <div>
                                                            <p className="text-xs font-semibold text-slate-600 mb-1">Payment</p>
                                                            <p className="text-xs text-slate-700">
                                                                {booking.payment_method === 'etransfer' ? 'e-Transfer' : booking.payment_method === 'stripe' ? 'Stripe' : 'Pay at appointment'}
                                                                {' · '}{ps.label}
                                                            </p>
                                                        </div>

                                                        {/* Actions */}
                                                        {booking.status !== 'cancelled' && (
                                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                                {booking.status === 'pending' && (
                                                                    <button
                                                                        onClick={() => updateBooking(booking.id, { status: 'confirmed' })}
                                                                        disabled={updatingId === booking.id}
                                                                        className="px-2.5 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                                                    >
                                                                        {updatingId === booking.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                                                        Confirm
                                                                    </button>
                                                                )}
                                                                {booking.payment_status !== 'paid' && booking.payment_method !== 'none' && (
                                                                    <button
                                                                        onClick={() => updateBooking(booking.id, { status: 'confirmed', payment_status: 'paid' })}
                                                                        disabled={updatingId === booking.id}
                                                                        className="px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                                                    >
                                                                        Mark Paid & Confirm
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => setCancelTarget(booking.id)}
                                                                    disabled={updatingId === booking.id}
                                                                    className="px-2.5 py-1.5 text-xs font-medium bg-red-100 text-red-600 rounded-lg hover:bg-red-200 disabled:opacity-50"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
