/**
 * Owner dashboard analytics. Surfaces "how is AI talking to my store" data:
 *   - per-agent request counts (last 30d)
 *   - top products fetched by agents
 *   - cart/checkout funnel volume + revenue attributed to agents
 *   - share-of-voice vs storefront browser sessions
 *   - enrichment coverage (% of products with AI attributes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';

const WINDOW_DAYS = 30;

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });

  try {
    await requireSiteAccess(siteId, request);
  } catch (e) {
    return siteAccessErrorResponse(e);
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: events }, { data: products }, { count: enriched }, { count: total }] = await Promise.all([
    admin
      .from('ai_agent_activity')
      .select('agent_id, surface, action, amount_cents, product_id, order_id, created_at')
      .eq('site_id', siteId)
      .gte('created_at', since)
      .limit(10000),
    admin
      .from('products')
      .select('id, name, slug')
      .eq('site_id', siteId)
      .eq('is_archived', false)
      .limit(500),
    admin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('is_archived', false)
      .not('ai_enriched_at', 'is', null),
    admin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('is_archived', false),
  ]);

  const productNameById = new Map((products || []).map(p => [p.id, p.name]));

  // Per-agent breakdown
  const byAgent = new Map<string, { requests: number; carts: number; checkouts: number; revenueCents: number }>();
  const byProduct = new Map<string, { hits: number }>();
  const dayBuckets = new Map<string, { agent: number; checkout: number }>();
  let agentRevenueCents = 0;
  let agentCheckouts = 0;
  let agentCartCreates = 0;

  for (const e of events || []) {
    const agent = e.agent_id || 'unknown';
    if (!byAgent.has(agent)) byAgent.set(agent, { requests: 0, carts: 0, checkouts: 0, revenueCents: 0 });
    const a = byAgent.get(agent)!;
    a.requests += 1;
    if (e.action === 'create_cart') { a.carts += 1; if (agent !== 'browser') agentCartCreates += 1; }
    if (e.action === 'mandate_verify' || e.surface === 'checkout' && e.action === 'mandate_verify') {
      a.checkouts += 1;
      if (agent !== 'browser') agentCheckouts += 1;
      const rev = e.amount_cents ?? 0;
      a.revenueCents += rev;
      if (agent !== 'browser') agentRevenueCents += rev;
    }
    if (e.product_id) {
      const pid = e.product_id;
      byProduct.set(pid, { hits: (byProduct.get(pid)?.hits ?? 0) + 1 });
    }
    const day = (e.created_at || '').slice(0, 10);
    if (day) {
      if (!dayBuckets.has(day)) dayBuckets.set(day, { agent: 0, checkout: 0 });
      const b = dayBuckets.get(day)!;
      if (e.agent_id !== 'browser') b.agent += 1;
      if (e.action === 'mandate_verify') b.checkout += 1;
    }
  }

  const totalAgentRequests = Array.from(byAgent.entries())
    .filter(([k]) => k !== 'browser')
    .reduce((s, [, v]) => s + v.requests, 0);
  const browserRequests = byAgent.get('browser')?.requests ?? 0;
  const totalRequests = totalAgentRequests + browserRequests;
  const shareOfVoice = totalRequests > 0 ? totalAgentRequests / totalRequests : 0;

  const topProducts = Array.from(byProduct.entries())
    .sort((a, b) => b[1].hits - a[1].hits)
    .slice(0, 10)
    .map(([id, v]) => ({ id, name: productNameById.get(id) || 'Unknown', hits: v.hits }));

  const timeline = Array.from(dayBuckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, v]) => ({ day, agentRequests: v.agent, checkouts: v.checkout }));

  return NextResponse.json({
    windowDays: WINDOW_DAYS,
    summary: {
      totalAgentRequests,
      browserRequests,
      shareOfVoice,
      agentCartCreates,
      agentCheckouts,
      agentRevenueCents,
    },
    perAgent: Array.from(byAgent.entries())
      .filter(([k]) => k !== 'browser')
      .map(([agent, v]) => ({ agent, ...v }))
      .sort((a, b) => b.requests - a.requests),
    topProducts,
    timeline,
    enrichment: {
      enrichedProducts: enriched ?? 0,
      totalProducts: total ?? 0,
      coverage: total ? (enriched ?? 0) / total : 0,
    },
  });
}
