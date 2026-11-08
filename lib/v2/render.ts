/**
 * v2 renderer: design + content → a complete HTML document.
 *
 * The server never executes agent code. It parses the section template,
 * swaps escaped/sanitized content values into the marked elements, expands
 * lists, and emits the agent's CSS (scoped) and JS (as inert module text that
 * the browser runtime imports).
 */
import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { BusinessProfile } from '@/lib/types/sites';
import { buildBlogJsonLd, buildJsonLd } from '@/lib/seo/jsonld';
import type {
  FieldSchema,
  PageRecord,
  RenderMode,
  SectionInstance,
  SectionRecord,
  SiteBundle,
  ThemeRecord,
} from './types';
import { GLOBAL_INSTANCE_FOOTER, GLOBAL_INSTANCE_HEADER } from './types';
import { compileSection } from './compile';
import { scopeCss, sectionScopeSelector } from './css-scope';
import { escapeHtml, safeHref, safeSrc, safeTokenValue, sanitizeInline, sanitizeRich, toPlainText } from './sanitize';
import { SCRIPT_HOST_ALLOWLIST } from './policy';
import { textStylesFor } from './text-styles';
import { postPath, type ArticleMeta, type CollectionData, type CollectionItem, type CollectionKind } from './collections';

const STATIC_TAGS = new Set(['svg', 'select', 'option', 'textarea', 'noscript', 'template', 'canvas', 'video', 'audio', 'iframe', 'math']);

// ── "Powered by Keystone" ──────────────────────────────────────────────────
// Required on every Keystone site, whoever designed it (an external MCP agent,
// Archie or our team). Agents opt into a styled version by putting an element
// with data-ks-attribution in their footer; the renderer always writes its
// text and link, so neither the agent nor the owner can change or drop them.
// Without a slot, a plain fallback line is rendered after the footer.
// public/ks/runtime.js re-adds the fallback if CSS/JS hides the slot.
export const ATTRIBUTION_URL = 'https://keystoneweb.ca';
const ATTRIBUTION_GUARD = 'visibility:visible!important;filter:none!important;clip-path:none!important';
const ATTRIBUTION_LINK = `<a href="${ATTRIBUTION_URL}" target="_blank" rel="noopener" style="${ATTRIBUTION_GUARD};display:inline!important">Keystone</a>`;
export const ATTRIBUTION_FALLBACK_HTML =
  `<div data-ks-attribution data-ks-attribution-fallback style="display:block!important;${ATTRIBUTION_GUARD};opacity:1!important;position:static!important;` +
  `margin:0!important;padding:12px 16px!important;text-align:center!important;font:12px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif!important;` +
  `color:inherit;background:transparent">Powered by ${ATTRIBUTION_LINK.replace('style="', 'style="color:inherit;text-decoration:underline;')}</div>`;

/** Append the fallback badge unless the rendered page already has a filled slot. */
export function withAttribution(html: string, found: boolean): string {
  return found ? html : `${html}\n${ATTRIBUTION_FALLBACK_HTML}`;
}

function fillAttribution($el: Cheerio<Element>, tag: string) {
  for (const a of ['hidden', 'inert', 'aria-hidden', 'tabindex']) $el.removeAttr(a);
  const style = ($el.attr('style') || '').trim().replace(/;?$/, '');
  $el.attr('style', `${style ? `${style};` : ''}${ATTRIBUTION_GUARD}`);
  if (tag === 'a') {
    $el.attr('href', ATTRIBUTION_URL).attr('target', '_blank').attr('rel', 'noopener');
    $el.text('Powered by Keystone');
  } else {
    $el.html(`Powered by ${ATTRIBUTION_LINK}`);
  }
}

export interface RenderOptions {
  mode: RenderMode;
  /** Absolute origin of the site, e.g. https://acme.kswd.ca (published) */
  siteUrl?: string;
  /** Prefix for internal links in draft modes, e.g. /v2r/draft/<token> */
  linkBase?: string;
  /** Origin of the editor window (edit mode postMessage target) */
  editorOrigin?: string;
  /** Where /ks/runtime.js is served from (defaults to same origin) */
  assetBase?: string;
  /** Release id or 'draft', used for cache busting */
  version?: string;
  /** Live business data for data-ks-collection elements */
  collections?: CollectionData;
  /** Rendering /blog/<slug>: the page title, meta tags and structured data come from the article. */
  article?: ArticleMeta;
  /** Trusted body HTML used instead of a page's sections (Keystone's default article layout). */
  bodyOverride?: string;
}

interface GlobalValues {
  name: string;
  phone: string;
  email: string;
  address: string;
  hours: string[];
  logo: string;
}

export function pagePath(page: Pick<PageRecord, 'slug'>): string {
  return page.slug === 'home' ? '/' : `/${page.slug}`;
}

export function findPageByPath(bundle: SiteBundle, path: string): PageRecord | undefined {
  const clean = decodeURIComponent(path || '/').replace(/\/+$/, '') || '/';
  const slug = clean === '/' ? 'home' : clean.replace(/^\//, '').toLowerCase();
  return bundle.pages.find((p) => p.slug === slug);
}

/** Resolve the effective theme tokens (agent tokens + owner overrides). */
export function resolveTokens(theme: ThemeRecord): Array<{ name: string; value: string }> {
  const overrides = theme.owner_overrides || {};
  return (theme.tokens || []).map((t) => ({
    name: t.name,
    value: t.editable !== false && overrides[t.name] !== undefined ? overrides[t.name] : t.value,
  }));
}

function globalsFor(bundle: SiteBundle): GlobalValues {
  const bp = (bundle.site.businessProfile || {}) as Partial<BusinessProfile>;
  const address = [bp.streetAddress, [bp.addressLocality, bp.addressRegion].filter(Boolean).join(', '), bp.postalCode]
    .filter((p) => p && String(p).trim())
    .join(', ');
  return {
    name: (bp.legalName as string) || bundle.site.title || '',
    phone: (bp.telephone as string) || '',
    email: bundle.site.contactEmail || '',
    address,
    hours: Array.isArray(bp.openingHours) ? (bp.openingHours as string[]) : [],
    logo: bundle.site.logo || '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Section instances
// ─────────────────────────────────────────────────────────────────────────────

interface FillCtx {
  $: CheerioAPI;
  mode: RenderMode;
  globals: GlobalValues;
  bundle: SiteBundle;
  page: PageRecord | null;
  collections?: CollectionData;
  /** Set when a data-ks-attribution slot was filled. */
  attribution?: { found: boolean };
  /** Edit mode: the designer's default values for this scope (where text styles come from). */
  defaults?: Record<string, unknown>;
}

/** Field values for an instance: template defaults overlaid with stored content. */
export function instanceValues(section: SectionRecord, stored: Record<string, unknown> | undefined): Record<string, unknown> {
  const schema = ensureSchema(section);
  return { ...(schema.defaults || {}), ...(stored || {}) };
}

export function ensureSchema(section: SectionRecord) {
  const schema = section.schema as ReturnType<typeof compileSection>;
  if (schema && Array.isArray(schema.fields)) return schema;
  return compileSection(section.html);
}

export function renderInstance(
  bundle: SiteBundle,
  section: SectionRecord,
  instance: SectionInstance,
  page: PageRecord | null,
  mode: RenderMode,
  collections?: CollectionData,
  attribution?: { found: boolean },
): string {
  const $ = load(section.html || '', null, false);
  const schema = ensureSchema(section);
  const values = instanceValues(section, bundle.content[instance.id]);
  const ctx: FillCtx = { $, mode, globals: globalsFor(bundle), bundle, page, collections, attribution, defaults: schema.defaults as Record<string, unknown> };

  fillScope($.root().contents(), values, schema.fields, '', ctx);
  if (mode === 'published') stripEditorAttributes($);

  const attrs = [
    `data-ks-section="${escapeHtml(section.key)}"`,
    `data-ks-instance="${escapeHtml(instance.id)}"`,
    mode === 'edit' && instance.hidden ? 'data-ks-hidden=""' : '',
  ].filter(Boolean).join(' ');
  return `<div ${attrs} style="display:contents">${$.html()}</div>`;
}

function fillScope(nodes: Cheerio<AnyNode>, values: Record<string, unknown>, fields: FieldSchema[], path: string, ctx: FillCtx) {
  const byId = new Map(fields.map((f) => [f.id, f]));
  nodes.each((_, node) => fillNode(node, values, byId, path, ctx));
}

function fillNode(node: AnyNode, values: Record<string, unknown>, fields: Map<string, FieldSchema>, path: string, ctx: FillCtx) {
  if (node.type !== 'tag') return;
  const el = node as Element;
  const $el = ctx.$(el);
  const tag = el.tagName.toLowerCase();
  const attrs = el.attribs || {};

  if ('data-ks-attribution' in attrs) {
    fillAttribution($el, tag);
    if (ctx.attribution) ctx.attribution.found = true;
    return;
  }

  if ('data-ks-static' in attrs || 'data-ks-cart-count' in attrs || STATIC_TAGS.has(tag)) return;

  if ('data-ks-collection' in attrs) {
    renderCollection($el, attrs['data-ks-collection'].trim() as CollectionKind, ctx);
    // The container's own content (headings, empty message) is owner content.
    $el.contents().each((_, child) => {
      if (child.type === 'tag' && 'data-ks-item' in ((child as Element).attribs || {})) return;
      fillNode(child, values, fields, path, ctx);
    });
    return;
  }

  if ('data-ks-nav' in attrs) {
    renderNav($el, ctx);
    return;
  }

  if ('data-ks-list' in attrs) {
    const id = attrs['data-ks-list'].trim();
    renderList($el, id, values[id], fields.get(id), path, ctx);
    // Non-item children of the list container (headings etc.) use the outer scope.
    $el.contents().each((_, child) => {
      if (child.type === 'tag' && 'data-ks-item' in ((child as Element).attribs || {})) return;
      fillNode(child, values, fields, path, ctx);
    });
    return;
  }

  if ('data-ks-optional' in attrs && !('data-ks' in attrs) && attrs['data-ks-optional']) {
    const id = attrs['data-ks-optional'];
    // Older designs' show/hide switches. Still honoured; agents no longer write them.
    if (isHidden(values[id])) {
      $el.remove();
      return;
    }
    if (ctx.mode === 'edit') $el.attr('data-ks-f', `${path}${id}`).attr('data-ks-t', 'toggle');
  }

  if ('data-ks' in attrs) {
    const binding = attrs['data-ks'].trim();
    if (binding.startsWith('@')) {
      fillGlobal($el, tag, binding, ctx);
      return;
    }
    const field = fields.get(binding);
    if (!field) return;
    const value = values[binding];
    // The owner removed it (stored as hidden: true): gone, in the editor too.
    // A background is the exception: removing it clears the image, its content stays.
    if (isHidden(value) && field.type !== 'bg') {
      $el.remove();
      return;
    }
    if (ctx.mode === 'edit') {
      $el.attr('data-ks-f', `${path}${binding}`).attr('data-ks-t', field.type);
      if (field.type === 'text' || field.type === 'richtext') {
        // The designer's own accent styles, offered in the text toolbar.
        const styles = textStylesFor([ctx.defaults?.[binding], value]);
        if (styles.length) $el.attr('data-ks-st', JSON.stringify(styles));
      }
    }
    const descend = fillField($el, tag, field, value);
    if (!descend) return;
  }

  $el.contents().each((_, child) => fillNode(child, values, fields, path, ctx));
}

/** Returns true when the element's children should be filled too. */
function fillField($el: Cheerio<Element>, tag: string, field: FieldSchema, value: unknown): boolean {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  switch (field.type) {
    case 'text':
      $el.html(sanitizeInline(asString(v.html ?? value)));
      return false;
    case 'richtext':
      $el.html(sanitizeRich(asString(v.html ?? value)));
      return false;
    case 'image': {
      const src = safeSrc(v.src ?? value);
      const original = $el.attr('src');
      if (src) $el.attr('src', src);
      if (src && src !== original) {
        $el.removeAttr('srcset');
        $el.removeAttr('sizes');
      }
      if (typeof v.alt === 'string') $el.attr('alt', toPlainText(v.alt));
      return false;
    }
    case 'bg': {
      const src = safeSrc(v.src ?? value);
      if (v.hidden) {
        // Removed by the owner: no image, from the template or the design's CSS.
        const style = ($el.attr('style') || '').replace(/background-image\s*:[^;]*;?/gi, '').trim();
        $el.attr('style', `${style}${style && !style.endsWith(';') ? ';' : ''}background-image:none`);
      } else if (src) {
        const style = ($el.attr('style') || '').replace(/background-image\s*:[^;]*;?/gi, '').trim();
        const sep = style && !style.endsWith(';') ? ';' : '';
        const encoded = src.replace(/['"\\\n\r()]/g, (c) => URL_ESCAPES[c] ?? '');
        $el.attr('style', `${style}${sep}background-image:url('${encoded}')`);
      }
      return true;
    }
    case 'link': {
      $el.attr('href', safeHref(v.href));
      if (v.newTab) $el.attr('target', '_blank').attr('rel', 'noopener noreferrer');
      else $el.removeAttr('target');
      if (field.hrefOnly) return true;
      $el.html(sanitizeInline(asString(v.label)));
      return false;
    }
    default:
      return false;
  }
}

function renderList($list: Cheerio<Element>, id: string, value: unknown, field: FieldSchema | undefined, path: string, ctx: FillCtx) {
  const $ = ctx.$;
  const itemEls = $list.children('[data-ks-item]');
  if (!itemEls.length) return;
  const template = $.html(itemEls.first());
  const list = (value && typeof value === 'object' ? value : {}) as { items?: unknown[]; hidden?: boolean };
  const items = Array.isArray(list.items) ? list.items : [];
  const listPath = `${path}${id}`;

  if (list.hidden) {
    $list.remove();
    return;
  }

  // An empty list in the editor keeps the designer's first item as a faded
  // placeholder, so the owner has something to click to add an item.
  if (!items.length && ctx.mode === 'edit') {
    itemEls.slice(1).remove();
    itemEls.first().attr('data-ks-ghost', '');
    $list.attr('data-ks-l', listPath);
    return;
  }

  // Remove the non-template items; render each value from the template.
  const rendered: string[] = [];
  items.forEach((item, index) => {
    const $item = load(template, null, false);
    const sub: FillCtx = { ...ctx, $: $item };
    if (ctx.mode === 'edit') {
      // Styles for a field in a list come from that field in every default item.
      const defaultItems = listItemsOf(ctx.defaults?.[id]);
      const keys = new Set(defaultItems.flatMap((d) => (d && typeof d === 'object' ? Object.keys(d as object) : [])));
      sub.defaults = Object.fromEntries([...keys].map((k) => [k, defaultItems.map((d) => (d as Record<string, unknown> | null)?.[k])]));
    }
    fillScope($item.root().contents(), (item || {}) as Record<string, unknown>, field?.item || [], `${listPath}.${index}.`, sub);
    if (ctx.mode === 'edit') $item.root().children().first().attr('data-ks-i', String(index));
    rendered.push($item.html());
  });

  itemEls.slice(1).remove();
  itemEls.first().replaceWith(rendered.join(''));

  if (ctx.mode === 'edit') $list.attr('data-ks-l', listPath);
}

function renderCollection($box: Cheerio<Element>, kind: CollectionKind, ctx: FillCtx) {
  const $ = ctx.$;
  const itemEls = $box.children('[data-ks-item]');
  if (!itemEls.length) return;
  const template = $.html(itemEls.first());
  const $empty = $box.children('[data-ks-empty]');
  const all = ctx.collections?.[kind];

  let rows: CollectionItem[] = Array.isArray(all) ? all : [];
  const filter = ($box.attr('data-ks-filter') || '').trim();
  if (filter) rows = rows.filter((r) => !!r[filter.replace(/^!/, '')] !== filter.startsWith('!'));
  const category = ($box.attr('data-ks-category') || '').trim().toLowerCase();
  if (category) rows = rows.filter((r) => (r.category || '').toLowerCase() === category);
  const tag = ($box.attr('data-ks-tag') || '').trim().toLowerCase();
  if (tag) rows = rows.filter((r) => (r.tags || '').toLowerCase().split(/\s*,\s*/).includes(tag));
  const ids = ($box.attr('data-ks-ids') || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (ids.length) rows = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is CollectionItem => !!r);
  const offset = Number($box.attr('data-ks-offset'));
  if (offset > 0) rows = rows.slice(offset);
  const limit = Number($box.attr('data-ks-limit'));
  if (limit > 0) rows = rows.slice(0, limit);

  if (ctx.mode === 'edit') $box.attr('data-ks-c', kind);

  if (!rows.length) {
    if (ctx.mode === 'published') {
      itemEls.remove();
      $empty.removeAttr('hidden');
    } else {
      // Drafts with no data yet: keep the designer's sample items, marked as samples.
      itemEls.attr('data-ks-sample', '');
      $empty.attr('hidden', '');
    }
    return;
  }

  const rendered = rows.map((row) => {
    const $item = load(template, null, false);
    const $root = $item.root().children().first();
    $item('[data-ks-if]').add($root.filter('[data-ks-if]')).each((_, node) => {
      const cond = String($item(node).attr('data-ks-if') || '');
      const truthy = !!row[cond.replace(/^!/, '')];
      if (truthy === cond.startsWith('!')) $item(node).remove();
      else $item(node).removeAttr('data-ks-if');
    });
    $item('[data-ks-bind]').add($root.filter('[data-ks-bind]')).each((_, node) => {
      const $n = $item(node);
      const field = String($n.attr('data-ks-bind'));
      const value = row[field] ?? '';
      const t = (node as Element).tagName.toLowerCase();
      if (field === 'content' && kind === 'post') {
        $n.html(value); // sanitized article HTML (sanitizeArticle)
      } else if (t === 'img') {
        const src = safeSrc(value);
        if (src) {
          $n.attr('src', src).removeAttr('srcset').removeAttr('sizes');
          if (!$n.attr('alt')) $n.attr('alt', row.name || row.title || '');
        } else {
          $n.remove();
        }
      } else if (t === 'a' && (field === 'url' || /^https?:|^\//.test(value))) {
        $n.attr('href', safeHref(value));
      } else {
        $n.text(value);
        if (t === 'time' && row.date_iso) $n.attr('datetime', row.date_iso);
      }
      $n.removeAttr('data-ks-bind');
    });
    $item('[data-ks-bind-bg]').add($root.filter('[data-ks-bind-bg]')).each((_, node) => {
      const $n = $item(node);
      const src = safeSrc(row[String($n.attr('data-ks-bind-bg'))]);
      if (src) {
        const style = ($n.attr('style') || '').replace(/background-image\s*:[^;]*;?/gi, '').trim();
        const encoded = src.replace(/['"\\\n\r()]/g, (c) => URL_ESCAPES[c] ?? '');
        $n.attr('style', `${style}${style && !style.endsWith(';') ? ';' : ''}background-image:url('${encoded}')`);
      }
      $n.removeAttr('data-ks-bind-bg');
    });
    if (kind === 'products') {
      const payload = ctx.collections?.productPayload?.[row.id];
      if (payload) $root.attr('data-ks-product', JSON.stringify(payload));
    } else if (kind === 'services') {
      $root.attr('data-ks-service', row.id);
      $item('[data-ks-action="book"]').each((_, node) => {
        if ((node as Element).tagName.toLowerCase() === 'a') $item(node).attr('href', row.url);
      });
    }
    $root.removeAttr('data-ks-item');
    return $item.html();
  });

  itemEls.slice(1).remove();
  itemEls.first().replaceWith(rendered.join(''));
  $empty.remove();
}

function renderNav($nav: Cheerio<Element>, ctx: FillCtx) {
  const $ = ctx.$;
  const navPages = ctx.bundle.pages
    .filter((p) => p.is_visible_in_nav && p.template !== 'post')
    .sort((a, b) => a.nav_order - b.nav_order);

  // The template is the direct child of the nav container that holds the first link.
  if ($nav.is('a')) return;
  const firstLink = $nav.find('a').first();
  if (!firstLink.length) return;
  let $template: Cheerio<Element> = firstLink;
  while ($template.parent().length && !$template.parent().is($nav)) $template = $template.parent();

  const templateHtml = $.html($template);
  const out = navPages.map((p) => {
    const $item = load(templateHtml, null, false);
    const $a = $item.root().find('a').first().length ? $item.root().find('a').first() : $item.root().children('a').first();
    $a.attr('href', pagePath(p));
    $a.text(p.display_name || p.title);
    if (ctx.page && p.id === ctx.page.id) $a.attr('aria-current', 'page');
    else $a.removeAttr('aria-current');
    return $item.html();
  });

  $nav.children().filter((_, child) => $(child).is('a') || $(child).find('a').length > 0).remove();
  $nav.append(out.join(''));
  if (ctx.mode === 'edit') $nav.attr('data-ks-navedit', '');
}

function fillGlobal($el: Cheerio<Element>, tag: string, binding: string, ctx: FillCtx) {
  const g = ctx.globals;
  const setText = (text: string) => {
    if (text) $el.text(text);
  };
  switch (binding) {
    case '@business.name':
    case '@site.name':
      setText(binding === '@site.name' ? ctx.bundle.site.title || g.name : g.name);
      break;
    case '@business.phone':
      setText(g.phone);
      if (tag === 'a' && g.phone) $el.attr('href', `tel:${g.phone.replace(/[^\d+]/g, '')}`);
      break;
    case '@business.email':
      setText(g.email);
      if (tag === 'a' && g.email) $el.attr('href', `mailto:${g.email}`);
      break;
    case '@business.address':
      setText(g.address);
      break;
    case '@business.hours':
      if (g.hours.length) $el.html(g.hours.map((h) => escapeHtml(h)).join('<br>'));
      break;
    case '@site.logo':
      if (tag === 'img' && g.logo) {
        $el.attr('src', safeSrc(g.logo));
        $el.removeAttr('srcset');
      }
      break;
    case '@site.year':
      $el.text(String(new Date().getFullYear()));
      break;
  }
  if (ctx.mode === 'edit') $el.attr('data-ks-g', binding);
}

function stripEditorAttributes($: CheerioAPI) {
  $('*').each((_, node) => {
    const el = node as Element;
    for (const name of Object.keys(el.attribs || {})) {
      if (!name.startsWith('data-ks')) continue;
      if (name.startsWith('data-ks-form') || name === 'data-ks-action' || name.startsWith('data-ks-action-')) continue;
      if (name === 'data-ks-product' || name === 'data-ks-service' || name === 'data-ks-cart-count') continue;
      if (name.startsWith('data-ks-attribution')) continue; // runtime.js checks it stays visible
      delete el.attribs[name];
    }
  });
}

/** Items of a list value; in a nested list's defaults that's one list per parent item. */
function listItemsOf(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(listItemsOf);
  const items = (value as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? items : [];
}

function isHidden(value: unknown): boolean {
  return !!(value && typeof value === 'object' && (value as { hidden?: boolean }).hidden);
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'html' in (value as object)) return asString((value as { html: unknown }).html);
  return String(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pages
// ─────────────────────────────────────────────────────────────────────────────

export interface RenderedPage {
  html: string;
  status: number;
  stats: { cssBytes: number; jsBytes: number };
}

export function renderPage(bundle: SiteBundle, page: PageRecord | null, options: RenderOptions): RenderedPage {
  const { mode } = options;
  const theme = bundle.theme;
  const used = new Map<string, SectionRecord>();
  const renderedInstances: Array<{ section: SectionRecord; instance: SectionInstance }> = [];
  const attribution = { found: false };

  const renderOne = (instance: SectionInstance): string => {
    const section = bundle.sections[instance.section];
    if (!section) {
      return mode === 'published' ? '' : `<div data-ks-instance="${escapeHtml(instance.id)}" style="padding:2rem;border:2px dashed #f59e0b;font:14px system-ui">Missing section design "${escapeHtml(instance.section)}"</div>`;
    }
    if (instance.hidden && mode !== 'edit') return '';
    used.set(section.key, section);
    renderedInstances.push({ section, instance });
    return renderInstance(bundle, section, instance, page, mode, options.collections, attribution);
  };

  const header = theme.header_section ? renderOne({ id: GLOBAL_INSTANCE_HEADER, section: theme.header_section }) : '';
  const footer = theme.footer_section ? renderOne({ id: GLOBAL_INSTANCE_FOOTER, section: theme.footer_section }) : '';
  const body = options.bodyOverride !== undefined
    ? options.bodyOverride
    : page
    ? page.instances.map(renderOne).join('\n')
    : `<section style="min-height:50vh;display:grid;place-items:center;text-align:center;padding:4rem 1rem"><div><h1>Page not found</h1><p><a href="/">Go to the home page</a></p></div></section>`;
  const footerWithAttribution = withAttribution(footer, attribution.found);

  // ── CSS ──
  const tokens = resolveTokens(theme);
  const tokenCss = tokens.length
    ? `:root{${tokens.map((t) => `--${t.name}:${safeTokenValue(t.value)}`).join(';')}}`
    : '';
  const sectionCss = [...used.values()]
    .map((s) => scopeCss(s.css || '', sectionScopeSelector(s.key)).css)
    .filter(Boolean)
    .join('\n');
  const editCss = mode === 'edit' ? EDIT_MODE_CSS : '';
  const css = [tokenCss, theme.global_css || '', sectionCss, editCss].filter(Boolean).join('\n');

  // ── JS (inert module text; the runtime imports it unless editing) ──
  const modules: string[] = [];
  if (mode !== 'edit') {
    if ((theme.global_js || '').trim()) modules.push(moduleTag('@global', theme.global_js));
    for (const s of used.values()) if ((s.js || '').trim()) modules.push(moduleTag(s.key, s.js));
  }
  const jsBytes = Buffer.byteLength(modules.join(''), 'utf8');

  // ── Head ──
  const siteTitle = bundle.site.title || 'Website';
  const article = options.article;
  const isHome = !article && page?.slug === 'home';
  const found = !!page || !!article;
  const title = article
    ? `${article.title} | ${siteTitle}`
    : page
    ? page.seo.title || (isHome ? siteTitle : `${page.title} | ${siteTitle}`)
    : `Page not found | ${siteTitle}`;
  const description = article
    ? article.excerpt || toPlainText(article.content).slice(0, 160)
    : page?.seo.description || '';
  const canonical = options.siteUrl && article
    ? `${options.siteUrl}${postPath(article.slug)}`
    : options.siteUrl && page ? `${options.siteUrl}${pagePath(page)}` : '';
  const ogImage = (article?.image) || page?.seo.ogImage || bundle.site.logo || '';
  const fontsHref = googleFontsHref(theme, tokens);
  const favicon = bundle.site.favicon || bundle.site.logo;

  let jsonLd = '';
  if (mode === 'published' && article && options.siteUrl) {
    jsonLd = buildBlogJsonLd({
      siteUrl: options.siteUrl,
      pageUrl: canonical,
      title: article.title,
      excerpt: description,
      content: article.content,
      coverImage: article.image || null,
      author: article.author || null,
      datePublished: article.datePublished,
      dateModified: article.dateModified,
      tags: article.tags,
      businessProfile: bundle.site.businessProfile as unknown as BusinessProfile | null,
    })
      .map((e) => `<script type="application/ld+json">${JSON.stringify(e.data).replace(/</g, '\\u003c')}</script>`)
      .join('');
  } else if (mode === 'published' && page && options.siteUrl) {
    try {
      const hints = structuredDataHints(bundle, renderedInstances, options.collections);
      const entries = buildJsonLd({
        businessProfile: bundle.site.businessProfile as unknown as BusinessProfile | null,
        siteUrl: options.siteUrl,
        pageUrl: canonical,
        pageTitle: title,
        pageDescription: description,
        isHomePage: isHome,
        testimonials: hints.testimonials,
        blocks: hints.blocks,
      });
      jsonLd = entries
        .map((e) => `<script type="application/ld+json">${JSON.stringify(e.data).replace(/</g, '\\u003c')}</script>`)
        .join('');
    } catch {
      jsonLd = '';
    }
  }

  const assetBase = options.assetBase || '';
  const config = {
    siteId: bundle.site.id,
    pageId: page?.id || null,
    mode,
    editorOrigin: options.editorOrigin || null,
    version: options.version || 'draft',
  };

  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    description ? `<meta name="description" content="${escapeHtml(description)}">` : '',
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : '',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    description ? `<meta property="og:description" content="${escapeHtml(description)}">` : '',
    ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : '',
    canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}">` : '',
    `<meta property="og:type" content="${article ? 'article' : 'website'}">`,
    article?.datePublished ? `<meta property="article:published_time" content="${escapeHtml(article.datePublished)}">` : '',
    favicon ? `<link rel="icon" href="${escapeHtml(safeSrc(favicon) || favicon)}">` : '',
    mode !== 'published' ? '<meta name="robots" content="noindex, nofollow">' : '',
    fontsHref ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${escapeHtml(fontsHref)}">` : '',
    css ? `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>` : '',
    jsonLd,
  ].filter(Boolean).join('\n');

  let html = `<!doctype html>
<html lang="en" class="ks-mode-${mode}" data-ks-config="${escapeHtml(JSON.stringify(config))}">
<head>
${head}
</head>
<body>
${header}
<main id="main">
${body}
</main>
${footerWithAttribution}
${modules.join('\n')}
<script src="${assetBase}/ks/runtime.js?v=4" defer></script>
${mode === 'edit' ? `<script src="${assetBase}/ks/editor.js?v=8" defer></script>` : ''}
</body>
</html>`;

  if (options.linkBase) html = rewriteInternalLinks(html, options.linkBase);

  return {
    html,
    status: found ? 200 : 404,
    stats: { cssBytes: Buffer.byteLength(css, 'utf8'), jsBytes },
  };
}

function moduleTag(key: string, code: string): string {
  return `<script type="text/ks-module" data-ks-js="${escapeHtml(key)}">${code.replace(/<\/script/gi, '<\\/script')}</script>`;
}

/** In draft modes keep navigation inside the draft (e.g. /about → /v2r/draft/<t>/about). */
function rewriteInternalLinks(html: string, base: string): string {
  return html.replace(/(<a\b[^>]*?\shref=")(\/(?!\/)[^"]*)"/gi, (_m, pre: string, href: string) => `${pre}${base}${href === '/' ? '' : href}"`);
}

function googleFontsHref(theme: ThemeRecord, tokens: Array<{ name: string; value: string }>): string {
  const families = new Map<string, string>();
  for (const f of theme.fonts || []) {
    if (f?.family) families.set(f.family, f.weights || '400;500;600;700');
  }
  const fontTokenNames = new Set((theme.tokens || []).filter((t) => t.type === 'font').map((t) => t.name));
  for (const t of tokens) {
    if (!fontTokenNames.has(t.name)) continue;
    const family = t.value.split(',')[0].replace(/['"]/g, '').trim();
    if (family && !GENERIC_FONTS.has(family.toLowerCase()) && !families.has(family)) families.set(family, '400;500;600;700');
  }
  if (!families.size) return '';
  const params = [...families.entries()]
    .map(([family, weights]) => `family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weights.replace(/[^0-9;]/g, '') || '400;700'}`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

const URL_ESCAPES: Record<string, string> = { "'": '%27', '"': '%22', '(': '%28', ')': '%29', '\\': '%5C' };

const GENERIC_FONTS = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'system-ui', 'ui-sans-serif', 'ui-serif', 'inherit', 'georgia', 'arial', 'helvetica']);

const EDIT_MODE_CSS = `
[data-ks-instance][data-ks-hidden]{opacity:.35!important;outline:2px dashed #94a3b8!important;outline-offset:-2px}
[data-ks-hidden]:not([data-ks-instance]){display:none!important}
[data-ks-ghost]{opacity:.4!important;outline:2px dashed #2563eb!important;outline-offset:2px;cursor:copy!important}
[data-ks-ghost] *{pointer-events:none}
`;

export const ALLOWED_SCRIPT_HOSTS_FOR_CSP = SCRIPT_HOST_ALLOWLIST.map((h) => `https://${h}`).join(' ');

/**
 * Structured data from content: lists marked data-ks-schema="reviews" / "faq"
 * and live services, mapped onto the shapes lib/seo/jsonld already understands.
 */
function structuredDataHints(
  bundle: SiteBundle,
  rendered: Array<{ section: SectionRecord; instance: SectionInstance }>,
  collections?: CollectionData,
) {
  const testimonials: Array<{ name?: string; quote?: string; rating?: number }> = [];
  const faqItems: Array<{ question: string; answer: string }> = [];
  const text = (v: unknown) => toPlainText(asString((v as { html?: unknown })?.html ?? v));
  for (const { section, instance } of rendered) {
    const schema = ensureSchema(section);
    const values = instanceValues(section, bundle.content[instance.id]);
    for (const field of schema.fields) {
      if (field.type !== 'list' || !field.schema) continue;
      const list = values[field.id] as { items?: Array<Record<string, unknown>>; hidden?: boolean } | undefined;
      if (!list || list.hidden) continue;
      for (const item of list.items || []) {
        if (field.schema === 'reviews') {
          const rating = Number(text(item.rating).replace(/[^0-9.]/g, ''));
          testimonials.push({ name: text(item.author), quote: text(item.quote), ...(rating > 0 && rating <= 5 ? { rating } : {}) });
        } else if (field.schema === 'faq') {
          const question = text(item.question);
          const answer = text(item.answer);
          if (question && answer) faqItems.push({ question, answer });
        }
      }
    }
  }
  const blocks: Array<{ type: string; data: Record<string, unknown> }> = [];
  if (faqItems.length) blocks.push({ type: 'faq', data: { items: faqItems } });
  if (collections?.services?.length) {
    blocks.push({ type: 'servicesGrid', data: { items: collections.services.map((s) => ({ title: s.name, description: s.description })) } });
  }
  return { testimonials: testimonials.filter((t) => t.quote), blocks };
}

/** Colours Keystone's own flows (cart, booking, product pages) use, from the theme. */
export function platformPalette(theme: ThemeRecord): { primary: string; secondary: string; accent: string } {
  const tokens = resolveTokens(theme);
  const value = (name?: string) => (name ? tokens.find((t) => t.name === name)?.value : undefined);
  const colors = (theme.tokens || []).filter((t) => t.type === 'color').map((t) => value(t.name)).filter((v): v is string => !!v);
  const map = theme.platform || {};
  return {
    primary: value(map.primary) || colors[0] || '#111827',
    secondary: value(map.secondary) || colors[1] || colors[0] || '#374151',
    accent: value(map.accent) || colors[2] || '#f3f4f6',
  };
}

export interface RenderedChrome {
  /** fonts + token/global/header/footer CSS for <head> */
  head: string;
  header: string;
  footer: string;
  /** agent JS modules for header/footer (inert text the runtime imports) */
  modules: string;
  config: string;
  palette: { primary: string; secondary: string; accent: string };
}

/**
 * The site's header, footer and design tokens, for Keystone-hosted pages
 * (cart, booking, product pages) on agent-built sites.
 */
export function renderChrome(bundle: SiteBundle, options: { siteUrl?: string; collections?: CollectionData } = {}): RenderedChrome {
  const theme = bundle.theme;
  const used: SectionRecord[] = [];
  const attribution = { found: false };
  const one = (id: string, key: string | null) => {
    if (!key || !bundle.sections[key]) return '';
    used.push(bundle.sections[key]);
    return renderInstance(bundle, bundle.sections[key], { id, section: key }, null, 'published', options.collections, attribution);
  };
  const header = one(GLOBAL_INSTANCE_HEADER, theme.header_section);
  const footer = withAttribution(one(GLOBAL_INSTANCE_FOOTER, theme.footer_section), attribution.found);
  const tokens = resolveTokens(theme);
  const tokenCss = tokens.length ? `:root{${tokens.map((t) => `--${t.name}:${safeTokenValue(t.value)}`).join(';')}}` : '';
  const css = [tokenCss, theme.global_css || '', ...used.map((s) => scopeCss(s.css || '', sectionScopeSelector(s.key)).css)].filter(Boolean).join('\n');
  const fontsHref = googleFontsHref(theme, tokens);
  const modules = [
    (theme.global_js || '').trim() ? moduleTag('@global', theme.global_js) : '',
    ...used.map((s) => ((s.js || '').trim() ? moduleTag(s.key, s.js) : '')),
  ].filter(Boolean);
  const config = JSON.stringify({ siteId: bundle.site.id, pageId: null, mode: 'published', editorOrigin: null, version: 'flow' });
  return {
    head: [
      fontsHref ? `<link rel="stylesheet" href="${escapeHtml(fontsHref)}">` : '',
      css ? `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>` : '',
    ].filter(Boolean).join('\n'),
    header,
    footer,
    modules: modules.join('\n'),
    config,
    palette: platformPalette(theme),
  };
}
