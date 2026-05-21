/**
 * UCP cart persistence + mutation helpers. Backed by the `ucp_carts` table.
 *
 * Carts are agent-owned: the agent_id + agent_session_id identifies which
 * AI surface the cart belongs to. A single human can have multiple parallel
 * UCP carts (one per agent), independent of their cookie-based browser cart.
 */

import { createAdminClient } from '@/lib/db/supabase-admin';
import type { UcpAddress, UcpCart, UcpCartItem, UcpCartTotals } from './types';
import { buildQuote } from './quote';
import { mapProductToUcp } from './product-mapper';

export interface CreateCartInput {
  siteId: string;
  currency: string;
  agentId: string;
  agentSessionId?: string | null;
  items?: UcpCartItem[];
  shippingAddress?: UcpAddress | null;
}

export async function createCart(input: CreateCartInput): Promise<UcpCart> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('ucp_carts')
    .insert({
      site_id: input.siteId,
      currency: input.currency,
      agent_id: input.agentId,
      agent_session_id: input.agentSessionId ?? null,
      items: input.items ?? [],
      shipping_address: input.shippingAddress ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`Failed to create UCP cart: ${error?.message}`);
  return await refreshTotals(data.id);
}

export async function loadCart(cartId: string): Promise<UcpCart | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('ucp_carts')
    .select('*')
    .eq('id', cartId)
    .maybeSingle();
  return data ? rowToCart(data) : null;
}

export async function updateCartItems(cartId: string, items: UcpCartItem[]): Promise<UcpCart> {
  const admin = createAdminClient();
  const merged = mergeLines(items);
  const { error } = await admin
    .from('ucp_carts')
    .update({ items: merged, updated_at: new Date().toISOString() })
    .eq('id', cartId);
  if (error) throw new Error(`Failed to update cart: ${error.message}`);
  return await refreshTotals(cartId);
}

export async function setShippingAddress(cartId: string, addr: UcpAddress | null): Promise<UcpCart> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('ucp_carts')
    .update({ shipping_address: addr, updated_at: new Date().toISOString() })
    .eq('id', cartId);
  if (error) throw new Error(`Failed to update address: ${error.message}`);
  return await refreshTotals(cartId);
}

export async function setPromoCodes(cartId: string, codes: string[]): Promise<UcpCart> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('ucp_carts')
    .update({ promo_codes: codes, updated_at: new Date().toISOString() })
    .eq('id', cartId);
  if (error) throw new Error(`Failed to update promo codes: ${error.message}`);
  return await refreshTotals(cartId);
}

export async function markCheckingOut(cartId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from('ucp_carts').update({ status: 'checking_out', updated_at: new Date().toISOString() }).eq('id', cartId);
}

export async function markConverted(cartId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from('ucp_carts').update({ status: 'converted', updated_at: new Date().toISOString() }).eq('id', cartId);
}

async function refreshTotals(cartId: string): Promise<UcpCart> {
  const admin = createAdminClient();
  const { data: row } = await admin.from('ucp_carts').select('*').eq('id', cartId).single();
  if (!row) throw new Error('Cart vanished mid-update');

  const quote = await buildQuote(
    row.site_id,
    {
      cartId: row.id,
      items: row.items as UcpCartItem[],
      shippingAddress: row.shipping_address as UcpAddress | undefined,
      promoCodes: row.promo_codes as string[],
    },
    row.currency,
  );

  // Hydrate item titles/images for the cart payload so an agent showing the
  // cart back to the user doesn't need a second round trip.
  const items = row.items as UcpCartItem[];
  if (items.length > 0) {
    const { data: products } = await admin
      .from('products')
      .select('id, name, images, slug, currency')
      .in('id', items.map(i => i.productId));
    const lookup = new Map((products || []).map(p => [p.id, p]));
    for (const it of items) {
      const p = lookup.get(it.productId);
      if (p) {
        it.title = p.name;
        it.imageUrl = Array.isArray(p.images) && p.images.length ? String(p.images[0]) : undefined;
      }
    }
  }

  const totals: UcpCartTotals = quote.totals;
  await admin.from('ucp_carts').update({ items, totals, updated_at: new Date().toISOString() }).eq('id', cartId);
  const { data: updated } = await admin.from('ucp_carts').select('*').eq('id', cartId).single();
  return rowToCart(updated);
}

function mergeLines(items: UcpCartItem[]): UcpCartItem[] {
  const key = (i: UcpCartItem) => `${i.productId}|${JSON.stringify(i.variants ?? {})}|${JSON.stringify(i.options ?? {})}`;
  const out = new Map<string, UcpCartItem>();
  for (const it of items) {
    const k = key(it);
    const existing = out.get(k);
    if (existing) {
      existing.qty += it.qty;
      existing.lineSubtotalCents = existing.unitPriceCents * existing.qty;
    } else {
      out.set(k, { ...it });
    }
  }
  // Drop zero/negative quantities so an agent can "remove" by setting qty=0.
  return Array.from(out.values()).filter(i => i.qty > 0);
}

interface UcpCartRow {
  id: string;
  site_id: string;
  currency: string;
  items: unknown;
  totals: unknown;
  shipping_address: unknown;
  promo_codes: unknown;
  status: UcpCart['status'];
  expires_at: string;
  updated_at: string;
}

function rowToCart(row: UcpCartRow): UcpCart {
  return {
    id: row.id,
    siteId: row.site_id,
    currency: row.currency,
    items: row.items as UcpCartItem[],
    totals: row.totals as UcpCartTotals,
    shippingAddress: row.shipping_address as UcpAddress | null,
    promoCodes: row.promo_codes as string[],
    status: row.status,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
  };
}

export type ProductMapper = typeof mapProductToUcp;
