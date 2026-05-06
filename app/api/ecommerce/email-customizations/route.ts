import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/ecommerce/email-customizations?siteId=...
 * Returns all email customizations for a site.
 *
 * PUT /api/ecommerce/email-customizations
 * Upsert a single email customization by email_key (owner only).
 * Body: { siteId, emailKey, overrides: { subject?, heading?, subheading?, footerText? } }
 */

export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('email_customizations')
        .select('email_key, overrides')
        .eq('site_id', siteId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customizations: data || [] });
}

export async function PUT(request: NextRequest) {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, emailKey, overrides } = body;

    if (!siteId || !emailKey) {
        return NextResponse.json({ error: 'Missing siteId or emailKey' }, { status: 400 });
    }

    const { data: site } = await supabase
        .from('sites')
        .select('user_id')
        .eq('id', siteId)
        .single();

    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
        .from('email_customizations')
        .upsert(
            { site_id: siteId, email_key: emailKey, overrides: overrides ?? {}, updated_at: new Date().toISOString() },
            { onConflict: 'site_id,email_key' }
        )
        .select('email_key, overrides')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customization: data });
}
