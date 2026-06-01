'use client';

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

export type CompactTier = 0 | 1 | 2 | 3;

interface UseHeaderCompactnessResult {
    containerRef: RefObject<HTMLDivElement | null>;
    leftRef: RefObject<HTMLDivElement | null>;
    centerRef: RefObject<HTMLDivElement | null>;
    rightRef: RefObject<HTMLDivElement | null>;
    tier: CompactTier;
}

// Minimum visual breathing room between the centered nav and each side zone.
// Anything tighter than this and the nav starts looking cramped against the
// search icon / utils cluster.
const MIN_GAP_PX = 24;

// Hysteresis: how much overflow before we tighten, and how much headroom
// before we relax. The relax threshold is generous to avoid oscillating at
// the boundary where tightening the gaps shrinks the measured zone widths
// just enough to want to step back.
const STEP_DOWN_OVERFLOW_PX = 0;
const STEP_UP_HEADROOM_PX = 80;

// When we've forced the desktop hamburger (tier 3), the in-flow nav is gone
// so we can't measure it directly. We use the last-known nav width plus a
// small buffer to decide when there's room to drop back to tier 2.
const HAMBURGER_RECOVERY_BUFFER_PX = 32;

// Below this the existing Tailwind `md:` breakpoint already swaps the
// desktop nav out for the mobile hamburger, so there's nothing for us to
// tighten and we don't want to second-guess the static breakpoint.
const DESKTOP_MIN_WIDTH_PX = 768;

/**
 * Observes the header's three zones (left / center / right) and returns a
 * "compactness tier" describing how tightly the layout needs to pack:
 *
 *   0 — comfortable (default Tailwind gaps)
 *   1 — tightened nav + utils gaps
 *   2 — tighter still
 *   3 — fall back to hamburger (nav doesn't fit even at minimum gap)
 *
 * The caller attaches the refs to the three zone wrappers + their shared
 * parent, then maps the returned tier onto gap classes (and, at tier 3,
 * swaps the inline nav for a hamburger button).
 */
export function useHeaderCompactness(enabled: boolean): UseHeaderCompactnessResult {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const leftRef = useRef<HTMLDivElement | null>(null);
    const centerRef = useRef<HTMLDivElement | null>(null);
    const rightRef = useRef<HTMLDivElement | null>(null);

    const [measuredTier, setMeasuredTier] = useState<CompactTier>(0);
    const tierRef = useRef<CompactTier>(0);
    // Largest center-zone (nav) width we've observed while it was still in
    // the flow. Used to project whether we have room to drop back from
    // hamburger mode.
    const navMaxWidthRef = useRef(0);

    const setTierSafe = useCallback((next: CompactTier) => {
        if (next === tierRef.current) return;
        tierRef.current = next;
        setMeasuredTier(next);
    }, []);

    useEffect(() => {
        if (!enabled) {
            // Reset the trackers so a future enable starts from baseline. The
            // public `tier` is already clamped to 0 below; no setState needed.
            tierRef.current = 0;
            navMaxWidthRef.current = 0;
            return;
        }

        const container = containerRef.current;
        if (!container) return;

        let raf = 0;

        const measure = () => {
            raf = 0;
            const available = container.clientWidth;
            if (available <= 0) return;
            if (available < DESKTOP_MIN_WIDTH_PX) {
                // Mobile: static `md:` breakpoint owns the layout. Reset to
                // tier 0 so when we cross back to desktop we start from a
                // known baseline rather than a stale tier.
                setTierSafe(0);
                return;
            }

            const left = leftRef.current?.scrollWidth ?? 0;
            const center = centerRef.current?.scrollWidth ?? 0;
            const right = rightRef.current?.scrollWidth ?? 0;

            const zoneCount = (left > 0 ? 1 : 0) + (center > 0 ? 1 : 0) + (right > 0 ? 1 : 0);
            const gapBudget = MIN_GAP_PX * Math.max(0, zoneCount - 1);

            const current = tierRef.current;

            if (current < 3) {
                // While the nav is still in flow, remember its widest measured
                // size so we know how much room we'd need to bring it back.
                if (center > navMaxWidthRef.current) navMaxWidthRef.current = center;

                const needed = left + center + right + gapBudget;
                const overflow = needed - available;

                if (overflow > STEP_DOWN_OVERFLOW_PX) {
                    setTierSafe((current + 1) as CompactTier);
                } else if (overflow < -STEP_UP_HEADROOM_PX && current > 0) {
                    setTierSafe((current - 1) as CompactTier);
                }
                return;
            }

            // Tier 3: nav is hidden behind a hamburger button. Project whether
            // restoring the nav at its last-known width would still fit.
            const projected = left + navMaxWidthRef.current + right + gapBudget;
            if (projected + HAMBURGER_RECOVERY_BUFFER_PX < available) {
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

        // Run once after mount so the first paint reflects the steady-state
        // tier rather than flashing tier 0 then collapsing.
        schedule();

        return () => {
            ro.disconnect();
            if (raf) cancelAnimationFrame(raf);
        };
    }, [enabled, setTierSafe]);

    const tier: CompactTier = enabled ? measuredTier : 0;
    return { containerRef, leftRef, centerRef, rightRef, tier };
}
