import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';

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
        .eq('is_archived', false)
        .order('sort_order', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ categories: data });
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { siteId, name } = body;

    if (!siteId || !name) {
        return NextResponse.json({ error: 'Missing siteId or name' }, { status: 400 });
    }

    let access;
    try {
        access = await requireSiteAccess(siteId, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

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
    const body = await request.json();
    const { id, name, sort_order } = body;

    if (!id) {
        return NextResponse.json({ error: 'Missing category id' }, { status: 400 });
    }

    const adminLookup = createAdminClient();
    const { data: row } = await adminLookup.from('booking_categories').select('site_id').eq('id', id).single();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let access;
    try {
        access = await requireSiteAccess(row.site_id, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

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

    const adminLookup = createAdminClient();
    const { data: row } = await adminLookup.from('booking_categories').select('site_id').eq('id', categoryId).single();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let access;
    try {
        access = await requireSiteAccess(row.site_id, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

    const { error } = await supabase
        .from('booking_categories')
        .update({ is_archived: true, archived_on: new Date().toISOString() })
        .eq('id', categoryId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
