import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/bookings/clover-init
 * Body: { siteId, serviceId, selectedOptionName?, selectedPriceCents?,
 *         date, startTime, customerName, customerEmail, customerPhone?, notes? }
 *
 * Creates a pending booking row and returns the bookingId plus Clover SDK config
 * so the client can render the CloverIframe component and charge in-page.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const {
            siteId, serviceId, selectedOptionName, selectedPriceCents,
            date, startTime, customerName, customerEmail, customerPhone, notes,
        } = body;

        if (!siteId || !serviceId || !date || !startTime || !customerName || !customerEmail) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const admin = createAdminClient();

        const { data: site } = await admin
            .from('sites')
            .select('clover_merchant_id, clover_public_key, clover_sandbox_mode')
            .eq('id', siteId)
            .single();

        if (!site?.clover_merchant_id || !site?.clover_public_key) {
            return NextResponse.json({ error: 'Clover is not configured for this site' }, { status: 400 });
        }

        const { data: service } = await supabase
            .from('booking_services')
            .select('*')
            .eq('id', serviceId)
            .eq('is_active', true)
            .single();

        if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

        const priceCents = selectedPriceCents ?? service.price_cents;
        if (!priceCents || priceCents <= 0) {
            return NextResponse.json({ error: 'Cannot create payment for a free service' }, { status: 400 });
        }

        const [h, m] = startTime.split(':').map(Number);
        const startMinutes = h * 60 + m;
        const endMinutes = startMinutes + service.duration_minutes;
        const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

        const { data: booking, error: insertErr } = await admin
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
                status: 'pending',
                payment_method: 'clover',
                payment_status: 'unpaid',
                notes: notes || null,
                selected_option_name: selectedOptionName || null,
                total_price_cents: priceCents,
            })
            .select('id')
            .single();

        if (insertErr || !booking) {
            console.error('clover-init insert error:', insertErr);
            return NextResponse.json({ error: 'Failed to create pending booking' }, { status: 500 });
        }

        return NextResponse.json({
            bookingId: booking.id,
            publicKey: site.clover_public_key,
            merchantId: site.clover_merchant_id,
            sandboxMode: !!site.clover_sandbox_mode,
            amountCents: priceCents,
        });
    } catch (err: any) {
        console.error('Booking Clover init error:', err);
        return NextResponse.json({ error: err.message || 'Failed to initialize Clover payment' }, { status: 500 });
    }
}
