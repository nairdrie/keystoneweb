import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { requestSessionToken, hasValidConvergeCredentials } from '@/lib/payments/converge';

/**
 * POST /api/converge/token
 * Body: { orderId }
 *
 * Generates a single-use Converge Lightbox session token for an existing order.
 * The order must be in 'pending' status with payment_method='converge' and a vendor_id set.
 * We look up the vendor's Converge credentials and request the token against their merchant account.
 */
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

    const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('*, vendors(*)')
        .eq('id', orderId)
        .single();

    if (orderErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.payment_method !== 'converge') {
        return NextResponse.json({ error: 'Order is not set up for Converge payment' }, { status: 400 });
    }
    if (order.payment_status === 'paid') {
        return NextResponse.json({ error: 'Order already paid' }, { status: 400 });
    }
    if (!order.vendors || !hasValidConvergeCredentials(order.vendors)) {
        return NextResponse.json({ error: 'Vendor Converge credentials not configured' }, { status: 400 });
    }

    const vendor = order.vendors;
    const totalCents = (order.subtotal_cents || 0) + (order.shipping_cents || 0);
    const totalAmount = totalCents / 100;

    const addr = order.shipping_address || {};
    const [firstName, ...lastNameParts] = (order.customer_name || '').split(' ');

    try {
        const token = await requestSessionToken(
            {
                merchantId: vendor.converge_merchant_id,
                userId: vendor.converge_user_id,
                pin: vendor.converge_pin,
                demoMode: !!vendor.converge_demo_mode,
            },
            {
                amount: totalAmount,
                invoiceNumber: `ORDER-${order.id.slice(0, 8).toUpperCase()}`,
                description: `Order ${order.id.slice(0, 8)}`,
                firstName,
                lastName: lastNameParts.join(' ') || undefined,
                email: order.customer_email,
                phone: order.customer_phone || undefined,
                avsAddress: addr.line1,
                avsZip: addr.postal,
                city: addr.city,
                state: addr.region,
                country: addr.country,
                shipToFirstName: firstName,
                shipToLastName: lastNameParts.join(' ') || undefined,
                shipToAddress1: addr.line1,
                shipToCity: addr.city,
                shipToState: addr.region,
                shipToZip: addr.postal,
                shipToCountry: addr.country,
                shipToPhone: order.customer_phone || undefined,
            }
        );

        return NextResponse.json({
            token,
            demoMode: !!vendor.converge_demo_mode,
            amount: totalAmount.toFixed(2),
            orderId: order.id,
        });
    } catch (err: any) {
        console.error('Converge token request failed:', err);
        return NextResponse.json({ error: err.message || 'Failed to generate payment token' }, { status: 500 });
    }
}
