import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/products/popularity?siteId=...
 * Returns a { [productId]: totalQty } map aggregated from the site's orders.
 * Used by the customer product grid to support "Popular" sort.
 */
export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: orders, error } = await supabase
        .from('orders')
        .select('items, status')
        .eq('site_id', siteId)
        .in('status', ['confirmed', 'shipped', 'completed']);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const popularity: Record<string, number> = {};
    for (const order of orders || []) {
        const items = (order.items as any[]) || [];
        for (const item of items) {
            const pid = item?.productId;
            const qty = Number(item?.qty) || 0;
            if (!pid || qty <= 0) continue;
            popularity[pid] = (popularity[pid] || 0) + qty;
        }
    }

    return NextResponse.json({ popularity });
}
