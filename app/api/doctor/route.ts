import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/doctor?siteId=...
 * Returns diagnostic data for the prepublish doctor.
 * Aggregates pages, blocks, nav items, booking/ecommerce settings, and site config.
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

    // Verify ownership
    const { data: site, error: siteError } = await supabase
        .from('sites')
        .select('*')
        .eq('id', siteId)
        .single();

    if (siteError || !site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all pages
    const { data: pages } = await supabase
        .from('pages')
        .select('*')
        .eq('site_id', siteId)
        .order('nav_order', { ascending: true });

    // Fetch booking settings
    const { data: bookingSettings } = await supabase
        .from('booking_settings')
        .select('*')
        .eq('site_id', siteId)
        .single();

    // Fetch booking services
    const { data: bookingServices } = await supabase
        .from('booking_services')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_active', true);

    // Fetch ecommerce settings
    const { data: ecommerceSettings } = await supabase
        .from('ecommerce_settings')
        .select('*')
        .eq('site_id', siteId)
        .single();

    // Fetch products
    const { data: products } = await supabase
        .from('products')
        .select('id, name, price_cents, is_active, images')
        .eq('site_id', siteId)
        .eq('is_active', true);

    return NextResponse.json({
        site: {
            id: site.id,
            design_data: site.design_data,
            is_published: site.is_published,
            stripe_account_id: site.stripe_account_id,
            translations_config: site.translations_config || null,
            translations: site.translations || null,
        },
        pages: pages || [],
        bookingSettings: bookingSettings || null,
        bookingServices: bookingServices || [],
        ecommerceSettings: ecommerceSettings || null,
        products: products || [],
    });
}
