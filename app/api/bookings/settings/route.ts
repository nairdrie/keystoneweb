import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

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
        .select('paypal_merchant_id, paypal_onboarding_status, stripe_account_id')
        .eq('id', siteId)
        .single();

    return NextResponse.json({
        settings: data || null,
        paypalConnected:
            !!site?.paypal_merchant_id && site?.paypal_onboarding_status === 'active',
        paypalMerchantId: site?.paypal_merchant_id || null,
        stripeConnected: !!site?.stripe_account_id,
    });
}

export async function PUT(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, ...settings } = body;

    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
