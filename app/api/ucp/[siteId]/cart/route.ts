/**
 * UCP cart creation. An agent POSTs items here and gets back a UcpCart
 * with totals already computed by our quote engine — the agent never
 * computes prices/tax/shipping itself.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadUcpSiteContext } from '@/lib/ucp/site-context';
import { detectAgent, logAgentActivity } from '@/lib/ucp/agent-detect';
import { createCart } from '@/lib/ucp/cart';
import type { UcpCartItem } from '@/lib/ucp/types';

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const ctx = await loadUcpSiteContext(siteId);
  if (!ctx) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  let body: { items?: UcpCartItem[]; currency?: string; shippingAddress?: unknown } = {};
  try {
    body = await request.json();
  } catch { /* allow empty body — agent may just want an empty cart id */ }

  const detect = detectAgent(request.headers);
  const items: UcpCartItem[] = Array.isArray(body.items) ? body.items.slice(0, 100).map(normalizeItem).filter(Boolean) as UcpCartItem[] : [];

  try {
    const cart = await createCart({
      siteId,
      currency: body.currency || ctx.currency,
      agentId: detect.agentId,
      agentSessionId: detect.sessionId,
      items,
      shippingAddress: (body.shippingAddress ?? null) as Parameters<typeof createCart>[0]['shippingAddress'],
    });

    await logAgentActivity(request, {
      siteId,
      surface: 'ucp_rest',
      action: 'create_cart',
      cartId: cart.id,
      httpStatus: 201,
      amountCents: cart.totals.subtotalCents,
      requestMeta: { itemCount: cart.items.length },
    });

    return NextResponse.json(cart, { status: 201, headers: { 'X-UCP-Version': '0.1' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

function normalizeItem(raw: unknown): UcpCartItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { productId?: unknown; qty?: unknown; variants?: unknown; options?: unknown };
  if (typeof obj.productId !== 'string') return null;
  const qty = Math.max(1, Math.floor(Number(obj.qty) || 1));
  return {
    productId: obj.productId,
    qty,
    variants: obj.variants && typeof obj.variants === 'object' ? obj.variants as Record<string, string> : undefined,
    options: obj.options && typeof obj.options === 'object' ? obj.options as Record<string, string> : undefined,
    unitPriceCents: 0,        // overwritten by the quote engine
    lineSubtotalCents: 0,
  };
}
