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
    const [rawPath, rawQuery = ''] = path.split('?');
    const a = normalize(rawPath || currentPathname || '/');
    const b = normalize(currentPathname || '/');
    if (a !== b) return null;
    if (typeof window !== 'undefined' && rawQuery) {
        const targetParams = new URLSearchParams(rawQuery);
        const currentParams = new URLSearchParams(window.location.search);
        const routeKeys = ['siteId', 'pageId', 'category', 'subcategory'];
        for (const key of routeKeys) {
            if (targetParams.has(key) && targetParams.get(key) !== currentParams.get(key)) {
                return null;
            }
        }
    }
    return hash;
}

const HEADER_SCROLL_GAP = 12;
type ScrollContainer = HTMLElement | Window;

function decodeHashId(id: string): string {
    try {
        return decodeURIComponent(id);
    } catch {
        return id;
    }
}

function escapeAttributeValue(value: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(value);
    }
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function getScrollTargetElement(id: string): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    const decodedId = decodeHashId(id);
    const directTarget = document.getElementById(id)
        || (decodedId !== id ? document.getElementById(decodedId) : null);
    if (directTarget) return directTarget;

    try {
        return document.querySelector<HTMLElement>(`[data-block-id="${escapeAttributeValue(decodedId)}"]`);
    } catch {
        return null;
    }
}

function isWindowScrollContainer(container: ScrollContainer): container is Window {
    return 'document' in container;
}

function isScrollableElement(el: HTMLElement): boolean {
    const style = getComputedStyle(el);
    const overflowY = `${style.overflowY} ${style.overflow}`;
    return /(auto|scroll|overlay)/.test(overflowY) && el.scrollHeight > el.clientHeight + 1;
}

function getOwnerWindow(el?: Element | null): Window {
    return el?.ownerDocument?.defaultView || window;
}

function getScrollContainer(el: HTMLElement): ScrollContainer {
    const doc = el.ownerDocument;
    let parent = el.parentElement;

    while (parent && parent !== doc.body && parent !== doc.documentElement) {
        if (parent.getAttribute('data-tour') === 'builder-canvas') {
            return parent;
        }
        if (isScrollableElement(parent)) {
            return parent;
        }
        parent = parent.parentElement;
    }

    return getOwnerWindow(el);
}

function getPrimaryScrollContainer(): ScrollContainer {
    if (typeof document === 'undefined') return window;
    const canvas = document.querySelector<HTMLElement>('[data-tour="builder-canvas"]');
    if (canvas) return canvas;
    return window;
}

export function getHeaderScrollOffset(): number {
    if (typeof document === 'undefined') return 0;
    const root = document.documentElement;
    const headerHeight = Number.parseFloat(
        getComputedStyle(root).getPropertyValue('--ks-header-height')
    );
    return Number.isFinite(headerHeight) && headerHeight > 0
        ? headerHeight + HEADER_SCROLL_GAP
        : 0;
}

/**
 * Smooth-scrolls to the element with the given id and updates the URL hash.
 * Returns true when the element was found and scroll initiated.
 */
export function smoothScrollToId(id: string): boolean {
    if (typeof document === 'undefined' || typeof window === 'undefined') return false;
    const decodedId = decodeHashId(id);
    const el = getScrollTargetElement(id);
    if (!el) return false;

    const scroller = getScrollContainer(el);
    const offset = getHeaderScrollOffset();

    if (isWindowScrollContainer(scroller)) {
        const top = el.getBoundingClientRect().top + scroller.scrollY - offset;
        scroller.scrollTo({
            top: Math.max(0, top),
            behavior: 'smooth',
        });
    } else {
        const targetRect = el.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const top = scroller.scrollTop + targetRect.top - scrollerRect.top - offset;
        scroller.scrollTo({
            top: Math.max(0, top),
            behavior: 'smooth',
        });
    }

    if (window.history) {
        window.history.replaceState(null, '', `#${id}`);
    }
    window.dispatchEvent(new CustomEvent('ks:same-page-hashchange', { detail: { id: decodedId } }));
    return true;
}

export function smoothScrollToTop(options: { behavior?: ScrollBehavior; updateHash?: boolean } = {}): boolean {
    if (typeof window === 'undefined') return false;
    const scroller = getPrimaryScrollContainer();
    const { behavior = 'smooth', updateHash = true } = options;

    scroller.scrollTo({
        top: 0,
        behavior,
    });

    if (updateHash && window.history) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    window.dispatchEvent(new CustomEvent('ks:same-page-hashchange', { detail: { id: '' } }));
    return true;
}
