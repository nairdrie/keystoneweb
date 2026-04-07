import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

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

    const supabase = await createClient();

    let query = supabase
        .from('products')
        .select('*')
        .eq('site_id', siteId);

    if (search) {
        // Fuzzy search across name and description
        const pattern = `%${search}%`;
        query = query.or(`name.ilike.${pattern},description.ilike.${pattern}`);
        query = query.eq('is_active', true).eq('status', 'published');
    }

    query = query.order('sort_order', { ascending: true });

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ products: data });
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, name, description, price_cents, compare_at_cents, currency, images, variants, inventory_count } = body;

    if (!siteId || !name) {
        return NextResponse.json({ error: 'Missing siteId or name' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    if (!id) {
        return NextResponse.json({ error: 'Missing product id' }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    // Bulk publish all drafts for a site
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

    const allowedFields = ['name', 'description', 'price_cents', 'compare_at_cents', 'currency', 'images', 'variants', 'inventory_count', 'is_active', 'sort_order', 'status'];

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
