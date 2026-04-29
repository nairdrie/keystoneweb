/**
 * Strip HTML tags to plain text for truncated previews (grid/list cards).
 * Falls back to the input untouched in non-DOM contexts so truncation still
 * works server-side; tags will simply be visible until hydration.
 */
export function stripHtml(input: string | null | undefined): string {
    if (!input) return '';
    return input
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * True if the value already looks like HTML (contains a tag). Plain-text
 * descriptions stored before rich-text was enabled won't match.
 */
export function isHtmlDescription(input: string | null | undefined): boolean {
    if (!input) return false;
    return /<[a-z][\s\S]*>/i.test(input);
}
