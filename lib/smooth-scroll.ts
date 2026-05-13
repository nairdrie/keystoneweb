/**
 * Returns the section id to smooth-scroll to if `href` targets a section on the
 * current page; otherwise returns null. Handles both bare hash links (`#id`)
 * and path-prefixed links matching the current pathname (`/about#id`).
 */
export function getSamePageHash(href: string, currentPathname: string | null | undefined): string | null {
    if (!href || href === '#') return null;
    if (href.startsWith('#')) {
        const hash = href.slice(1);
        return hash || null;
    }
    const hashIdx = href.indexOf('#');
    if (hashIdx === -1) return null;
    const path = href.slice(0, hashIdx);
    const hash = href.slice(hashIdx + 1);
    if (!hash) return null;
    const normalize = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);
    const a = normalize(path);
    const b = normalize(currentPathname || '');
    if (a !== b) return null;
    return hash;
}

/**
 * Smooth-scrolls to the element with the given id and updates the URL hash.
 * Returns true when the element was found and scroll initiated.
 */
export function smoothScrollToId(id: string): boolean {
    if (typeof document === 'undefined') return false;
    const el = document.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState(null, '', `#${id}`);
    }
    return true;
}
