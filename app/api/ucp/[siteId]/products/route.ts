/**
 * UCP catalog endpoint. Returns spec-compliant UcpProduct[] for the site,
 * with real-time prices, inventory, and AI attributes. Supports filtering
 * by category/tag/in_stock and pagination.
 *
 * Edge-cached (s-maxage=30) so agents get sub-100ms reads while still
 * picking up price drops within ~30s of publication. The native_commerce
 * feed has the same data path so freshness is consistent across surfaces.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { loadUcpSiteContext } from '@/lib/ucp/site-context';
import { mapProductToUcp } from '@/lib/ucp/product-mapper';
import { logAgentActivity } from '@/lib/ucp/agent-detect';

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const ctx = await loadUcpSiteContext(siteId);
  if (!ctx) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  if (!ctx.isPublished) return NextResponse.json({ error: 'Storefront not published' }, { status: 404 });

  const u = request.nextUrl;
  const limit = Math.min(200, Math.max(1, parseInt(u.searchParams.get('limit') || '50')));
  const offset = Math.max(0, parseInt(u.searchParams.get('offset') || '0'));
  const category = u.searchParams.get('category') || '';
  const inStockOnly = u.searchParams.get('availability') === 'in_stock';
  const search = u.searchParams.get('q')?.trim() || '';
  const updatedSince = u.searchParams.get('updated_since') || '';

  const admin = createAdminClient();
  let q = admin
    .from('products')
    .select('*', { count: 'exact' })
    .eq('site_id', siteId)
    .eq('is_archived', false)
    .eq('status', 'published')
    .eq('is_active', true)
    .eq('native_commerce', true);

  if (category) q = q.eq('category', category);
  if (search) {
    const pat = `%${search}%`;
    q = q.or(`name.ilike.${pat},description.ilike.${pat}`);
  }
  if (updatedSince) q = q.gte('updated_at', updatedSince);
  q = q.order('updated_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let products = (data || []).map(p => mapProductToUcp(p as Parameters<typeof mapProductToUcp>[0], { siteUrl: ctx.storefrontUrl }));
  if (inStockOnly) products = products.filter(p => p.availability === 'in_stock');

  await logAgentActivity(request, {
    siteId,
    surface: 'ucp_rest',
    action: 'list_products',
    httpStatus: 200,
    requestMeta: { limit, offset, category, search, returned: products.length },
  });

  return NextResponse.json(
    {
      products,
      pagination: {
        limit,
        offset,
        total: count ?? products.length,
        nextOffset: (count ?? 0) > offset + limit ? offset + limit : null,
      },
      generatedAt: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=15, s-maxage=30',
        'X-UCP-Version': '0.1',
      },
    },
  );
}
