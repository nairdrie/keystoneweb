/**
 * Standalone quote endpoint. Accepts either a cartId or an ad-hoc items
 * array — the latter lets an agent get a pre-cart price preview ("how much
 * would 2 of X + 1 of Y cost shipped to ZIP 94110?") without committing
 * any state.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadUcpSiteContext } from '@/lib/ucp/site-context';
import { logAgentActivity } from '@/lib/ucp/agent-detect';
import { buildQuote } from '@/lib/ucp/quote';
import type { UcpQuoteRequest } from '@/lib/ucp/types';

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const ctx = await loadUcpSiteContext(siteId);
  if (!ctx) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const body = await request.json().catch(() => ({})) as UcpQuoteRequest;
  const quote = await buildQuote(siteId, body, ctx.currency);

  await logAgentActivity(request, {
    siteId,
    surface: 'ucp_rest',
    action: 'quote',
    cartId: body.cartId ?? null,
    amountCents: quote.totals.totalCents,
    httpStatus: 200,
    requestMeta: { items: body.items?.length ?? 0 },
  });

  return NextResponse.json(quote, { headers: { 'X-UCP-Version': '0.1' } });
}
