import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { sendOrderConfirmation, sendOrderNotification } from '@/lib/email';

/**
 * POST /api/products/orders — Create order (public checkout)
 * GET /api/products/orders?siteId=... — List orders (owner only)
 * PUT /api/products/orders — Update order status (owner only)
 */

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const body = await request.json();

    const {
        siteId, items, customerName, customerEmail, customerPhone,
        shippingAddress, notes, paymentMethod = 'none', stripeSessionId,
    } = body;

    if (!siteId || !items || !items.length || !customerName || !customerEmail) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Calculate subtotal from items
    const subtotalCents = items.reduce((sum: number, item: any) => sum + (item.price_cents * item.qty), 0);

    // Determine status based on payment
    const status = paymentMethod === 'none' ? 'confirmed' : 'pending';
    const paymentStatus = paymentMethod === 'none' ? 'paid' : 'unpaid';

    const { data: order, error } = await supabase
        .from('orders')
        .insert({
            site_id: siteId,
            items,
            subtotal_cents: subtotalCents,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone || null,
            shipping_address: shippingAddress || null,
            status,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            notes: notes || null,
        })
        .select()
        .single();

    if (error) {
        console.error('Order creation error:', error);
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    // Decrement inventory for purchased products
    for (const item of items) {
        if (item.productId) {
            const { data: product } = await supabase
                .from('products')
                .select('inventory_count')
                .eq('id', item.productId)
                .single();

            if (product && product.inventory_count > 0) {
                await supabase
                    .from('products')
                    .update({ inventory_count: product.inventory_count - item.qty })
                    .eq('id', item.productId);
            }
        }
    }

    // Get e-commerce settings for e-transfer email + notification email
    // Falls back to booking_settings for backwards compatibility
    const { data: ecomSettings } = await supabase
        .from('ecommerce_settings')
        .select('etransfer_email, notification_email')
        .eq('site_id', siteId)
        .single();

    const { data: bookingSettings } = !ecomSettings ? await supabase
        .from('booking_settings')
        .select('etransfer_email, notification_email')
        .eq('site_id', siteId)
        .single() : { data: null };

    const paymentConfig = ecomSettings || bookingSettings;

    // Build response
    const response: any = {
        order,
        confirmationMessage: 'Thank you for your order!',
    };

    if (paymentMethod === 'etransfer' && paymentConfig?.etransfer_email) {
        response.paymentInstructions = {
            type: 'etransfer',
            email: paymentConfig?.etransfer_email,
            amount: (subtotalCents / 100).toFixed(2),
            currency: items[0]?.currency || 'CAD',
            reference: `ORDER-${order.id.slice(0, 8).toUpperCase()}`,
        };
    }

    if (paymentMethod === 'stripe') {
        // Stripe webhook will handle emails once paid
        return NextResponse.json(response);
    }

    // Send emails (fire-and-forget) for non-Stripe methods
    const emailData = {
        orderId: order.id,
        items,
        subtotalCents,
        currency: items[0]?.currency || 'CAD',
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        paymentMethod,
        etransferEmail: paymentConfig?.etransfer_email,
    };

    sendOrderConfirmation(emailData).catch(err => console.error('Order customer email failed:', err));

    if (paymentConfig?.notification_email) {
        sendOrderNotification(emailData, paymentConfig.notification_email)
            .catch(err => console.error('Order owner email failed:', err));
    }

    return NextResponse.json(response);
}

export async function GET(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const status = request.nextUrl.searchParams.get('status');
    let query = supabase
        .from('orders')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: data });
}

export async function PUT(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, status, payment_status } = body;

    if (!orderId) {
        return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (payment_status) updates.payment_status = payment_status;

    const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ order: data });
}
