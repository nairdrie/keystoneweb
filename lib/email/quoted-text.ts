/**
 * Strip quoted/forwarded content from an inbound email body so the reply
 * sent to the customer doesn't echo their own original message back.
 *
 * Heuristics — applied in order, the earliest match wins:
 *   1. "On <date>, <name> wrote:" attribution line (Apple Mail, Gmail, Outlook)
 *   2. "-----Original Message-----" (Outlook desktop)
 *   3. Lines beginning with ">" (RFC quoting)
 *   4. <blockquote> in HTML
 *
 * These are conservative — we'd rather leave a small amount of quote in
 * place than accidentally truncate a legitimate reply.
 */

const ATTRIBUTION_RE = /^(?:>?\s*)?on\s.{1,200}?\swrote:\s*$/im;
const ORIGINAL_MSG_RE = /^[-]{2,}\s*original message\s*[-]{2,}\s*$/im;
const FORWARDED_RE = /^[-]{2,}\s*forwarded message\s*[-]{2,}\s*$/im;

export function stripQuotedText(text: string | null | undefined): string {
  if (!text) return '';
  let body = text.replace(/\r\n/g, '\n');

  for (const re of [ATTRIBUTION_RE, ORIGINAL_MSG_RE, FORWARDED_RE]) {
    const m = body.match(re);
    if (m && m.index != null) {
      body = body.slice(0, m.index);
      break;
    }
  }

  // Drop any trailing block of consecutive ">"-quoted lines
  const lines = body.split('\n');
  let lastNonQuoted = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\s*>/.test(lines[i]) || lines[i].trim() === '') {
      lastNonQuoted = i;
    } else break;
  }
  body = lines.slice(0, lastNonQuoted).join('\n');

  return body.trim();
}

/**
 * HTML version: drop the first <blockquote> and everything after it.
 * Most email clients wrap the quoted thread in a <blockquote>.
 */
export function stripQuotedHtml(html: string | null | undefined): string {
  if (!html) return '';
  const blockquoteIdx = html.search(/<blockquote\b/i);
  if (blockquoteIdx > -1) return html.slice(0, blockquoteIdx).trim();

  // Gmail wraps quoted text in <div class="gmail_quote">
  const gmailIdx = html.search(/<div[^>]*class=["'][^"']*gmail_quote[^"']*["']/i);
  if (gmailIdx > -1) return html.slice(0, gmailIdx).trim();

  // Outlook web puts a divider <div id="appendonsend"> before the quoted thread
  const outlookIdx = html.search(/<div[^>]*id=["']appendonsend["']/i);
  if (outlookIdx > -1) return html.slice(0, outlookIdx).trim();

  return html.trim();
}
