import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { createCharge, hasValidCloverCredentials } from '@/lib/payments/clover';
import {
    sendOrderConfirmation,
    sendOrderNotification,
    sendOwnerVendorOrderNotification,
    sendVendorOrderNotification,
    sendCustomerConfirmation,
    sendOwnerNotification,
} from '@/lib/email';

/**
 * POST /api/clover/charge
 * Body: { token, orderId? } | { token, bookingId? }
 *
 * Charges a Clover.js token and marks the order or booking as paid.
 * The token is produced client-side by clover.createToken() or the paymentMethod event.
 */
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const body = await request.json();
    const { token, orderId, bookingId } = body;

    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    if (!orderId && !bookingId) return NextResponse.json({ error: 'Missing orderId or bookingId' }, { status: 400 });

    // ── Order path ──────────────────────────────────────────────────────────────
    if (orderId) {
        const { data: order, error } = await supabase
            .from('orders')
            .select('*, vendors(*)')
            .eq('id', orderId)
            .single();

        if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        if (order.payment_method !== 'clover') return NextResponse.json({ error: 'Order is not a Clover order' }, { status: 400 });
        if (order.payment_status === 'paid') return NextResponse.json({ error: 'Order already paid' }, { status: 400 });

        let creds: { merchantId: string; privateToken: string; sandboxMode: boolean };
        const vendor = order.vendors;

        if (order.vendor_id && vendor && hasValidCloverCredentials(vendor)) {
            creds = { merchantId: vendor.clover_merchant_id, privateToken: vendor.clover_private_token, sandboxMode: !!vendor.clover_sandbox_mode };
        } else if (!order.vendor_id) {
            const { data: site } = await supabase
                .from('sites')
                .select('clover_merchant_id, clover_private_token, clover_sandbox_mode')
                .eq('id', order.site_id)
                .single();
            if (!site?.clover_merchant_id || !site?.clover_private_token) {
                return NextResponse.json({ error: 'Clover credentials not configured' }, { status: 400 });
            }
            creds = { merchantId: site.clover_merchant_id, privateToken: site.clover_private_token, sandboxMode: !!site.clover_sandbox_mode };
        } else {
            return NextResponse.json({ error: 'Clover credentials not configured' }, { status: 400 });
        }

        const amountCents = (order.subtotal_cents || 0) + (order.shipping_cents || 0) + (order.tax_cents || 0);
        const currency = order.items?.[0]?.currency || 'USD';

        try {
            const charge = await createCharge(creds, {
                amountCents,
                currency,
                token,
                description: `Order ${orderId.slice(0, 8).toUpperCase()}`,
            });

            const { data: updated } = await supabase
                .from('orders')
                .update({
                    payment_status: 'paid',
                    status: 'confirmed',
                    clover_charge_id: charge.chargeId,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', orderId)
                .select()
                .single();

            sendCloverOrderEmails(supabase, updated || order, vendor || null).catch(e => console.error(e));

            return NextResponse.json({ success: true, chargeId: charge.chargeId });
        } catch (err: any) {
            console.error('Clover charge failed:', err);
            return NextResponse.json({ error: err.message || 'Payment failed' }, { status: 402 });
        }
    }

    // ── Booking path ─────────────────────────────────────────────────────────────
    if (bookingId) {
        const { data: booking, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', bookingId)
            .single();

        if (error || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        if (booking.payment_status === 'paid') return NextResponse.json({ error: 'Booking already paid' }, { status: 400 });

        const { data: site } = await supabase
            .from('sites')
            .select('clover_merchant_id, clover_private_token, clover_sandbox_mode')
            .eq('id', booking.site_id)
            .single();

        if (!site?.clover_merchant_id || !site?.clover_private_token) {
            return NextResponse.json({ error: 'Clover credentials not configured' }, { status: 400 });
        }

        const { data: service } = await supabase
            .from('booking_services')
            .select('currency')
            .eq('id', booking.service_id)
            .single();

        const creds = {
            merchantId: site.clover_merchant_id,
            privateToken: site.clover_private_token,
            sandboxMode: !!site.clover_sandbox_mode,
        };
        const amountCents = booking.total_price_cents || 0;
        const currency = service?.currency || 'USD';

        try {
            const charge = await createCharge(creds, {
                amountCents,
                currency,
                token,
                description: `Booking ${bookingId.slice(0, 8).toUpperCase()}`,
            });

            const { data: updated } = await supabase
                .from('bookings')
                .update({
                    payment_status: 'paid',
                    status: 'confirmed',
                    clover_charge_id: charge.chargeId,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', bookingId)
                .select()
                .single();

            sendCloverBookingEmails(supabase, updated || booking).catch(e => console.error(e));

            return NextResponse.json({ success: true, chargeId: charge.chargeId });
        } catch (err: any) {
            console.error('Clover booking charge failed:', err);
            return NextResponse.json({ error: err.message || 'Payment failed' }, { status: 402 });
        }
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
            logoUrl,
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
