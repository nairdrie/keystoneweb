import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/payments/clover';

/**
 * POST /api/bookings/clover-session
 * Body: { siteId, serviceId, selectedOptionName?, selectedPriceCents?, date, startTime,
 *         customerName, customerEmail, customerPhone?, notes?, returnUrl }
 *
 * Creates a Clover Hosted Checkout session for a booking. On payment completion,
 * the Clover webhook (/api/clover/webhook) handles creating the booking row.
 *
 * Since the Clover webhook is shared between orders and bookings, we store
 * pending booking details in a temporary row so the webhook can retrieve them.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const {
            siteId, serviceId, selectedOptionName, selectedPriceCents,
            date, startTime, customerName, customerEmail, customerPhone, notes, returnUrl,
        } = body;

        if (!siteId || !serviceId || !date || !startTime || !customerName || !customerEmail) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const admin = createAdminClient();
        const { data: site } = await admin
            .from('sites')
            .select('clover_merchant_id, clover_private_token, clover_sandbox_mode')
            .eq('id', siteId)
            .single();

        if (!site?.clover_merchant_id || !site?.clover_private_token) {
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

        const itemName = selectedOptionName ? `${service.name} — ${selectedOptionName}` : service.name;
        const [firstName, ...lastNameParts] = (customerName || '').split(' ');

        const session = await createCheckoutSession(
            {
                merchantId: site.clover_merchant_id,
                privateToken: site.clover_private_token,
                sandboxMode: !!site.clover_sandbox_mode,
            },
            {
                customer: {
                    email: customerEmail,
                    firstName,
                    lastName: lastNameParts.join(' ') || undefined,
                    phoneNumber: customerPhone || undefined,
                },
                lineItems: [{
                    name: itemName,
                    price: priceCents,
                    unitQty: 1,
                }],
                shippingCents: 0,
                tipsEnabled: false,
            }
        );

        // Store pending booking metadata keyed by checkout session ID so the
        // webhook can create the booking row upon payment confirmation.
        // We use a lightweight approach: store in the bookings table with status='pending'.
        const [h, m] = startTime.split(':').map(Number);
        const startMinutes = h * 60 + m;
        const endMinutes = startMinutes + service.duration_minutes;
        const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

        await admin
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
                clover_checkout_session_id: session.checkoutSessionId,
                notes: notes || null,
                selected_option_name: selectedOptionName || null,
                total_price_cents: priceCents,
            });

        return NextResponse.json({
            href: session.href,
            checkoutSessionId: session.checkoutSessionId,
        });
    } catch (err: any) {
        console.error('Booking Clover session error:', err);
        return NextResponse.json({ error: err.message || 'Failed to create Clover checkout session' }, { status: 500 });
    }
}
