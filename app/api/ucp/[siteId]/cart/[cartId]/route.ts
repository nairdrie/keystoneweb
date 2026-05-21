/**
 * Per-cart UCP endpoints:
 *   GET    — read current state
 *   PATCH  — replace items, set address, set promo codes
 *   DELETE — abandon
 *
 * Mutations always re-run the quote engine so totals match the source of
 * truth before they're returned to the agent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadUcpSiteContext } from '@/lib/ucp/site-context';
import { logAgentActivity } from '@/lib/ucp/agent-detect';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { loadCart, setPromoCodes, setShippingAddress, updateCartItems } from '@/lib/ucp/cart';
import type { UcpCartItem } from '@/lib/ucp/types';

interface RouteCtx { params: Promise<{ siteId: string; cartId: string }> }

export async function GET(request: NextRequest, { params }: RouteCtx) {
  const { siteId, cartId } = await params;
  const cart = await assertCartBelongsTo(cartId, siteId);
  if (!cart) return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
  await logAgentActivity(request, { siteId, surface: 'ucp_rest', action: 'get_cart', cartId, httpStatus: 200 });
  return NextResponse.json(cart, { headers: { 'X-UCP-Version': '0.1' } });
}

export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  const { siteId, cartId } = await params;
  const exists = await assertCartBelongsTo(cartId, siteId);
  if (!exists) return NextResponse.json({ error: 'Cart not found' }, { status: 404 });

  const body = await request.json().catch(() => ({})) as {
    items?: UcpCartItem[];
    shippingAddress?: unknown;
    promoCodes?: string[];
  };

  let cart = exists;
  try {
    if (Array.isArray(body.items)) {
      const normalized = body.items.slice(0, 100).map(it => ({
        productId: String(it.productId),
        qty: Math.max(0, Math.floor(Number(it.qty) || 0)),
        variants: it.variants && typeof it.variants === 'object' ? it.variants : undefined,
        options: it.options && typeof it.options === 'object' ? it.options : undefined,
        unitPriceCents: 0,
        lineSubtotalCents: 0,
      })) as UcpCartItem[];
      cart = await updateCartItems(cartId, normalized);
    }
    if (body.shippingAddress !== undefined) {
      cart = await setShippingAddress(cartId, body.shippingAddress as Parameters<typeof setShippingAddress>[1]);
    }
    if (Array.isArray(body.promoCodes)) {
      cart = await setPromoCodes(cartId, body.promoCodes.map(c => String(c).trim()).filter(Boolean));
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  await logAgentActivity(request, {
    siteId,
    surface: 'ucp_rest',
    action: 'update_cart',
    cartId,
    httpStatus: 200,
    amountCents: cart.totals.totalCents,
  });
  return NextResponse.json(cart, { headers: { 'X-UCP-Version': '0.1' } });
}

export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  const { siteId, cartId } = await params;
  const exists = await assertCartBelongsTo(cartId, siteId);
  if (!exists) return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
  const admin = createAdminClient();
  await admin.from('ucp_carts').update({ status: 'abandoned', updated_at: new Date().toISOString() }).eq('id', cartId);
  await logAgentActivity(request, { siteId, surface: 'ucp_rest', action: 'abandon_cart', cartId, httpStatus: 200 });
  return NextResponse.json({ ok: true });
}

async function assertCartBelongsTo(cartId: string, siteId: string) {
  const ctx = await loadUcpSiteContext(siteId);
  if (!ctx) return null;
  const cart = await loadCart(cartId);
  if (!cart || cart.siteId !== siteId) return null;
  return cart;
}
