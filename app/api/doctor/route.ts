import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';
import {
    runAllChecks,
    type CheckContext,
    type DiagnosticData,
    type DiagnosticResult,
    type Severity,
} from '@/lib/health-checks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, pass: 2 };
const VALID_CONTEXTS = new Set<CheckContext>(['designer', 'owner', 'ops']);

type DoctorAccess = {
    supabase: SupabaseClient;
    isOps: boolean;
    runByUserId: string;
    targetUserId: string | null;
};

type DiagnosticPayload = {
    data: DiagnosticData;
    ownerUserId: string | null;
};

/**
 * GET /api/doctor?siteId=...&context=designer|owner|ops&includeReachability=true
 *
 * Returns diagnostic data for the prepublish doctor.
 *
 * Access:
 *  - context=designer|owner: requires site access.
 *  - context=ops: requires the authenticated user to be an ops admin.
 */
export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    const context = normalizeContext(request.nextUrl.searchParams.get('context'));
    const includeReachability = request.nextUrl.searchParams.get('includeReachability') === 'true';

    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const access = await resolveDoctorAccess(request, siteId, context);
    if (access instanceof NextResponse) return access;

    const payload = await getDiagnosticPayload(access.supabase, siteId, access.isOps, includeReachability);
    if (!payload) {
        return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    return NextResponse.json({
        ...payload.data,
        context,
    });
}

/**
 * POST /api/doctor
 * Body: { siteId, context?: 'designer'|'owner'|'ops', includeReachability?: boolean }
 *
 * Runs diagnostics on the server, stores the completed run, and returns the
 * results so all health-check surfaces share the same persisted signal.
 */
export async function POST(request: NextRequest) {
    let body: {
        siteId?: string;
        context?: string;
        includeReachability?: boolean;
    } = {};

    try {
        body = await request.json();
    } catch {
        body = {};
    }

    const siteId = body.siteId ?? request.nextUrl.searchParams.get('siteId') ?? undefined;
    const context = normalizeContext(body.context ?? request.nextUrl.searchParams.get('context'));
    const includeReachability = body.includeReachability ?? request.nextUrl.searchParams.get('includeReachability') === 'true';

    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const access = await resolveDoctorAccess(request, siteId, context);
    if (access instanceof NextResponse) return access;

    const payload = await getDiagnosticPayload(access.supabase, siteId, access.isOps, includeReachability);
    if (!payload) {
        return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }
    if (!payload.ownerUserId) {
        return NextResponse.json({ error: 'Site has no owner' }, { status: 400 });
    }

    const results = runAllChecks(payload.data, context)
        .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    const summary = summarizeResults(results);

    // Store with the service-role client after access has been verified above.
    // This keeps the health-check UI from failing because of user-client RLS or
    // admin manage-mode edge cases while still preserving owner/run-by metadata.
    const admin = createAdminClient();
    const { data: run, error: insertError } = await admin
        .from('site_health_check_runs')
        .insert({
            site_id: siteId,
            user_id: payload.ownerUserId,
            run_by_user_id: access.runByUserId,
            context,
            results,
            summary,
        })
        .select('id, created_at')
        .single();

    if (insertError) {
        console.error('Failed to store health check run:', insertError);
        if (isMissingHealthRunsTableError(insertError)) {
            return NextResponse.json({
                results,
                summary,
                checkedAt: new Date().toISOString(),
                context,
                persisted: false,
                persistenceError: insertError.message,
            });
        }

        return NextResponse.json({
            error: 'Failed to store health check run',
            details: insertError.message,
            code: insertError.code,
        }, { status: 500 });
    }

    return NextResponse.json({
        results,
        summary,
        checkedAt: run.created_at,
        context,
        persisted: true,
    });
}

function normalizeContext(value: unknown): CheckContext {
    return typeof value === 'string' && VALID_CONTEXTS.has(value as CheckContext)
        ? value as CheckContext
        : 'designer';
}

async function resolveDoctorAccess(
    request: NextRequest,
    siteId: string,
    context: CheckContext,
): Promise<DoctorAccess | NextResponse> {
    if (context === 'ops') {
        const access = await getOpsAccessContext();
        if (!access?.isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return {
            supabase: createAdminClient(),
            isOps: true,
            runByUserId: access.userId,
            targetUserId: null,
        };
    }

    try {
        const access = await requireSiteAccess(siteId, request);
        return {
            supabase: access.supabase,
            isOps: false,
            runByUserId: access.user.id,
            targetUserId: access.targetUserId,
        };
    } catch (error) {
        return siteAccessErrorResponse(error);
    }
}

async function getDiagnosticPayload(
    supabase: SupabaseClient,
    siteId: string,
    isOps: boolean,
    includeReachability: boolean,
): Promise<DiagnosticPayload | null> {
    const { data: site } = await supabase
        .from('sites')
        .select('*')
        .eq('id', siteId)
        .single();

    if (!site) return null;

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
            .eq('domain', site.pending_custom_domain)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        domainPurchase = dp ?? null;
    }

    let externalLinkResults: Record<string, { ok: boolean; status?: number }> | undefined;
    let imageReachabilityResults: Record<string, { ok: boolean; status?: number }> | undefined;

    if (includeReachability) {
        const reachability = await collectReachability(site, pages || []);
        externalLinkResults = reachability.externalLinkResults;
        imageReachabilityResults = reachability.imageReachabilityResults;
    }

    return {
        ownerUserId: site.user_id ?? null,
        data: {
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
        },
    };
}

async function collectReachability(
    site: { design_data?: unknown },
    pages: Array<{ design_data?: unknown }>,
): Promise<{
    externalLinkResults: Record<string, { ok: boolean; status?: number }>;
    imageReachabilityResults: Record<string, { ok: boolean; status?: number }>;
}> {
    const dd = asRecord(site.design_data);
    const externalUrls = new Set<string>();
    const imageUrls = new Set<string>();

    const collectFromObj = (obj: unknown) => {
        const record = asRecord(obj);
        for (const [key, v] of Object.entries(record)) {
            const nested = asRecord(v);
            if (key.endsWith('Link') && typeof nested.href === 'string') {
                const href = nested.href.trim();
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
                    collectFromObj(item);
                }
            }
        }
    };

    const navItems = Array.isArray(dd.__navItems) ? dd.__navItems : [];
    for (const item of navItems) {
        const navItem = asRecord(item);
        if (navItem.linkType === 'custom' && typeof navItem.href === 'string') {
            const href = navItem.href.trim();
            if (/^https?:\/\//i.test(href)) externalUrls.add(href);
        }
    }

    for (const page of pages) {
        const pageDesign = asRecord(page.design_data);
        const blocksValue = pageDesign.blocks ?? pageDesign.__blocks;
        const blocks = Array.isArray(blocksValue) ? blocksValue : [];
        for (const block of blocks) {
            collectFromObj(asRecord(block).data);
        }
    }

    const MAX_CHECKS = 50;
    const externalList = [...externalUrls].slice(0, MAX_CHECKS);
    const imageList = [...imageUrls].slice(0, MAX_CHECKS);

    return {
        externalLinkResults: await runReachability(externalList),
        imageReachabilityResults: await runReachability(imageList),
    };
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function summarizeResults(results: DiagnosticResult[]) {
    return {
        errors: results.filter(result => result.severity === 'error').length,
        warnings: results.filter(result => result.severity === 'warning').length,
        passed: results.filter(result => result.severity === 'pass').length,
    };
}

function isMissingHealthRunsTableError(error: { code?: string; message?: string }) {
    const message = error.message ?? '';
    return (
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        message.includes('site_health_check_runs') && message.includes('schema cache')
    );
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
