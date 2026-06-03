'use client';
/* eslint-disable react-hooks/refs */

import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function shouldDebug(): boolean {
    if (typeof window === 'undefined') return false;
    return window.location?.search?.includes('debugHeaderBp') ?? false;
}

function debugLog(...args: unknown[]) {
    if (!shouldDebug()) return;
    // eslint-disable-next-line no-console
    console.log('[useHeaderBreakpoints]', ...args);
}

export interface HeaderCompactBreakpoints {
    /** Max viewport (px) at which the header switches to tier 1 (tighter nav/utils gaps). */
    tier1Max: number;
    /** Max viewport (px) at which the header switches to tier 2 (tighter still). */
    tier2Max: number;
    /** Max viewport (px) at which the desktop nav collapses into the hamburger. */
    hamburgerMax: number;
}

export type HeaderLayoutKey =
    | 'logoLeft-navCenter'
    | 'logoLeft-navRight'
    | 'logoLeft-navLeft'
    | 'logoCenter-navCenter'
    | 'logoCenter-navRight'
    | 'logoCenter-navLeft'
    | 'logoAbove-navCenter'
    | 'logoAbove-navRight'
    | 'logoAbove-navLeft';

interface UseHeaderBreakpointsOpts {
    enabled: boolean;
    layout: HeaderLayoutKey;
    /** Current saved breakpoints — to avoid saving identical values. */
    current: HeaderCompactBreakpoints | undefined;
    /** Persist computed breakpoints to siteContent. */
    onCompute: (bp: HeaderCompactBreakpoints) => void;
    refs: {
        container: RefObject<HTMLElement | null>;
        logo: RefObject<HTMLElement | null>;
        nav: RefObject<HTMLElement | null>;
        utils: RefObject<HTMLElement | null>;
    };
}

// Minimum visual breathing room between separate clusters at every tier.
const MIN_GAP_PX = 32;

// Gap values (px) for nav / utils item spacing at each tier. Mirrors the
// Tailwind classes the inline <style> block will set.
const NAV_GAPS = [24, 16, 12] as const;   // tier 0 / 1 / 2
const UTILS_GAPS = [24, 16, 12] as const;
const ZONE_INNER_GAPS = [16, 12, 8] as const;
const ZONE_OUTER_GAPS = [12, 12, 8] as const;
const ROW_GAPS = [32, 24, 16] as const;   // logo-above wide-row gap

/**
 * Editor-only hook that measures the rendered widths of the header's
 * content clusters and computes the viewport-width breakpoints at which
 * the header should tighten gaps / collapse into the hamburger. Saved to
 * siteContent so published pages can ship the breakpoints as static
 * media queries — no runtime JS measurement on the published path.
 *
 * Re-runs whenever any observed cluster's size changes (nav items added,
 * search style toggled, etc.). Debounced so a stream of resize callbacks
 * results in a single save.
 */
export function useHeaderBreakpoints(opts: UseHeaderBreakpointsOpts): void {
    const optsRef = useRef(opts);
    // Sync the latest opts into the ref before any effect reads them. Using
    // useIsoLayoutEffect (rather than assigning during render) keeps React
    // 19's reactivity rules happy and still runs before any RO callback
    // schedules off the same commit.
    useIsoLayoutEffect(() => {
        optsRef.current = opts;
    });

    useEffect(() => {
        if (!opts.enabled) {
            debugLog('disabled (isEditMode=false or user picked hamburger)');
            return;
        }

        const container = opts.refs.container.current;
        if (!container) {
            debugLog('skip: container ref not attached yet');
            return;
        }
        debugLog('subscribed', { layout: opts.layout });

        let saveTimer: ReturnType<typeof setTimeout> | null = null;
        let measureFrame = 0;

        const measure = () => {
            measureFrame = 0;
            const { layout, refs, current, onCompute } = optsRef.current;
            const navEl = refs.nav.current;
            const utilsEl = refs.utils.current;
            const logoEl = refs.logo.current;

            const navItemCount = navEl ? navEl.children.length : 0;
            const utilsItemCount = utilsEl ? utilsEl.children.length : 0;

            // Read the rendered gap (in px) to back out the natural per-item
            // width sum independently of which tier is currently active.
            const readGap = (el: HTMLElement | null): number => {
                if (!el) return 0;
                const cs = el.ownerDocument?.defaultView?.getComputedStyle(el);
                if (!cs) return 0;
                return parseFloat(cs.columnGap || cs.gap || '0') || 0;
            };

            const navRenderedGap = readGap(navEl);
            const utilsRenderedGap = readGap(utilsEl);

            const navRenderedWidth = navEl?.scrollWidth ?? 0;
            const utilsRenderedWidth = utilsEl?.scrollWidth ?? 0;
            const logoWidth = logoEl?.scrollWidth ?? 0;

            // Skip if elements haven't laid out yet (zero-width). When the
            // editor preview is at a narrow viewport that already hides
            // the desktop nav/utils via the hamburger media query, those
            // elements have display:none and report 0 width — we can't
            // produce accurate breakpoints from that state.
            if (navItemCount > 0 && navRenderedWidth === 0) {
                debugLog('skip: nav not measurable (display:none?)', { navItemCount });
                return;
            }
            if (utilsItemCount > 0 && utilsRenderedWidth === 0) {
                debugLog('skip: utils not measurable (display:none?)', { utilsItemCount });
                return;
            }

            const navItemsTotal = navRenderedWidth - Math.max(0, navItemCount - 1) * navRenderedGap;
            const utilsItemsTotal = utilsRenderedWidth - Math.max(0, utilsItemCount - 1) * utilsRenderedGap;

            // Width of each cluster at each tier.
            const navWidthAt = (tier: 0 | 1 | 2) =>
                navItemsTotal + Math.max(0, navItemCount - 1) * NAV_GAPS[tier];
            const utilsWidthAt = (tier: 0 | 1 | 2) =>
                utilsItemsTotal + Math.max(0, utilsItemCount - 1) * UTILS_GAPS[tier];

            const neededAt = (tier: 0 | 1 | 2): number => {
                const n = navWidthAt(tier);
                const u = utilsWidthAt(tier);
                const innerGap = ZONE_INNER_GAPS[tier];
                const outerGap = ZONE_OUTER_GAPS[tier];
                const rowGap = ROW_GAPS[tier];

                switch (layout) {
                    case 'logoLeft-navCenter':
                    case 'logoCenter-navCenter':
                        // 3 zones, nav centered. Need symmetric breathing.
                        return Math.max(logoWidth, u) * 2 + n + 2 * MIN_GAP_PX;
                    case 'logoLeft-navRight':
                    case 'logoCenter-navRight':
                        // logo | empty | nav+utils
                        return logoWidth + (n + innerGap + u) + 2 * outerGap + MIN_GAP_PX;
                    case 'logoLeft-navLeft':
                    case 'logoCenter-navLeft':
                        // logo+nav | empty | utils
                        return (logoWidth + innerGap + n) + u + 2 * outerGap + MIN_GAP_PX;
                    case 'logoAbove-navCenter':
                        // Centered nav + absolute utils right.
                        return n + 2 * u + 2 * MIN_GAP_PX;
                    case 'logoAbove-navRight':
                        // nav | rowGap | utils, both glued to the right.
                        return n + rowGap + u;
                    case 'logoAbove-navLeft':
                        // nav (left) ... ml-auto ... utils (right).
                        return n + u + MIN_GAP_PX;
                }
            };

            const nextBp: HeaderCompactBreakpoints = {
                tier1Max: Math.ceil(neededAt(0)),
                tier2Max: Math.ceil(neededAt(1)),
                hamburgerMax: Math.ceil(neededAt(2)),
            };

            // Sanity: keep breakpoints monotonically decreasing.
            if (nextBp.tier2Max > nextBp.tier1Max) nextBp.tier2Max = nextBp.tier1Max;
            if (nextBp.hamburgerMax > nextBp.tier2Max) nextBp.hamburgerMax = nextBp.tier2Max;

            const unchanged = current
                && current.tier1Max === nextBp.tier1Max
                && current.tier2Max === nextBp.tier2Max
                && current.hamburgerMax === nextBp.hamburgerMax;
            debugLog('measured', {
                layout,
                logoWidth,
                navRenderedWidth,
                navItemCount,
                navRenderedGap,
                utilsRenderedWidth,
                utilsItemCount,
                utilsRenderedGap,
                nextBp,
                current,
                unchanged,
            });
            if (unchanged) return;

            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                saveTimer = null;
                debugLog('saving breakpoints', nextBp);
                onCompute(nextBp);
            }, 300);
        };

        const schedule = () => {
            if (measureFrame) return;
            measureFrame = requestAnimationFrame(measure);
        };

        const ro = new ResizeObserver(schedule);
        ro.observe(container);
        if (opts.refs.logo.current) ro.observe(opts.refs.logo.current);
        if (opts.refs.nav.current) ro.observe(opts.refs.nav.current);
        if (opts.refs.utils.current) ro.observe(opts.refs.utils.current);

        // Run an initial measurement after refs are attached.
        schedule();

        return () => {
            ro.disconnect();
            if (measureFrame) cancelAnimationFrame(measureFrame);
            if (saveTimer) clearTimeout(saveTimer);
        };
    }, [opts.enabled, opts.layout, opts.refs.container, opts.refs.logo, opts.refs.nav, opts.refs.utils]);
}

// Below this viewport the existing mobile-only UI (search/cart/hamburger
// cluster) is always shown. We clamp the dynamic hamburger breakpoint to
// this minimum so desktop nav never tries to render on phones.
const MOBILE_BREAKPOINT_PX = 768;

/**
 * Generate the inline <style> block that applies the saved breakpoints as
 * CSS media queries. Returns the CSS text — caller injects via
 * dangerouslySetInnerHTML.
 *
 * When no breakpoints are saved (legacy sites, fresh templates) we fall
 * back to a 768px hamburger threshold so behaviour matches the static
 * Tailwind `md:` rules the previous header used.
 */
export function buildHeaderBreakpointCss(bp: HeaderCompactBreakpoints | undefined): string {
    const hamburgerMax = Math.max(MOBILE_BREAKPOINT_PX, bp?.hamburgerMax ?? MOBILE_BREAKPOINT_PX);
    const tier2Max = Math.max(hamburgerMax, bp?.tier2Max ?? hamburgerMax);
    const tier1Max = Math.max(tier2Max, bp?.tier1Max ?? tier2Max);

    const gapRules = (tier: 0 | 1 | 2) => `
    .ks-site-header .ks-h-gap-nav { gap: ${NAV_GAPS[tier]}px; }
    .ks-site-header .ks-h-gap-utils { gap: ${UTILS_GAPS[tier]}px; }
    .ks-site-header .ks-h-gap-zone-inner { gap: ${ZONE_INNER_GAPS[tier]}px; }
    .ks-site-header .ks-h-gap-zone-outer { gap: ${ZONE_OUTER_GAPS[tier]}px; }
    .ks-site-header .ks-h-gap-row { gap: ${ROW_GAPS[tier]}px; }`;

    return `
/* keystone:header-breakpoints */
${gapRules(0)}
.ks-site-header .ks-h-desktop-hamburger { display: none; }
.ks-site-header .ks-h-mobile-cluster { display: none; }
.ks-site-header .ks-h-drawer-host { display: none; }

@media (max-width: ${tier1Max}px) {${gapRules(1)}
}
@media (max-width: ${tier2Max}px) {${gapRules(2)}
}
@media (max-width: ${hamburgerMax}px) {
    .ks-site-header .ks-h-desktop-nav { display: none !important; }
    .ks-site-header .ks-h-desktop-hamburger { display: inline-flex !important; }
    .ks-site-header .ks-h-drawer-host { display: block !important; }
}
@media (max-width: ${MOBILE_BREAKPOINT_PX - 1}px) {
    /* Below the mobile breakpoint the inline desktop-utils icons are
       hidden — the mobile cluster owns search/cart/etc. The desktop
       hamburger button hides too, replaced by the one inside the
       mobile cluster. */
    .ks-site-header .ks-h-desktop-utils { display: none !important; }
    .ks-site-header .ks-h-desktop-hamburger { display: none !important; }
    .ks-site-header .ks-h-mobile-cluster { display: flex !important; }
}
`.trim();
}
