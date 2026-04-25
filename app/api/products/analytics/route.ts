import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/products/analytics?siteId=...
 * Owner-only. Returns sales KPIs:
 *  - revenue (30d) + trend vs. previous 30d
 *  - orders count + trend
 *  - average order value (AOV)
 *  - top 5 products by revenue (last 30d)
 *  - daily revenue series (last 30d, for sparkline)
 *  - current open-order counts by status
 *
 * Revenue only counts non-cancelled orders with status in
 * ('confirmed','shipped','completed') to avoid double-counting pending
 * e-transfers that haven't been paid yet.
 */

const COUNTED_STATUSES = new Set(['confirmed', 'shipped', 'completed']);

function totalCents(order: any): number {
    return (order.subtotal_cents || 0) + (order.shipping_cents || 0) + (order.tax_cents || 0);
}

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const windowStart = new Date(now - 30 * DAY_MS).toISOString();
    const prevWindowStart = new Date(now - 60 * DAY_MS).toISOString();

    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, status, created_at, subtotal_cents, shipping_cents, tax_cents, items')
        .eq('site_id', siteId)
        .gte('created_at', prevWindowStart)
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const all = orders || [];
    const counted = all.filter(o => COUNTED_STATUSES.has(o.status));

    // Revenue trend
    const current = counted.filter(o => new Date(o.created_at).getTime() >= now - 30 * DAY_MS);
    const previous = counted.filter(o => {
        const t = new Date(o.created_at).getTime();
        return t >= now - 60 * DAY_MS && t < now - 30 * DAY_MS;
    });

    const currentRevenueCents = current.reduce((sum, o) => sum + totalCents(o), 0);
    const previousRevenueCents = previous.reduce((sum, o) => sum + totalCents(o), 0);

    const revenueChangePct = previousRevenueCents === 0
        ? null
        : Math.round(((currentRevenueCents - previousRevenueCents) / previousRevenueCents) * 100);
    const ordersChangePct = previous.length === 0
        ? null
        : Math.round(((current.length - previous.length) / previous.length) * 100);

    const aovCents = current.length === 0 ? 0 : Math.round(currentRevenueCents / current.length);

    // Daily series (last 30 days)
    const daily: { date: string; revenueCents: number; orders: number }[] = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now - i * DAY_MS);
        const key = d.toISOString().slice(0, 10);
        const dayOrders = current.filter(o => o.created_at.slice(0, 10) === key);
        daily.push({
            date: key,
            revenueCents: dayOrders.reduce((sum, o) => sum + totalCents(o), 0),
            orders: dayOrders.length,
        });
    }

    // Top products (revenue-weighted) from the current window
    const productRevenue: Record<string, { name: string; revenueCents: number; qty: number }> = {};
    for (const order of current) {
        const items = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
            const pid = item?.productId;
            if (!pid) continue;
            const line = (item.price_cents || 0) * (item.qty || 0);
            if (!productRevenue[pid]) {
                productRevenue[pid] = { name: item.name || 'Unknown', revenueCents: 0, qty: 0 };
            }
            productRevenue[pid].revenueCents += line;
            productRevenue[pid].qty += item.qty || 0;
        }
    }
    const topProducts = Object.entries(productRevenue)
        .map(([id, v]) => ({ productId: id, ...v }))
        .sort((a, b) => b.revenueCents - a.revenueCents)
        .slice(0, 5);

    // Status counts over the entire fetched window (for at-a-glance pipeline view)
    const statusCounts: Record<string, number> = {};
    for (const o of all) {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }

    return NextResponse.json({
        window: { days: 30 },
        revenue: {
            currentCents: currentRevenueCents,
            previousCents: previousRevenueCents,
            changePct: revenueChangePct,
        },
        orders: {
            current: current.length,
            previous: previous.length,
            changePct: ordersChangePct,
        },
        aovCents,
        daily,
        topProducts,
        statusCounts,
    });
}
