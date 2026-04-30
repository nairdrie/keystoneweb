import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { PUBLISHED_ROOT } from '@/lib/env/domain';

const MASKED = '••••••••';

function resolveSiteUrl(site: { custom_domain?: string | null; site_slug?: string | null; published_domain?: string | null }): string | null {
    if (site.custom_domain) return `https://${site.custom_domain}`;
    const sub = site.published_domain || site.site_slug;
    if (sub) return `https://${sub}.${PUBLISHED_ROOT}`;
    return null;
}

/**
 * GET /api/site-payment?siteId=...
 * Returns site-level Converge/Clover credentials (masked secrets) for the owner.
 *
 * PUT /api/site-payment
 * Save or update site-level Converge/Clover credentials.
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

    const { data: site } = await supabase
        .from('sites')
        .select('user_id, site_slug, custom_domain, published_domain, converge_merchant_id, converge_user_id, converge_pin, converge_demo_mode, clover_merchant_id, clover_public_key, clover_private_token, clover_webhook_secret, clover_sandbox_mode')
        .eq('id', siteId)
        .single();

    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
        siteUrl: resolveSiteUrl(site),
        converge: {
            merchant_id: site.converge_merchant_id || '',
            user_id: site.converge_user_id || '',
            pin: site.converge_pin ? MASKED : '',
            demo_mode: !!site.converge_demo_mode,
            connected: !!(site.converge_merchant_id && site.converge_user_id && site.converge_pin),
        },
        clover: {
            merchant_id: site.clover_merchant_id || '',
            public_key: site.clover_public_key || '',
            private_token: site.clover_private_token ? MASKED : '',
            webhook_secret: site.clover_webhook_secret ? MASKED : '',
            sandbox_mode: !!site.clover_sandbox_mode,
            connected: !!(site.clover_merchant_id && site.clover_private_token),
        },
    });
}

export async function PUT(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, processor, ...fields } = body;

    if (!siteId || !processor) {
        return NextResponse.json({ error: 'Missing siteId or processor' }, { status: 400 });
    }

    const { data: site } = await supabase
        .from('sites')
        .select('user_id')
        .eq('id', siteId)
        .single();

    if (!site || site.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updates: Record<string, any> = {};

    if (processor === 'converge') {
        if (fields.merchant_id !== undefined) updates.converge_merchant_id = fields.merchant_id || null;
        if (fields.user_id !== undefined) updates.converge_user_id = fields.user_id || null;
        if (fields.pin !== undefined && fields.pin !== MASKED) updates.converge_pin = fields.pin || null;
        if (fields.demo_mode !== undefined) updates.converge_demo_mode = !!fields.demo_mode;
    } else if (processor === 'clover') {
        if (fields.merchant_id !== undefined) updates.clover_merchant_id = fields.merchant_id || null;
        if (fields.public_key !== undefined) updates.clover_public_key = fields.public_key || null;
        if (fields.private_token !== undefined && fields.private_token !== MASKED) updates.clover_private_token = fields.private_token || null;
        if (fields.webhook_secret !== undefined && fields.webhook_secret !== MASKED) updates.clover_webhook_secret = fields.webhook_secret || null;
        if (fields.sandbox_mode !== undefined) updates.clover_sandbox_mode = !!fields.sandbox_mode;
    } else {
        return NextResponse.json({ error: 'Invalid processor' }, { status: 400 });
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { error } = await supabase
        .from('sites')
        .update(updates)
        .eq('id', siteId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
