import sanitizeHtml from 'sanitize-html';

/**
 * Sanitiser for outbound email HTML composed in TipTap. Allows the rich-text
 * tag set we expose in the toolbar plus inline images and links. Blocks
 * scripts, iframes, forms, event handlers, and dangerous URL schemes.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'span', 'div',
    'h1', 'h2', 'h3', 'h4',
    'strong', 'em', 'u', 's', 'b', 'i',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img',
    'hr',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'style'],
    span: ['style'],
    div: ['style'],
    p: ['style'],
    h1: ['style'], h2: ['style'], h3: ['style'], h4: ['style'],
    li: ['style'],
    blockquote: ['style'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
  },
  // Drop styles that can leak the user's own viewport-relative units, etc.
  allowedStyles: {
    '*': {
      color: [/^.*$/],
      'background-color': [/^.*$/],
      'text-align': [/^left$|^right$|^center$|^justify$/],
      'font-weight': [/^bold$|^[1-9]00$/],
      'font-style': [/^italic$|^normal$/],
      'text-decoration': [/^.*$/],
      width: [/^\d+(?:px|%)$/],
      height: [/^\d+(?:px|%)$/],
    },
  },
};

export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html ?? '', OPTIONS);
}

/** Strip HTML for a plain-text fallback / search snippet. */
export function htmlToPlainText(html: string): string {
  return sanitizeHtml(html ?? '', { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
