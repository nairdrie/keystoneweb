import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/clover/status?orderId=...
 *
 * Polls an order's payment status. Used by the post-redirect client screen
 * while waiting for the Clover webhook to mark the order paid.
 */
export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const orderId = request.nextUrl.searchParams.get('orderId');
    if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

    const { data: order, error } = await supabase
        .from('orders')
        .select('id, status, payment_status, payment_method, clover_charge_id')
        .eq('id', orderId)
        .single();

    if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    return NextResponse.json({
        orderId: order.id,
        status: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        hasCharge: !!order.clover_charge_id,
    });
}
