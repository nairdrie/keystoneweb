import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

/**
 * GET /api/public/orders/[orderId]
 *
 * Public, no-auth endpoint for the order-confirmation / tracking page.
 * Order IDs are unguessable UUIDs; we surface only fields the customer
 * needs to track their order, never internal payment ids or vendor data.
 */
export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ orderId: string }> },
) {
    const { orderId } = await context.params;
    if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

    const supabase = await createClient();

    const { data: order, error } = await supabase
        .from('orders')
        .select(`
            id,
            site_id,
            items,
            subtotal_cents,
            shipping_cents,
            shipping_method,
            tax_cents,
            tax_label,
            customer_name,
            customer_email,
            shipping_address,
            status,
            payment_method,
            payment_status,
            tracking_number,
            tracking_carrier,
            created_at,
            updated_at,
            parent_order_id
        `)
        .eq('id', orderId)
        .maybeSingle();

    if (error || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Resolve site name + currency context. Currency lives on the items themselves.
    const { data: site } = await supabase
        .from('sites')
        .select('site_slug')
        .eq('id', order.site_id)
        .maybeSingle();

    // For mixed-vendor orders the parent holds the umbrella; siblings carry vendor-specific
    // payment status. Surface them so the page can show per-vendor progress.
    const parentId = order.parent_order_id || order.id;
    const { data: kids } = await supabase
        .from('orders')
        .select('id, status, payment_status, payment_method, subtotal_cents, shipping_cents, items, vendors(name)')
        .eq('parent_order_id', parentId);
    const siblings = kids || [];

    // For e-transfer, we need to surface the merchant's etransfer email + reference
    // so the customer can complete payment from the confirmation page.
    let etransferEmail: string | null = null;
    if (order.payment_method === 'etransfer' && order.payment_status !== 'paid') {
        const { data: ecom } = await supabase
            .from('ecommerce_settings')
            .select('etransfer_email')
            .eq('site_id', order.site_id)
            .maybeSingle();
        etransferEmail = ecom?.etransfer_email || null;
    }

    const items = Array.isArray(order.items) ? order.items : [];
    const currency = items[0]?.currency || 'CAD';

    return NextResponse.json({
        id: order.id,
        siteName: site?.site_slug || null,
        currency,
        status: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        items: items.map((it: any) => ({
            name: it.name,
            qty: it.qty,
            priceCents: it.price_cents,
            variants: it.variants || null,
        })),
        subtotalCents: order.subtotal_cents,
        shippingCents: order.shipping_cents || 0,
        shippingMethod: order.shipping_method || null,
        taxCents: order.tax_cents || 0,
        taxLabel: order.tax_label || null,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        shippingAddress: order.shipping_address || null,
        trackingNumber: order.tracking_number || null,
        trackingCarrier: order.tracking_carrier || null,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        etransferEmail,
        childOrders: siblings.map((s: any) => ({
            id: s.id,
            status: s.status,
            paymentStatus: s.payment_status,
            paymentMethod: s.payment_method,
            subtotalCents: s.subtotal_cents,
            shippingCents: s.shipping_cents || 0,
            vendorName: s.vendors?.name || null,
            items: Array.isArray(s.items)
                ? s.items.map((it: any) => ({
                    name: it.name,
                    qty: it.qty,
                    priceCents: it.price_cents,
                    variants: it.variants || null,
                }))
                : [],
        })),
    });
}
