import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { scanText } from '@/lib/moderation/text-scan';
import { handleModerationResult } from '@/lib/moderation/report';

/**
 * GET /api/products?siteId=...
 * POST /api/products — Create product (owner)
 * PUT /api/products — Update product (owner)
 * DELETE /api/products?id=... — Delete product (owner)
 */

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const search = request.nextUrl.searchParams.get('search')?.trim() || '';
    const category = request.nextUrl.searchParams.get('category')?.trim() || '';
    const status = request.nextUrl.searchParams.get('status')?.trim() || '';
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('site_id', siteId);

    if (search) {
        const pattern = `%${search}%`;
        query = query.or(`name.ilike.${pattern},description.ilike.${pattern}`);
    }

    if (category) {
        query = query.eq('category', category);
    }

    if (status === 'draft' || status === 'published') {
        query = query.eq('status', status);
    }

    // For public search, only show published active products
    if (search && !status && !category) {
        query = query.eq('is_active', true).eq('status', 'published');
    }

    query = query.order('sort_order', { ascending: true })
        .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch distinct categories for this site (for filter dropdown)
    const { data: catData } = await supabase
        .from('products')
        .select('category')
        .eq('site_id', siteId)
        .not('category', 'is', null)
        .order('category');

    const categories = [...new Set((catData || []).map(r => r.category).filter(Boolean))];

    return NextResponse.json({
        products: data,
        categories,
        pagination: {
            page,
            limit,
            total: count ?? 0,
            totalPages: Math.ceil((count ?? 0) / limit),
        },
    });
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, name, description, price_cents, compare_at_cents, currency, images, variants, inventory_count, vendor_id } = body;

    if (!siteId || !name) {
        return NextResponse.json({ error: 'Missing siteId or name' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Scan product text for illegal content before storing
    const textToScan = [name, description].filter(Boolean).join('\n\n');
    const textScanResult = await scanText(textToScan);
    if (textScanResult.flagged) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? request.headers.get('x-real-ip')
            ?? null;
        await handleModerationResult(
            { ...textScanResult, severity: 'review' as const },
            {
                siteId:      siteId,
                userId:      user.id,
                ipAddress:   ip,
                contentType: 'text',
                contentRef:  null,
                contentHash: null,
            }
        );
        return NextResponse.json({ error: 'Content policy violation' }, { status: 422 });
    }

    // Generate slug
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Get max sort_order
    const { data: existing } = await supabase
        .from('products')
        .select('sort_order')
        .eq('site_id', siteId)
        .order('sort_order', { ascending: false })
        .limit(1);

    const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
        .from('products')
        .insert({
            site_id: siteId,
            name,
            description: description || null,
            price_cents: price_cents || 0,
            compare_at_cents: compare_at_cents || null,
            currency: currency || 'CAD',
            images: images || [],
            variants: variants || [],
            inventory_count: inventory_count ?? -1,
            vendor_id: vendor_id || null,
            slug,
            sort_order: nextOrder,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product: data });
}

export async function PUT(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...fields } = body;

    // Bulk publish all drafts for a site (no id needed)
    if (fields.siteId && fields.publishAll === true) {
        const { data: site } = await supabase.from('sites').select('user_id').eq('id', fields.siteId).single();
        if (!site || site.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { error: pubError } = await supabase
            .from('products')
            .update({ status: 'published', updated_at: new Date().toISOString() })
            .eq('site_id', fields.siteId)
            .eq('status', 'draft');
        if (pubError) return NextResponse.json({ error: pubError.message }, { status: 500 });
        return NextResponse.json({ success: true });
    }

    if (!id) {
        return NextResponse.json({ error: 'Missing product id' }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    const allowedFields = ['name', 'description', 'price_cents', 'compare_at_cents', 'currency', 'images', 'variants', 'inventory_count', 'is_active', 'sort_order', 'status', 'category', 'tags', 'vendor_id'];

    for (const key of allowedFields) {
        if (fields[key] !== undefined) updates[key] = fields[key];
    }

    // Regenerate slug if name changed
    if (fields.name) {
        updates.slug = fields.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product: data });
}

export async function DELETE(request: NextRequest) {
    const productId = request.nextUrl.searchParams.get('id');
    if (!productId) {
        return NextResponse.json({ error: 'Missing product id' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
