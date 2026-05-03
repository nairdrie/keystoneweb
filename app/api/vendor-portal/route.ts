import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { sendVendorOrderStatusUpdate } from '@/lib/email';

/**
 * GET /api/vendor-portal?token=... — Fetch vendor info + orders (public, token-auth)
 * PUT /api/vendor-portal — Update order status (public, token-auth)
 */

async function getVendorByToken(supabase: any, token: string) {
    const { data: tokenRow } = await supabase
        .from('vendor_order_tokens')
        .select('vendor_id, site_id, expires_at')
        .eq('token', token)
        .single();

    if (!tokenRow) return null;
    if (new Date(tokenRow.expires_at) < new Date()) return null;

    const { data: vendor } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', tokenRow.vendor_id)
        .eq('is_archived', false)
        .single();

    return vendor ? { ...vendor, tokenSiteId: tokenRow.site_id } : null;
}

export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
        return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const supabase = await createClient();
    const vendor = await getVendorByToken(supabase, token);
    if (!vendor) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Fetch orders assigned to this vendor
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('vendor_id', vendor.id)
        .eq('site_id', vendor.tokenSiteId)
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch site name
    const { data: site } = await supabase
        .from('sites')
        .select('site_slug')
        .eq('id', vendor.tokenSiteId)
        .single();

    return NextResponse.json({
        vendor: { id: vendor.id, name: vendor.name, contact_email: vendor.contact_email },
        siteName: site?.site_slug || 'Store',
        orders: orders || [],
    });
}

export async function PUT(request: NextRequest) {
    const supabase = await createClient();
    const body = await request.json();
    const { token, orderId, status, payment_status } = body;

    if (!token || !orderId) {
        return NextResponse.json({ error: 'Missing token or orderId' }, { status: 400 });
    }

    const vendor = await getVendorByToken(supabase, token);
    if (!vendor) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Verify order belongs to this vendor
    const { data: existingOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('vendor_id', vendor.id)
        .single();

    if (!existingOrder) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    // Vendors can mark as: payment collected, shipped, completed
    const allowedStatuses = ['confirmed', 'shipped', 'completed'];
    if (status && allowedStatuses.includes(status)) {
        updates.status = status;
    }
    if (payment_status === 'paid') {
        updates.payment_status = 'paid';
    }

    const { data: updatedOrder, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify site owner about the vendor's status update
    const { data: ecomSettings } = await supabase
        .from('ecommerce_settings')
        .select('notification_email')
        .eq('site_id', existingOrder.site_id)
        .single();

    if (ecomSettings?.notification_email) {
        const { data: site } = await supabase
            .from('sites')
            .select('site_slug')
            .eq('id', existingOrder.site_id)
            .single();

        sendVendorOrderStatusUpdate({
            orderId: existingOrder.id,
            vendorName: vendor.name,
            newStatus: updates.status || existingOrder.status,
            newPaymentStatus: updates.payment_status || existingOrder.payment_status,
            customerName: existingOrder.customer_name,
            items: existingOrder.items,
            ownerEmail: ecomSettings.notification_email,
            siteName: site?.site_slug || undefined,
        }).catch(err => console.error('Vendor status update email failed:', err));
    }

    // If vendor marked payment as collected + confirmed, notify the customer
    if (updates.payment_status === 'paid' || updates.status === 'confirmed') {
        const { data: site } = await supabase
            .from('sites')
            .select('site_slug')
            .eq('id', existingOrder.site_id)
            .single();

        const { sendVendorOrderCustomerUpdate } = await import('@/lib/email');
        sendVendorOrderCustomerUpdate({
            orderId: existingOrder.id,
            vendorName: vendor.name,
            customerName: existingOrder.customer_name,
            customerEmail: existingOrder.customer_email,
            items: existingOrder.items,
            status: updates.status || existingOrder.status,
            paymentStatus: updates.payment_status || existingOrder.payment_status,
            siteName: site?.site_slug || undefined,
        }).catch(err => console.error('Vendor customer update email failed:', err));
    }

    return NextResponse.json({ order: updatedOrder });
}
