import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/bookings/addons?siteId=...
 * Returns all reusable add-on variants for a site (owner only)
 *
 * POST /api/bookings/addons
 * Create a new reusable add-on variant (owner only)
 * Body: { siteId, name, price_cents }
 *
 * DELETE /api/bookings/addons?id=...
 * Delete a reusable add-on variant (owner only)
 */

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

    const { data, error } = await supabase
        .from('booking_addons')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_archived', false)
        .order('created_at', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ addons: data });
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, name, price_cents } = body;

    if (!siteId || !name) {
        return NextResponse.json({ error: 'Missing siteId or name' }, { status: 400 });
    }

    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership via site
    const { data: addon } = await supabase
        .from('booking_addons')
        .select('site_id, sites(user_id)')
        .eq('id', addonId)
        .single();

    if (!addon) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const siteUserId = (addon.sites as any)?.user_id;
    if (siteUserId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
        .from('booking_addons')
        .update({ is_archived: true, archived_on: new Date().toISOString() })
        .eq('id', addonId);
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
