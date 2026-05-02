/**
 * RFC 5322 message-ID + threading helpers.
 *
 * Outbound messages we send via Resend get a deterministic Message-ID we
 * generate ourselves so we can match a customer's reply back to the same
 * thread via the In-Reply-To / References headers.
 */

const DOMAIN = 'mail.keystoneweb.ca';

/** Generate a stable Message-ID for a row in contact_submissions. */
export function buildMessageId(messageRowId: string): string {
  return `<${messageRowId}@${DOMAIN}>`;
}

/** Strip surrounding angle brackets and whitespace from a Message-ID header. */
export function normalizeMessageId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/<([^>]+)>/);
  if (m) return `<${m[1].trim()}>`;
  const t = raw.trim();
  return t ? (t.startsWith('<') ? t : `<${t}>`) : null;
}

/** Extract all <…> Message-IDs from a References header string. */
export function parseReferencesHeader(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return Array.from(raw.matchAll(/<[^>]+>/g)).map(m => m[0]);
}

/**
 * Build a References header that includes all prior IDs plus the parent's ID.
 * Truncates to a reasonable length (10 most recent) per RFC recommendations.
 */
export function buildReferencesHeader(
  parentReferences: string | null | undefined,
  parentMessageId: string | null | undefined,
): string | null {
  const refs = parseReferencesHeader(parentReferences);
  const parentId = normalizeMessageId(parentMessageId);
  if (parentId && !refs.includes(parentId)) refs.push(parentId);
  if (refs.length === 0) return null;
  const trimmed = refs.length > 10 ? [refs[0], ...refs.slice(-9)] : refs;
  return trimmed.join(' ');
}

/** Extract the row ID embedded in our deterministic Message-IDs. */
export function extractRowIdFromMessageId(messageId: string | null | undefined): string | null {
  const norm = normalizeMessageId(messageId);
  if (!norm) return null;
  const m = norm.match(/^<([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i);
  return m ? m[1] : null;
}

/**
 * Subject normalisation for fallback thread detection.
 * Strips leading Re:/Fwd: prefixes and collapses whitespace.
 */
export function normalizeSubject(subject: string | null | undefined): string {
  if (!subject) return '';
  return subject
    .replace(/^(\s*(re|fwd|fw)[\s\[\(].*?:|\s*(re|fwd|fw):)+/i, '')
    .trim()
    .toLowerCase();
}

// ─── Owner reply-by-email addresses ──────────────────────────────────────────
// The notification email we send to the site owner sets Reply-To to a special
// address `reply+<threadId>@kswd.ca`. When the owner hits Reply in their
// regular email client, the inbound webhook decodes the threadId and
// forwards their response as an outbound reply to the customer in the
// matching Keystone thread.

const REPLY_DOMAIN = 'kswd.ca';
const REPLY_PREFIX = 'reply+';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildOwnerReplyAddress(threadId: string): string {
  return `${REPLY_PREFIX}${threadId.toLowerCase()}@${REPLY_DOMAIN}`;
}

/** Returns the threadId if the address is an owner-reply address, else null. */
export function parseOwnerReplyAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const lower = address.toLowerCase().trim();
  if (!lower.endsWith(`@${REPLY_DOMAIN}`)) return null;
  const local = lower.slice(0, -1 - REPLY_DOMAIN.length);
  if (!local.startsWith(REPLY_PREFIX)) return null;
  const candidate = local.slice(REPLY_PREFIX.length);
  return UUID_RE.test(candidate) ? candidate : null;
}
