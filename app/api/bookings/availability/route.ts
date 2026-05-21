import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';

/**
 * GET /api/bookings/availability?siteId=...
 * Returns weekly availability + blocked dates for a site (public)
 *
 * PUT /api/bookings/availability
 * Update availability rules (owner only)
 *
 * POST /api/bookings/availability
 * Add a blocked date (owner only)
 *
 * DELETE /api/bookings/availability?id=...
 * Remove a blocked date (owner only)
 */

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: availability, error: avError } = await supabase
        .from('booking_availability')
        .select('*')
        .eq('site_id', siteId)
        .order('day_of_week', { ascending: true });

    const today = new Date().toISOString().split('T')[0];
    const { data: blockedDates, error: bdError } = await supabase
        .from('booking_blocked_dates')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_archived', false)
        .gte('blocked_date', today)
        .order('blocked_date', { ascending: true });

    if (avError || bdError) {
        return NextResponse.json({ error: (avError || bdError)?.message }, { status: 500 });
    }

    return NextResponse.json({ availability: availability || [], blockedDates: blockedDates || [] });
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    const { siteId, availability } = body;

    if (!siteId || !availability) {
        return NextResponse.json({ error: 'Missing siteId or availability' }, { status: 400 });
    }

    let access;
    try {
        access = await requireSiteAccess(siteId, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

    const results = [];
    for (const day of availability) {
        const { data, error } = await supabase
            .from('booking_availability')
            .upsert({
                site_id: siteId,
                day_of_week: day.day_of_week,
                start_time: day.start_time,
                end_time: day.end_time,
                is_active: day.is_active,
            }, { onConflict: 'site_id,day_of_week' })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        results.push(data);
    }

    return NextResponse.json({ availability: results });
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { siteId, blocked_date, reason } = body;

    if (!siteId || !blocked_date) {
        return NextResponse.json({ error: 'Missing siteId or blocked_date' }, { status: 400 });
    }

    let access;
    try {
        access = await requireSiteAccess(siteId, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

    const { data, error } = await supabase
        .from('booking_blocked_dates')
        .insert({ site_id: siteId, blocked_date, reason: reason || null })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: 'Date already blocked' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ blockedDate: data });
}

export async function DELETE(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
        return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const adminLookup = createAdminClient();
    const { data: row } = await adminLookup.from('booking_blocked_dates').select('site_id').eq('id', id).single();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let access;
    try {
        access = await requireSiteAccess(row.site_id, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

    const { error } = await supabase
        .from('booking_blocked_dates')
        .update({ is_archived: true, archived_on: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
