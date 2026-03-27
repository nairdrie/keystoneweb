'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calendar, Clock, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface BookingDetails {
    id: string;
    booking_date: string;
    start_time: string;
    status: string;
    customer_name: string;
    customer_email: string;
    service: { name: string; duration_minutes: number } | null;
}

type PageState =
    | { type: 'loading' }
    | { type: 'error'; message: string }
    | { type: 'ready'; booking: BookingDetails; noticeHours: number }
    | { type: 'too_late'; booking: BookingDetails; noticeHours: number; hoursUntilAppointment: number }
    | { type: 'disabled'; booking: BookingDetails }
    | { type: 'already_cancelled' }
    | { type: 'cancelled' };

export default function BookingCancelPage() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [state, setState] = useState<PageState>({ type: 'loading' });
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        if (!token) {
            setState({ type: 'error', message: 'Invalid cancellation link.' });
            return;
        }
        fetch(`/api/bookings/cancel?token=${token}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    setState({ type: 'error', message: data.error });
                    return;
                }
                if (data.alreadyCancelled) {
                    setState({ type: 'already_cancelled' });
                    return;
                }
                if (data.reason === 'disabled') {
                    setState({ type: 'disabled', booking: data.booking });
                    return;
                }
                if (!data.canCancel) {
                    setState({
                        type: 'too_late',
                        booking: data.booking,
                        noticeHours: data.noticeHours,
                        hoursUntilAppointment: data.hoursUntilAppointment,
                    });
                    return;
                }
                setState({ type: 'ready', booking: data.booking, noticeHours: data.noticeHours });
            })
            .catch(() => setState({ type: 'error', message: 'Something went wrong. Please try again.' }));
    }, [token]);

    const handleCancel = async () => {
        if (!token) return;
        setConfirming(true);
        try {
            const res = await fetch('/api/bookings/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const data = await res.json();
            if (data.success) {
                setState({ type: 'cancelled' });
            } else {
                setState({ type: 'error', message: data.error || 'Failed to cancel booking.' });
            }
        } catch {
            setState({ type: 'error', message: 'Something went wrong. Please try again.' });
        } finally {
            setConfirming(false);
        }
    };

    const formatDate = (dateStr: string) =>
        new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        });

    const formatTime = (t: string) => {
        const [hh, mm] = t.split(':').map(Number);
        const period = hh >= 12 ? 'PM' : 'AM';
        const dh = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
        return `${dh}:${mm.toString().padStart(2, '0')} ${period}`;
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {state.type === 'loading' && (
                    <div className="text-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400 mb-3" />
                        <p className="text-sm text-slate-500">Loading booking details…</p>
                    </div>
                )}

                {state.type === 'error' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <XCircle className="w-6 h-6 text-red-500" />
                        </div>
                        <h1 className="text-lg font-bold text-slate-900 mb-2">Invalid Link</h1>
                        <p className="text-sm text-slate-500">{state.message}</p>
                    </div>
                )}

                {state.type === 'already_cancelled' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <XCircle className="w-6 h-6 text-slate-400" />
                        </div>
                        <h1 className="text-lg font-bold text-slate-900 mb-2">Already Cancelled</h1>
                        <p className="text-sm text-slate-500">This booking has already been cancelled.</p>
                    </div>
                )}

                {state.type === 'cancelled' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                        </div>
                        <h1 className="text-lg font-bold text-slate-900 mb-2">Booking Cancelled</h1>
                        <p className="text-sm text-slate-500">Your booking has been cancelled and a confirmation email has been sent.</p>
                    </div>
                )}

                {state.type === 'disabled' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                        </div>
                        <h1 className="text-lg font-bold text-slate-900 mb-2">Online Cancellation Unavailable</h1>
                        <p className="text-sm text-slate-500 mb-4">
                            This business does not allow online cancellations. Please contact them directly to cancel your appointment.
                        </p>
                        <BookingCard booking={state.booking} formatDate={formatDate} formatTime={formatTime} />
                    </div>
                )}

                {state.type === 'too_late' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                        <div className="text-center mb-5">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Clock className="w-6 h-6 text-amber-500" />
                            </div>
                            <h1 className="text-lg font-bold text-slate-900 mb-2">Cancellation Window Passed</h1>
                            <p className="text-sm text-slate-500">
                                Cancellations must be made at least <strong>{state.noticeHours} hours</strong> before the appointment.
                                Your appointment is in <strong>{state.hoursUntilAppointment} hour{state.hoursUntilAppointment !== 1 ? 's' : ''}</strong>.
                                Please contact the business directly.
                            </p>
                        </div>
                        <BookingCard booking={state.booking} formatDate={formatDate} formatTime={formatTime} />
                    </div>
                )}

                {state.type === 'ready' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                        <div className="text-center mb-5">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Calendar className="w-6 h-6 text-red-500" />
                            </div>
                            <h1 className="text-lg font-bold text-slate-900 mb-1">Cancel Your Booking</h1>
                            <p className="text-sm text-slate-500">Are you sure you want to cancel this appointment?</p>
                        </div>

                        <BookingCard booking={state.booking} formatDate={formatDate} formatTime={formatTime} />

                        <div className="mt-5 space-y-2">
                            <button
                                onClick={handleCancel}
                                disabled={confirming}
                                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                            >
                                {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Yes, Cancel My Booking
                            </button>
                            <p className="text-xs text-center text-slate-400">
                                Cancellations must be made at least {state.noticeHours} hour{state.noticeHours !== 1 ? 's' : ''} before your appointment.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function BookingCard({ booking, formatDate, formatTime }: {
    booking: BookingDetails;
    formatDate: (d: string) => string;
    formatTime: (t: string) => string;
}) {
    return (
        <div className="bg-slate-50 rounded-xl p-4 text-sm">
            <p className="font-semibold text-slate-900 mb-2">{booking.service?.name ?? 'Appointment'}</p>
            <div className="space-y-1 text-slate-600">
                <p>{formatDate(booking.booking_date)}</p>
                <p>{formatTime(booking.start_time)}{booking.service ? ` · ${booking.service.duration_minutes} min` : ''}</p>
                <p className="text-slate-500 text-xs mt-1">Ref: {booking.id.slice(0, 8).toUpperCase()}</p>
            </div>
        </div>
    );
}
