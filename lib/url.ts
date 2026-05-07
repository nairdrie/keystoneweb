const SAFE_EXPLICIT_HREF_PATTERN = /^(?:https?:|mailto:|tel:|sms:|#|\/)/i;
const HAS_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

export function normalizeExternalHref(value: string | null | undefined): string {
    const href = (value || '').trim();
    if (!href) return '';
    if (SAFE_EXPLICIT_HREF_PATTERN.test(href)) return href;
    if (HAS_SCHEME_PATTERN.test(href)) return '';
    return `https://${href}`;
}
