import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/clover/status?orderId=...        — lookup by order/booking id
 * GET /api/clover/status?ick=<sessionId>    — lookup by Clover hosted-checkout session id
 *                                             (Clover appends ?ick=... when redirecting back)
 *
 * Used by the post-redirect client screen while waiting for the Clover webhook
 * to mark the order paid.
 */
export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const orderId = request.nextUrl.searchParams.get('orderId');
    const ick = request.nextUrl.searchParams.get('ick');

    if (!orderId && !ick) {
        return NextResponse.json({ error: 'Missing orderId or ick' }, { status: 400 });
    }

    const orderCols = 'id, site_id, status, payment_status, payment_method, clover_charge_id, subtotal_cents, shipping_cents, customer_email';
    const bookingCols = 'id, site_id, status, payment_status, total_price_cents, customer_email';

    if (orderId) {
        const { data: order, error } = await supabase
            .from('orders')
            .select(orderCols)
            .eq('id', orderId)
            .single();
        if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        return NextResponse.json({
            kind: 'order',
            id: order.id,
            siteId: order.site_id,
            status: order.status,
            paymentStatus: order.payment_status,
            paymentMethod: order.payment_method,
            hasCharge: !!order.clover_charge_id,
            totalCents: (order.subtotal_cents || 0) + (order.shipping_cents || 0),
            customerEmail: order.customer_email,
        });
    }

    // Lookup by checkout session id — try orders first, then bookings
    const { data: order } = await supabase
        .from('orders')
        .select(orderCols)
        .eq('clover_checkout_session_id', ick)
        .maybeSingle();

    if (order) {
        return NextResponse.json({
            kind: 'order',
            id: order.id,
            siteId: order.site_id,
            status: order.status,
            paymentStatus: order.payment_status,
            paymentMethod: order.payment_method,
            hasCharge: !!order.clover_charge_id,
            totalCents: (order.subtotal_cents || 0) + (order.shipping_cents || 0),
            customerEmail: order.customer_email,
        });
    }

    const { data: booking } = await supabase
        .from('bookings')
        .select(bookingCols)
        .eq('clover_checkout_session_id', ick)
        .maybeSingle();

    if (booking) {
        return NextResponse.json({
            kind: 'booking',
            id: booking.id,
            siteId: booking.site_id,
            status: booking.status,
            paymentStatus: booking.payment_status,
            totalCents: booking.total_price_cents,
            customerEmail: booking.customer_email,
        });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
