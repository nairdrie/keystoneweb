import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/products/export?siteId=...
 * Owner-only. Streams the full product catalog as a CSV download.
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

    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_archived', false)
        .order('sort_order');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const headers = [
        'id', 'name', 'description', 'category', 'tags',
        'price', 'compare_at_price', 'currency', 'inventory_count',
        'status', 'is_active', 'slug', 'images', 'variants',
        'created_at', 'updated_at',
    ];

    const rows = (products || []).map(p => [
        p.id,
        p.name,
        p.description || '',
        p.category || '',
        Array.isArray(p.tags) ? p.tags.join('; ') : '',
        (p.price_cents / 100).toFixed(2),
        p.compare_at_cents ? (p.compare_at_cents / 100).toFixed(2) : '',
        p.currency || 'CAD',
        p.inventory_count,
        p.status || '',
        p.is_active ? 'true' : 'false',
        p.slug || '',
        Array.isArray(p.images) ? p.images.join(' | ') : '',
        Array.isArray(p.variants) ? JSON.stringify(p.variants) : '',
        p.created_at || '',
        p.updated_at || '',
    ]);

    const csv = [
        headers.map(esc).join(','),
        ...rows.map(r => r.map(esc).join(',')),
    ].join('\r\n');

    const filename = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
}
