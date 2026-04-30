import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession, hasValidCloverCredentials } from '@/lib/payments/clover';

/**
 * POST /api/clover/session
 * Body: { orderId }
 *
 * Creates a Clover Hosted Checkout session for an order and returns the redirect URL.
 * The order must have payment_method='clover' and a vendor with Clover credentials.
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
    if (order.payment_method !== 'clover') {
        return NextResponse.json({ error: 'Order is not set up for Clover payment' }, { status: 400 });
    }
    if (order.payment_status === 'paid') {
        return NextResponse.json({ error: 'Order already paid' }, { status: 400 });
    }

    let creds: { merchantId: string; privateToken: string; sandboxMode: boolean };

    if (order.vendor_id && order.vendors && hasValidCloverCredentials(order.vendors)) {
        const v = order.vendors;
        creds = { merchantId: v.clover_merchant_id, privateToken: v.clover_private_token, sandboxMode: !!v.clover_sandbox_mode };
    } else if (!order.vendor_id) {
        const { data: site } = await supabase
            .from('sites')
            .select('clover_merchant_id, clover_private_token, clover_sandbox_mode')
            .eq('id', order.site_id)
            .single();
        if (!site?.clover_merchant_id || !site?.clover_private_token) {
            return NextResponse.json({ error: 'Site Clover credentials not configured' }, { status: 400 });
        }
        creds = { merchantId: site.clover_merchant_id, privateToken: site.clover_private_token, sandboxMode: !!site.clover_sandbox_mode };
    } else {
        return NextResponse.json({ error: 'Clover credentials not configured' }, { status: 400 });
    }

    const [firstName, ...lastNameParts] = (order.customer_name || '').split(' ');
    const lastName = lastNameParts.join(' ') || undefined;

    try {
        const session = await createCheckoutSession(creds,
            {
                customer: {
                    email: order.customer_email,
                    firstName,
                    lastName,
                    phoneNumber: order.customer_phone || undefined,
                },
                lineItems: (order.items || []).map((item: any) => {
                    const variantNote = item.variants ? Object.entries(item.variants).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
                    const optionNote = item.options ? Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
                    const note = [variantNote, optionNote].filter(Boolean).join(' · ') || undefined;
                    return {
                        name: item.name,
                        price: item.price_cents,
                        unitQty: item.qty,
                        note,
                    };
                }),
                shippingCents: order.shipping_cents || 0,
                tipsEnabled: false,
            }
        );

        await supabase
            .from('orders')
            .update({
                clover_checkout_session_id: session.checkoutSessionId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        return NextResponse.json({
            href: session.href,
            checkoutSessionId: session.checkoutSessionId,
            expirationTime: session.expirationTime,
        });
    } catch (err: any) {
        console.error('Clover session creation failed:', err);
        return NextResponse.json({ error: err.message || 'Failed to create Clover checkout session' }, { status: 500 });
    }
}
