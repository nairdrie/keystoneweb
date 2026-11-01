/**
 * Export a classic (block engine) site's content in a clean, design-free form
 * so an agent can rebuild it as a v2 site ("redesign"). Read-only: the v1 site
 * is never modified.
 */
import type { Db } from './store';
import { toPlainText } from './sanitize';

interface ExtractedBlock {
  type: string;
  text: string[];
  images: Array<{ src: string; alt?: string }>;
  links: Array<{ label?: string; href: string }>;
}

const SKIP_KEYS = /^(__.*|id|type|variant|layout|style|className|class|color|bgColor|backgroundColor|textColor|icon|animation|align|alignment|size|padding|margin)$/i;
const IMAGE_KEY = /(image|img|photo|src|logo|bg|background|avatar|thumbnail|url)$/i;

function walk(value: unknown, key: string, out: ExtractedBlock, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return;
  if (typeof value === 'string') {
    const v = value.trim();
    if (!v) return;
    if (/^https?:\/\/\S+\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(v) || (IMAGE_KEY.test(key) && /^https?:\/\//.test(v))) {
      out.images.push({ src: v });
      return;
    }
    if (/^(#|rgb|hsl|palette:|var\()/i.test(v) || /^[a-z0-9_-]{1,24}$/.test(v) && !/\s/.test(v) && key !== 'title') return;
    if (/(href|link|url)$/i.test(key)) {
      out.links.push({ href: v });
      return;
    }
    const text = toPlainText(v);
    if (text.length > 1) out.text.push(text);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => walk(v, key, out, depth + 1));
    return;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.url === 'string' && /^https?:\/\//.test(obj.url) && (IMAGE_KEY.test(key) || 'alt' in obj)) {
      out.images.push({ src: obj.url, alt: typeof obj.alt === 'string' ? obj.alt : undefined });
      return;
    }
    for (const [k, v] of Object.entries(obj)) {
      if (SKIP_KEYS.test(k) && typeof v !== 'object') continue;
      if (k.endsWith('__styles') || k.endsWith('__settings')) continue;
      walk(v, k, out, depth + 1);
    }
  }
}

export async function exportLegacySite(db: Db, siteId: string) {
  const { data: site } = await db
    .from('sites')
    .select('id, site_slug, design_data, published_data, business_profile, custom_domain, published_domain, is_published')
    .eq('id', siteId)
    .single();
  if (!site) return null;
  const dd = (site.is_published ? site.published_data : site.design_data) || {};

  const { data: pages } = await db
    .from('pages')
    .select('slug, title, display_name, is_visible_in_nav, nav_order, design_data, published_data')
    .eq('site_id', siteId)
    .order('nav_order', { ascending: true });

  const [products, menu, posts, services] = await Promise.all([
    db.from('products').select('name, price_cents', { count: 'exact' }).eq('site_id', siteId).limit(20),
    db.from('menu_items').select('name', { count: 'exact', head: true }).eq('site_id', siteId),
    db.from('blog_posts').select('title', { count: 'exact', head: true }).eq('site_id', siteId),
    db.from('booking_services').select('name, duration_minutes', { count: 'exact' }).eq('site_id', siteId).limit(20),
  ]);

  return {
    site: {
      title: dd.siteTitle || site.site_slug,
      tagline: dd.tagline || dd.description || null,
      logo: dd.siteLogo || dd.headerLogo || null,
      contactEmail: dd.contactEmail || null,
      socialLinks: dd.socialLinks || null,
      businessProfile: site.business_profile || null,
      liveUrl: site.custom_domain ? `https://${site.custom_domain}` : site.published_domain ? `https://${site.published_domain}.kswd.ca` : null,
    },
    pages: (pages || []).map((p) => {
      const data = ((site.is_published ? p.published_data : p.design_data) || p.design_data || {}) as Record<string, unknown>;
      const blocks = Array.isArray(data.blocks) ? (data.blocks as Array<{ type: string; data: unknown }>) : [];
      return {
        slug: p.slug,
        title: p.title,
        navLabel: p.display_name,
        inNav: p.is_visible_in_nav,
        seo: { title: data.seoTitle || null, description: data.seoDescription || null },
        blocks: blocks.map((b) => {
          const out: ExtractedBlock = { type: b.type, text: [], images: [], links: [] };
          walk(b.data, b.type, out);
          out.text = [...new Set(out.text)];
          return out;
        }),
      };
    }),
    data: {
      products: { count: products.count ?? 0, sample: products.data || [] },
      menuItems: { count: menu.count ?? 0 },
      blogPosts: { count: posts.count ?? 0 },
      bookingServices: { count: services.count ?? 0, sample: services.data || [] },
      note: 'Products, menus, blog posts and booking services stay in Keystone and are not part of the page design.',
    },
  };
}
