/**
 * AI enrichment trigger.
 *
 *   POST /api/products/ai-enrich  { productId } | { siteId, all: true }
 *
 * The single-product call runs enrichment inline (fast path used by the
 * product editor after save). The bulk call enqueues every published
 * product on the site that hasn't been enriched yet and returns immediately
 * — the worker progresses asynchronously by repeatedly hitting this same
 * route from the merchant dashboard.
 *
 * Site-owner only; goes through requireSiteAccess so an admin in Manage
 * mode can re-enrich a tenant's catalog too.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';
import { enrichProductById } from '@/lib/ucp/enrich';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { productId?: string; siteId?: string; all?: boolean; limit?: number };

  if (body.productId) {
    const admin = createAdminClient();
    const { data: product } = await admin.from('products').select('site_id').eq('id', body.productId).maybeSingle();
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    try {
      await requireSiteAccess(product.site_id, request);
    } catch (e) {
      return siteAccessErrorResponse(e);
    }
    const result = await enrichProductById(body.productId);
    return NextResponse.json(result);
  }

  if (body.siteId && body.all) {
    try {
      await requireSiteAccess(body.siteId, request);
    } catch (e) {
      return siteAccessErrorResponse(e);
    }
    const limit = Math.min(20, Math.max(1, body.limit || 10));
    const admin = createAdminClient();
    const { data } = await admin
      .from('products')
      .select('id')
      .eq('site_id', body.siteId)
      .eq('is_archived', false)
      .is('ai_enriched_at', null)
      .limit(limit);

    const ids = (data || []).map(d => d.id);
    const results: Array<{ id: string; status: string }> = [];
    for (const id of ids) {
      const r = await enrichProductById(id);
      results.push({ id, status: r.status });
    }
    const { count: remaining } = await admin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', body.siteId)
      .eq('is_archived', false)
      .is('ai_enriched_at', null);

    return NextResponse.json({ processed: results.length, results, remaining: remaining ?? 0 });
  }

  return NextResponse.json({ error: 'Provide productId or { siteId, all: true }' }, { status: 400 });
}
