'use client';

import { RefObject, useEffect } from 'react';

/**
 * Measures the size of the site header element and publishes it as a CSS
 * custom property on `<html>`:
 *   - `--ks-header-height` — pixel height of the header (e.g. `64px`)
 *
 * Plus an HTML attribute that hero / first-block can branch on:
 *   - `data-ks-header-overlay="true|false"` — true for transparent /
 *     overlay headers that float above the content (so the first block
 *     should pad-top instead of subtract).
 *
 * Hero (and any other "fit-to-screen" first block) reads these values to
 * compute its viewport-aware height — see HeroBlock.tsx.
 */
export function useHeaderHeight(
    ref: RefObject<HTMLElement | null>,
    options: { overlay: boolean }
) {
    const { overlay } = options;

    useEffect(() => {
        // Use the ref'd element's ownerDocument — when the header is rendered
        // inside the editor's iframe-based device preview, the React tree runs
        // in the parent window but the actual DOM lives in the iframe's
        // document. Setting CSS vars on the parent's <html> wouldn't cascade
        // through the iframe boundary.
        const el = ref.current;
        const root = el?.ownerDocument?.documentElement
            ?? (typeof document !== 'undefined' ? document.documentElement : null);
        if (!root) return;
        root.dataset.ksHeaderOverlay = overlay ? 'true' : 'false';
        return () => {
            delete root.dataset.ksHeaderOverlay;
        };
    }, [overlay, ref]);

    useEffect(() => {
        const el = ref.current;
        const root = el?.ownerDocument?.documentElement ?? null;
        if (!el || !root) return;

        const apply = (height: number) => {
            root.style.setProperty('--ks-header-height', `${Math.round(height)}px`);
        };

        // Initial measure
        apply(el.getBoundingClientRect().height);

        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                apply(entry.contentRect.height);
            }
        });
        ro.observe(el);

        return () => {
            ro.disconnect();
            root.style.removeProperty('--ks-header-height');
        };
    }, [ref]);
}
