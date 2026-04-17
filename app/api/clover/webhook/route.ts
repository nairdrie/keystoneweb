import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/payments/clover';
import {
    sendOrderConfirmation,
    sendOrderNotification,
    sendOwnerVendorOrderNotification,
    sendVendorOrderNotification,
} from '@/lib/email';

/**
 * POST /api/clover/webhook
 *
 * Clover calls this endpoint after a Hosted Checkout payment completes.
 * Payload: { createdTime, message, status: "APPROVED"|"DECLINED", type: "PAYMENT", id, merchantId, data: checkoutSessionId }
 * Header: Clover-Signature: t=<timestamp>,v1=<hex>
 *
 * We must:
 *   1. Read the raw body (so HMAC can be verified)
 *   2. Match the checkout session to an order
 *   3. Verify the signature using the vendor's configured webhook secret
 *   4. If APPROVED: mark the order paid, trigger emails
 */
export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('clover-signature');

    let payload: any;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { status, type, id: paymentId, merchantId, data: checkoutSessionId } = payload;
    if (type !== 'PAYMENT' || !checkoutSessionId) {
        // Unknown event type — ack but ignore
        return NextResponse.json({ received: true });
    }

    // Use service role client to bypass RLS (this is a public webhook)
    const supabase = await createClient();

    // Look up the order by checkout session id
    const { data: order } = await supabase
        .from('orders')
        .select('*, vendors(*)')
        .eq('clover_checkout_session_id', checkoutSessionId)
        .single();

    if (!order) {
        // Order not found — possibly a duplicate or stale event
        console.warn('Clover webhook: no order found for session', checkoutSessionId);
        return NextResponse.json({ received: true });
    }

    const vendor = order.vendors;
    if (!vendor?.clover_webhook_secret) {
        console.error('Clover webhook: vendor has no webhook secret configured');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // Verify signature
    if (!verifyWebhookSignature(rawBody, signatureHeader, vendor.clover_webhook_secret)) {
        console.error('Clover webhook: signature verification failed');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Ensure the webhook merchantId matches the vendor
    if (merchantId && merchantId !== vendor.clover_merchant_id) {
        console.error('Clover webhook: merchant id mismatch');
        return NextResponse.json({ error: 'Merchant mismatch' }, { status: 400 });
    }

    if (order.payment_status === 'paid') {
        return NextResponse.json({ received: true, alreadyPaid: true });
    }

    if (status === 'APPROVED') {
        const { data: updated } = await supabase
            .from('orders')
            .update({
                payment_status: 'paid',
                status: 'confirmed',
                clover_charge_id: paymentId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', order.id)
            .select()
            .single();

        await sendCloverOrderEmails(supabase, updated || order, vendor).catch(e => console.error(e));
        return NextResponse.json({ received: true, marked: 'paid' });
    } else {
        // DECLINED or other
        await supabase
            .from('orders')
            .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', order.id);
        return NextResponse.json({ received: true, marked: 'failed' });
    }
}

async function sendCloverOrderEmails(supabase: any, order: any, vendor: any) {
    const { data: siteInfo } = await supabase
        .from('sites')
        .select('site_slug, title')
        .eq('id', order.site_id)
        .single();
    const siteName = siteInfo?.title || siteInfo?.site_slug || undefined;

    const { data: ecomSettings } = await supabase
        .from('ecommerce_settings')
        .select('notification_email')
        .eq('site_id', order.site_id)
        .single();

    const currency = order.items?.[0]?.currency || 'CAD';

    // Notify the vendor (they need to fulfill even though Clover processed the payment)
    const { data: tokenRow } = await supabase
        .from('vendor_order_tokens')
        .select('token')
        .eq('vendor_id', vendor.id)
        .eq('site_id', order.site_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const ccEmails = Array.isArray(vendor.cc_notification_emails) ? vendor.cc_notification_emails : [];
    const vendorRecipients = [vendor.contact_email, ...ccEmails].filter(Boolean);
    for (const recipient of vendorRecipients) {
        sendVendorOrderNotification({
            orderId: order.id,
            vendorName: vendor.name,
            vendorEmail: recipient,
            customerName: order.customer_name,
            customerEmail: order.customer_email,
            customerPhone: order.customer_phone,
            shippingAddress: order.shipping_address,
            items: order.items,
            subtotalCents: order.subtotal_cents,
            currency,
            portalToken: tokenRow?.token,
            siteName,
        }).catch((e: any) => console.error(e));
    }

    await supabase
        .from('orders')
        .update({ vendor_notified_at: new Date().toISOString() })
        .eq('id', order.id);

    if (order.parent_order_id) {
        const { data: parent } = await supabase
            .from('orders')
            .select('*')
            .eq('id', order.parent_order_id)
            .single();

        const { data: siblings } = await supabase
            .from('orders')
            .select('*, vendors(id, name)')
            .eq('parent_order_id', order.parent_order_id);

        if (ecomSettings?.notification_email && parent && siblings) {
            sendOwnerVendorOrderNotification({
                parentOrderId: parent.id,
                childOrders: siblings.map((s: any) => ({
                    orderId: s.id,
                    vendorName: s.vendors?.name || 'Your Store',
                    items: s.items,
                    subtotalCents: s.subtotal_cents,
                    paymentMethod: s.payment_method,
                    status: s.status,
                })),
                customerName: order.customer_name,
                customerEmail: order.customer_email,
                currency,
                ownerEmail: ecomSettings.notification_email,
                siteName,
            }).catch(e => console.error(e));
        }
        return;
    }

    sendOrderConfirmation({
        orderId: order.id,
        items: order.items,
        subtotalCents: order.subtotal_cents,
        shippingCents: order.shipping_cents || 0,
        shippingMethod: order.shipping_method || undefined,
        currency,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        shippingAddress: order.shipping_address,
        paymentMethod: 'clover',
        siteName,
    }).catch(e => console.error(e));

    if (ecomSettings?.notification_email) {
        sendOrderNotification({
            orderId: order.id,
            items: order.items,
            subtotalCents: order.subtotal_cents,
            shippingCents: order.shipping_cents || 0,
            shippingMethod: order.shipping_method || undefined,
            currency,
            customerName: order.customer_name,
            customerEmail: order.customer_email,
            customerPhone: order.customer_phone,
            shippingAddress: order.shipping_address,
            paymentMethod: 'clover',
            siteName,
        }, ecomSettings.notification_email).catch(e => console.error(e));
    }
}
