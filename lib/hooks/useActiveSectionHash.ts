'use client';

import { useEffect, useRef, useState } from 'react';
import { type NavItem } from '@/lib/editor-context';
import { getHeaderScrollOffset, getSamePageHash, getScrollTargetElement, smoothScrollToId } from '@/lib/smooth-scroll';

const EXPLICIT_ACTIVE_MS = 900;

function decodeHash(hash: string): string {
    try {
        return decodeURIComponent(hash);
    } catch {
        return hash;
    }
}

function readLocationHash(): string {
    if (typeof window === 'undefined') return '';
    return decodeHash(window.location.hash.replace(/^#/, ''));
}

export function getSectionIdsForNavItems(
    items: NavItem[],
    resolveHref: (item: NavItem) => string,
    currentPathname: string | null | undefined,
): string[] {
    const ids: string[] = [];
    const visit = (navItems: NavItem[]) => {
        for (const item of navItems) {
            const hash = getSamePageHash(resolveHref(item), currentPathname);
            if (hash) ids.push(decodeHash(hash));
            if (item.children?.length) visit(item.children);
        }
    };

    visit(items);
    return Array.from(new Set(ids));
}

export function navItemMatchesActiveSection(
    item: NavItem,
    activeSectionHash: string,
    resolveHref: (item: NavItem) => string,
    currentPathname: string | null | undefined,
): boolean {
    if (!activeSectionHash) return false;
    const hash = getSamePageHash(resolveHref(item), currentPathname);
    if (hash && decodeHash(hash) === activeSectionHash) return true;
    return item.children?.some(child => navItemMatchesActiveSection(child, activeSectionHash, resolveHref, currentPathname)) || false;
}

export function useActiveSectionHash(sectionIds: string[], routeKey = ''): string {
    const idsKey = Array.from(new Set(sectionIds.filter(Boolean))).join('\0');
    const [activeHash, setActiveHash] = useState('');
    const explicitHashRef = useRef<{ id: string; expiresAt: number } | null>(null);

    useEffect(() => {
        const ids = idsKey ? idsKey.split('\0') : [];
        explicitHashRef.current = null;

        if (!ids.length || typeof window === 'undefined' || typeof document === 'undefined') {
            const timeout = setTimeout(() => {
                setActiveHash(current => current ? '' : current);
            }, 0);
            return () => clearTimeout(timeout);
        }

        const updateActiveHash = () => {
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
            const headerOffset = getHeaderScrollOffset();
            const activationLine = Math.min(
                Math.max(headerOffset + 24, viewportHeight * 0.22),
                Math.max(headerOffset + 24, viewportHeight - 1)
            );
            const exitLine = headerOffset + 8;
            let nextHash = '';
            let nextTop = Number.NEGATIVE_INFINITY;

            for (const id of ids) {
                const el = getScrollTargetElement(id);
                if (!el) continue;
                const rect = el.getBoundingClientRect();
                if (rect.top <= activationLine && rect.bottom > exitLine && rect.top > nextTop) {
                    nextHash = id;
                    nextTop = rect.top;
                }
            }

            const explicitHash = explicitHashRef.current;
            if (!nextHash && explicitHash && explicitHash.expiresAt > Date.now() && ids.includes(explicitHash.id)) {
                nextHash = explicitHash.id;
            } else if (explicitHash && (nextHash === explicitHash.id || explicitHash.expiresAt <= Date.now())) {
                explicitHashRef.current = null;
            }

            setActiveHash(current => current === nextHash ? current : nextHash);
        };

        let frame = 0;
        let initialHashRetryTimeout: number | null = null;
        const scheduleUpdate = () => {
            if (frame) return;
            frame = window.requestAnimationFrame(() => {
                frame = 0;
                updateActiveHash();
            });
        };

        const handleExplicitHash = (event: Event) => {
            const id = (event as CustomEvent<{ id?: string }>).detail?.id;
            if (id === '') {
                explicitHashRef.current = null;
                setActiveHash(current => current ? '' : current);
                return;
            }
            if (!id || !ids.includes(id)) {
                explicitHashRef.current = null;
                setActiveHash(current => current ? '' : current);
                scheduleUpdate();
                return;
            }
            explicitHashRef.current = { id, expiresAt: Date.now() + EXPLICIT_ACTIVE_MS };
            setActiveHash(current => current === id ? current : id);
            scheduleUpdate();
        };

        window.addEventListener('scroll', scheduleUpdate, { passive: true });
        window.addEventListener('resize', scheduleUpdate);
        window.addEventListener('hashchange', scheduleUpdate);
        window.addEventListener('ks:same-page-hashchange', handleExplicitHash);

        const initialHash = readLocationHash();
        if (initialHash && ids.includes(initialHash)) {
            const retryUntil = Date.now() + 2000;
            const activateInitialHash = () => {
                if (!getScrollTargetElement(initialHash)) {
                    if (Date.now() < retryUntil) {
                        initialHashRetryTimeout = window.setTimeout(activateInitialHash, 80);
                    } else {
                        scheduleUpdate();
                    }
                    return;
                }

                frame = window.requestAnimationFrame(() => {
                    frame = 0;
                    explicitHashRef.current = { id: initialHash, expiresAt: Date.now() + EXPLICIT_ACTIVE_MS };
                    setActiveHash(current => current === initialHash ? current : initialHash);
                    smoothScrollToId(initialHash);
                    scheduleUpdate();
                });
            };
            activateInitialHash();
        } else {
            scheduleUpdate();
        }

        return () => {
            if (frame) window.cancelAnimationFrame(frame);
            if (initialHashRetryTimeout !== null) window.clearTimeout(initialHashRetryTimeout);
            window.removeEventListener('scroll', scheduleUpdate);
            window.removeEventListener('resize', scheduleUpdate);
            window.removeEventListener('hashchange', scheduleUpdate);
            window.removeEventListener('ks:same-page-hashchange', handleExplicitHash);
        };
    }, [idsKey, routeKey]);

    return activeHash;
}
