import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { sendBookingCancellationToCustomer, sendBookingCancellationToOwner } from '@/lib/email';

/**
 * GET /api/bookings/cancel?token=...
 * Fetch booking details by cancellation token (for the cancel confirmation page).
 * Returns booking + service info + whether cancellation window is still open.
 *
 * POST /api/bookings/cancel
 * Cancel a booking by its cancellation token (public — no auth required).
 * Enforces the merchant's cancellation_notice_hours policy.
 */

export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
        return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: booking, error } = await supabase
        .from('bookings')
        .select(`
            id, site_id, booking_date, start_time, status, customer_name, customer_email,
            service:booking_services(name, duration_minutes, price_cents, currency)
        `)
        .eq('cancellation_token', token)
        .single();

    if (error || !booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status === 'cancelled') {
        return NextResponse.json({ booking, alreadyCancelled: true, canCancel: false });
    }

    // Check cancellation window
    const { data: settings } = await supabase
        .from('booking_settings')
        .select('cancellation_notice_hours')
        .eq('site_id', booking.site_id)
        .single();

    const noticeHours = settings?.cancellation_notice_hours ?? 24;

    if (noticeHours === 0) {
        return NextResponse.json({ booking, canCancel: false, reason: 'disabled' });
    }

    const appointmentDateTime = new Date(`${booking.booking_date}T${booking.start_time}`);
    const hoursUntilAppointment = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const canCancel = hoursUntilAppointment >= noticeHours;

    return NextResponse.json({
        booking,
        canCancel,
        noticeHours,
        hoursUntilAppointment: Math.floor(hoursUntilAppointment),
        reason: canCancel ? null : 'too_late',
    });
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { token } = body;

    if (!token) {
        return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch booking
    const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select(`
            id, site_id, booking_date, start_time, status, customer_name, customer_email,
            service:booking_services(name, duration_minutes)
        `)
        .eq('cancellation_token', token)
        .single();

    if (fetchError || !booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status === 'cancelled') {
        return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 409 });
    }

    // Enforce notice period
    const { data: settings } = await supabase
        .from('booking_settings')
        .select('cancellation_notice_hours, notification_email')
        .eq('site_id', booking.site_id)
        .single();

    const noticeHours = settings?.cancellation_notice_hours ?? 24;

    if (noticeHours === 0) {
        return NextResponse.json({ error: 'Online cancellation is disabled for this business' }, { status: 403 });
    }

    const appointmentDateTime = new Date(`${booking.booking_date}T${booking.start_time}`);
    const hoursUntilAppointment = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilAppointment < noticeHours) {
        return NextResponse.json({
            error: `Cancellations must be made at least ${noticeHours} hours in advance`,
        }, { status: 422 });
    }

    // Cancel the booking
    const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', cancellation_reason: 'Cancelled by customer', updated_at: new Date().toISOString() })
        .eq('id', booking.id);

    if (updateError) {
        return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
    }

    // Send cancellation emails (fire-and-forget)
    const service = booking.service as any;
    const formatTime = (t: string) => {
        const [hh, mm] = t.split(':').map(Number);
        const period = hh >= 12 ? 'PM' : 'AM';
        const displayHour = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
        return `${displayHour}:${mm.toString().padStart(2, '0')} ${period}`;
    };

    const emailData = {
        serviceName: service?.name ?? 'Appointment',
        date: booking.booking_date,
        startTime: formatTime(booking.start_time),
        customerName: booking.customer_name,
        customerEmail: booking.customer_email,
        bookingId: booking.id,
        cancelledBy: 'customer' as const,
    };

    sendBookingCancellationToCustomer(emailData)
        .catch(err => console.error('Customer cancellation email failed:', err));

    if (settings?.notification_email) {
        sendBookingCancellationToOwner(emailData, settings.notification_email)
            .catch(err => console.error('Owner cancellation email failed:', err));
    }

    return NextResponse.json({ success: true });
}
