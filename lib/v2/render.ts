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
import { buildJsonLd } from '@/lib/seo/jsonld';
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

const STATIC_TAGS = new Set(['svg', 'select', 'option', 'textarea', 'noscript', 'template', 'canvas', 'video', 'audio', 'iframe', 'math']);

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
): string {
  const $ = load(section.html || '', null, false);
  const schema = ensureSchema(section);
  const values = instanceValues(section, bundle.content[instance.id]);
  const ctx: FillCtx = { $, mode, globals: globalsFor(bundle), bundle, page };

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

  if ('data-ks-static' in attrs || STATIC_TAGS.has(tag)) return;

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
    const hidden = isHidden(values[id]);
    if (hidden && ctx.mode !== 'edit') {
      $el.remove();
      return;
    }
    if (ctx.mode === 'edit') {
      $el.attr('data-ks-f', `${path}${id}`).attr('data-ks-t', 'toggle');
      if (hidden) $el.attr('data-ks-hidden', '');
    }
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
    if (isHidden(value)) {
      if (ctx.mode !== 'edit') {
        $el.remove();
        return;
      }
      $el.attr('data-ks-hidden', '');
    }
    if (ctx.mode === 'edit') {
      $el.attr('data-ks-f', `${path}${binding}`).attr('data-ks-t', field.type);
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
      if (src) {
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

  if (list.hidden && ctx.mode !== 'edit') {
    $list.remove();
    return;
  }

  // Remove the non-template items; render each value from the template.
  const rendered: string[] = [];
  items.forEach((item, index) => {
    const $item = load(template, null, false);
    const sub: FillCtx = { ...ctx, $: $item };
    fillScope($item.root().contents(), (item || {}) as Record<string, unknown>, field?.item || [], `${listPath}.${index}.`, sub);
    if (ctx.mode === 'edit') $item.root().children().first().attr('data-ks-i', String(index));
    rendered.push($item.html());
  });

  itemEls.slice(1).remove();
  itemEls.first().replaceWith(rendered.join(''));

  if (ctx.mode === 'edit') {
    $list.attr('data-ks-l', listPath);
    if (list.hidden) $list.attr('data-ks-hidden', '');
  }
}

function renderNav($nav: Cheerio<Element>, ctx: FillCtx) {
  const $ = ctx.$;
  const navPages = ctx.bundle.pages
    .filter((p) => p.is_visible_in_nav)
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
      delete el.attribs[name];
    }
  });
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

  const renderOne = (instance: SectionInstance): string => {
    const section = bundle.sections[instance.section];
    if (!section) {
      return mode === 'published' ? '' : `<div data-ks-instance="${escapeHtml(instance.id)}" style="padding:2rem;border:2px dashed #f59e0b;font:14px system-ui">Missing section design "${escapeHtml(instance.section)}"</div>`;
    }
    if (instance.hidden && mode !== 'edit') return '';
    used.set(section.key, section);
    return renderInstance(bundle, section, instance, page, mode);
  };

  const header = theme.header_section ? renderOne({ id: GLOBAL_INSTANCE_HEADER, section: theme.header_section }) : '';
  const footer = theme.footer_section ? renderOne({ id: GLOBAL_INSTANCE_FOOTER, section: theme.footer_section }) : '';
  const body = page
    ? page.instances.map(renderOne).join('\n')
    : `<section style="min-height:50vh;display:grid;place-items:center;text-align:center;padding:4rem 1rem"><div><h1>Page not found</h1><p><a href="/">Go to the home page</a></p></div></section>`;

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
  const isHome = page?.slug === 'home';
  const title = page
    ? page.seo.title || (isHome ? siteTitle : `${page.title} | ${siteTitle}`)
    : `Page not found | ${siteTitle}`;
  const description = page?.seo.description || '';
  const canonical = options.siteUrl && page ? `${options.siteUrl}${pagePath(page)}` : '';
  const ogImage = page?.seo.ogImage || bundle.site.logo || '';
  const fontsHref = googleFontsHref(theme, tokens);
  const favicon = bundle.site.favicon || bundle.site.logo;

  let jsonLd = '';
  if (mode === 'published' && page && options.siteUrl) {
    try {
      const entries = buildJsonLd({
        businessProfile: bundle.site.businessProfile as unknown as BusinessProfile | null,
        siteUrl: options.siteUrl,
        pageUrl: canonical,
        pageTitle: title,
        pageDescription: description,
        isHomePage: isHome,
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
    '<meta property="og:type" content="website">',
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
${footer}
${modules.join('\n')}
<script src="${assetBase}/ks/runtime.js?v=2" defer></script>
${mode === 'edit' ? `<script src="${assetBase}/ks/editor.js?v=2" defer></script>` : ''}
</body>
</html>`;

  if (options.linkBase) html = rewriteInternalLinks(html, options.linkBase);

  return {
    html,
    status: page ? 200 : 404,
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
[data-ks-hidden]{opacity:.35!important;outline:2px dashed #94a3b8!important;outline-offset:-2px}
`;

export const ALLOWED_SCRIPT_HOSTS_FOR_CSP = SCRIPT_HOST_ALLOWLIST.map((h) => `https://${h}`).join(' ');
