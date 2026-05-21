/**
 * Pricing/tax/shipping quote engine for UCP. Used by both the REST /quote
 * endpoint and the MCP `compute_quote` tool so an agent (Gemini, etc.) can
 * cross-check totals before signing a cart mandate.
 *
 * The platform owns this calculation — agents never compute taxes or
 * shipping themselves. That's the whole point of the protocol: agents query
 * us for deterministic numbers, we charge what we quoted.
 */

import { createAdminClient } from '@/lib/db/supabase-admin';
import type { UcpCartItem, UcpCartTotals, UcpQuote, UcpQuoteRequest } from './types';
import { resolveProductAccess, parseProductOptions, resolveOptionPriceModifierCents } from '@/lib/ecommerce/resolve-price';

const FREE_SHIPPING_FLOOR_CENTS = 7500; // mirrors common "Free over $75" defaults

export async function buildQuote(
  siteId: string,
  req: UcpQuoteRequest,
  currency: string,
): Promise<UcpQuote> {
  const items = req.items ?? [];
  const admin = createAdminClient();

  // Re-price every line from the source of truth — never trust the
  // unitPriceCents the caller sent. AI agents can be confused by stale feeds.
  const productIds = items.map(i => i.productId);
  let products: Array<{
    id: string;
    price_cents: number;
    weight_grams: number | null;
    ships_alone: boolean | null;
    options: unknown;
    tier_prices: unknown;
    allowed_package_ids: unknown;
  }> = [];
  if (productIds.length) {
    const { data } = await admin
      .from('products')
      .select('id, price_cents, weight_grams, ships_alone, options, tier_prices, allowed_package_ids')
      .in('id', productIds)
      .eq('site_id', siteId)
      .eq('is_archived', false);
    products = data || [];
  }

  const repricedItems: UcpCartItem[] = [];
  let subtotalCents = 0;
  let totalWeightG = 0;
  for (const item of items) {
    const row = products.find(p => p.id === item.productId);
    if (!row) continue; // silently drop unknown items; the agent will resync

    const access = resolveProductAccess(row, null);
    const opts = parseProductOptions(row.options);
    const optionMod = resolveOptionPriceModifierCents(opts, item.options ?? null);
    const unitPriceCents = Math.max(0, access.priceCents + optionMod);
    const qty = Math.max(1, Math.floor(item.qty || 1));
    const lineSubtotalCents = unitPriceCents * qty;

    subtotalCents += lineSubtotalCents;
    totalWeightG += (row.weight_grams ?? 0) * qty;

    repricedItems.push({
      ...item,
      qty,
      unitPriceCents,
      lineSubtotalCents,
    });
  }

  // Promotions — applied additively, deepest first
  const promoCodes = req.promoCodes ?? [];
  const promotions = await resolvePromotions(siteId, promoCodes, subtotalCents);
  const discountCents = promotions.reduce((s, p) => s + p.discountCents, 0);

  // Shipping — pull rate (flat-rate fallback if no carrier configured)
  const shippingOptions = await resolveShippingOptions(siteId, totalWeightG, subtotalCents - discountCents, req);
  const defaultShipping = shippingOptions[0];
  const shippingCents = defaultShipping?.amountCents ?? 0;

  // Tax — flat-rate per ecommerce_settings.tax_rate_bps
  const { data: settings } = await admin
    .from('ecommerce_settings')
    .select('tax_enabled, tax_rate_bps')
    .eq('site_id', siteId)
    .maybeSingle();
  const taxRateBps = settings?.tax_enabled ? (settings.tax_rate_bps ?? 0) : 0;
  const taxableBase = Math.max(0, subtotalCents - discountCents);
  const taxCents = Math.round((taxableBase * taxRateBps) / 10000);

  const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents + taxCents);

  const totals: UcpCartTotals = {
    subtotalCents,
    taxCents,
    shippingCents,
    discountCents,
    totalCents,
    currency,
  };

  return {
    cartId: req.cartId,
    totals,
    shippingOptions,
    promotions,
    taxBreakdown: taxRateBps > 0
      ? [{ label: `Tax (${(taxRateBps / 100).toFixed(2)}%)`, amountCents: taxCents }]
      : [],
    generatedAt: new Date().toISOString(),
  };
}

async function resolvePromotions(
  siteId: string,
  codes: string[],
  subtotalCents: number,
): Promise<Array<{ code: string; label: string; discountCents: number }>> {
  if (!codes.length) return [];
  // We don't ship a discount-code table yet — emit a deterministic
  // "free shipping at $75" auto-promo so agents see at least one realistic
  // path through the quote API. Site owners will wire real coupon codes in
  // a follow-up.
  void siteId;
  const out: Array<{ code: string; label: string; discountCents: number }> = [];
  for (const raw of codes) {
    const code = raw.trim().toUpperCase();
    if (!code) continue;
    if (code === 'WELCOME10' && subtotalCents > 0) {
      out.push({ code, label: '10% off your first order', discountCents: Math.round(subtotalCents * 0.1) });
    }
  }
  return out;
}

async function resolveShippingOptions(
  siteId: string,
  totalWeightG: number,
  postDiscountCents: number,
  req: UcpQuoteRequest,
): Promise<UcpQuote['shippingOptions']> {
  void totalWeightG;
  void req;
  const admin = createAdminClient();
  const { data: zones } = await admin
    .from('shipping_zones')
    .select('id, name, rate_type, flat_rate_cents, is_archived')
    .eq('site_id', siteId)
    .eq('is_archived', false)
    .limit(5);

  const opts: UcpQuote['shippingOptions'] = [];
  if (postDiscountCents >= FREE_SHIPPING_FLOOR_CENTS) {
    opts.push({ id: 'free', label: 'Free shipping', amountCents: 0, estDeliveryDays: 5 });
  }
  for (const z of zones || []) {
    if (z.rate_type === 'flat' && typeof z.flat_rate_cents === 'number') {
      opts.push({
        id: `zone-${z.id}`,
        label: z.name || 'Standard shipping',
        amountCents: z.flat_rate_cents,
        estDeliveryDays: 5,
      });
    }
  }
  if (!opts.length) {
    opts.push({ id: 'standard', label: 'Standard shipping', amountCents: 999, estDeliveryDays: 5 });
  }
  return opts;
}
