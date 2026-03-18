'use client';

import { motion } from 'framer-motion';

// Total loop: 15s — three mockups appear sequentially, one at a time
// Browser:  0.2 → 4.5s
// Card:     4.8 → 9.5s
// Phone:   9.8 → 14.2s
// Gap:     14.2 → 15s then restart
const D = 15;

// Segment boundaries (in / out seconds)
const B_IN = 0.1; const B_OUT = 4.9;   // Browser
const C_IN = 5.1; const C_OUT = 9.9;   // Component card
const P_IN = 10.1; const P_OUT = 14.9;  // Phone

// Build times array for 6-keyframe fade: invisible → fade in → hold → fade out → invisible
function makeTimes(inAt: number, outAt: number) {
    const fadeIn = 0.25;
    const fadeOut = 0.35;
    return [
        0,
        Math.max(0.001, (inAt - fadeIn) / D),
        inAt / D,
        outAt / D,
        Math.min(0.999, (outAt + fadeOut) / D),
        1,
    ] as number[];
}

// fade: returns animate + transition (times in transition, not animate!)
function fade(inAt: number, outAt: number, peak = 1) {
    return {
        animate: {
            opacity: [0, 0, peak, peak, 0, 0] as number[],
        },
        transition: {
            times: makeTimes(inAt, outAt),
        },
    };
}

// slideIn: animate values + transition times for slide+fade within a segment
function slideIn(
    inAt: number,
    outAt: number,
    from: 'left' | 'right' | 'bottom' | 'top' = 'left',
    dist = 20,
    peak = 1
) {
    const axis = from === 'left' || from === 'right' ? 'x' : 'y';
    const sign = from === 'right' || from === 'bottom' ? 1 : -1;
    const offset = dist * sign;

    return {
        animate: {
            opacity: [0, 0, peak, peak, 0, 0] as number[],
            [axis]: [offset, offset, 0, 0, offset / 2, offset] as number[],
        },
        transition: {
            times: makeTimes(inAt, outAt),
        },
    };
}

// Base loop transition (times added per-element)
const baseLoop = { duration: D, repeat: Infinity, ease: 'easeOut' as const };

// Merge base loop + per-element times + optional extra props
function tr(times: number[], extra?: object) {
    return { ...baseLoop, times, ...extra };
}

export default function AnimatedGridPattern() {
    // Pre-compute all animations
    const bFrame = fade(B_IN, B_OUT, 1);
    const cFrame = fade(C_IN, C_OUT, 0.9);
    const pFrame = fade(P_IN, P_OUT, 0.85);

    const bNav = slideIn(B_IN + 0.2, B_OUT, 'left', 30);
    const bHero = slideIn(B_IN + 0.4, B_OUT, 'left', 25);
    const bImg = slideIn(B_IN + 0.6, B_OUT, 'right', 20);
    const bCta = slideIn(B_IN + 0.8, B_OUT, 'left', 15);
    const bCard1 = slideIn(B_IN + 1.0, B_OUT, 'bottom', 15);
    const bCard2 = slideIn(B_IN + 1.2, B_OUT, 'bottom', 15);
    const bCard3 = slideIn(B_IN + 1.4, B_OUT, 'bottom', 15);
    const bFooter = slideIn(B_IN + 1.6, B_OUT, 'bottom', 10);

    const cHeader = slideIn(C_IN + 0.2, C_OUT, 'right', 20);
    const cImg = slideIn(C_IN + 0.5, C_OUT, 'right', 15);
    const cText = slideIn(C_IN + 0.7, C_OUT, 'right', 15);
    const cStats = slideIn(C_IN + 0.9, C_OUT, 'bottom', 10);
    const cCta = slideIn(C_IN + 1.1, C_OUT, 'right', 10);
    const cBars = slideIn(C_IN + 1.3, C_OUT, 'bottom', 8);

    const pEl1 = slideIn(P_IN + 0.2, P_OUT, 'bottom', 10, 0.9);
    const pEl2 = slideIn(P_IN + 0.4, P_OUT, 'bottom', 10, 0.9);
    const pEl3 = slideIn(P_IN + 0.6, P_OUT, 'bottom', 8, 0.9);
    const pEl4 = slideIn(P_IN + 0.8, P_OUT, 'bottom', 8, 0.9);
    const pEl5 = slideIn(P_IN + 1.0, P_OUT, 'bottom', 8, 0.9);

    // Launch dot timing (within browser segment)
    const launchInAt = 2.5;
    const launchTimes = makeTimes(launchInAt, B_OUT);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
            {/* Gradient overlays for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-white/40 z-20" />

            {/* Grid texture */}
            <div className="absolute inset-0 opacity-[0.08]">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                    <defs>
                        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-900" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>

            {/* ━━━ Desktop ━━━ */}
            <div className="absolute inset-0 flex justify-center">
                <div className="relative w-full max-w-5xl h-full">

                    {/* ── SEGMENT 1: Browser mockup (0.2 → 4.5s) ── */}
                    <motion.div
                        animate={{ ...bFrame.animate, y: [15, 15, 0, 0, 10, 15] }}
                        transition={tr(bFrame.transition.times)}
                        className="absolute top-[12%] left-[5%] lg:left-[8%] w-72 lg:w-80 rounded-xl border border-slate-300/80 bg-white/50 backdrop-blur-sm overflow-hidden z-10 shadow-md"
                    >
                        <div className="flex items-center gap-1.5 px-3 h-8 border-b border-slate-200/60 bg-white/60 shrink-0">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-300/60" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-300/60" />
                            <div className="flex-1 mx-3 h-3 rounded-md bg-slate-200/70" />
                        </div>
                        <div className="p-3 space-y-2">
                            <motion.div animate={bNav.animate} transition={tr(bNav.transition.times)} className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded bg-red-400/70" />
                                <div className="flex-1" />
                                <div className="w-8 h-2 rounded bg-slate-300/70" />
                                <div className="w-8 h-2 rounded bg-slate-300/70" />
                                <div className="w-8 h-2 rounded bg-slate-300/70" />
                            </motion.div>

                            <motion.div animate={bHero.animate} transition={tr(bHero.transition.times)} className="flex gap-2 items-start">
                                <div className="flex-1 space-y-1.5 pt-1">
                                    <div className="h-3 rounded bg-slate-800/25 w-full" />
                                    <div className="h-3 rounded bg-slate-800/20 w-4/5" />
                                    <div className="h-2 rounded bg-slate-400/30 w-full mt-1" />
                                    <div className="h-2 rounded bg-slate-400/30 w-3/4" />
                                </div>
                                <motion.div animate={bImg.animate} transition={tr(bImg.transition.times)}
                                    className="w-20 h-16 rounded-lg bg-slate-200/80 border border-slate-300/50 flex items-center justify-center shrink-0">
                                    <svg className="w-6 h-6 text-slate-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                                    </svg>
                                </motion.div>
                            </motion.div>

                            <motion.div animate={bCta.animate} transition={tr(bCta.transition.times)}>
                                <div className="w-20 h-5 rounded-full bg-red-400/60" />
                            </motion.div>

                            <div className="flex gap-1.5 pt-1">
                                <motion.div animate={bCard1.animate} transition={tr(bCard1.transition.times)}
                                    className="flex-1 h-12 rounded-lg bg-slate-100/80 border border-slate-200/60 p-1.5">
                                    <div className="w-4 h-4 rounded bg-red-300/50 mb-1" />
                                    <div className="h-1.5 rounded bg-slate-300/60 w-3/4" />
                                </motion.div>
                                <motion.div animate={bCard2.animate} transition={tr(bCard2.transition.times)}
                                    className="flex-1 h-12 rounded-lg bg-slate-100/80 border border-slate-200/60 p-1.5">
                                    <div className="w-4 h-4 rounded bg-amber-300/50 mb-1" />
                                    <div className="h-1.5 rounded bg-slate-300/60 w-3/4" />
                                </motion.div>
                                <motion.div animate={bCard3.animate} transition={tr(bCard3.transition.times)}
                                    className="flex-1 h-12 rounded-lg bg-slate-100/80 border border-slate-200/60 p-1.5">
                                    <div className="w-4 h-4 rounded bg-emerald-300/50 mb-1" />
                                    <div className="h-1.5 rounded bg-slate-300/60 w-3/4" />
                                </motion.div>
                            </div>

                            <motion.div animate={bFooter.animate} transition={tr(bFooter.transition.times)}
                                className="h-3 rounded bg-slate-200/60 w-full" />
                        </div>
                    </motion.div>

                    {/* Launch dot */}
                    <motion.div
                        animate={{ opacity: [0, 0, 1, 1, 0, 0], scale: [0, 0, 1.2, 1, 1, 0] }}
                        transition={tr(launchTimes)}
                        className="absolute top-[12%] left-[5%] lg:left-[8%] z-20"
                        style={{ marginLeft: 270, marginTop: 10 }}
                    >
                        <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_3px_rgba(52,211,153,0.6)]" />
                    </motion.div>

                    {/* Pulse ring 1 */}
                    <motion.div
                        animate={{ opacity: [0, 0, 0.9, 0, 0], scale: [0.3, 0.3, 1, 3, 3] }}
                        transition={{ ...baseLoop, times: [0, (launchInAt - 0.1) / D, (launchInAt + 0.2) / D, (launchInAt + 1.2) / D, 1] }}
                        className="absolute top-[12%] left-[5%] lg:left-[8%] z-10"
                        style={{ marginLeft: 260, marginTop: -1 }}
                    >
                        <div className="w-8 h-8 rounded-full border-2 border-emerald-400/80" />
                    </motion.div>

                    {/* Pulse ring 2 */}
                    <motion.div
                        animate={{ opacity: [0, 0, 0.6, 0, 0], scale: [0.3, 0.3, 1, 4, 4] }}
                        transition={{ ...baseLoop, times: [0, (launchInAt + 0.1) / D, (launchInAt + 0.4) / D, (launchInAt + 1.4) / D, 1] }}
                        className="absolute top-[12%] left-[5%] lg:left-[8%] z-10"
                        style={{ marginLeft: 260, marginTop: -1 }}
                    >
                        <div className="w-8 h-8 rounded-full border border-emerald-400/50" />
                    </motion.div>

                    {/* Browser glow */}
                    <motion.div
                        animate={{ opacity: [0, 0, 0.15, 0, 0] }}
                        transition={{ ...baseLoop, times: [0, launchInAt / D, (launchInAt + 0.3) / D, (launchInAt + 1.1) / D, 1] }}
                        className="absolute top-[12%] left-[5%] lg:left-[8%] w-72 lg:w-80 h-64 rounded-xl bg-emerald-400 z-[9] blur-xl"
                    />

                    {/* ── SEGMENT 2: Component card (4.8 → 9.5s) ── */}
                    <motion.div
                        animate={{ ...cFrame.animate, y: [20, 20, 0, 0, 10, 20] }}
                        transition={tr(cFrame.transition.times)}
                        className="absolute top-[20%] left-[50%] -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-[10%] w-56 lg:w-60 rounded-xl border border-red-300/60 bg-white/40 backdrop-blur-sm overflow-hidden z-10 shadow-md"
                    >
                        <div className="p-3 space-y-2">
                            <motion.div animate={cHeader.animate} transition={tr(cHeader.transition.times)} className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-red-300/60 shrink-0" />
                                <div className="flex-1 space-y-1">
                                    <div className="h-2.5 rounded bg-slate-700/25 w-3/4" />
                                    <div className="h-2 rounded bg-slate-400/30 w-full" />
                                </div>
                            </motion.div>
                            <motion.div animate={cImg.animate} transition={tr(cImg.transition.times)}
                                className="h-14 rounded-lg bg-slate-200/70 border border-slate-300/40" />
                            <motion.div animate={cText.animate} transition={tr(cText.transition.times)} className="space-y-1">
                                <div className="h-2 rounded bg-slate-300/60 w-full" />
                                <div className="h-2 rounded bg-slate-300/50 w-2/3" />
                            </motion.div>
                            <motion.div animate={cStats.animate} transition={tr(cStats.transition.times)} className="flex gap-2 pt-0.5">
                                <div className="flex-1 h-6 rounded-lg bg-emerald-100/70 border border-emerald-200/50 flex items-center justify-center">
                                    <div className="w-6 h-1.5 rounded bg-emerald-400/60" />
                                </div>
                                <div className="flex-1 h-6 rounded-lg bg-slate-100/70 border border-slate-200/40" />
                                <div className="flex-1 h-6 rounded-lg bg-slate-100/70 border border-slate-200/40" />
                            </motion.div>
                            <motion.div animate={cCta.animate} transition={tr(cCta.transition.times)}>
                                <div className="h-6 rounded-full bg-red-400/50 w-3/5" />
                            </motion.div>
                            <motion.div animate={cBars.animate} transition={tr(cBars.transition.times)} className="space-y-1 pt-0.5">
                                <div className="h-1.5 rounded-full bg-slate-200/60 w-full overflow-hidden">
                                    <div className="h-full bg-red-400/50 rounded-full" style={{ width: '65%' }} />
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-200/60 w-full overflow-hidden">
                                    <div className="h-full bg-amber-400/40 rounded-full" style={{ width: '40%' }} />
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* ── SEGMENT 3: Phone mockup (9.8 → 14.2s) ── */}
                    <motion.div
                        animate={{ ...pFrame.animate, y: [18, 18, 0, 0, 10, 18] }}
                        transition={tr(pFrame.transition.times)}
                        className="absolute top-[15%] left-[50%] -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-[14%] w-24 h-44 rounded-2xl border-2 border-slate-300/60 bg-white/35 backdrop-blur-sm overflow-hidden z-10 shadow-md"
                    >
                        <div className="mx-auto mt-1.5 w-10 h-2 rounded-full bg-slate-300/60" />
                        <div className="p-2 mt-1 space-y-1.5">
                            <motion.div animate={pEl1.animate} transition={tr(pEl1.transition.times)} className="h-2 rounded bg-red-300/60 w-full" />
                            <motion.div animate={pEl2.animate} transition={tr(pEl2.transition.times)} className="h-7 rounded-lg bg-slate-200/60 w-full" />
                            <motion.div animate={pEl3.animate} transition={tr(pEl3.transition.times)} className="h-1.5 rounded bg-slate-300/50 w-3/4" />
                            <motion.div animate={pEl4.animate} transition={tr(pEl4.transition.times)} className="flex gap-1">
                                <div className="flex-1 h-4 rounded bg-slate-100/70 border border-slate-200/50" />
                                <div className="flex-1 h-4 rounded bg-slate-100/70 border border-slate-200/50" />
                            </motion.div>
                            <motion.div animate={pEl5.animate} transition={tr(pEl5.transition.times)}>
                                <div className="h-5 rounded-full bg-red-400/50 w-2/3 mx-auto" />
                            </motion.div>
                        </div>
                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-slate-400/40" />
                    </motion.div>
                </div>
            </div>


        </div>
    );
}
