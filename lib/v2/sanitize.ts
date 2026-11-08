/**
 * Sanitizers for content-layer values. Content is owner-editable and always
 * treated as untrusted: it can carry formatting, never script.
 */
import sanitizeHtml from 'sanitize-html';

const SAFE_SCHEMES = ['http', 'https', 'mailto', 'tel'];

const INLINE_TAGS = ['em', 'strong', 'b', 'i', 'u', 's', 'br', 'span', 'mark', 'sup', 'sub', 'small', 'a'];
const BLOCK_TAGS = ['p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote'];

const ATTRS: sanitizeHtml.IOptions['allowedAttributes'] = {
  span: ['class'],
  mark: ['class'],
  a: ['href', 'target', 'rel'],
};

/** Inline formatting only — headlines, labels, button text. */
export function sanitizeInline(html: string): string {
  if (!html) return '';
  return sanitizeHtml(String(html), {
    allowedTags: INLINE_TAGS,
    allowedAttributes: ATTRS,
    allowedSchemes: SAFE_SCHEMES,
    transformTags: { a: forceSafeLink },
  }).trim();
}

/** Paragraph-level formatting — body copy. */
export function sanitizeRich(html: string): string {
  if (!html) return '';
  return sanitizeHtml(String(html), {
    allowedTags: [...INLINE_TAGS, ...BLOCK_TAGS],
    allowedAttributes: ATTRS,
    allowedSchemes: SAFE_SCHEMES,
    transformTags: { a: forceSafeLink },
  }).trim();
}

const ARTICLE_TAGS = [
  ...INLINE_TAGS, ...BLOCK_TAGS,
  'h1', 'h5', 'h6', 'pre', 'code', 'hr', 'figure', 'figcaption', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'del', 'ins', 'abbr', 'cite', 'q',
];

/**
 * Blog article bodies (written in Admin → Blog's rich-text editor, or imported
 * by an agent): headings, lists, quotes, code, images, tables, plus the colour
 * and alignment styles the editor produces. No script, no event handlers.
 */
export function sanitizeArticle(html: string): string {
  if (!html) return '';
  return sanitizeHtml(String(html), {
    allowedTags: ARTICLE_TAGS,
    allowedAttributes: {
      ...ATTRS,
      img: ['src', 'alt', 'width', 'height', 'loading'],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
      abbr: ['title'],
      '*': ['style'],
    },
    allowedStyles: {
      '*': {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i],
        'text-align': [/^(left|right|center|justify)$/],
      },
    },
    allowedSchemes: SAFE_SCHEMES,
    allowedSchemesByTag: { img: ['http', 'https'] },
    transformTags: { a: forceSafeLink },
  }).trim();
}

function forceSafeLink(tagName: string, attribs: sanitizeHtml.Attributes) {
  const next = { ...attribs };
  if (next.target === '_blank') next.rel = 'noopener noreferrer';
  else delete next.target;
  return { tagName, attribs: next };
}

/**
 * Plain text from inline html (for labels, alt text, titles). Returns real characters, not
 * entities: sanitize-html re-encodes & < > " in its output, and every caller escapes again when
 * it renders, so leaving them encoded showed "AI Trust &amp; Efficiency" on the page.
 */
export function toPlainText(html: string): string {
  return sanitizeHtml(String(html || ''), { allowedTags: [], allowedAttributes: {} })
    .replace(/&(lt|gt|quot|#39|amp);/g, (_, e: string) => ({ lt: '<', gt: '>', quot: '"', '#39': "'", amp: '&' })[e]!)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Accepts http(s), mailto, tel, relative paths and #anchors. Rejects javascript: & friends. */
export function safeHref(href: unknown): string {
  const value = String(href ?? '').trim();
  if (!value) return '#';
  if (value.startsWith('/') || value.startsWith('#') || value.startsWith('?')) return value;
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return `/${value.replace(/^\.?\/*/, '')}`;
  return '#';
}

/** Image sources must be http(s) or site-relative. */
export function safeSrc(src: unknown): string {
  const value = String(src ?? '').trim();
  if (!value) return '';
  if (value.startsWith('/')) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return '';
}

export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Values that end up inside CSS (url(), custom properties). */
export function cssString(value: string): string {
  return String(value ?? '').replace(/[\\"\n\r]/g, (c) => (c === '"' ? '\\"' : c === '\\' ? '\\\\' : ' '));
}

/** Theme token values: refuse anything that could break out of a declaration. */
export function safeTokenValue(value: unknown): string {
  return String(value ?? '')
    .replace(/[{};<>]/g, '')
    .replace(/\/\*|\*\//g, '')
    .replace(/@import|expression\(|javascript:/gi, '')
    .slice(0, 400)
    .trim();
}
