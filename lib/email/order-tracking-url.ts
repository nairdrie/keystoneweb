import { PUBLISHED_ROOT } from '@/lib/env/domain';

/**
 * Resolves a published site's customer-facing origin (without trailing slash) given
 * the columns we already pull from the `sites` row. Custom domains win, then the
 * subdomain on the published root, then null when neither is configured (e.g. an
 * unpublished or deleted site — in which case we just don't link).
 */
export function buildSiteOrigin(opts: {
    customDomain?: string | null;
    publishedDomain?: string | null;
}): string | null {
    const custom = opts.customDomain?.trim();
    if (custom) return `https://${stripTrailingSlash(custom)}`;
    const sub = opts.publishedDomain?.trim();
    if (sub) return `https://${sub}.${PUBLISHED_ROOT}`;
    return null;
}

export function buildOrderTrackingUrl(
    siteOrigin: string | null | undefined,
    orderId: string,
): string | null {
    if (!siteOrigin || !orderId) return null;
    return `${stripTrailingSlash(siteOrigin)}/order-confirmation?orderId=${encodeURIComponent(orderId)}`;
}

function stripTrailingSlash(s: string): string {
    return s.replace(/\/+$/, '');
}
