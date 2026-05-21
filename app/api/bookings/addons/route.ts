import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');

    let access;
    try {
        access = await requireSiteAccess(siteId, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

    const { data, error } = await supabase
        .from('booking_addons')
        .select('*')
        .eq('site_id', siteId!)
        .eq('is_archived', false)
        .order('created_at', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ addons: data });
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { siteId, name, price_cents } = body;

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

    const { data, error } = await supabase
        .from('booking_addons')
        .insert({ site_id: siteId, name, price_cents: price_cents ?? 0 })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ addon: data });
}

export async function DELETE(request: NextRequest) {
    const addonId = request.nextUrl.searchParams.get('id');
    if (!addonId) {
        return NextResponse.json({ error: 'Missing addon id' }, { status: 400 });
    }

    const adminLookup = createAdminClient();
    const { data: addon } = await adminLookup.from('booking_addons').select('site_id').eq('id', addonId).single();
    if (!addon) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let access;
    try {
        access = await requireSiteAccess(addon.site_id, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

    const { error } = await supabase
        .from('booking_addons')
        .update({ is_archived: true, archived_on: new Date().toISOString() })
        .eq('id', addonId);
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
