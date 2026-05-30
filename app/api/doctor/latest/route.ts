import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';
import type { DiagnosticResult } from '@/lib/health-checks';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/doctor/latest?siteId=...
 *
 * Returns the most recent stored health-check run for the site, or null when
 * the site has never been scanned. Used by the admin Health Check panel to
 * restore the previously displayed results after a page refresh.
 */
export async function GET(request: NextRequest) {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    try {
        await requireSiteAccess(siteId, request);
    } catch (error) {
        return siteAccessErrorResponse(error);
    }

    const admin = createAdminClient();
    const { data, error } = await admin
        .from('site_health_check_runs')
        .select('id, created_at, context, results, summary')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        return NextResponse.json({
            error: 'Failed to load latest health check',
            details: error.message,
        }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ run: null });
    }

    return NextResponse.json({
        run: {
            id: data.id,
            checkedAt: data.created_at,
            context: data.context,
            results: (data.results ?? []) as DiagnosticResult[],
            summary: data.summary ?? null,
        },
    });
}
