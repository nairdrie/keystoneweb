import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';

/**
 * GET /api/bookings/services?siteId=...
 * Returns active services for a site (public) or all services (owner)
 * 
 * POST /api/bookings/services
 * Create a new service (owner only)
 * 
 * PUT /api/bookings/services
 * Update a service (owner only)
 * 
 * DELETE /api/bookings/services?id=...
 * Delete a service (owner only)
 */

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('booking_services')
        .select('*, booking_categories(name)')
        .eq('site_id', siteId)
        .eq('is_archived', false)
        .order('sort_order', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ services: data });
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { siteId, name, description, duration_minutes, price_cents, currency, category_id, is_featured, compare_at_price_cents, options, options_required } = body;

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

    // Get max sort_order
    const { data: existing } = await supabase
        .from('booking_services')
        .select('sort_order')
        .eq('site_id', siteId)
        .order('sort_order', { ascending: false })
        .limit(1);

    const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
        .from('booking_services')
        .insert({
            site_id: siteId,
            name,
            description: description || null,
            duration_minutes: duration_minutes || 30,
            price_cents: price_cents || 0,
            currency: currency || 'CAD',
            category_id: category_id || null,
            is_featured: is_featured ?? false,
            compare_at_price_cents: compare_at_price_cents ?? null,
            options: options ?? null,
            options_required: options_required !== undefined ? options_required : true,
            sort_order: nextOrder,
        })
        .select('*, booking_categories(name)')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ service: data });
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    const { id, name, description, duration_minutes, price_cents, currency, is_active, sort_order, category_id, is_featured, compare_at_price_cents, options, options_required, status, siteId: bodySiteId, publishAll } = body;

    // Bulk publish all drafts for a site
    if (bodySiteId && publishAll === true) {
        let access;
        try {
            access = await requireSiteAccess(bodySiteId, request);
        } catch (e) {
            return siteAccessErrorResponse(e);
        }
        const { supabase } = access;
        const { error: pubError } = await supabase
            .from('booking_services')
            .update({ status: 'published', updated_at: new Date().toISOString() })
            .eq('site_id', bodySiteId)
            .eq('status', 'draft')
            .eq('is_archived', false);
        if (pubError) return NextResponse.json({ error: pubError.message }, { status: 500 });
        return NextResponse.json({ success: true });
    }

    if (!id) {
        return NextResponse.json({ error: 'Missing service id' }, { status: 400 });
    }

    // Resolve site_id from the service for access check.
    const adminLookup = createAdminClient();
    const { data: svc } = await adminLookup.from('booking_services').select('site_id').eq('id', id).single();
    if (!svc) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    let access;
    try {
        access = await requireSiteAccess(svc.site_id, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
    if (price_cents !== undefined) updates.price_cents = price_cents;
    if (currency !== undefined) updates.currency = currency;
    if (is_active !== undefined) updates.is_active = is_active;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (category_id !== undefined) updates.category_id = category_id;
    if (is_featured !== undefined) updates.is_featured = is_featured;
    if (compare_at_price_cents !== undefined) updates.compare_at_price_cents = compare_at_price_cents;
    if (options !== undefined) updates.options = options;
    if (options_required !== undefined) updates.options_required = options_required;
    if (status !== undefined) updates.status = status;

    const { data, error } = await supabase
        .from('booking_services')
        .update(updates)
        .eq('id', id)
        .select('*, booking_categories(name)')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ service: data });
}

export async function DELETE(request: NextRequest) {
    const serviceId = request.nextUrl.searchParams.get('id');

    if (!serviceId) {
        return NextResponse.json({ error: 'Missing service id' }, { status: 400 });
    }

    const adminLookup = createAdminClient();
    const { data: svc } = await adminLookup.from('booking_services').select('site_id').eq('id', serviceId).single();
    if (!svc) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    let access;
    try {
        access = await requireSiteAccess(svc.site_id, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

    const { error } = await supabase
        .from('booking_services')
        .update({ is_archived: true, archived_on: new Date().toISOString() })
        .eq('id', serviceId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
