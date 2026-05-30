import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/products/settings?siteId=...
 * Returns e-commerce settings for a site (public read for checkout)
 *
 * PUT /api/products/settings
 * Create or update e-commerce settings (owner only)
 */

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('ecommerce_settings')
        .select('*')
        .eq('site_id', siteId)
        .single();

    if (error && error.code !== 'PGRST116') {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Shippo runs off a single platform-level API key (env). Surface only the
    // boolean to the storefront — the column on ecommerce_settings is unused
    // and never returned.
    const shippoConfigured = !!process.env.SHIPPO_API_KEY;
    let publicSettings: any = data;
    if (data) {
        const { shippo_api_key: _omit, ...rest } = data as any;
        publicSettings = { ...rest, shippo_configured: shippoConfigured };
    } else {
        publicSettings = { shippo_configured: shippoConfigured };
    }

    // Also fetch stripe_account_id and paypal fields from sites table.
    // NOTE: paypal_client_id is safe to expose (it's used in the public JS SDK);
    // paypal_secret must NEVER be returned here — this is an unauthenticated read.
    const { data: site } = await supabase
        .from('sites')
        .select('stripe_account_id, paypal_client_id, paypal_secret, paypal_sandbox_mode, converge_merchant_id, converge_user_id, converge_pin, converge_demo_mode, clover_merchant_id, clover_public_key, clover_private_token, clover_sandbox_mode')
        .eq('id', siteId)
        .single();

    return NextResponse.json({
        settings: publicSettings || null,
        stripeConnected: !!site?.stripe_account_id,
        paypalConnected: !!(site?.paypal_client_id && site?.paypal_secret),
        paypalClientId: site?.paypal_client_id || null,
        paypalSandbox: !!site?.paypal_sandbox_mode,
        convergeConnected: !!(site?.converge_merchant_id && site?.converge_user_id && site?.converge_pin),
        convergeDemoMode: !!site?.converge_demo_mode,
        cloverConnected: !!(site?.clover_merchant_id && site?.clover_public_key && site?.clover_private_token),
        cloverSandboxMode: !!site?.clover_sandbox_mode,
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
        .from('ecommerce_settings')
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
