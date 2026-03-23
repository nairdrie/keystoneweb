import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { sendCustomerPaymentConfirmed } from '@/lib/email';

/**
 * GET /api/bookings/manage?siteId=...&status=...&from=...&to=...
 * List bookings for a site (authenticated owner only)
 * 
 * PUT /api/bookings/manage
 * Update booking status (confirm, cancel)
 */

export async function GET(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = request.nextUrl.searchParams.get('siteId');
    const status = request.nextUrl.searchParams.get('status');
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');

    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, status, payment_status } = body;

    if (!bookingId) {
        return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
    }

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

    const { data, error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', bookingId)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
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

            const formatTime = (t: string) => {
                const [hh, mm] = t.split(':').map(Number);
                const period = hh >= 12 ? 'PM' : 'AM';
                const displayHour = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
                return `${displayHour}:${mm.toString().padStart(2, '0')} ${period}`;
            };

            sendCustomerPaymentConfirmed({
                serviceName: service.name,
                date: existingBooking.booking_date,
                startTime: formatTime(existingBooking.start_time),
                duration: service.duration_minutes,
                priceCents: service.price_cents,
                currency: service.currency,
                customerName: existingBooking.customer_name,
                customerEmail: existingBooking.customer_email,
                customerPhone: existingBooking.customer_phone,
                notes: existingBooking.notes,
                bookingId: existingBooking.id,
                paymentMethod: existingBooking.payment_method,
                confirmationMessage: settings?.confirmation_message,
            }).catch(err => console.error('Customer payment confirmed email failed:', err));
        }
    }

    return NextResponse.json({ booking: data });
}
