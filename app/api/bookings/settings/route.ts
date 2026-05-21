import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';

/**
 * GET /api/bookings/settings?siteId=...
 * Returns booking settings for a site (public read)
 * 
 * PUT /api/bookings/settings
 * Create or update booking settings (owner only)
 */

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('booking_settings')
        .select('*')
        .eq('site_id', siteId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also expose the site's PayPal merchant id publicly so the customer-side
    // booking flow can initialize the PayPal Smart Buttons with merchant-id.
    const { data: site } = await supabase
        .from('sites')
        .select('paypal_merchant_id, paypal_onboarding_status, stripe_account_id, converge_merchant_id, converge_user_id, converge_pin, converge_demo_mode, clover_merchant_id, clover_public_key, clover_private_token, clover_sandbox_mode')
        .eq('id', siteId)
        .single();

    return NextResponse.json({
        settings: data || null,
        paypalConnected:
            !!site?.paypal_merchant_id && site?.paypal_onboarding_status === 'active',
        paypalMerchantId: site?.paypal_merchant_id || null,
        stripeConnected: !!site?.stripe_account_id,
        convergeConnected: !!(site?.converge_merchant_id && site?.converge_user_id && site?.converge_pin),
        convergeDemoMode: !!site?.converge_demo_mode,
        cloverConnected: !!(site?.clover_merchant_id && site?.clover_public_key && site?.clover_private_token),
        cloverSandboxMode: !!site?.clover_sandbox_mode,
    });
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    const { siteId, ...settings } = body;

    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    let access;
    try {
        access = await requireSiteAccess(siteId, request);
    } catch (e) {
        return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

    const { data, error } = await supabase
        .from('booking_settings')
        .upsert({
            site_id: siteId,
            ...settings,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'site_id' })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: data });
}
