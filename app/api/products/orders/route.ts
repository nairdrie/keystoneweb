import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { sendOrderConfirmation, sendOrderNotification, sendOrderPaymentConfirmed, sendOrderCancellationToCustomer, sendOrderCancellationToOwner, sendOrderShipped } from '@/lib/email';
import { findMatchingZone, type ShippingZone } from '@/lib/shipping-data';
import Stripe from 'stripe';

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
        shippingAddress, shippingCents: clientShippingCents, shippingMethod: clientShippingMethod,
        notes, paymentMethod = 'none', stripeSessionId,
    } = body;

    if (!siteId || !items || !items.length || !customerName || !customerEmail) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Calculate subtotal from items
    const subtotalCents = items.reduce((sum: number, item: any) => sum + (item.price_cents * item.qty), 0);

    // Server-side shipping validation: re-calculate shipping from zones to prevent tampering
    let validatedShippingCents = 0;
    let validatedShippingMethod: string | null = null;

    const { data: ecomSettingsRow } = await supabase
        .from('ecommerce_settings')
        .select('shipping_required')
        .eq('site_id', siteId)
        .single();

    const shippingRequired = ecomSettingsRow?.shipping_required !== false;

    if (shippingRequired && shippingAddress) {
        const { data: zones } = await supabase
            .from('shipping_zones')
            .select('*')
            .eq('site_id', siteId)
            .order('sort_order');

        if (zones && zones.length > 0) {
            const result = findMatchingZone(
                zones as ShippingZone[],
                shippingAddress.country || '',
                shippingAddress.region || shippingAddress.province || '',
                subtotalCents
            );
            if (result) {
                validatedShippingCents = result.shippingCents;
                validatedShippingMethod = result.label;
            }
        }
    }

    // Determine status based on payment
    const status = paymentMethod === 'none' ? 'confirmed' : 'pending';
    const paymentStatus = paymentMethod === 'none' ? 'paid' : 'unpaid';

    // Server-side tax: look up flat-rate tax config and compute tax_cents.
    // Stripe's automatic_tax (when enabled) handles tax via Stripe Checkout,
    // so we skip flat-rate tax in that case to avoid double-charging.
    const { data: taxSettings } = await supabase
        .from('ecommerce_settings')
        .select('tax_rate_bps, tax_label, tax_enabled')
        .eq('site_id', siteId)
        .single();

    const taxRateBps = taxSettings?.tax_rate_bps || 0;
    const stripeAutomaticTax = paymentMethod === 'stripe' && taxSettings?.tax_enabled === true;
    const applyFlatTax = taxRateBps > 0 && !stripeAutomaticTax;
    const taxCents = applyFlatTax ? Math.round((subtotalCents + validatedShippingCents) * taxRateBps / 10000) : 0;
    const orderTaxLabel = applyFlatTax ? (taxSettings?.tax_label || 'Tax') : null;

    const { data: order, error } = await supabase
        .from('orders')
        .insert({
            site_id: siteId,
            items,
            subtotal_cents: subtotalCents,
            shipping_cents: validatedShippingCents,
            shipping_method: validatedShippingMethod,
            tax_cents: taxCents,
            tax_label: orderTaxLabel,
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

    // Get site name for customer emails
    const { data: siteInfo } = await supabase
        .from('sites')
        .select('site_slug')
        .eq('id', siteId)
        .single();
    const siteName = siteInfo?.site_slug || undefined;

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

    const orderTotalCents = subtotalCents + validatedShippingCents;

    if (paymentMethod === 'etransfer' && paymentConfig?.etransfer_email) {
        response.paymentInstructions = {
            type: 'etransfer',
            email: paymentConfig?.etransfer_email,
            amount: (orderTotalCents / 100).toFixed(2),
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
        shippingCents: validatedShippingCents,
        shippingMethod: validatedShippingMethod || undefined,
        currency: items[0]?.currency || 'CAD',
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        paymentMethod,
        etransferEmail: paymentConfig?.etransfer_email,
        siteName,
        notes: notes || undefined,
        taxCents: taxCents || undefined,
        taxLabel: orderTaxLabel || undefined,
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
    const { orderId, status, payment_status, cancellationReason, tracking_number, tracking_carrier } = body;

    if (!orderId) {
        return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    // Fetch the existing order before updating
    const { data: existingOrder, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (fetchError || !existingOrder) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (payment_status) updates.payment_status = payment_status;
    if (cancellationReason) updates.cancellation_reason = cancellationReason;
    if (tracking_number !== undefined) updates.tracking_number = tracking_number || null;
    if (tracking_carrier !== undefined) updates.tracking_carrier = tracking_carrier || null;

    const isBeingMarkedShipped = status === 'shipped' && existingOrder.status !== 'shipped';

    const isBeingCancelled = status === 'cancelled' && existingOrder.status !== 'cancelled';

    // Attempt Stripe refund before updating if order was paid via Stripe
    let refunded = false;
    if (isBeingCancelled && existingOrder.payment_status === 'paid' && existingOrder.stripe_payment_id) {
        try {
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (stripeKey) {
                const stripe = new Stripe(stripeKey);
                await stripe.refunds.create({ payment_intent: existingOrder.stripe_payment_id });
                refunded = true;
                updates.payment_status = 'unpaid'; // reflect refund in DB
            }
        } catch (err) {
            console.error('Stripe refund failed:', err);
            // Don't block the cancellation — log and continue
        }
    }

    const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send payment confirmed email for e-transfer orders when marked as paid
    const isBeingMarkedPaid = payment_status === 'paid' && existingOrder.payment_status !== 'paid'
        && existingOrder.payment_method === 'etransfer';
    if (isBeingMarkedPaid) {
        const { data: paidSiteInfo } = await supabase
            .from('sites')
            .select('title, site_slug')
            .eq('id', existingOrder.site_id)
            .single();
        const paidSiteName = paidSiteInfo?.title || paidSiteInfo?.site_slug || undefined;

        const emailData = {
            orderId: existingOrder.id,
            items: existingOrder.items,
            subtotalCents: existingOrder.subtotal_cents,
            shippingCents: existingOrder.shipping_cents || 0,
            shippingMethod: existingOrder.shipping_method || undefined,
            taxCents: existingOrder.tax_cents || undefined,
            taxLabel: existingOrder.tax_label || undefined,
            currency: existingOrder.items[0]?.currency || 'CAD',
            customerName: existingOrder.customer_name,
            customerEmail: existingOrder.customer_email,
            paymentMethod: existingOrder.payment_method,
            siteName: paidSiteName,
        };

        sendOrderPaymentConfirmed(emailData)
            .catch(err => console.error('Order payment confirmed email failed:', err));
    }

    // Send shipped email (with tracking info) when status transitions to 'shipped'
    if (isBeingMarkedShipped) {
        const { data: shippedSiteInfo } = await supabase
            .from('sites')
            .select('title, site_slug')
            .eq('id', existingOrder.site_id)
            .single();
        const shippedSiteName = shippedSiteInfo?.title || shippedSiteInfo?.site_slug || undefined;

        const emailData = {
            orderId: existingOrder.id,
            items: existingOrder.items,
            subtotalCents: existingOrder.subtotal_cents,
            shippingCents: existingOrder.shipping_cents || 0,
            shippingMethod: existingOrder.shipping_method || undefined,
            currency: existingOrder.items[0]?.currency || 'CAD',
            customerName: existingOrder.customer_name,
            customerEmail: existingOrder.customer_email,
            paymentMethod: existingOrder.payment_method,
            siteName: shippedSiteName,
            shippingAddress: existingOrder.shipping_address || undefined,
            trackingNumber: data.tracking_number || undefined,
            trackingCarrier: data.tracking_carrier || undefined,
        };

        sendOrderShipped(emailData)
            .catch(err => console.error('Order shipped email failed:', err));
    }

    // Restore inventory for cancelled orders
    if (isBeingCancelled && existingOrder.items?.length) {
        for (const item of existingOrder.items) {
            if (item.productId) {
                const { data: product } = await supabase
                    .from('products')
                    .select('inventory_count')
                    .eq('id', item.productId)
                    .single();
                if (product) {
                    await supabase
                        .from('products')
                        .update({ inventory_count: product.inventory_count + item.qty })
                        .eq('id', item.productId);
                }
            }
        }
    }

    // Send cancellation emails
    if (isBeingCancelled) {
        const { data: cancelSiteInfo } = await supabase
            .from('sites')
            .select('title, site_slug')
            .eq('id', existingOrder.site_id)
            .single();
        const cancelSiteName = cancelSiteInfo?.title || cancelSiteInfo?.site_slug || undefined;

        const { data: ecomSettings } = await supabase
            .from('ecommerce_settings')
            .select('notification_email')
            .eq('site_id', existingOrder.site_id)
            .single();
        const { data: bookingSettings } = !ecomSettings ? await supabase
            .from('booking_settings')
            .select('notification_email')
            .eq('site_id', existingOrder.site_id)
            .single() : { data: null };
        const notificationEmail = (ecomSettings || bookingSettings)?.notification_email;

        const emailData = {
            orderId: existingOrder.id,
            items: existingOrder.items,
            subtotalCents: existingOrder.subtotal_cents,
            currency: existingOrder.items[0]?.currency || 'CAD',
            customerName: existingOrder.customer_name,
            customerEmail: existingOrder.customer_email,
            cancellationReason: cancellationReason || undefined,
            refunded,
            siteName: cancelSiteName,
        };

        sendOrderCancellationToCustomer(emailData)
            .catch(err => console.error('Order cancellation customer email failed:', err));

        if (notificationEmail) {
            sendOrderCancellationToOwner(emailData, notificationEmail)
                .catch(err => console.error('Order cancellation owner email failed:', err));
        }
    }

    return NextResponse.json({ order: data, refunded });
}
