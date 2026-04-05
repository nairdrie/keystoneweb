'use client';

import { usePathname } from 'next/navigation';
import { useEditorContext } from '@/lib/editor-context';

/**
 * Returns the language prefix (e.g. "/fr") for the current page,
 * or "" if the site is on the default language or translations are disabled.
 */
export function useLangPrefix(): string {
    const context = useEditorContext();
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor') || pathname?.startsWith('/design');

    const siteContent = context?.siteContent;
    const currentLanguage = siteContent?.__currentLanguage as string | undefined;
    const translationsConfig = siteContent?.__translationsConfig as
        { enabled?: boolean; defaultLanguage?: string } | undefined;
    const defaultLanguage = translationsConfig?.defaultLanguage || 'en';

    if (!isEditor && translationsConfig?.enabled && currentLanguage && currentLanguage !== defaultLanguage) {
        return `/${currentLanguage}`;
    }
    return '';
}

/**
 * Rewrites internal href paths in an HTML string to include the language prefix.
 * Only rewrites hrefs that start with "/" and are not already language-prefixed.
 * Leaves external URLs (http/https/mailto/tel/#) untouched.
 */
export function prefixInternalLinks(html: string, langPrefix: string): string {
    if (!langPrefix || !html) return html;

    // Match href="/" or href="/something" but not href="//", href="http", href="#", href="mailto:", etc.
    return html.replace(
        /href="(\/(?:[^"\/][^"]*)?)?"/g,
        (_match, path: string | undefined) => {
            const p = path ?? '/';
            // Don't double-prefix if the path already starts with the lang prefix
            if (p.startsWith(langPrefix + '/') || p === langPrefix) {
                return `href="${p}"`;
            }
            // For root path "/", just return the prefix
            if (p === '/') {
                return `href="${langPrefix}"`;
            }
            return `href="${langPrefix}${p}"`;
        },
    );
}
