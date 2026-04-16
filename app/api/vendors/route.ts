import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * GET /api/vendors?siteId=... — List vendors for a site (owner only)
 * POST /api/vendors — Create vendor (owner only)
 * PUT /api/vendors — Update vendor (owner only)
 * DELETE /api/vendors?id=... — Delete vendor (owner only)
 */

async function verifyOwnership(supabase: any, siteId: string, userId: string) {
    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    return site && site.user_id === userId;
}

export async function GET(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    if (!(await verifyOwnership(supabase, siteId, user.id))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ vendors: data });
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, name, contactEmail, paymentMode } = body;

    if (!siteId || !name || !contactEmail) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!(await verifyOwnership(supabase, siteId, user.id))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: vendor, error } = await supabase
        .from('vendors')
        .insert({
            site_id: siteId,
            name,
            contact_email: contactEmail,
            payment_mode: paymentMode || 'external',
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate a portal access token for this vendor
    const token = crypto.randomBytes(32).toString('hex');
    await supabase.from('vendor_order_tokens').insert({
        vendor_id: vendor.id,
        site_id: siteId,
        token,
    });

    return NextResponse.json({ vendor, portalToken: token });
}

export async function PUT(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, contactEmail, paymentMode } = body;

    if (!id) {
        return NextResponse.json({ error: 'Missing vendor id' }, { status: 400 });
    }

    // Fetch vendor to verify ownership
    const { data: vendor } = await supabase.from('vendors').select('site_id').eq('id', id).single();
    if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    if (!(await verifyOwnership(supabase, vendor.site_id, user.id))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (contactEmail !== undefined) updates.contact_email = contactEmail;
    if (paymentMode !== undefined) updates.payment_mode = paymentMode;

    const { data, error } = await supabase
        .from('vendors')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ vendor: data });
}

export async function DELETE(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vendorId = request.nextUrl.searchParams.get('id');
    if (!vendorId) {
        return NextResponse.json({ error: 'Missing vendor id' }, { status: 400 });
    }

    // Fetch vendor to verify ownership
    const { data: vendor } = await supabase.from('vendors').select('site_id').eq('id', vendorId).single();
    if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    if (!(await verifyOwnership(supabase, vendor.site_id, user.id))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase.from('vendors').delete().eq('id', vendorId);
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
