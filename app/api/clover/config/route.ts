import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/clover/config?orderId=<id>
 * GET /api/clover/config?siteId=<id>
 *
 * Returns public Clover SDK configuration for initializing Clover.js on the client.
 * For orderId: resolves vendor vs site credentials and includes the charge amount.
 * For siteId:  used by bookings (amount is determined separately).
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const orderId = searchParams.get('orderId');
    const siteId = searchParams.get('siteId');

    const supabase = await createClient();

    if (orderId) {
        const { data: order, error } = await supabase
            .from('orders')
            .select('*, vendors(clover_merchant_id, clover_public_key, clover_private_token, clover_sandbox_mode)')
            .eq('id', orderId)
            .single();

        if (error || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        let publicKey: string | null = null;
        let merchantId: string | null = null;
        let sandboxMode = false;

        if (order.vendor_id && order.vendors?.clover_public_key && order.vendors?.clover_merchant_id) {
            publicKey = order.vendors.clover_public_key;
            merchantId = order.vendors.clover_merchant_id;
            sandboxMode = !!order.vendors.clover_sandbox_mode;
        } else {
            const { data: site } = await supabase
                .from('sites')
                .select('clover_public_key, clover_merchant_id, clover_sandbox_mode')
                .eq('id', order.site_id)
                .single();
            publicKey = site?.clover_public_key || null;
            merchantId = site?.clover_merchant_id || null;
            sandboxMode = !!site?.clover_sandbox_mode;
        }

        if (!publicKey || !merchantId) {
            return NextResponse.json({ error: 'Clover not configured' }, { status: 400 });
        }

        const amountCents =
            (order.subtotal_cents || 0) +
            (order.shipping_cents || 0) +
            (order.tax_cents || 0);

        return NextResponse.json({ publicKey, merchantId, sandboxMode, amountCents });
    }

    if (siteId) {
        const { data: site } = await supabase
            .from('sites')
            .select('clover_public_key, clover_merchant_id, clover_sandbox_mode')
            .eq('id', siteId)
            .single();

        if (!site?.clover_public_key || !site?.clover_merchant_id) {
            return NextResponse.json({ error: 'Clover not configured' }, { status: 400 });
        }

        return NextResponse.json({
            publicKey: site.clover_public_key,
            merchantId: site.clover_merchant_id,
            sandboxMode: !!site.clover_sandbox_mode,
        });
    }

    return NextResponse.json({ error: 'Missing orderId or siteId' }, { status: 400 });
}
