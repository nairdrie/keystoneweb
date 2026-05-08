import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyTransaction } from '@/lib/payments/converge';
import {
    sendOrderConfirmation,
    sendOrderNotification,
    sendOwnerVendorOrderNotification,
    sendVendorOrderNotification,
} from '@/lib/email';
import { buildSiteOrigin } from '@/lib/email/order-tracking-url';

/**
 * POST /api/converge/verify
 * Body: { orderId, sslTxnId }
 *
 * Called by the client after Lightbox onApproval. Server independently verifies the transaction
 * against Converge (ccquerytxn), marks the order paid, and triggers emails. This prevents
 * client-side tampering.
 */
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const body = await request.json();
    const { orderId, sslTxnId } = body;

    if (!orderId || !sslTxnId) {
        return NextResponse.json({ error: 'Missing orderId or sslTxnId' }, { status: 400 });
    }

    const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('*, vendors(*)')
        .eq('id', orderId)
        .single();

    if (orderErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.payment_status === 'paid') {
        return NextResponse.json({ order, alreadyPaid: true });
    }

    let creds: { merchantId: string; userId: string; pin: string; demoMode: boolean };
    const vendor = order.vendors;

    if (order.vendor_id && vendor?.converge_merchant_id && vendor?.converge_user_id && vendor?.converge_pin) {
        creds = { merchantId: vendor.converge_merchant_id, userId: vendor.converge_user_id, pin: vendor.converge_pin, demoMode: !!vendor.converge_demo_mode };
    } else if (!order.vendor_id) {
        const { data: site } = await supabase
            .from('sites')
            .select('converge_merchant_id, converge_user_id, converge_pin, converge_demo_mode')
            .eq('id', order.site_id)
            .single();
        if (!site?.converge_merchant_id || !site?.converge_user_id || !site?.converge_pin) {
            return NextResponse.json({ error: 'Converge credentials not configured' }, { status: 400 });
        }
        creds = { merchantId: site.converge_merchant_id, userId: site.converge_user_id, pin: site.converge_pin, demoMode: !!site.converge_demo_mode };
    } else {
        return NextResponse.json({ error: 'Converge credentials not configured' }, { status: 400 });
    }

    const result = await verifyTransaction(creds, sslTxnId);

    if (!result.approved) {
        return NextResponse.json({
            error: 'Payment not approved',
            resultMessage: result.resultMessage,
            resultCode: result.resultCode,
        }, { status: 400 });
    }

    // Verify the amount matches (guard against token reuse for a smaller amount)
    const expectedAmount = ((order.subtotal_cents || 0) + (order.shipping_cents || 0)) / 100;
    const paidAmount = parseFloat(result.amount || '0');
    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
        return NextResponse.json({
            error: 'Payment amount mismatch',
            expected: expectedAmount,
            received: paidAmount,
        }, { status: 400 });
    }

    // Mark paid
    const { data: updated } = await supabase
        .from('orders')
        .update({
            payment_status: 'paid',
            status: 'confirmed',
            converge_txn_id: result.txnId,
            updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select()
        .single();

    // Fire-and-forget emails
    await sendConvergeOrderEmails(supabase, updated || order, vendor || null).catch(e => console.error('Converge email failure:', e));

    return NextResponse.json({
        success: true,
        order: updated,
        transaction: {
            txnId: result.txnId,
            approvalCode: result.approvalCode,
            cardLast4: result.cardLast4,
            cardBrand: result.cardBrand,
        },
    });
}

async function sendConvergeOrderEmails(supabase: any, order: any, vendor: any | null) {
    const { data: siteInfo } = await supabase
        .from('sites')
        .select('site_slug, design_data, published_domain, custom_domain')
        .eq('id', order.site_id)
        .single();
    const siteName = siteInfo?.site_slug || undefined;
    const logoUrl: string | undefined = siteInfo?.design_data?.headerLogo || siteInfo?.design_data?.siteLogo || undefined;
    const siteOrigin = buildSiteOrigin({
        customDomain: siteInfo?.custom_domain,
        publishedDomain: siteInfo?.published_domain,
    });

    const { data: cvgCustomRows } = await supabase
        .from('email_customizations')
        .select('email_key, overrides')
        .eq('site_id', order.site_id)
        .eq('email_key', 'order_confirmed');
    const cvgOverrides = cvgCustomRows?.[0]?.overrides;

    const { data: ecomSettings } = await supabase
        .from('ecommerce_settings')
        .select('notification_email')
        .eq('site_id', order.site_id)
        .single();

    const currency = order.items?.[0]?.currency || 'CAD';

    // If this is a vendor order, notify the vendor
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
            }).catch(e => console.error(e));
        }

        await supabase
            .from('orders')
            .update({ vendor_notified_at: new Date().toISOString() })
            .eq('id', order.id);
    }

    // If this is a child order of a split cart, the customer mixed-order email was sent at creation.
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

    // Single-order Converge payment (not a split cart) — send full customer confirmation
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
        paymentMethod: 'converge',
        siteName,
        siteOrigin,
        logoUrl,
        overrides: cvgOverrides,
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
            paymentMethod: 'converge',
            siteName,
        }, ecomSettings.notification_email).catch(e => console.error(e));
    }
}
