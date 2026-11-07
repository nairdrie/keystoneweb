/**
 * Live business data for agent-built sites.
 *
 * Agents design how products, services and blog posts look (data-ks-collection
 * in their own markup); Keystone fills in the real records at request time and
 * runs the transactional flows (cart, checkout, booking) on hosted pages.
 * Owners manage the records in Admin (Store, Booking, Blog).
 */
import type { Db } from './store';
import { sanitizeArticle } from './sanitize';

/** posts = a list of blog posts; post = one article (the one being read on /blog/<slug>, else the newest). */
export const COLLECTION_KINDS = ['products', 'services', 'posts', 'post'] as const;
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
  posts: postFields(),
  post: {
    ...postFields(),
    content: 'The full article (formatted HTML from Admin → Blog). Bind it on a block element such as <div>.',
  },
};

function postFields(): Record<string, string> {
  return {
    id: 'Post id',
    title: 'Post title',
    slug: 'URL slug',
    excerpt: 'Summary (plain text; falls back to the start of the article)',
    date: 'Formatted publish date, e.g. "February 12, 2026"',
    date_iso: 'Publish date as YYYY-MM-DD (for <time datetime>)',
    image: 'Cover image URL (on <img>: src; with data-ks-bind-bg: background)',
    author: 'Author name',
    tags: 'Tags, comma-separated',
    tag: 'First tag',
    url: 'Article URL (/blog/<slug>)',
    reading_time: 'e.g. "4 min read"',
    featured: '"true" for the featured post',
    current: '"true" for the article being read (use data-ks-filter="!current" for "more stories")',
  };
}

/** Where articles live: /blog/<slug>. */
export const POST_PATH_PREFIX = '/blog/';
export function postPath(slug: string): string {
  return `${POST_PATH_PREFIX}${encodeURIComponent(slug)}`;
}

export type CollectionItem = Record<string, string> & { id: string };

export interface CollectionData {
  products?: CollectionItem[];
  services?: CollectionItem[];
  posts?: CollectionItem[];
  post?: CollectionItem[];
  /** The article being read (/blog/<slug>), for the page title, meta tags and structured data. */
  article?: ArticleMeta;
  /** cart payloads by product id (for add-to-cart) */
  productPayload?: Record<string, { productId: string; name: string; price_cents: number; currency: string; image?: string; needsOptions: boolean; url: string }>;
}

export interface ArticleMeta {
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  author: string;
  tags: string[];
  content: string;
  datePublished: string | null;
  dateModified: string | null;
}

export interface FetchOptions {
  /** On /blog/<slug>: the article being read. */
  postSlug?: string | null;
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

const POST_DATE = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Toronto' });
const POST_DATE_ISO = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Toronto' });

function postRow(p: Row, currentSlug: string | null | undefined, withContent: boolean): CollectionItem {
  const when = p.published_at || p.created_at;
  const date = when && !Number.isNaN(new Date(when).getTime()) ? new Date(when) : null;
  const text = plain(p.content, 100_000);
  const words = text ? text.split(' ').length : 0;
  const tags = Array.isArray(p.tags) ? p.tags.map((t: unknown) => plain(t, 40)).filter(Boolean) : [];
  const row: CollectionItem = {
    id: String(p.id),
    title: plain(p.title, 200),
    slug: String(p.slug || ''),
    excerpt: plain(p.excerpt, 400) || (text.length > 220 ? `${text.slice(0, 217).replace(/\s+\S*$/, '')}…` : text),
    date: date ? POST_DATE.format(date) : '',
    date_iso: date ? POST_DATE_ISO.format(date) : '',
    image: typeof p.cover_image === 'string' ? p.cover_image : '',
    author: plain(p.author, 80),
    tags: tags.join(', '),
    tag: tags[0] || '',
    url: postPath(String(p.slug || '')),
    reading_time: words ? `${Math.max(1, Math.round(words / 200))} min read` : '',
    featured: p.is_featured ? 'true' : '',
    current: currentSlug && p.slug === currentSlug ? 'true' : '',
  };
  if (withContent) row.content = sanitizeArticle(String(p.content || ''));
  return row;
}

const POST_LIMIT = 100;

export async function fetchCollections(db: Db, siteId: string, kinds: Set<CollectionKind>, opts: FetchOptions = {}): Promise<CollectionData> {
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

  if (kinds.has('posts') || kinds.has('post') || opts.postSlug) {
    jobs.push((async () => {
      const { data } = await db
        .from('blog_posts')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_published', true)
        .eq('is_archived', false)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(POST_LIMIT);
      const rows = (data || []) as Row[];
      if (kinds.has('posts')) out.posts = rows.map((p) => postRow(p, opts.postSlug, false));

      let current: Row | null = null;
      if (opts.postSlug) {
        current = rows.find((p) => p.slug === opts.postSlug) || null;
        if (!current) {
          // Older than the newest POST_LIMIT posts.
          const { data: one } = await db
            .from('blog_posts')
            .select('*')
            .eq('site_id', siteId)
            .eq('slug', opts.postSlug)
            .eq('is_published', true)
            .eq('is_archived', false)
            .maybeSingle();
          current = (one as Row | null) || null;
        }
        if (current) {
          out.article = {
            slug: String(current.slug),
            title: plain(current.title, 200),
            excerpt: plain(current.excerpt, 400),
            image: typeof current.cover_image === 'string' ? current.cover_image : '',
            author: plain(current.author, 80),
            tags: Array.isArray(current.tags) ? current.tags.map((t: unknown) => plain(t, 40)).filter(Boolean) : [],
            content: sanitizeArticle(String(current.content || '')),
            datePublished: current.published_at || current.created_at || null,
            dateModified: current.updated_at || current.published_at || null,
          };
        }
      } else if (kinds.has('post')) {
        current = rows[0] || null; // anywhere else, `post` is the newest article
      }
      if (kinds.has('post')) out.post = current ? [postRow(current, opts.postSlug, true)] : [];
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
export function featuresIn(htmls: string[]): { ecommerce: boolean; booking: boolean; blog: boolean } {
  const all = htmls.join('\n');
  return {
    ecommerce: /data-ks-collection\s*=\s*["']products["']|data-ks-action\s*=\s*["'](add-to-cart|open-cart)["']|href\s*=\s*["']\/(cart|product\/)/.test(all),
    booking: /data-ks-collection\s*=\s*["']services["']|data-ks-action\s*=\s*["']book["']|href\s*=\s*["']\/book\b/.test(all),
    blog: /data-ks-collection\s*=\s*["']posts?["']/.test(all),
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
