import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/products/orders/export?siteId=...
 * Owner-only. Streams the order history as a CSV (one row per order).
 */

function esc(value: unknown): string {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
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

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const headers = [
        'order_id', 'reference', 'created_at', 'status',
        'customer_name', 'customer_email', 'customer_phone',
        'shipping_line1', 'shipping_city', 'shipping_region', 'shipping_postal', 'shipping_country',
        'items', 'item_count',
        'subtotal', 'shipping', 'shipping_method', 'tax', 'tax_label', 'total', 'currency',
        'payment_method', 'payment_status',
        'tracking_carrier', 'tracking_number',
        'notes',
    ];

    const rows = (orders || []).map(o => {
        const refId = `ORDER-${String(o.id).slice(0, 8).toUpperCase()}`;
        const items = Array.isArray(o.items) ? o.items : [];
        const itemSummary = items.map((i: any) => `${i.qty}x ${i.name}${i.variants ? ` (${Object.values(i.variants).join(', ')})` : ''}`).join(' | ');
        const itemCount = items.reduce((sum: number, i: any) => sum + (i.qty || 0), 0);
        const subtotal = ((o.subtotal_cents || 0) / 100).toFixed(2);
        const shipping = ((o.shipping_cents || 0) / 100).toFixed(2);
        const tax = ((o.tax_cents || 0) / 100).toFixed(2);
        const total = (((o.subtotal_cents || 0) + (o.shipping_cents || 0) + (o.tax_cents || 0)) / 100).toFixed(2);
        const currency = (items[0]?.currency || 'CAD').toUpperCase();
        const addr = o.shipping_address || {};
        return [
            o.id,
            refId,
            o.created_at,
            o.status,
            o.customer_name,
            o.customer_email,
            o.customer_phone || '',
            addr.line1 || '',
            addr.city || '',
            addr.region || addr.province || '',
            addr.postal || '',
            addr.country || '',
            itemSummary,
            itemCount,
            subtotal,
            shipping,
            o.shipping_method || '',
            tax,
            o.tax_label || '',
            total,
            currency,
            o.payment_method,
            o.payment_status,
            o.tracking_carrier || '',
            o.tracking_number || '',
            o.notes || '',
        ];
    });

    const csv = [
        headers.map(esc).join(','),
        ...rows.map(r => r.map(esc).join(',')),
    ].join('\r\n');

    const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
}
