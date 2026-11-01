/**
 * Live business data for agent-built sites.
 *
 * Agents design how products and services look (data-ks-collection in their
 * own markup); Keystone fills in the real records at request time and runs the
 * transactional flows (cart, checkout, booking) on hosted pages.
 */
import type { Db } from './store';

export const COLLECTION_KINDS = ['products', 'services'] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];

/** Fields an agent can bind with data-ks-bind / data-ks-bind-bg / data-ks-if. */
export const COLLECTION_FIELDS: Record<CollectionKind, Record<string, string>> = {
  products: {
    id: 'Product id',
    name: 'Product name',
    description: 'Short description (plain text)',
    price: 'Formatted price, e.g. "$49.00"',
    compare_price: 'Formatted original price when on sale, else empty',
    on_sale: '"true" when compare_price is set (use with data-ks-if)',
    image: 'Main image URL (on <img>: src; with data-ks-bind-bg: background)',
    url: 'Product page URL (/product/<id>)',
    category: 'Category name',
    brand: 'Brand',
    featured: '"true" when featured',
    in_stock: '"true" unless inventory is 0',
    needs_options: '"true" when the shopper must pick a variant/option on the product page',
  },
  services: {
    id: 'Service id',
    name: 'Service name',
    description: 'Description (plain text)',
    price: 'Formatted price, e.g. "$85.00" (empty when free)',
    compare_price: 'Formatted original price when discounted',
    duration: 'Formatted duration, e.g. "1 hr 30 min"',
    image: 'Image URL when the service has one',
    url: 'Booking page URL for this service (/book?service=<id>)',
    featured: '"true" when featured',
    has_options: '"true" when the service has options to choose',
  },
};

export type CollectionItem = Record<string, string> & { id: string };

export interface CollectionData {
  products?: CollectionItem[];
  services?: CollectionItem[];
  /** cart payloads by product id (for add-to-cart) */
  productPayload?: Record<string, { productId: string; name: string; price_cents: number; currency: string; image?: string; needsOptions: boolean; url: string }>;
}

export function formatMoney(cents: number | null | undefined, currency = 'CAD'): string {
  if (cents === null || cents === undefined || Number.isNaN(Number(cents))) return '';
  try {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency || 'CAD', currencyDisplay: 'narrowSymbol' }).format(Number(cents) / 100);
  } catch {
    return `$${(Number(cents) / 100).toFixed(2)}`;
  }
}

export function formatDuration(minutes: number | null | undefined): string {
  const m = Number(minutes) || 0;
  if (!m) return '';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return [h ? `${h} hr` : '', rest ? `${rest} min` : ''].filter(Boolean).join(' ');
}

function plain(text: unknown, max = 400): string {
  return String(text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function hasChoices(value: unknown): boolean {
  return Array.isArray(value) && value.some((v) => v && Array.isArray((v as Row).options ?? (v as Row).values) && ((v as Row).options ?? (v as Row).values).length > 0);
}

export async function fetchCollections(db: Db, siteId: string, kinds: Set<CollectionKind>): Promise<CollectionData> {
  const out: CollectionData = {};
  const jobs: Array<Promise<void>> = [];

  if (kinds.has('products')) {
    jobs.push((async () => {
      const { data } = await db
        .from('products')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_active', true)
        .eq('status', 'published')
        .order('sort_order', { ascending: true })
        .limit(200);
      const rows = ((data || []) as Row[]).filter((p) => !p.is_archived);
      out.productPayload = {};
      out.products = rows.map((p) => {
        const image = Array.isArray(p.images) ? String(p.images[0] || '') : '';
        const needsOptions = hasChoices(p.variants) || hasChoices(p.options);
        const url = p.external_url ? String(p.external_url) : `/product/${p.id}`;
        out.productPayload![p.id] = { productId: p.id, name: p.name, price_cents: Number(p.price_cents) || 0, currency: p.currency || 'CAD', image: image || undefined, needsOptions, url };
        const onSale = !!p.compare_at_cents && Number(p.compare_at_cents) > Number(p.price_cents);
        return {
          id: String(p.id),
          name: plain(p.name, 200),
          description: plain(p.description, 300),
          price: formatMoney(p.price_cents, p.currency),
          compare_price: onSale ? formatMoney(p.compare_at_cents, p.currency) : '',
          on_sale: onSale ? 'true' : '',
          image,
          url,
          category: plain(p.category, 80),
          brand: plain(p.brand, 80),
          featured: p.is_featured ? 'true' : '',
          in_stock: p.inventory_count === 0 ? '' : 'true',
          needs_options: needsOptions ? 'true' : '',
        };
      });
    })());
  }

  if (kinds.has('services')) {
    jobs.push((async () => {
      const { data } = await db
        .from('booking_services')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_active', true)
        .eq('status', 'published')
        .order('sort_order', { ascending: true })
        .limit(200);
      out.services = ((data || []) as Row[]).filter((s) => !s.is_archived).map((s) => {
        const discounted = !!s.compare_at_price_cents && Number(s.compare_at_price_cents) > Number(s.price_cents);
        return {
          id: String(s.id),
          name: plain(s.name, 200),
          description: plain(s.description, 400),
          price: Number(s.price_cents) > 0 ? formatMoney(s.price_cents, s.currency) : '',
          compare_price: discounted ? formatMoney(s.compare_at_price_cents, s.currency) : '',
          duration: formatDuration(s.duration_minutes),
          image: typeof s.image_url === 'string' ? s.image_url : '',
          url: `/book?service=${encodeURIComponent(String(s.id))}`,
          featured: s.is_featured ? 'true' : '',
          has_options: Array.isArray(s.options) && s.options.length ? 'true' : '',
        };
      });
    })());
  }

  await Promise.all(jobs);
  return out;
}

/** Which collections a set of section templates use (cheap scan, no parsing). */
export function collectionsIn(htmls: string[]): Set<CollectionKind> {
  const kinds = new Set<CollectionKind>();
  for (const html of htmls) {
    for (const m of html.matchAll(/data-ks-collection\s*=\s*["']([a-z]+)["']/g)) {
      if ((COLLECTION_KINDS as readonly string[]).includes(m[1])) kinds.add(m[1] as CollectionKind);
    }
  }
  return kinds;
}

/** Platform features a v2 site uses, from its markup (for admin tabs, header cart, etc.). */
export function featuresIn(htmls: string[]): { ecommerce: boolean; booking: boolean } {
  const all = htmls.join('\n');
  return {
    ecommerce: /data-ks-collection\s*=\s*["']products["']|data-ks-action\s*=\s*["'](add-to-cart|open-cart)["']|href\s*=\s*["']\/(cart|product\/)/.test(all),
    booking: /data-ks-collection\s*=\s*["']services["']|data-ks-action\s*=\s*["']book["']|href\s*=\s*["']\/book\b/.test(all),
  };
}

/** Section templates that appear on a page (including the global header/footer). */
export function pageSectionHtmls(bundle: { sections: Record<string, { html: string }>; theme: { header_section: string | null; footer_section: string | null } }, page: { instances: Array<{ section: string }> } | null): string[] {
  const keys = new Set<string>([
    ...(bundle.theme.header_section ? [bundle.theme.header_section] : []),
    ...(bundle.theme.footer_section ? [bundle.theme.footer_section] : []),
    ...(page?.instances || []).map((i) => i.section),
  ]);
  return [...keys].map((k) => bundle.sections[k]?.html || '').filter(Boolean);
}
