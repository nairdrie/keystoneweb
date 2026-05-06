import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/payments/clover';
import {
    sendOrderConfirmation,
    sendOrderNotification,
    sendOwnerVendorOrderNotification,
    sendVendorOrderNotification,
    sendCustomerConfirmation,
    sendOwnerNotification,
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

    // Look up the order by checkout session id — could be an ecommerce order or a booking
    const { data: order } = await supabase
        .from('orders')
        .select('*, vendors(*)')
        .eq('clover_checkout_session_id', checkoutSessionId)
        .single();

    const { data: booking } = !order ? await supabase
        .from('bookings')
        .select('*')
        .eq('clover_checkout_session_id', checkoutSessionId)
        .single() : { data: null };

    const record = order || booking;
    if (!record) {
        console.warn('Clover webhook: no order or booking found for session', checkoutSessionId);
        return NextResponse.json({ received: true });
    }

    const isBooking = !order && !!booking;
    const vendor = order?.vendors || null;
    let webhookSecret: string | null = null;
    let expectedMerchantId: string | null = null;

    if (order?.vendor_id && vendor?.clover_webhook_secret) {
        webhookSecret = vendor.clover_webhook_secret;
        expectedMerchantId = vendor.clover_merchant_id;
    } else {
        const { data: site } = await supabase
            .from('sites')
            .select('clover_webhook_secret, clover_merchant_id')
            .eq('id', record.site_id)
            .single();
        webhookSecret = site?.clover_webhook_secret || null;
        expectedMerchantId = site?.clover_merchant_id || null;
    }

    if (!webhookSecret) {
        console.error('Clover webhook: no webhook secret configured');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    if (!verifyWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
        console.error('Clover webhook: signature verification failed');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    if (merchantId && expectedMerchantId && merchantId !== expectedMerchantId) {
        console.error('Clover webhook: merchant id mismatch');
        return NextResponse.json({ error: 'Merchant mismatch' }, { status: 400 });
    }

    if (record.payment_status === 'paid') {
        return NextResponse.json({ received: true, alreadyPaid: true });
    }

    const table = isBooking ? 'bookings' : 'orders';

    if (status === 'APPROVED') {
        const { data: updated } = await supabase
            .from(table)
            .update({
                payment_status: 'paid',
                status: 'confirmed',
                clover_charge_id: paymentId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', record.id)
            .select()
            .single();

        if (isBooking) {
            await sendCloverBookingEmails(supabase, updated || record).catch(e => console.error(e));
        } else {
            await sendCloverOrderEmails(supabase, updated || record, vendor || null).catch(e => console.error(e));
        }
        return NextResponse.json({ received: true, marked: 'paid' });
    } else {
        await supabase
            .from(table)
            .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', record.id);
        return NextResponse.json({ received: true, marked: 'failed' });
    }
}

async function sendCloverOrderEmails(supabase: any, order: any, vendor: any | null) {
    const { data: siteInfo } = await supabase
        .from('sites')
        .select('site_slug, title, design_data')
        .eq('id', order.site_id)
        .single();
    const siteName = siteInfo?.title || siteInfo?.site_slug || undefined;
    const logoUrl: string | undefined = siteInfo?.design_data?.headerLogo || siteInfo?.design_data?.siteLogo || undefined;

    const { data: cloverCustomRows } = await supabase
        .from('email_customizations')
        .select('email_key, overrides')
        .eq('site_id', order.site_id)
        .eq('email_key', 'order_confirmed');
    const cloverOverrides = cloverCustomRows?.[0]?.overrides;

    const { data: ecomSettings } = await supabase
        .from('ecommerce_settings')
        .select('notification_email')
        .eq('site_id', order.site_id)
        .single();

    const currency = order.items?.[0]?.currency || 'CAD';

    if (vendor) {
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
    }

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
        logoUrl,
        overrides: cloverOverrides,
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

async function sendCloverBookingEmails(supabase: any, booking: any) {
    const { data: siteInfo } = await supabase
        .from('sites')
        .select('site_slug, title')
        .eq('id', booking.site_id)
        .single();
    const siteName = siteInfo?.title || siteInfo?.site_slug || undefined;

    const { data: settings } = await supabase
        .from('booking_settings')
        .select('notification_email, confirmation_message')
        .eq('site_id', booking.site_id)
        .single();

    const { data: service } = await supabase
        .from('booking_services')
        .select('name, duration_minutes, currency, price_cents')
        .eq('id', booking.service_id)
        .single();

    if (!service) return;

    const formatTime = (t: string) => {
        const [hh, mm] = t.split(':').map(Number);
        const period = hh >= 12 ? 'PM' : 'AM';
        const displayHour = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
        return `${displayHour}:${mm.toString().padStart(2, '0')} ${period}`;
    };

    const emailData = {
        serviceName: service.name,
        selectedOptionName: booking.selected_option_name || undefined,
        date: booking.booking_date,
        startTime: formatTime(booking.start_time),
        duration: service.duration_minutes,
        priceCents: booking.total_price_cents || service.price_cents,
        currency: service.currency,
        customerName: booking.customer_name,
        customerEmail: booking.customer_email,
        customerPhone: booking.customer_phone,
        notes: booking.notes,
        bookingId: booking.id,
        paymentMethod: 'clover' as const,
        confirmationMessage: settings?.confirmation_message,
        siteName,
    };

    sendCustomerConfirmation(emailData as any).catch(e => console.error(e));
    if (settings?.notification_email) {
        sendOwnerNotification(emailData as any, settings.notification_email).catch(e => console.error(e));
    }
}
