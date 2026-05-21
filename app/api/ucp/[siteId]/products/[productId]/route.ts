/**
 * Real-time single-product endpoint. Distinct from the bulk catalog so
 * agents executing compatibility checks ("will this fit my AM5 socket?")
 * can get the freshest price + inventory + AI attribute payload without
 * pulling the whole catalog.
 *
 * Edge-cache window is intentionally short (5s) — Universal Cart cross-
 * references price history, so stale prices here cost the merchant
 * placement in AI Mode results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { loadUcpSiteContext } from '@/lib/ucp/site-context';
import { mapProductToUcp } from '@/lib/ucp/product-mapper';
import { logAgentActivity } from '@/lib/ucp/agent-detect';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; productId: string }> },
) {
  const { siteId, productId } = await params;
  const ctx = await loadUcpSiteContext(siteId);
  if (!ctx) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const admin = createAdminClient();
  // Accept either an id or a slug — agents typically remember slugs after
  // following a search-result URL, and we want both lookups to succeed.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId);
  let query = admin
    .from('products')
    .select('*')
    .eq('site_id', siteId)
    .eq('is_archived', false);
  query = isUuid ? query.eq('id', productId) : query.eq('slug', productId);
  const { data, error } = await query.maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    await logAgentActivity(request, { siteId, surface: 'ucp_rest', action: 'get_product', httpStatus: 404, requestMeta: { productId } });
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const product = mapProductToUcp(data as Parameters<typeof mapProductToUcp>[0], { siteUrl: ctx.storefrontUrl });

  await logAgentActivity(request, {
    siteId,
    surface: 'ucp_rest',
    action: 'get_product',
    productId: data.id,
    httpStatus: 200,
  });

  return NextResponse.json(product, {
    headers: { 'Cache-Control': 'public, max-age=5, s-maxage=5', 'X-UCP-Version': '0.1' },
  });
}
