/**
 * Section compiler: reads an agent-written section (annotated HTML) and
 * returns the editable field schema, the default content (the text the agent
 * wrote) and a list of issues.
 *
 * The rule that makes "everything is editable" a guarantee: every visible text
 * node and every image must sit inside a bound element (data-ks), a list item,
 * navigation, or an explicitly decorative subtree (data-ks-static).
 */
import { load, type CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { CompileIssue, CompiledSection, FieldSchema, FieldType } from './types';
import { sanitizeInline, sanitizeRich } from './sanitize';
import { BUDGETS, FIELD_ID_RE, GLOBAL_BINDINGS, isAllowedScriptUrl } from './policy';
import { COLLECTION_FIELDS, COLLECTION_KINDS, type CollectionKind } from './collections';

const EXPLICIT_TYPES = new Set<FieldType>(['text', 'richtext', 'image', 'link', 'bg']);
/** Elements whose text is form/UI furniture rather than page copy. */
const STATIC_TAGS = new Set(['svg', 'select', 'option', 'textarea', 'noscript', 'template', 'canvas', 'video', 'audio', 'iframe', 'math']);
const INLINE_TAGS = new Set(['em', 'strong', 'b', 'i', 'u', 's', 'br', 'span', 'mark', 'sup', 'sub', 'small']);

interface Scope {
  fields: FieldSchema[];
  defaults: Record<string, unknown>;
  ids: Set<string>;
}

interface Ctx {
  $: CheerioAPI;
  issues: CompileIssue[];
  stats: CompiledSection['stats'];
  unboundReported: number;
}

export function compileSection(html: string): CompiledSection {
  const issues: CompileIssue[] = [];
  const stats = { boundFields: 0, textNodes: 0, unboundTextNodes: 0 };

  if (Buffer.byteLength(html || '', 'utf8') > BUDGETS.sectionHtmlBytes) {
    issues.push({
      level: 'error',
      rule: 'budget',
      message: `Section HTML is over ${BUDGETS.sectionHtmlBytes / 1000}KB. Split it into smaller sections.`,
    });
  }

  const $ = load(html || '', null, false);
  const ctx: Ctx = { $, issues, stats, unboundReported: 0 };
  const scope = newScope();
  const roots = $.root().contents().toArray();

  if (!roots.some((n) => n.type === 'tag')) {
    issues.push({ level: 'error', rule: 'empty', message: 'Section has no HTML elements.' });
  }

  for (const node of roots) walk(node, scope, ctx, false);

  if (stats.unboundTextNodes > ctx.unboundReported) {
    issues.push({
      level: 'error',
      rule: 'unbound-text',
      message: `${stats.unboundTextNodes - ctx.unboundReported} more text node(s) are not editable.`,
    });
  }

  checkRepeatedItems($, issues);

  return { fields: scope.fields, defaults: scope.defaults, issues, stats };
}

const NOT_CHECKED_FOR_REPEATS = '[data-ks-list],[data-ks-collection],[data-ks-nav],[data-ks-static],form';
/** Form rows and groups that hold their own lists (mega menus) aren't simple repeated items. */
const NOT_A_REPEATED_ITEM = 'input,select,textarea,button,[data-ks-list],[data-ks-collection],[data-ks-nav]';

/**
 * Siblings that repeat one structure but each carry their own field ids
 * (stat1Value, stat2Value, …) are usually something the owner will want to add
 * to or trim, which only a data-ks-list allows. This is a hint, never an
 * error: the agent leaves it when the count is part of the design.
 */
function checkRepeatedItems($: CheerioAPI, issues: CompileIssue[]): void {
  let reported = 0;
  $('*').each((_, node) => {
    if (reported >= 3) return false;
    const parent = node as Element;
    if ($(parent).closest(NOT_CHECKED_FOR_REPEATS).length) return;

    const groups = new Map<string, Element[]>();
    for (const child of parent.children) {
      if (child.type !== 'tag') continue;
      const el = child as Element;
      if ('data-ks-item' in el.attribs) continue;
      const classes = (el.attribs.class || '').split(/\s+/).filter(Boolean).sort().join('.');
      const sig = `${el.tagName}.${classes}`;
      groups.set(sig, [...(groups.get(sig) || []), el]);
    }

    for (const els of groups.values()) {
      if (els.length < 3) continue;
      // Each one holds its own fields inside it (a run of bound paragraphs is just copy).
      const shapes = els.map((el) => {
        if ($(el).find(NOT_A_REPEATED_ITEM).length) return null;
        const inner = $(el).find('[data-ks]').toArray().filter((f) => !String((f as Element).attribs['data-ks']).trim().startsWith('@')) as Element[];
        return inner.length ? inner.map((f) => f.tagName).join(',') : null;
      });
      if (shapes.some((s) => s === null) || new Set(shapes).size !== 1) continue;
      const ids = els.slice(0, 3).map((el) => $(el).find('[data-ks]').first().attr('data-ks')).join(', ');
      issues.push({
        level: 'warning',
        rule: 'repeated-items',
        message: `${els.length} <${els[0].tagName}> elements here repeat the same structure with separate fields (${ids}, …). The owner can edit them but can't add or remove one.`,
        snippet: snippetOf($, parent),
        fix: 'If the owner might want more or fewer of these, put data-ks-list="<id>" on the container and data-ks-item on each one, with the same field ids inside every item (e.g. value, label). The design stays the same. If the count is part of the design, leave it.',
      });
      reported++;
    }
  });
}

function newScope(): Scope {
  return { fields: [], defaults: {}, ids: new Set() };
}

function walk(node: AnyNode, scope: Scope, ctx: Ctx, covered: boolean): void {
  if (node.type === 'text') {
    const text = (node as unknown as { data: string }).data || '';
    if (!text.trim()) return;
    ctx.stats.textNodes++;
    if (!covered) {
      ctx.stats.unboundTextNodes++;
      if (ctx.unboundReported < 5) {
        ctx.unboundReported++;
        ctx.issues.push({
          level: 'error',
          rule: 'unbound-text',
          message: `Text "${truncate(text.trim(), 60)}" is not editable by the owner.`,
          snippet: snippetOf(ctx.$, node.parent as Element | null),
          fix: 'Add data-ks="<fieldId>" to the element that holds this text, or data-ks-static to a purely decorative wrapper.',
        });
      }
    }
    return;
  }
  if (node.type !== 'tag' && node.type !== 'script' && node.type !== 'style') return;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const attrs = el.attribs || {};

  checkSecurity(el, tag, attrs, ctx);
  if (tag === 'script' || tag === 'style') return;

  if ('data-ks-attribution' in attrs) {
    // "Powered by Keystone" slot: the renderer writes its text and link.
    if (ctx.$(el).find('[data-ks],[data-ks-list],[data-ks-nav],[data-ks-collection]').length) {
      ctx.issues.push({
        level: 'error',
        rule: 'attribution',
        message: 'data-ks-attribution is filled by Keystone ("Powered by Keystone"); don\'t put fields inside it.',
        snippet: snippetOf(ctx.$, el),
      });
    }
    return;
  }

  if ('data-ks-static' in attrs || 'data-ks-cart-count' in attrs || STATIC_TAGS.has(tag)) {
    // Decorative or form furniture: allowed to have unbound text.
    for (const child of el.children) walk(child, scope, ctx, true);
    return;
  }

  if ('data-ks-nav' in attrs) {
    if (!ctx.$(el).find('a').length && tag !== 'a') {
      ctx.issues.push({
        level: 'error',
        rule: 'nav-template',
        message: 'data-ks-nav needs one <a> inside it to use as the link template.',
        snippet: snippetOf(ctx.$, el),
      });
    }
    return; // rendered from the page list
  }

  if ('data-ks-collection' in attrs) {
    compileCollection(el, attrs, scope, ctx);
    return;
  }

  if ('data-ks-list' in attrs) {
    compileList(el, attrs, scope, ctx);
    return;
  }

  // Standalone show/hide switch on a non-field element.
  if ('data-ks-optional' in attrs && !('data-ks' in attrs) && attrs['data-ks-optional']) {
    const id = attrs['data-ks-optional'];
    if (registerId(id, scope, ctx, el)) {
      scope.fields.push({ id, type: 'toggle', label: attrs['data-ks-label'] || humanize(id), optional: true });
      scope.defaults[id] = { hidden: false };
      ctx.stats.boundFields++;
    }
  }

  if ('data-ks' in attrs) {
    const binding = attrs['data-ks'].trim();
    if (binding.startsWith('@')) {
      if (!(GLOBAL_BINDINGS as readonly string[]).includes(binding)) {
        ctx.issues.push({
          level: 'error',
          rule: 'unknown-binding',
          message: `Unknown global binding "${binding}". Use one of: ${GLOBAL_BINDINGS.join(', ')}.`,
          snippet: snippetOf(ctx.$, el),
        });
      }
      return; // content comes from the business profile / site settings
    }
    const descend = compileField(el, tag, attrs, binding, scope, ctx);
    if (!descend) return;
    for (const child of el.children) walk(child, scope, ctx, covered);
    return;
  }

  if (tag === 'img' && !covered) {
    ctx.issues.push({
      level: 'error',
      rule: 'unbound-image',
      message: 'Image is not replaceable by the owner.',
      snippet: snippetOf(ctx.$, el),
      fix: 'Add data-ks="<fieldId>" to the <img>, or data-ks-static if it is purely decorative.',
    });
  }

  for (const child of el.children) walk(child, scope, ctx, covered);
}

/** Returns true if the walker should descend into the element's children. */
function compileField(el: Element, tag: string, attrs: Record<string, string>, id: string, scope: Scope, ctx: Ctx): boolean {
  if (!registerId(id, scope, ctx, el)) return false;

  const explicit = attrs['data-ks-type'] as FieldType | undefined;
  if (explicit && !EXPLICIT_TYPES.has(explicit)) {
    ctx.issues.push({
      level: 'error',
      rule: 'field-type',
      message: `Unknown data-ks-type "${explicit}" on "${id}". Use text, richtext, image, link or bg.`,
      snippet: snippetOf(ctx.$, el),
    });
    return false;
  }
  const type: FieldType = explicit || (tag === 'img' ? 'image' : tag === 'a' ? 'link' : 'text');

  const field: FieldSchema = { id, type, ...readHints(attrs, id) };
  ctx.stats.boundFields++;
  const $el = ctx.$(el);

  switch (type) {
    case 'image': {
      if (tag !== 'img') {
        ctx.issues.push({
          level: 'error',
          rule: 'field-type',
          message: `"${id}" is an image field but is on a <${tag}>. Use an <img>, or data-ks-type="bg" for a background image.`,
          snippet: snippetOf(ctx.$, el),
        });
        return false;
      }
      if (!attrs.alt && attrs.alt !== '') {
        ctx.issues.push({ level: 'warning', rule: 'missing-alt', message: `Image "${id}" has no alt text.`, snippet: snippetOf(ctx.$, el) });
      }
      scope.defaults[id] = { src: attrs.src || '', alt: attrs.alt || '' };
      scope.fields.push(field);
      return false;
    }
    case 'bg': {
      const fromStyle = /background(?:-image)?\s*:[^;]*url\(\s*['"]?([^'")]+)['"]?\s*\)/i.exec(attrs.style || '');
      scope.defaults[id] = { src: attrs['data-ks-src'] || fromStyle?.[1] || '' };
      scope.fields.push(field);
      return true; // a background holds other content
    }
    case 'link': {
      const hasComplexChildren = $el.children().toArray().some((child) => {
        const childTag = (child as Element).tagName?.toLowerCase();
        return !INLINE_TAGS.has(childTag) || 'data-ks' in ((child as Element).attribs || {});
      }) || $el.find('[data-ks]').length > 0;
      if (hasComplexChildren) {
        field.hrefOnly = true;
        scope.defaults[id] = { href: attrs.href || '#', newTab: attrs.target === '_blank' };
        scope.fields.push(field);
        return true; // children may hold their own fields
      }
      scope.defaults[id] = {
        href: attrs.href || '#',
        label: sanitizeInline($el.html() || ''),
        newTab: attrs.target === '_blank',
      };
      scope.fields.push(field);
      return false;
    }
    case 'richtext': {
      if ($el.find('[data-ks]').length) nestedFieldError(id, el, ctx);
      scope.defaults[id] = { html: sanitizeRich($el.html() || '') };
      scope.fields.push(field);
      return false;
    }
    default: {
      if ($el.find('[data-ks]').length) nestedFieldError(id, el, ctx);
      scope.defaults[id] = { html: sanitizeInline($el.html() || '') };
      scope.fields.push(field);
      return false;
    }
  }
}

function compileList(el: Element, attrs: Record<string, string>, scope: Scope, ctx: Ctx): void {
  const id = attrs['data-ks-list'].trim();
  if (!registerId(id, scope, ctx, el)) return;

  const items = el.children.filter((c): c is Element => c.type === 'tag' && 'data-ks-item' in ((c as Element).attribs || {}));
  if (items.length === 0) {
    ctx.issues.push({
      level: 'error',
      rule: 'list-template',
      message: `List "${id}" has no direct children marked data-ks-item.`,
      snippet: snippetOf(ctx.$, el),
      fix: 'Mark each repeated child with data-ks-item. The first one is used as the template for new items.',
    });
    return;
  }

  const itemDefaults: Record<string, unknown>[] = [];
  let itemFields: FieldSchema[] = [];
  items.forEach((item, index) => {
    const itemScope = newScope();
    walk(item, itemScope, ctx, false);
    if (index === 0) itemFields = itemScope.fields;
    else if (fieldSignature(itemScope.fields) !== fieldSignature(itemFields)) {
      ctx.issues.push({
        level: 'error',
        rule: 'list-shape',
        message: `Item ${index + 1} of list "${id}" has different fields than the first item. All items must share one shape.`,
        snippet: snippetOf(ctx.$, item),
      });
    }
    itemDefaults.push(itemScope.defaults);
  });

  // Anything else inside the list container (not an item) still needs binding.
  for (const child of el.children) {
    if (items.includes(child as Element)) continue;
    walk(child, scope, ctx, false);
  }

  scope.fields.push({ id, type: 'list', item: itemFields, ...readHints(attrs, id) });
  scope.defaults[id] = { items: itemDefaults };
  ctx.stats.boundFields++;

  // Structured-data hints: data-ks-schema="reviews" | "faq" on a list.
  const schemaHint = attrs['data-ks-schema'];
  if (schemaHint) {
    const required = SCHEMA_HINTS[schemaHint];
    if (!required) {
      ctx.issues.push({ level: 'error', rule: 'schema-hint', message: `Unknown data-ks-schema "${schemaHint}". Use ${Object.keys(SCHEMA_HINTS).join(' or ')}.`, snippet: snippetOf(ctx.$, el) });
    } else {
      const ids = new Set(itemFields.map((f) => f.id));
      const missing = required.filter((f) => !ids.has(f));
      if (missing.length) {
        ctx.issues.push({ level: 'error', rule: 'schema-hint', message: `List "${id}" is marked data-ks-schema="${schemaHint}" but its items lack field(s): ${missing.join(', ')}.`, snippet: snippetOf(ctx.$, el) });
      }
    }
  }
}

/** data-ks-schema hints → item fields they need (rating is optional for reviews). */
export const SCHEMA_HINTS: Record<string, string[]> = {
  reviews: ['author', 'quote'],
  faq: ['question', 'answer'],
};

/**
 * <div data-ks-collection="products|services|posts|post" data-ks-limit data-ks-filter …>
 *   <article data-ks-item> … data-ks-bind="name" … data-ks-action="add-to-cart" … </article>
 *   <p data-ks-empty data-ks="emptyText">No products yet.</p>
 * </div>
 * Item templates are filled with live data, so their sample text needn't be bound.
 */
const ARTICLE_CONTAINERS = new Set(['div', 'article', 'section', 'main', 'aside']);
/** Sample article markup that may sit inside the element bound to "content". */
const ARTICLE_SAMPLE_TAGS = new Set(['p', 'h2', 'h3', 'h4', 'ul', 'ol', 'blockquote', 'figure', 'img', 'pre', 'hr', 'table']);

function compileCollection(el: Element, attrs: Record<string, string>, scope: Scope, ctx: Ctx) {
  const kind = attrs['data-ks-collection'].trim() as CollectionKind;
  if (!(COLLECTION_KINDS as readonly string[]).includes(kind)) {
    ctx.issues.push({
      level: 'error',
      rule: 'collection',
      message: `Unknown data-ks-collection "${kind}". Available: ${COLLECTION_KINDS.join(', ')}.`,
      snippet: snippetOf(ctx.$, el),
    });
    return;
  }
  const items = el.children.filter((c): c is Element => c.type === 'tag' && 'data-ks-item' in ((c as Element).attribs || {}));
  if (!items.length) {
    ctx.issues.push({
      level: 'error',
      rule: 'collection-template',
      message: `Collection "${kind}" needs a direct child marked data-ks-item to use as the item template.`,
      snippet: snippetOf(ctx.$, el),
    });
  }
  const known = COLLECTION_FIELDS[kind];
  for (const item of items) {
    ctx.$(item).find('[data-ks-bind],[data-ks-bind-bg],[data-ks-if]').addBack('[data-ks-bind],[data-ks-bind-bg],[data-ks-if]').each((_, node) => {
      const a = (node as Element).attribs || {};
      for (const attr of ['data-ks-bind', 'data-ks-bind-bg', 'data-ks-if']) {
        const name = a[attr]?.replace(/^!/, '');
        if (name && !(name in known)) {
          ctx.issues.push({
            level: 'error',
            rule: 'collection-field',
            message: `"${name}" is not a ${kind} field. Available: ${Object.keys(known).join(', ')}.`,
            snippet: snippetOf(ctx.$, node as Element),
          });
        }
      }
      // The article body is block-level HTML: it needs a block container.
      if (a['data-ks-bind'] === 'content') {
        const t = (node as Element).tagName.toLowerCase();
        if (!ARTICLE_CONTAINERS.has(t)) {
          ctx.issues.push({
            level: 'error',
            rule: 'collection-field',
            message: `Bind "content" on a block element (div, article, section, main), not <${t}> — the article has its own paragraphs and headings.`,
            snippet: snippetOf(ctx.$, node as Element),
          });
        } else if ((node as Element).children.some((c) => c.type === 'tag' && !ARTICLE_SAMPLE_TAGS.has((c as Element).tagName.toLowerCase()))) {
          ctx.issues.push({
            level: 'warning',
            rule: 'collection-field',
            message: 'Everything inside the element bound to "content" is replaced by the article. Put sample paragraphs there, but no other design.',
            snippet: snippetOf(ctx.$, node as Element),
          });
        }
      }
    });
    ctx.$(item).find('[data-ks]').each((_, node) => {
      ctx.issues.push({
        level: 'error',
        rule: 'collection-field',
        message: 'Inside a collection item, use data-ks-bind (live data), not data-ks (owner content).',
        snippet: snippetOf(ctx.$, node as Element),
      });
    });
    checkSecurity(item, item.tagName.toLowerCase(), item.attribs || {}, ctx);
  }
  if (attrs['data-ks-limit'] && !(Number(attrs['data-ks-limit']) > 0)) {
    ctx.issues.push({ level: 'error', rule: 'collection', message: 'data-ks-limit must be a positive number.', snippet: snippetOf(ctx.$, el) });
  }
  if (attrs['data-ks-offset'] && !(Number(attrs['data-ks-offset']) >= 0)) {
    ctx.issues.push({ level: 'error', rule: 'collection', message: 'data-ks-offset must be a number (how many items to skip).', snippet: snippetOf(ctx.$, el) });
  }
  if (kind === 'post' && attrs['data-ks-limit']) {
    ctx.issues.push({ level: 'warning', rule: 'collection', message: 'data-ks-collection="post" is always a single article; data-ks-limit has no effect.', snippet: snippetOf(ctx.$, el) });
  }
  // Everything else in the container (headings, the empty message) is owner content.
  for (const child of el.children) {
    if (items.includes(child as Element)) continue;
    walk(child, scope, ctx, false);
  }
}

function readHints(attrs: Record<string, string>, id: string): Partial<FieldSchema> {
  const hints: Partial<FieldSchema> = { label: attrs['data-ks-label'] || humanize(id) };
  const max = Number(attrs['data-ks-max']);
  if (Number.isFinite(max) && max > 0) hints.max = max;
  if (attrs['data-ks-aspect'] && /^\d+(\.\d+)?\/\d+(\.\d+)?$/.test(attrs['data-ks-aspect'])) hints.aspect = attrs['data-ks-aspect'];
  const minItems = Number(attrs['data-ks-min']);
  const maxItems = Number(attrs['data-ks-max-items']);
  if (Number.isFinite(minItems) && minItems >= 0 && attrs['data-ks-min']) hints.minItems = minItems;
  if (Number.isFinite(maxItems) && maxItems > 0) hints.maxItems = maxItems;
  if ('data-ks-optional' in attrs) hints.optional = true;
  if (attrs['data-ks-schema'] && attrs['data-ks-schema'] in SCHEMA_HINTS) hints.schema = attrs['data-ks-schema'] as FieldSchema['schema'];
  return hints;
}

function registerId(id: string, scope: Scope, ctx: Ctx, el: Element): boolean {
  if (!FIELD_ID_RE.test(id)) {
    ctx.issues.push({
      level: 'error',
      rule: 'field-id',
      message: `Field id "${id}" is invalid. Use letters, numbers, - or _, starting with a letter.`,
      snippet: snippetOf(ctx.$, el),
    });
    return false;
  }
  if (scope.ids.has(id)) {
    ctx.issues.push({
      level: 'error',
      rule: 'duplicate-field',
      message: `Field id "${id}" is used twice in the same scope. Field ids must be unique within a section (or within a list item).`,
      snippet: snippetOf(ctx.$, el),
    });
    return false;
  }
  scope.ids.add(id);
  return true;
}

function nestedFieldError(id: string, el: Element, ctx: Ctx) {
  ctx.issues.push({
    level: 'error',
    rule: 'nested-field',
    message: `Text field "${id}" contains other data-ks fields. Text fields replace their whole content; bind the children separately instead.`,
    snippet: snippetOf(ctx.$, el),
  });
}

function checkSecurity(el: Element, tag: string, attrs: Record<string, string>, ctx: Ctx) {
  for (const name of Object.keys(attrs)) {
    if (/^on/i.test(name)) {
      ctx.issues.push({
        level: 'error',
        rule: 'inline-handler',
        message: `Inline event handler "${name}" is not allowed. Use the section's JS module instead.`,
        snippet: snippetOf(ctx.$, el),
      });
    }
  }
  for (const attr of ['href', 'src', 'action', 'formaction', 'xlink:href']) {
    if (attrs[attr] && /^\s*(javascript|vbscript|data:text\/html)/i.test(attrs[attr])) {
      ctx.issues.push({ level: 'error', rule: 'unsafe-url', message: `Unsafe URL in ${attr}.`, snippet: snippetOf(ctx.$, el) });
    }
  }
  if (tag === 'script') {
    if (attrs.src && !isAllowedScriptUrl(attrs.src)) {
      ctx.issues.push({
        level: 'error',
        rule: 'script-host',
        message: `Script ${attrs.src} is not from an allowed host. Import modules inside the section JS from an allowed CDN instead.`,
      });
    } else {
      ctx.issues.push({
        level: 'error',
        rule: 'script-tag',
        message: 'Put JavaScript in the section\'s js (an ES module with a default export), not in <script> tags.',
      });
    }
  }
  if (tag === 'iframe') {
    ctx.issues.push({ level: 'warning', rule: 'iframe', message: 'Embedded iframes are not editable by the owner.', snippet: snippetOf(ctx.$, el) });
  }
}

function fieldSignature(fields: FieldSchema[]): string {
  return fields.map((f) => `${f.id}:${f.type}${f.item ? `[${fieldSignature(f.item)}]` : ''}`).sort().join(',');
}

export function humanize(id: string): string {
  const words = id.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function snippetOf($: CheerioAPI, el: Element | null): string | undefined {
  if (!el) return undefined;
  const outer = $.html(el) || '';
  return truncate(outer.replace(/\s+/g, ' '), 140);
}
