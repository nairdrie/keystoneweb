import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { sendCustomerConfirmation, sendOwnerNotification } from '@/lib/email';

/**
 * POST /api/bookings/book
 * Create a new booking (public — no auth required, customers book directly)
 * 
 * Body: {
 *   siteId, serviceId, date (YYYY-MM-DD), startTime (HH:MM),
 *   customerName, customerEmail, customerPhone?, notes?,
 *   paymentMethod? ('none' | 'etransfer' | 'stripe')
 * }
 * 
 * - Validates the slot is still available (race condition protection)
 * - Creates the booking record
 * - Returns booking confirmation + payment instructions if applicable
 */

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    const body = await request.json();
    const {
        siteId, serviceId, date, startTime,
        customerName, customerEmail, customerPhone, notes,
        paymentMethod = 'none',
    } = body;

    // Validation
    if (!siteId || !serviceId || !date || !startTime || !customerName || !customerEmail) {
        return NextResponse.json(
            { error: 'Missing required fields: siteId, serviceId, date, startTime, customerName, customerEmail' },
            { status: 400 }
        );
    }

    // 1. Get service to calculate end time
    const { data: service, error: svcError } = await supabase
        .from('booking_services')
        .select('*')
        .eq('id', serviceId)
        .eq('is_active', true)
        .single();

    if (svcError || !service) {
        return NextResponse.json({ error: 'Service not found or inactive' }, { status: 404 });
    }

    // Calculate end time
    const [h, m] = startTime.split(':').map(Number);
    const startMinutes = h * 60 + m;
    const endMinutes = startMinutes + service.duration_minutes;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

    // 2. Get booking settings
    const { data: settings } = await supabase
        .from('booking_settings')
        .select('*')
        .eq('site_id', siteId)
        .single();

    const bufferMinutes = settings?.buffer_minutes ?? 15;

    // 3. Race condition check — is the slot still available?
    const { data: conflictCheck } = await supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('site_id', siteId)
        .eq('booking_date', date)
        .in('status', ['pending', 'confirmed']);

    const timeConflict = (conflictCheck || []).some((b: any) => {
        const bStartMin = timeToMin(b.start_time);
        const bEndMin = timeToMin(b.end_time);
        // Check overlap with buffer
        return startMinutes < bEndMin + bufferMinutes && endMinutes + bufferMinutes > bStartMin;
    });

    if (timeConflict) {
        return NextResponse.json(
            { error: 'This time slot is no longer available. Please choose another time.' },
            { status: 409 }
        );
    }

    // 4. Determine payment status
    let paymentStatus = 'unpaid';
    if (paymentMethod === 'none') {
        paymentStatus = 'paid'; // No payment required = treat as paid
    }

    // 5. Determine booking status
    const status = paymentMethod === 'none' ? 'confirmed' : 'pending';

    // 6. Create the booking
    const { data: booking, error: bookError } = await supabase
        .from('bookings')
        .insert({
            site_id: siteId,
            service_id: serviceId,
            booking_date: date,
            start_time: startTime,
            end_time: endTime,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone || null,
            status,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            notes: notes || null,
        })
        .select()
        .single();

    if (bookError) {
        console.error('Booking creation error:', bookError);
        return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
    }

    // 7. Build response with payment instructions if applicable
    const response: any = {
        booking,
        service: {
            name: service.name,
            duration_minutes: service.duration_minutes,
            price_cents: service.price_cents,
            currency: service.currency,
        },
        confirmationMessage: settings?.confirmation_message || 'Your booking has been confirmed!',
    };

    if (paymentMethod === 'etransfer' && settings?.etransfer_email) {
        response.paymentInstructions = {
            type: 'etransfer',
            email: settings.etransfer_email,
            amount: (service.price_cents / 100).toFixed(2),
            currency: service.currency,
            reference: `BOOKING-${booking.id.slice(0, 8).toUpperCase()}`,
        };
    }

    // 8. Send email notifications (best-effort, async)
    const formatTime = (t: string) => {
        const [hh, mm] = t.split(':').map(Number);
        const period = hh >= 12 ? 'PM' : 'AM';
        const displayHour = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
        return `${displayHour}:${mm.toString().padStart(2, '0')} ${period}`;
    };

    const emailData = {
        serviceName: service.name,
        date,
        startTime: formatTime(startTime),
        duration: service.duration_minutes,
        priceCents: service.price_cents,
        currency: service.currency,
        customerName,
        customerEmail,
        customerPhone,
        notes,
        bookingId: booking.id,
        paymentMethod,
        etransferEmail: settings?.etransfer_email,
        confirmationMessage: settings?.confirmation_message,
    };

    // Fire-and-forget: don't block the response
    sendCustomerConfirmation(emailData).catch(err => console.error('Customer email failed:', err));

    if (settings?.notification_email) {
        sendOwnerNotification(emailData, settings.notification_email)
            .catch(err => console.error('Owner email failed:', err));
    }

    return NextResponse.json(response);
}

function timeToMin(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}
