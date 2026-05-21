import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/doctor?siteId=...&context=designer|owner|ops&includeReachability=true
 *
 * Returns diagnostic data for the prepublish doctor.
 *
 * Access:
 *  - context=designer|owner — requires the authenticated user to own the site.
 *  - context=ops            — requires the authenticated user to be an ops admin.
 */
export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    const context = request.nextUrl.searchParams.get('context') ?? 'designer';
    const includeReachability = request.nextUrl.searchParams.get('includeReachability') === 'true';

    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    let supabase;
    let isOps = false;

    if (context === 'ops') {
        const access = await getOpsAccessContext();
        if (!access?.isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        supabase = createAdminClient();
        isOps = true;
    } else {
        supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: site, error: siteError } = await supabase
            .from('sites')
            .select('user_id')
            .eq('id', siteId)
            .single();

        if (siteError || !site || site.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    const { data: site } = await supabase
        .from('sites')
        .select('*')
        .eq('id', siteId)
        .single();

    if (!site) {
        return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const { data: pages } = await supabase
        .from('pages')
        .select('*')
        .eq('site_id', siteId)
        .order('nav_order', { ascending: true });

    const { data: bookingSettings } = await supabase
        .from('booking_settings')
        .select('*')
        .eq('site_id', siteId)
        .single();

    const { data: bookingServices } = await supabase
        .from('booking_services')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_active', true)
        .eq('is_archived', false);

    const { data: ecommerceSettings } = await supabase
        .from('ecommerce_settings')
        .select('*')
        .eq('site_id', siteId)
        .single();

    const { data: products } = await supabase
        .from('products')
        .select('id, name, price_cents, is_active, images')
        .eq('site_id', siteId)
        .eq('is_active', true)
        .eq('is_archived', false);

    let domainPurchase: { status?: string | null; transfer_status?: string | null } | null = null;
    if (isOps && site.pending_custom_domain) {
        const { data: dp } = await supabase
            .from('domain_purchases')
            .select('status, transfer_status')
            .eq('domain_name', site.pending_custom_domain)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        domainPurchase = dp ?? null;
    }

    let externalLinkResults: Record<string, { ok: boolean; status?: number }> | undefined;
    let imageReachabilityResults: Record<string, { ok: boolean; status?: number }> | undefined;

    if (includeReachability) {
        const allPages = pages || [];
        const dd = site.design_data || {};

        const externalUrls = new Set<string>();
        const imageUrls = new Set<string>();

        const collectFromObj = (obj: any) => {
            for (const key of Object.keys(obj || {})) {
                const v = obj[key];
                if (key.endsWith('Link') && v && typeof v === 'object' && typeof v.href === 'string') {
                    const href = v.href.trim();
                    if (/^https?:\/\//i.test(href)) externalUrls.add(href);
                }
                if (key === 'ctaUrl' && typeof v === 'string' && /^https?:\/\//i.test(v)) {
                    externalUrls.add(v);
                }
                if (typeof v === 'string' && v.startsWith('http') && /\.(jpg|jpeg|png|gif|webp|svg)/i.test(v)) {
                    imageUrls.add(v);
                }
                if (Array.isArray(v)) {
                    for (const item of v) {
                        if (item && typeof item === 'object') collectFromObj(item);
                    }
                }
            }
        };

        for (const item of dd.__navItems || []) {
            if (item.linkType === 'custom' && typeof item.href === 'string' && /^https?:\/\//i.test(item.href)) {
                externalUrls.add(item.href);
            }
        }

        for (const page of allPages) {
            const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
            for (const block of blocks) {
                collectFromObj(block.data || {});
            }
        }

        const MAX_CHECKS = 50;
        const externalList = [...externalUrls].slice(0, MAX_CHECKS);
        const imageList = [...imageUrls].slice(0, MAX_CHECKS);

        externalLinkResults = await runReachability(externalList);
        imageReachabilityResults = await runReachability(imageList);
    }

    return NextResponse.json({
        site: {
            id: site.id,
            design_data: site.design_data,
            is_published: site.is_published,
            stripe_account_id: site.stripe_account_id,
            translations_config: site.translations_config || null,
            translations: site.translations || null,
            favicon_url: site.favicon_url ?? null,
            custom_domain: site.custom_domain ?? null,
            pending_custom_domain: site.pending_custom_domain ?? null,
            analytics_provider: site.analytics_provider ?? null,
            analytics_id: site.analytics_id ?? null,
        },
        pages: pages || [],
        bookingSettings: bookingSettings || null,
        bookingServices: bookingServices || [],
        ecommerceSettings: ecommerceSettings || null,
        products: products || [],
        domainPurchase,
        externalLinkResults,
        imageReachabilityResults,
        context,
    });
}

async function runReachability(
    urls: string[],
): Promise<Record<string, { ok: boolean; status?: number }>> {
    const out: Record<string, { ok: boolean; status?: number }> = {};
    await Promise.all(
        urls.map(async (url) => {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 4000);
                const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
                clearTimeout(timeout);
                out[url] = { ok: res.ok, status: res.status };
            } catch {
                out[url] = { ok: false };
            }
        }),
    );
    return out;
}
