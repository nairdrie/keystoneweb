/**
 * Active promotions exposed in spec form so Universal Cart can auto-apply
 * the best deal. We emit:
 *   - storewide promos
 *   - product-level compare_at_cents (turned into "X% off" signals)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { loadUcpSiteContext } from '@/lib/ucp/site-context';
import { logAgentActivity } from '@/lib/ucp/agent-detect';

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const ctx = await loadUcpSiteContext(siteId);
  if (!ctx) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const admin = createAdminClient();
  const { data } = await admin
    .from('products')
    .select('id, slug, name, price_cents, compare_at_cents, currency')
    .eq('site_id', siteId)
    .eq('is_archived', false)
    .eq('status', 'published')
    .eq('is_active', true)
    .not('compare_at_cents', 'is', null)
    .limit(100);

  const productPromos = (data || [])
    .filter(p => p.compare_at_cents && p.compare_at_cents > p.price_cents)
    .map(p => ({
      productId: p.id,
      productUrl: `${ctx.storefrontUrl}/product/${p.slug}`,
      label: `${Math.round((1 - p.price_cents / p.compare_at_cents!) * 100)}% off ${p.name}`,
      originalPrice: { amount: p.compare_at_cents!, currency: p.currency },
      salePrice: { amount: p.price_cents, currency: p.currency },
    }));

  const storewide = [
    { code: 'WELCOME10', label: '10% off your first order', kind: 'percent', value: 10 },
  ];

  await logAgentActivity(request, { siteId, surface: 'ucp_rest', action: 'promotions', httpStatus: 200 });

  return NextResponse.json(
    { storewide, productPromos, generatedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30', 'X-UCP-Version': '0.1' } },
  );
}
