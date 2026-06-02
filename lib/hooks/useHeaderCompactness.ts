'use client';

import { RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Run the layout sync effect on the client and fall back to useEffect on the
// server so React doesn't warn about useLayoutEffect during SSR. The hook
// itself is 'use client', but the file may still be evaluated on the server
// during streaming.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type CompactTier = 0 | 1 | 2 | 3;

interface UseHeaderCompactnessResult {
    containerRef: RefObject<HTMLDivElement | null>;
    leftRef: RefObject<HTMLDivElement | null>;
    centerRef: RefObject<HTMLDivElement | null>;
    rightRef: RefObject<HTMLDivElement | null>;
    tier: CompactTier;
}

// Minimum visual breathing room (px) between the centered nav and each
// neighbouring zone (or container edge). Tightening kicks in as soon as the
// rendered gap drops below this.
const MIN_GAP_PX = 32;

// Hysteresis: relax tier only when we have meaningfully more room than the
// minimum, so tightening doesn't oscillate at the boundary.
const STEP_UP_HEADROOM_PX = 32;

// When we've forced the desktop hamburger (tier 3), the nav is hidden so we
// can't measure its gap to the utils directly. We project using the largest
// nav width we observed before falling back, plus a small buffer.
const HAMBURGER_RECOVERY_BUFFER_PX = 48;

// Below this the existing Tailwind `md:` breakpoint already swaps the
// desktop nav out for the mobile hamburger, so there's nothing for us to
// tighten and we don't want to second-guess the static breakpoint.
const MOBILE_VIEWPORT_PX = 768;

/**
 * Observes the header zones and reports a "compactness tier" describing how
 * tightly the layout needs to pack:
 *
 *   0 — comfortable (default gaps)
 *   1 — tightened nav + utils gaps
 *   2 — tighter still
 *   3 — fall back to hamburger (nav doesn't fit even at minimum gap)
 *
 * The caller attaches refs to the actual content elements (the nav itself,
 * the utils cluster itself — not their flex wrappers) so we can measure
 * their rendered bounding rects directly. That makes the measurement work
 * for both standard 3-zone flex layouts and centered-with-absolute-utils
 * layouts: in both cases we just look at how much horizontal space sits
 * between the rendered elements.
 */
export function useHeaderCompactness(enabled: boolean): UseHeaderCompactnessResult {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const leftRef = useRef<HTMLDivElement | null>(null);
    const centerRef = useRef<HTMLDivElement | null>(null);
    const rightRef = useRef<HTMLDivElement | null>(null);

    const [measuredTier, setMeasuredTier] = useState<CompactTier>(0);
    const tierRef = useRef<CompactTier>(0);
    // Largest center-zone (nav) width we've observed while it was still in
    // flow. Used to project whether we have room to drop back from hamburger.
    const navMaxWidthRef = useRef(0);

    const setTierSafe = useCallback((next: CompactTier) => {
        if (next === tierRef.current) return;
        tierRef.current = next;
        setMeasuredTier(next);
    }, []);

    useIsoLayoutEffect(() => {
        if (!enabled) {
            tierRef.current = 0;
            navMaxWidthRef.current = 0;
            return;
        }

        const container = containerRef.current;
        if (!container) return;

        let raf = 0;

        const measure = () => {
            raf = 0;

            const containerRect = container.getBoundingClientRect();
            const available = containerRect.width;
            if (available <= 0) return;

            // Mobile: existing `md:` Tailwind breakpoint takes over. Don't
            // second-guess it — reset to a known baseline on the way down.
            const win = container.ownerDocument?.defaultView;
            const viewport = win?.innerWidth ?? available;
            if (viewport < MOBILE_VIEWPORT_PX) {
                setTierSafe(0);
                return;
            }

            const centerRect = centerRef.current?.getBoundingClientRect();
            const leftRect = leftRef.current?.getBoundingClientRect();
            const rightRect = rightRef.current?.getBoundingClientRect();

            const current = tierRef.current;

            // Track widest nav we've seen so we can project recovery from
            // hamburger fallback.
            if (current < 3 && centerRect && centerRect.width > navMaxWidthRef.current) {
                navMaxWidthRef.current = centerRect.width;
            }

            // Compute the worst-case gap between rendered zones. Anything
            // smaller than MIN_GAP_PX visibly crowds the header — including
            // the absolute-positioned utils case, where bounding rects still
            // reflect the actual rendered x positions.
            let worstGap = Infinity;
            const pair = (a?: DOMRect, b?: DOMRect) => {
                if (!a || !b || a.width === 0 || b.width === 0) return;
                // a is whichever sits to the left; the gap is b.left - a.right.
                const [first, second] = a.left <= b.left ? [a, b] : [b, a];
                worstGap = Math.min(worstGap, second.left - first.right);
            };
            pair(leftRect, centerRect);
            pair(centerRect, rightRect);
            // Some layouts (logo-above-right, logo-above-left) have only
            // two zones — measure those directly too.
            if (!centerRect || centerRect.width === 0) pair(leftRect, rightRect);

            // Container-level overflow check: when content can't fit, the
            // flex container's scrollWidth exceeds its clientWidth. Catches
            // layouts where no single ref's rect crosses an edge but the
            // collective content (e.g. nav + utils as siblings) overflows.
            if (container.scrollWidth > containerRect.width + 1) {
                worstGap = Math.min(worstGap, -1);
            }

            if (typeof window !== 'undefined' && window.location?.search?.includes('debugHeader')) {
                console.log('[useHeaderCompactness]', {
                    tier: current,
                    available,
                    worstGap,
                    left: leftRect?.width,
                    center: centerRect?.width,
                    right: rightRect?.width,
                });
            }

            if (current < 3) {
                if (!Number.isFinite(worstGap)) return;

                if (worstGap < MIN_GAP_PX) {
                    setTierSafe((current + 1) as CompactTier);
                } else if (worstGap > MIN_GAP_PX + STEP_UP_HEADROOM_PX && current > 0) {
                    setTierSafe((current - 1) as CompactTier);
                }
                return;
            }

            // Tier 3: nav is hidden behind the hamburger button. Project
            // whether bringing it back at its widest observed size would
            // still leave a comfortable gap. Use 2 * max(left, right) so
            // the projection works for a centered nav (which needs the same
            // breathing on both sides) without knowing the layout details.
            if (navMaxWidthRef.current === 0) return;
            const leftWidth = leftRect?.width ?? 0;
            const rightWidth = rightRect?.width ?? 0;
            const symmetricSide = Math.max(leftWidth, rightWidth) * 2;
            const projectedNeeded = navMaxWidthRef.current + symmetricSide + MIN_GAP_PX * 2;
            if (projectedNeeded + HAMBURGER_RECOVERY_BUFFER_PX < available) {
                setTierSafe(2);
            }
        };

        const schedule = () => {
            if (raf) return;
            raf = requestAnimationFrame(measure);
        };

        const ro = new ResizeObserver(schedule);
        ro.observe(container);
        if (leftRef.current) ro.observe(leftRef.current);
        if (centerRef.current) ro.observe(centerRef.current);
        if (rightRef.current) ro.observe(rightRef.current);

        // Also re-measure on window resize — ResizeObserver fires on the
        // container, but in some layouts (overlay headers in iframes) the
        // container size lags the viewport by a frame.
        const win = container.ownerDocument?.defaultView;
        win?.addEventListener('resize', schedule);

        // Synchronous initial measure (inside useLayoutEffect) so the tier
        // is settled before the browser paints. Without this the user would
        // see one frame of tier 0 before the hook tightens.
        measure();

        return () => {
            ro.disconnect();
            win?.removeEventListener('resize', schedule);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [enabled, setTierSafe]);

    const tier: CompactTier = enabled ? measuredTier : 0;
    return { containerRef, leftRef, centerRef, rightRef, tier };
}
