import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { sendCustomerPaymentConfirmed, sendBookingCancellationToCustomer, sendBookingCancellationToOwner } from '@/lib/email';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';

/**
 * GET /api/bookings/manage?siteId=...&status=...&from=...&to=...
 * List bookings for a site (authenticated owner only)
 * 
 * PUT /api/bookings/manage
 * Update booking status (confirm, cancel)
 */

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    const status = request.nextUrl.searchParams.get('status');
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');

    let access;
    try {
        access = await requireSiteAccess(siteId, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

    let query = supabase
        .from('bookings')
        .select(`
            *,
            service:booking_services(name, duration_minutes, price_cents, currency)
        `)
        .eq('site_id', siteId)
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true });

    if (status) {
        query = query.eq('status', status);
    }
    if (from) {
        query = query.gte('booking_date', from);
    }
    if (to) {
        query = query.lte('booking_date', to);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bookings: data });
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    const { bookingId, status, payment_status, cancellationReason } = body;

    if (!bookingId) {
        return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
    }

    // Resolve booking → site for the access check.
    const adminLookup = createAdminClient();
    const { data: bookingSiteRow } = await adminLookup.from('bookings').select('site_id').eq('id', bookingId).single();
    if (!bookingSiteRow) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    let access;
    try {
        access = await requireSiteAccess(bookingSiteRow.site_id, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

    // Fetch the current booking before updating so we know prior state
    const { data: existingBooking } = await supabase
        .from('bookings')
        .select(`
            *,
            service:booking_services(name, duration_minutes, price_cents, currency)
        `)
        .eq('id', bookingId)
        .single();

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (payment_status) updates.payment_status = payment_status;
    if (cancellationReason) updates.cancellation_reason = cancellationReason;

    const { data, error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', bookingId)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formatTime = (t: string) => {
        const [hh, mm] = t.split(':').map(Number);
        const period = hh >= 12 ? 'PM' : 'AM';
        const displayHour = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
        return `${displayHour}:${mm.toString().padStart(2, '0')} ${period}`;
    };

    // Fetch site name + logo for customer-facing emails
    let siteName: string | undefined;
    let manageSiteLogoUrl: string | undefined;
    const manageSiteId = existingBooking?.site_id;
    if (manageSiteId) {
        const { data: siteInfo } = await supabase
            .from('sites')
            .select('site_slug, design_data')
            .eq('id', manageSiteId)
            .single();
        siteName = siteInfo?.site_slug || undefined;
        manageSiteLogoUrl = (siteInfo?.design_data as any)?.headerLogo || (siteInfo?.design_data as any)?.siteLogo || undefined;
    }

    // Send customer confirmation email when an e-transfer booking is confirmed
    // (was pending, now confirmed — owner has received the e-transfer)
    const isBeingConfirmed = status === 'confirmed' && existingBooking?.status !== 'confirmed';
    const isEtransfer = existingBooking?.payment_method === 'etransfer';

    if (isBeingConfirmed && isEtransfer && existingBooking) {
        const service = existingBooking.service as any;
        if (service && existingBooking.customer_email) {
            // Fetch settings for confirmation message
            const { data: settings } = await supabase
                .from('booking_settings')
                .select('confirmation_message')
                .eq('site_id', existingBooking.site_id)
                .single();

            const { data: bpcCustomRows } = await supabase
                .from('email_customizations')
                .select('email_key, overrides')
                .eq('site_id', existingBooking.site_id)
                .eq('email_key', 'booking_payment_confirmed');
            const bpcOverrides = bpcCustomRows?.[0]?.overrides;

            sendCustomerPaymentConfirmed({
                serviceName: service.name,
                selectedOptionName: existingBooking.selected_option_name || undefined,
                date: existingBooking.booking_date,
                startTime: formatTime(existingBooking.start_time),
                duration: service.duration_minutes,
                priceCents: existingBooking.total_price_cents ?? service.price_cents,
                currency: service.currency,
                customerName: existingBooking.customer_name,
                customerEmail: existingBooking.customer_email,
                customerPhone: existingBooking.customer_phone,
                notes: existingBooking.notes,
                bookingId: existingBooking.id,
                paymentMethod: existingBooking.payment_method,
                confirmationMessage: settings?.confirmation_message,
                siteName,
                logoUrl: manageSiteLogoUrl,
                overrides: bpcOverrides,
            }).catch(err => console.error('Customer payment confirmed email failed:', err));
        }
    }

    // Send cancellation emails when merchant cancels a booking
    const isBeingCancelled = status === 'cancelled' && existingBooking?.status !== 'cancelled';

    if (isBeingCancelled && existingBooking) {
        const service = existingBooking.service as any;

        const { data: settings } = await supabase
            .from('booking_settings')
            .select('notification_email')
            .eq('site_id', existingBooking.site_id)
            .single();

        const { data: mCancelCustomRows } = await supabase
            .from('email_customizations')
            .select('email_key, overrides')
            .eq('site_id', existingBooking.site_id)
            .eq('email_key', 'booking_cancelled');
        const mCancelOverrides = mCancelCustomRows?.[0]?.overrides;

        const emailData = {
            serviceName: service?.name ?? 'Appointment',
            date: existingBooking.booking_date,
            startTime: formatTime(existingBooking.start_time),
            customerName: existingBooking.customer_name,
            customerEmail: existingBooking.customer_email,
            bookingId: existingBooking.id,
            cancellationReason: cancellationReason || undefined,
            cancelledBy: 'merchant' as const,
            siteName,
            logoUrl: manageSiteLogoUrl,
            overrides: mCancelOverrides,
        };

        if (existingBooking.customer_email) {
            sendBookingCancellationToCustomer(emailData)
                .catch(err => console.error('Customer cancellation email failed:', err));
        }

        if (settings?.notification_email) {
            sendBookingCancellationToOwner(emailData, settings.notification_email)
                .catch(err => console.error('Owner cancellation email failed:', err));
        }
    }

    return NextResponse.json({ booking: data });
}
