/**
 * Maps a Supabase `products` row into a UCP-spec product. Single source of
 * truth shared between the UCP REST endpoints, the MCP server, and the
 * native_commerce feed so spec-compliance lives in one place.
 */

import type { UcpProduct, UcpMoney } from './types';
import { resolveProductAccess, parseProductOptions } from '@/lib/ecommerce/resolve-price';
import type { PricingMember } from '@/lib/ecommerce/resolve-price';

export interface ProductRow {
  id: string;
  site_id: string;
  name: string;
  brand?: string | null;
  description?: string | null;
  price_cents: number;
  compare_at_cents?: number | null;
  currency: string;
  images?: unknown;
  variants?: unknown;
  inventory_count: number;
  is_active: boolean;
  status: string;
  slug: string;
  category?: string | null;
  subcategory?: string | null;
  tags?: unknown;
  tier_prices?: unknown;
  allowed_package_ids?: unknown;
  options?: unknown;
  weight_grams?: number | null;
  length_mm?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  ai_attributes?: unknown;
  native_commerce?: boolean;
  gtin?: string | null;
  mpn?: string | null;
  condition?: string | null;
  updated_at?: string;
}

export interface MapContext {
  siteUrl: string;
  member?: PricingMember | null;
}

export function mapProductToUcp(p: ProductRow, ctx: MapContext): UcpProduct {
  const access = resolveProductAccess(p, ctx.member ?? null);
  const price: UcpMoney = { amount: access.priceCents, currency: p.currency || 'USD' };
  const compareAt = p.compare_at_cents
    ? ({ amount: p.compare_at_cents, currency: p.currency || 'USD' } as UcpMoney)
    : null;

  const images = Array.isArray(p.images) ? (p.images as string[]).filter(Boolean) : [];
  const tags = Array.isArray(p.tags) ? (p.tags as string[]).filter(Boolean) : [];
  const variants = Array.isArray(p.variants)
    ? (p.variants as Array<{ name: string; options: string[] }>).filter(v => v?.name && Array.isArray(v?.options))
    : [];

  const aiAttributes: Record<string, string | number | boolean> = {};
  if (p.ai_attributes && typeof p.ai_attributes === 'object') {
    for (const [k, v] of Object.entries(p.ai_attributes as Record<string, unknown>)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        aiAttributes[k] = v;
      }
    }
  }
  // Promote a handful of structural product fields into aiAttributes too so
  // a spec-compliant consumer doesn't need to know our row shape.
  if (p.brand) aiAttributes.brand = p.brand;
  if (p.category) aiAttributes.category = p.category;
  if (p.subcategory) aiAttributes.subcategory = p.subcategory;
  for (const opt of parseProductOptions(p.options)) {
    aiAttributes[`option.${opt.name.toLowerCase()}`] = opt.values.map(v => v.label).join(' | ');
  }

  let availability: UcpProduct['availability'];
  if (p.status !== 'published' || !p.is_active) availability = 'unavailable';
  else if (p.inventory_count === 0) availability = 'out_of_stock';
  else availability = 'in_stock';

  return {
    id: p.id,
    sku: p.slug || null,
    gtin: p.gtin || null,
    mpn: p.mpn || null,
    title: p.name,
    brand: p.brand ?? null,
    description: p.description ?? null,
    url: `${ctx.siteUrl}/product/${p.slug}`,
    images,
    price,
    compareAtPrice: compareAt,
    availability,
    inventoryCount: p.inventory_count >= 0 ? p.inventory_count : null,
    condition: (p.condition === 'used' || p.condition === 'refurbished') ? p.condition : 'new',
    category: p.category ?? null,
    subcategory: p.subcategory ?? null,
    tags,
    variants,
    aiAttributes,
    nativeCommerce: p.native_commerce !== false,
    gated: !access.canPurchase,
    gateReason: access.gateReason,
    shippingDimensions: {
      weightGrams: p.weight_grams ?? null,
      lengthMm: p.length_mm ?? null,
      widthMm: p.width_mm ?? null,
      heightMm: p.height_mm ?? null,
    },
    updatedAt: p.updated_at ?? new Date().toISOString(),
  };
}
