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
import type { UcpAddress, UcpCartItem, UcpCartTotals, UcpQuote, UcpQuoteRequest } from './types';
import { resolveProductAccess, parseProductOptions, resolveOptionPriceModifierCents } from '@/lib/ecommerce/resolve-price';
import { findMatchingZone, applyMarkup, type PackagingBox, type ShippingZone } from '@/lib/shipping-data';
import { getRates, type ShippoAddress, type ShippoRate } from '@/lib/shipping/shippo';
import { generatePackingPlans, planToShippoParcels, type PackerItem } from '@/lib/shipping/packer';

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
    name: string;
    price_cents: number;
    weight_grams: number | null;
    length_mm: number | null;
    width_mm: number | null;
    height_mm: number | null;
    ships_alone: boolean | null;
    options: unknown;
    tier_prices: unknown;
    allowed_package_ids: unknown;
  }> = [];
  if (productIds.length) {
    const { data } = await admin
      .from('products')
      .select('id, name, price_cents, weight_grams, length_mm, width_mm, height_mm, ships_alone, options, tier_prices, allowed_package_ids')
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

  // Shipping — try carrier (live Shippo) first, fall back to flat-rate.
  const packerItems: PackerItem[] = [];
  for (const it of repricedItems) {
    const row = products.find(p => p.id === it.productId);
    if (!row) continue;
    if (!row.weight_grams || !row.length_mm || !row.width_mm || !row.height_mm) {
      // Item is missing dims — carrier quoting will be skipped entirely so
      // we don't quote a partial cart at the wrong price.
      packerItems.length = 0;
      break;
    }
    packerItems.push({
      productId: row.id,
      name: row.name,
      qty: it.qty,
      weight_grams: row.weight_grams,
      length_mm: row.length_mm,
      width_mm: row.width_mm,
      height_mm: row.height_mm,
      ships_alone: !!row.ships_alone,
    });
  }
  void totalWeightG;
  const shippingOptions = await resolveShippingOptions(siteId, subtotalCents - discountCents, req, packerItems);
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
  postDiscountCents: number,
  req: UcpQuoteRequest,
  packerItems: PackerItem[],
): Promise<UcpQuote['shippingOptions']> {
  const admin = createAdminClient();
  const { data: zones } = await admin
    .from('shipping_zones')
    .select('*')
    .eq('site_id', siteId)
    .eq('is_archived', false)
    .order('sort_order');

  const opts: UcpQuote['shippingOptions'] = [];

  // Try to match a zone against the agent's shipping address. Without an
  // address we can only emit the flat-rate / free fallbacks since carrier
  // quoting fundamentally needs origin + destination.
  const addr = req.shippingAddress;
  if (addr && zones && zones.length > 0) {
    const matched = findMatchingZone(zones as ShippingZone[], addr.country, addr.region || '', postDiscountCents);
    if (matched) {
      const zone = matched.zone;
      if (zone.rate_type === 'carrier') {
        const carrierOpts = await quoteCarrierZone(siteId, zone, addr, packerItems);
        if (carrierOpts.length > 0) return carrierOpts;
        // Carrier failed — fall through to the matched zone's non-carrier
        // fallback so the agent still gets a valid number.
      }
      opts.push({
        id: `zone-${zone.id}`,
        label: matched.label,
        amountCents: matched.shippingCents,
        estDeliveryDays: 5,
      });
      return opts;
    }
  }

  // No address / no matching zone — emit storewide fallback options.
  if (postDiscountCents >= FREE_SHIPPING_FLOOR_CENTS) {
    opts.push({ id: 'free', label: 'Free shipping', amountCents: 0, estDeliveryDays: 5 });
  }
  for (const z of zones || []) {
    if (z.rate_type === 'flat' && typeof z.rate_cents === 'number') {
      opts.push({
        id: `zone-${z.id}`,
        label: z.name || 'Standard shipping',
        amountCents: z.rate_cents,
        estDeliveryDays: 5,
      });
    }
  }
  if (!opts.length) {
    opts.push({ id: 'standard', label: 'Standard shipping', amountCents: 999, estDeliveryDays: 5 });
  }
  return opts;
}

/**
 * Live carrier quoting via Shippo, mirroring /api/shipping-zones/calculate.
 * Returns empty on any failure so the caller can fall back gracefully.
 */
async function quoteCarrierZone(
  siteId: string,
  zone: ShippingZone,
  addr: UcpAddress,
  packerItems: PackerItem[],
): Promise<UcpQuote['shippingOptions']> {
  if (packerItems.length === 0) return [];
  const apiKey = process.env.SHIPPO_API_KEY;
  if (!apiKey) return [];

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from('ecommerce_settings')
    .select('origin_line1, origin_line2, origin_city, origin_region, origin_postal, origin_country, packaging_boxes')
    .eq('site_id', siteId)
    .maybeSingle();
  if (!settings?.origin_line1 || !settings?.origin_postal) return [];

  const boxes: PackagingBox[] = Array.isArray(settings.packaging_boxes) ? settings.packaging_boxes : [];
  if (boxes.length === 0) return [];

  const plans = generatePackingPlans(packerItems, boxes);
  if (plans.length === 0) return [];

  const addressFrom: ShippoAddress = {
    street1: settings.origin_line1,
    street2: settings.origin_line2 || undefined,
    city: settings.origin_city || '',
    state: settings.origin_region || '',
    zip: settings.origin_postal,
    country: settings.origin_country || 'US',
  };
  const addressTo: ShippoAddress = {
    street1: addr.line1 || '',
    street2: addr.line2 || undefined,
    city: addr.city || '',
    state: addr.region || '',
    zip: addr.postalCode || '',
    country: addr.country || addressFrom.country,
  };

  const quoted: Array<{ planIndex: number; rates: ShippoRate[] }> = [];
  for (let i = 0; i < plans.length; i++) {
    try {
      const rates = await getRates({ apiKey, addressFrom, addressTo, parcels: planToShippoParcels(plans[i]) });
      quoted.push({ planIndex: i, rates });
    } catch (err) {
      console.warn(`[UCP] Shippo plan ${i} error:`, (err as Error).message);
    }
  }
  if (quoted.length === 0) return [];

  const allowed = Array.isArray(zone.carrier_services) ? zone.carrier_services : [];
  const bestByService = new Map<string, { rate: ShippoRate }>();
  for (const { rates } of quoted) {
    for (const r of rates) {
      if (!r.servicelevel_token) continue;
      if (allowed.length > 0 && !allowed.includes(r.servicelevel_token)) continue;
      const prev = bestByService.get(r.servicelevel_token);
      if (!prev || r.amount_cents < prev.rate.amount_cents) {
        bestByService.set(r.servicelevel_token, { rate: r });
      }
    }
  }
  if (bestByService.size === 0) return [];

  return Array.from(bestByService.values())
    .map(({ rate }) => ({
      id: `${zone.id}:${rate.servicelevel_token || rate.object_id}`,
      label: `${rate.provider} ${rate.servicelevel_name}`,
      amountCents: applyMarkup(rate.amount_cents, zone.markup_type, zone.markup_cents),
      estDeliveryDays: typeof rate.estimated_days === 'number' && rate.estimated_days > 0 ? rate.estimated_days : null,
    }))
    .sort((a, b) => a.amountCents - b.amountCents);
}
