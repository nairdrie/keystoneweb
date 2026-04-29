/**
 * Strip HTML tags + collapse whitespace for compact list previews.
 * Server-safe (no DOM dependency).
 */
export function plainTextPreview(input: string | null | undefined, maxLen = 180): string {
  if (!input) return '';
  const stripped = input
    // Drop scripts/styles entirely (with their text content).
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // Drop all other HTML tags.
    .replace(/<[^>]+>/g, ' ')
    // Decode a handful of common entities.
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    // Collapse runs of whitespace.
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > maxLen ? `${stripped.slice(0, maxLen - 1)}…` : stripped;
}
