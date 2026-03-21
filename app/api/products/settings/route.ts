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

    // Also fetch stripe_account_id from sites table
    const { data: site } = await supabase
        .from('sites')
        .select('stripe_account_id')
        .eq('id', siteId)
        .single();

    return NextResponse.json({
        settings: data || null,
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
