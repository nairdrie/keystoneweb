import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/bookings/categories?siteId=...
 * Returns categories for a site
 * 
 * POST /api/bookings/categories
 * Create a new category (owner only)
 * 
 * PUT /api/bookings/categories
 * Update a category (owner only)
 * 
 * DELETE /api/bookings/categories?id=...
 * Delete a category (owner only)
 */

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('booking_categories')
        .select('*')
        .eq('site_id', siteId)
        .order('sort_order', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ categories: data });
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, name } = body;

    if (!siteId || !name) {
        return NextResponse.json({ error: 'Missing siteId or name' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get max sort_order
    const { data: existing } = await supabase
        .from('booking_categories')
        .select('sort_order')
        .eq('site_id', siteId)
        .order('sort_order', { ascending: false })
        .limit(1);

    const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
        .from('booking_categories')
        .insert({
            site_id: siteId,
            name,
            sort_order: nextOrder,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ category: data });
}

export async function PUT(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, sort_order } = body;

    if (!id) {
        return NextResponse.json({ error: 'Missing category id' }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const { data, error } = await supabase
        .from('booking_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ category: data });
}

export async function DELETE(request: NextRequest) {
    const categoryId = request.nextUrl.searchParams.get('id');

    if (!categoryId) {
        return NextResponse.json({ error: 'Missing category id' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
        .from('booking_categories')
        .delete()
        .eq('id', categoryId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
