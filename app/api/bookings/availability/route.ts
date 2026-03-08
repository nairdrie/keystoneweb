import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/bookings/availability?siteId=...
 * Returns weekly availability + blocked dates for a site (public)
 * 
 * PUT /api/bookings/availability
 * Update availability rules (owner only)
 * Body: { siteId, availability: [{ day_of_week, start_time, end_time, is_active }] }
 * 
 * POST /api/bookings/availability/blocked
 * Add a blocked date — handled via query param ?action=block
 * 
 * DELETE /api/bookings/availability/blocked?id=...
 * Remove a blocked date — handled via query param ?action=unblock
 */

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get weekly availability
    const { data: availability, error: avError } = await supabase
        .from('booking_availability')
        .select('*')
        .eq('site_id', siteId)
        .order('day_of_week', { ascending: true });

    // Get blocked dates (only future ones)
    const today = new Date().toISOString().split('T')[0];
    const { data: blockedDates, error: bdError } = await supabase
        .from('booking_blocked_dates')
        .select('*')
        .eq('site_id', siteId)
        .gte('blocked_date', today)
        .order('blocked_date', { ascending: true });

    if (avError || bdError) {
        return NextResponse.json({ error: (avError || bdError)?.message }, { status: 500 });
    }

    return NextResponse.json({ availability: availability || [], blockedDates: blockedDates || [] });
}

export async function PUT(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, availability } = body;

    if (!siteId || !availability) {
        return NextResponse.json({ error: 'Missing siteId or availability' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Upsert each day
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
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, blocked_date, reason } = body;

    if (!siteId || !blocked_date) {
        return NextResponse.json({ error: 'Missing siteId or blocked_date' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
        .from('booking_blocked_dates')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
