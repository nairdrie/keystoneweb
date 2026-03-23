import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { sendCustomerConfirmation, sendOwnerNotification } from '@/lib/email';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover' as any,
});

/**
 * GET /api/bookings/stripe-success?session_id=...&siteId=...&serviceId=...&date=...&startTime=...&customerName=...&customerEmail=...&paymentMethod=stripe
 *
 * Called after a successful Stripe Checkout. Verifies the session payment,
 * creates the booking record, and redirects the user back to the site.
 */
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const sessionId = params.get('session_id');
    const siteId = params.get('siteId');
    const serviceId = params.get('serviceId');
    const date = params.get('date');
    const startTime = params.get('startTime');
    const customerName = params.get('customerName');
    const customerEmail = params.get('customerEmail');
    const customerPhone = params.get('customerPhone') || undefined;
    const notes = params.get('notes') || undefined;
    const selectedOptionName = params.get('selectedOptionName') || undefined;

    if (!sessionId || !siteId || !serviceId || !date || !startTime || !customerName || !customerEmail) {
        return NextResponse.redirect(
            new URL(`/?booking_error=missing_params`, request.url)
        );
    }

    const supabase = await createClient();

    // Get site's connected Stripe account to verify the session
    const { data: site } = await supabase
        .from('sites')
        .select('stripe_account_id, site_slug, published_domain')
        .eq('id', siteId)
        .single();

    if (!site?.stripe_account_id) {
        return NextResponse.redirect(new URL('/?booking_error=no_stripe', request.url));
    }

    // Verify the Stripe session is actually paid
    let checkoutSession;
    try {
        checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
            stripeAccount: site.stripe_account_id,
        });
    } catch {
        return NextResponse.redirect(new URL('/?booking_error=invalid_session', request.url));
    }

    if (checkoutSession.payment_status !== 'paid') {
        return NextResponse.redirect(new URL('/?booking_error=unpaid', request.url));
    }

    // Get service for duration + pricing
    const { data: service } = await supabase
        .from('booking_services')
        .select('*')
        .eq('id', serviceId)
        .single();

    if (!service) {
        return NextResponse.redirect(new URL('/?booking_error=no_service', request.url));
    }

    // Calculate end time
    const [h, m] = startTime.split(':').map(Number);
    const startMinutes = h * 60 + m;
    const endMinutes = startMinutes + service.duration_minutes;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

    // Get settings for buffer/notifications
    const { data: settings } = await supabase
        .from('booking_settings')
        .select('*')
        .eq('site_id', siteId)
        .single();

    // Check for conflict (race condition)
    const bufferMinutes = settings?.buffer_minutes ?? 15;
    const { data: conflictCheck } = await supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('site_id', siteId)
        .eq('booking_date', date)
        .in('status', ['pending', 'confirmed']);

    const timeConflict = (conflictCheck || []).some((b: any) => {
        const bStartMin = timeToMin(b.start_time);
        const bEndMin = timeToMin(b.end_time);
        return startMinutes < bEndMin + bufferMinutes && endMinutes + bufferMinutes > bStartMin;
    });

    if (timeConflict) {
        // Slot taken — ideally we'd refund but that's complex; show error
        return NextResponse.redirect(new URL('/?booking_error=slot_taken', request.url));
    }

    // Create the confirmed booking
    const stripePaymentId = checkoutSession.payment_intent as string;

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
            status: 'confirmed',
            payment_method: 'stripe',
            payment_status: 'paid',
            stripe_payment_id: stripePaymentId,
            notes: notes || null,
        })
        .select()
        .single();

    if (bookError) {
        console.error('Booking creation error after Stripe payment:', bookError);
        return NextResponse.redirect(new URL('/?booking_error=db_error', request.url));
    }

    // Send emails (fire-and-forget)
    const formatTime = (t: string) => {
        const [hh, mm] = t.split(':').map(Number);
        const period = hh >= 12 ? 'PM' : 'AM';
        const displayHour = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
        return `${displayHour}:${mm.toString().padStart(2, '0')} ${period}`;
    };

    const priceCents = checkoutSession.amount_total ?? service.price_cents;
    const serviceName = selectedOptionName
        ? `${service.name} — ${selectedOptionName}`
        : service.name;

    const emailData = {
        serviceName,
        date,
        startTime: formatTime(startTime),
        duration: service.duration_minutes,
        priceCents,
        currency: service.currency,
        customerName,
        customerEmail,
        customerPhone,
        notes,
        bookingId: booking.id,
        paymentMethod: 'stripe' as const,
        etransferEmail: undefined,
        confirmationMessage: settings?.confirmation_message,
    };

    sendCustomerConfirmation(emailData).catch(err => console.error('Customer email failed:', err));
    if (settings?.notification_email) {
        sendOwnerNotification(emailData, settings.notification_email)
            .catch(err => console.error('Owner email failed:', err));
    }

    // Build the redirect URL back to the site
    const siteBase = site.published_domain
        ? `https://${site.published_domain}`
        : process.env.NEXT_PUBLIC_APP_URL || '/';

    const successUrl = new URL(siteBase);
    successUrl.searchParams.set('booking_confirmed', booking.id.slice(0, 8).toUpperCase());

    return NextResponse.redirect(successUrl);
}

function timeToMin(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}
