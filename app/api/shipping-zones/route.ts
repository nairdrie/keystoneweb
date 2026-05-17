import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET  /api/shipping-zones?siteId=... — List zones (public, for checkout)
 * POST /api/shipping-zones — Create zone (owner only)
 * PUT  /api/shipping-zones — Update zone (owner only)
 * DELETE /api/shipping-zones?id=... — Delete zone (owner only)
 */

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('shipping_zones')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_archived', false)
        .order('sort_order');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ zones: data || [] });
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, name, countries, regions, rate_type, rate_cents, free_threshold_cents, is_local_pickup, sort_order, carrier_services, markup_type, markup_cents } = body;

    if (!siteId || !name || !countries?.length) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
        .from('shipping_zones')
        .insert({
            site_id: siteId,
            name,
            countries,
            regions: regions || [],
            rate_type: rate_type || 'flat',
            rate_cents: rate_cents || 0,
            free_threshold_cents: free_threshold_cents || 0,
            is_local_pickup: is_local_pickup || false,
            sort_order: sort_order ?? 0,
            carrier_services: Array.isArray(carrier_services) ? carrier_services : [],
            markup_type: markup_type === 'flat' ? 'flat' : 'exact',
            markup_cents: typeof markup_cents === 'number' && markup_cents >= 0 ? Math.round(markup_cents) : 0,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ zone: data });
}

export async function PUT(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, siteId, ...updates } = body;

    if (!id) {
        return NextResponse.json({ error: 'Missing zone id' }, { status: 400 });
    }

    // Verify ownership via zone's site_id
    const { data: zone } = await supabase
        .from('shipping_zones')
        .select('site_id')
        .eq('id', id)
        .single();

    if (!zone) {
        return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    const { data: site } = await supabase.from('sites').select('user_id').eq('id', zone.site_id).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allowedFields = ['name', 'countries', 'regions', 'rate_type', 'rate_cents', 'free_threshold_cents', 'is_local_pickup', 'sort_order', 'carrier_services', 'markup_type', 'markup_cents'];
    const filtered: Record<string, any> = {};
    for (const key of allowedFields) {
        if (updates[key] !== undefined) filtered[key] = updates[key];
    }

    const { data, error } = await supabase
        .from('shipping_zones')
        .update(filtered)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ zone: data });
}

export async function DELETE(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
        return NextResponse.json({ error: 'Missing zone id' }, { status: 400 });
    }

    // Verify ownership
    const { data: zone } = await supabase
        .from('shipping_zones')
        .select('site_id')
        .eq('id', id)
        .single();

    if (!zone) {
        return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    const { data: site } = await supabase.from('sites').select('user_id').eq('id', zone.site_id).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
        .from('shipping_zones')
        .update({ is_archived: true, archived_on: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
