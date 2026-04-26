'use client';

import { useMemo } from 'react';
import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'a', 'abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'blockquote',
    'br', 'caption', 'cite', 'code', 'col', 'colgroup', 'dd', 'del', 'details',
    'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'footer',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'i', 'img',
    'ins', 'kbd', 'li', 'main', 'mark', 'nav', 'ol', 'p', 'pre', 'q', 'rb',
    'rp', 'rt', 'rtc', 'ruby', 's', 'samp', 'section', 'small', 'span',
    'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th',
    'thead', 'time', 'tr', 'u', 'ul', 'var', 'wbr',
  ],
  // Drop these entirely (including their text content)
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'head', 'meta', 'link', 'title'],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['style', 'class', 'colspan', 'rowspan', 'align', 'valign'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel', 'cid'],
  allowedSchemesByTag: { img: ['http', 'https', 'data', 'cid'] },
  allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
  allowProtocolRelative: true,
  // Force links to open in a new tab and not leak referrer
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
      },
    }),
  },
};

/** Heuristic: does this string look like it contains HTML? */
function looksLikeHtml(text: string): boolean {
  return /<\/?[a-zA-Z][^>]*>/.test(text);
}

type Props = {
  /** Pre-formatted HTML (preferred). */
  html?: string | null;
  /** Plain-text fallback. May still contain stray HTML tags — we detect + render as HTML. */
  text?: string | null;
  /** Tailwind classes for the wrapper. */
  className?: string;
  /** Shown when both html and text are empty. */
  emptyLabel?: string;
};

/**
 * Renders an email body. Prefers sanitized HTML, falls back to plain text.
 * If the plain-text fallback contains HTML tags, those are sanitized + rendered too,
 * since email clients sometimes drop the text/plain part or stuff HTML into it.
 */
export default function EmailBody({ html, text, className, emptyLabel = 'No message body.' }: Props) {
  const rendered = useMemo(() => {
    const trimmedHtml = html?.trim();
    if (trimmedHtml) {
      return { kind: 'html' as const, value: sanitizeHtml(trimmedHtml, SANITIZE_OPTIONS) };
    }
    const trimmedText = text?.trim();
    if (trimmedText) {
      if (looksLikeHtml(trimmedText)) {
        return { kind: 'html' as const, value: sanitizeHtml(trimmedText, SANITIZE_OPTIONS) };
      }
      return { kind: 'text' as const, value: trimmedText };
    }
    return null;
  }, [html, text]);

  if (!rendered) {
    return <p className="text-gray-500 text-sm italic">{emptyLabel}</p>;
  }

  if (rendered.kind === 'html') {
    return (
      <div
        className={`email-body max-w-none ${className ?? ''}`}
        dangerouslySetInnerHTML={{ __html: rendered.value }}
      />
    );
  }

  return (
    <pre className={`whitespace-pre-wrap font-sans leading-relaxed ${className ?? ''}`}>
      {rendered.value}
    </pre>
  );
}
