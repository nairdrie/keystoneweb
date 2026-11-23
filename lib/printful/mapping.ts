/**
 * Turn a Printful sync product into Keystone's product shape, and match an
 * order line back to a Printful sync variant. Pure functions, no I/O.
 *
 * Keystone has two kinds of choices on a product:
 * - `variants` [{name, options[]}]: same-price choices (Colour).
 * - `options`  [{name, values[{label, priceModifierCents}], defaultIndex}]:
 *   required choices that add to the base price (a 2XL that costs more).
 *
 * The Printful variants decide both: each dimension (Color, Size) whose values
 * explain every price difference on its own becomes an option with modifiers;
 * the rest are variants. If prices depend on both dimensions together, one
 * combined option ("Style": "Black / 2XL") carries the exact price of each.
 *
 * The mapping stored in printful_product_links is computed here from
 * Printful's own data: the model never supplies sync variant ids.
 */
import type { ProductOptionGroup } from '@/lib/ecommerce/resolve-price';
import type { PfSyncProduct, PfSyncVariant } from './client';

export type Selection = Record<string, string>;

export interface VariantLink {
  selection: Selection;
  sync_variant_id: number;
  name: string;
  retail_price_cents: number;
  available: boolean;
}

export interface MappedProduct {
  name: string;
  priceCents: number;
  currency: string;
  variants: Array<{ name: string; options: string[] }>;
  options: ProductOptionGroup[];
  links: VariantLink[];
  imageUrls: string[];
  warnings: string[];
}

const toCents = (v: string | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};

const clean = (s: string | null | undefined) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** "Unisex Tee / Black / M" → ["Black", "M"] (the parts after the product name). */
function nameParts(variant: PfSyncVariant, productName: string): string[] {
  const parts = clean(variant.name).split(' / ').map(clean).filter(Boolean);
  if (parts.length > 1 && (parts[0] === clean(productName) || parts.length > 2)) return parts.slice(1);
  return parts.length > 1 ? parts.slice(1) : parts;
}

function uniqueInOrder(values: string[]): string[] {
  return [...new Set(values)];
}

/** Do the prices depend on this dimension alone? (same value → same price) */
function priceDependsOnlyOn(dim: string, rows: Array<{ sel: Selection; cents: number }>): boolean {
  const byValue = new Map<string, number>();
  for (const r of rows) {
    const v = r.sel[dim];
    const seen = byValue.get(v);
    if (seen === undefined) byValue.set(v, r.cents);
    else if (seen !== r.cents) return false;
  }
  return true;
}

export function selectionKey(sel: Selection): string {
  return Object.keys(sel).sort().map((k) => `${k}=${sel[k]}`).join('|');
}

export function mapSyncProduct(pf: PfSyncProduct): MappedProduct {
  const warnings: string[] = [];
  const productName = clean(pf.sync_product.name) || 'Printful product';
  const all = (pf.sync_variants || []).filter((v) => !v.is_ignored);
  if (!all.length) throw new Error(`Printful product ${pf.sync_product.id} has no variants that can be sold`);

  const currencies = uniqueInOrder(all.map((v) => (v.currency || 'USD').toUpperCase()));
  if (currencies.length > 1) warnings.push(`Printful variants use several currencies (${currencies.join(', ')}); ${currencies[0]} is used.`);
  const currency = currencies[0];

  const missingPrice = all.filter((v) => !toCents(v.retail_price));
  if (missingPrice.length) warnings.push(`${missingPrice.length} Printful variant(s) have no retail price; set one in Printful and link again.`);

  // 1. Dimensions: Printful's own color/size fields, else the variant name.
  let rows: Array<{ v: PfSyncVariant; sel: Selection; cents: number }>;
  const hasColor = all.some((v) => clean(v.color));
  const hasSize = all.some((v) => clean(v.size));
  if (all.length === 1) {
    rows = [{ v: all[0], sel: {}, cents: toCents(all[0].retail_price) }];
  } else if (hasColor || hasSize) {
    rows = all.map((v) => {
      const sel: Selection = {};
      if (hasColor) sel.Color = clean(v.color) || 'Standard';
      if (hasSize) sel.Size = clean(v.size) || 'One size';
      return { v, sel, cents: toCents(v.retail_price) };
    });
  } else {
    rows = all.map((v) => ({ v, sel: { Style: nameParts(v, productName).join(' / ') || clean(v.name) }, cents: toCents(v.retail_price) }));
  }

  // Duplicate selections (e.g. same colour/size, different print) → fall back to the full variant name.
  if (new Set(rows.map((r) => selectionKey(r.sel))).size !== rows.length) {
    rows = all.map((v) => ({ v, sel: { Style: clean(v.name) }, cents: toCents(v.retail_price) }));
    if (new Set(rows.map((r) => selectionKey(r.sel))).size !== rows.length) {
      rows = all.map((v) => ({ v, sel: { Style: `${clean(v.name)} (#${v.id})` }, cents: toCents(v.retail_price) }));
    }
  }

  const dims = rows.length ? Object.keys(rows[0].sel) : [];
  const priced = rows.filter((r) => r.cents > 0);
  const base = priced.length ? Math.min(...priced.map((r) => r.cents)) : 0;
  const pricesVary = new Set(priced.map((r) => r.cents)).size > 1;

  const variants: MappedProduct['variants'] = [];
  const options: ProductOptionGroup[] = [];

  const valuesOf = (dim: string) => uniqueInOrder(rows.map((r) => r.sel[dim]));
  const optionFor = (dim: string, valueCents: (value: string) => number): ProductOptionGroup => {
    const values = valuesOf(dim).map((label) => ({ label, priceModifierCents: Math.max(0, valueCents(label) - base) }));
    const cheapest = values.findIndex((v) => v.priceModifierCents === 0);
    return { name: dim, values, defaultIndex: cheapest >= 0 ? cheapest : 0 };
  };

  if (!pricesVary) {
    for (const dim of dims) variants.push({ name: dim, options: valuesOf(dim) });
  } else {
    const pricedRows = priced.length ? priced : rows;
    const driver = dims.find((d) => priceDependsOnlyOn(d, pricedRows));
    if (driver) {
      const priceOf = (value: string) => pricedRows.find((r) => r.sel[driver] === value)?.cents ?? base;
      for (const dim of dims) {
        if (dim === driver) options.push(optionFor(dim, priceOf));
        else variants.push({ name: dim, options: valuesOf(dim) });
      }
    } else {
      // Prices depend on the combination: one option per exact variant.
      const label = (sel: Selection) => dims.map((d) => sel[d]).join(' / ');
      rows = rows.map((r) => ({ ...r, sel: { Style: label(r.sel) } }));
      options.push(optionFor('Style', (value) => rows.find((r) => r.sel.Style === value)?.cents ?? base));
      warnings.push('Printful prices differ by both colour and size, so they are offered as one "Style" choice with exact prices.');
    }
  }

  const links: VariantLink[] = rows.map((r) => ({
    selection: r.sel,
    sync_variant_id: r.v.id,
    name: clean(r.v.name),
    retail_price_cents: r.cents,
    available: !r.v.availability_status || r.v.availability_status === 'active',
  }));
  const unavailable = links.filter((l) => !l.available).length;
  if (unavailable) warnings.push(`${unavailable} variant(s) are out of stock or discontinued at Printful; orders for them will fail until Printful restocks.`);

  // Images: the product thumbnail, then one mockup per colour (or per variant).
  const urls: string[] = [];
  const push = (u: string | null | undefined) => {
    const s = clean(u);
    if (s.startsWith('https://') && !urls.includes(s)) urls.push(s);
  };
  push(pf.sync_product.thumbnail_url);
  const seenColour = new Set<string>();
  for (const r of rows) {
    const colour = r.v.color ? clean(r.v.color) : selectionKey(r.sel);
    if (seenColour.has(colour)) continue;
    seenColour.add(colour);
    const preview = (r.v.files || []).find((f) => f.type === 'preview' && f.preview_url)?.preview_url;
    push(preview || r.v.product?.image);
  }

  return { name: productName, priceCents: base, currency, variants, options, links, imageUrls: urls.slice(0, 8), warnings };
}

/**
 * The full selection for an order line: its variants plus options, with the
 * product's default option values filled in (as the price resolver does).
 */
export function lineSelection(
  item: { variants?: Record<string, string> | null; options?: Record<string, string> | null },
  productOptions: ProductOptionGroup[],
): Selection {
  const sel: Selection = {};
  for (const [k, v] of Object.entries(item.variants || {})) if (typeof v === 'string') sel[k] = v;
  for (const g of productOptions) {
    const chosen = item.options?.[g.name];
    const value = (chosen && g.values.find((v) => v.label === chosen)) || g.values[g.defaultIndex] || g.values[0];
    if (value) sel[g.name] = value.label;
  }
  return sel;
}

/** The link whose every dimension matches the line's selection (extra keys on the line are ignored). */
export function findVariantLink(links: VariantLink[], sel: Selection): VariantLink | null {
  if (links.length === 1 && !Object.keys(links[0].selection).length) return links[0];
  return links.find((l) => Object.entries(l.selection).every(([k, v]) => sel[k] === v)) || null;
}
