'use client';

import { motion } from 'framer-motion';

// Total loop: 15s — three mockups appear sequentially, one at a time
// Browser:  0.2 → 4.5s
// Card:     4.8 → 9.5s
// Phone:   9.8 → 14.2s
// Gap:     14.2 → 15s then restart
const D = 15;

// Segment boundaries (in / out seconds)
const B_IN = 0.2;   const B_OUT = 4.5;   // Browser
const C_IN = 4.8;   const C_OUT = 9.5;   // Component card
const P_IN = 9.8;   const P_OUT = 14.2;  // Phone

// Keyframe helper: fade in at `inAt`, hold until `outAt`, fade out
function fade(inAt: number, outAt: number, peak = 1) {
    const fadeIn = 0.25;
    const fadeOut = 0.35;
    const i0 = Math.max(0.001, (inAt - fadeIn) / D);
    const i1 = inAt / D;
    const o0 = outAt / D;
    const o1 = Math.min(0.999, (outAt + fadeOut) / D);
    return {
        opacity: [0, 0, peak, peak, 0, 0] as number[],
        times: [0, i0, i1, o0, o1, 1] as number[],
    };
}

// Slide-in from a direction + fade, within a segment window
function slideIn(
    inAt: number,
    outAt: number,
    from: 'left' | 'right' | 'bottom' | 'top' = 'left',
    dist = 20,
    peak = 1
) {
    const fadeIn = 0.2;
    const fadeOut = 0.3;
    const i0 = Math.max(0.001, (inAt - fadeIn) / D);
    const i1 = inAt / D;
    const o0 = outAt / D;
    const o1 = Math.min(0.999, (outAt + fadeOut) / D);

    const axis = from === 'left' || from === 'right' ? 'x' : 'y';
    const sign = from === 'right' || from === 'bottom' ? 1 : -1;
    const offset = dist * sign;

    return {
        opacity: [0, 0, peak, peak, 0, 0] as number[],
        [axis]: [offset, offset, 0, 0, offset / 2, offset] as number[],
        times: [0, i0, i1, o0, o1, 1] as number[],
    };
}

const loop = { duration: D, repeat: Infinity, ease: 'easeOut' as const };

export default function AnimatedGridPattern() {
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
            <div className="hidden md:block">

                {/* ── SEGMENT 1: Browser mockup (0.2s → 4.5s) ────────────── */}
                <motion.div
                    animate={{
                        ...fade(B_IN, B_OUT, 1),
                        y: [15, 15, 0, 0, 10, 15] as number[],
                    }}
                    transition={loop}
                    className="absolute top-[12%] left-[5%] lg:left-[8%] w-72 lg:w-80 rounded-xl border border-slate-300/80 bg-white/50 backdrop-blur-sm overflow-hidden z-10 shadow-md"
                >
                    {/* Chrome bar */}
                    <div className="flex items-center gap-1.5 px-3 h-8 border-b border-slate-200/60 bg-white/60 shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-300/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-300/60" />
                        <div className="flex-1 mx-3 h-3 rounded-md bg-slate-200/70" />
                    </div>
                    <div className="p-3 space-y-2">
                        {/* Nav bar */}
                        <motion.div
                            animate={slideIn(B_IN + 0.2, B_OUT, 'left', 30)}
                            transition={loop}
                            className="flex items-center gap-2"
                        >
                            <div className="w-5 h-5 rounded bg-red-400/70" />
                            <div className="flex-1" />
                            <div className="w-8 h-2 rounded bg-slate-300/70" />
                            <div className="w-8 h-2 rounded bg-slate-300/70" />
                            <div className="w-8 h-2 rounded bg-slate-300/70" />
                        </motion.div>

                        {/* Hero section */}
                        <motion.div
                            animate={slideIn(B_IN + 0.4, B_OUT, 'left', 25)}
                            transition={loop}
                            className="flex gap-2 items-start"
                        >
                            <div className="flex-1 space-y-1.5 pt-1">
                                <div className="h-3 rounded bg-slate-800/25 w-full" />
                                <div className="h-3 rounded bg-slate-800/20 w-4/5" />
                                <div className="h-2 rounded bg-slate-400/30 w-full mt-1" />
                                <div className="h-2 rounded bg-slate-400/30 w-3/4" />
                            </div>
                            <motion.div
                                animate={slideIn(B_IN + 0.6, B_OUT, 'right', 20)}
                                transition={loop}
                                className="w-20 h-16 rounded-lg bg-slate-200/80 border border-slate-300/50 flex items-center justify-center shrink-0"
                            >
                                <svg className="w-6 h-6 text-slate-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                                </svg>
                            </motion.div>
                        </motion.div>

                        {/* CTA */}
                        <motion.div animate={slideIn(B_IN + 0.8, B_OUT, 'left', 15)} transition={loop}>
                            <div className="w-20 h-5 rounded-full bg-red-400/60" />
                        </motion.div>

                        {/* Feature cards */}
                        <div className="flex gap-1.5 pt-1">
                            <motion.div
                                animate={slideIn(B_IN + 1.0, B_OUT, 'bottom', 15)}
                                transition={loop}
                                className="flex-1 h-12 rounded-lg bg-slate-100/80 border border-slate-200/60 p-1.5"
                            >
                                <div className="w-4 h-4 rounded bg-red-300/50 mb-1" />
                                <div className="h-1.5 rounded bg-slate-300/60 w-3/4" />
                            </motion.div>
                            <motion.div
                                animate={slideIn(B_IN + 1.2, B_OUT, 'bottom', 15)}
                                transition={loop}
                                className="flex-1 h-12 rounded-lg bg-slate-100/80 border border-slate-200/60 p-1.5"
                            >
                                <div className="w-4 h-4 rounded bg-amber-300/50 mb-1" />
                                <div className="h-1.5 rounded bg-slate-300/60 w-3/4" />
                            </motion.div>
                            <motion.div
                                animate={slideIn(B_IN + 1.4, B_OUT, 'bottom', 15)}
                                transition={loop}
                                className="flex-1 h-12 rounded-lg bg-slate-100/80 border border-slate-200/60 p-1.5"
                            >
                                <div className="w-4 h-4 rounded bg-emerald-300/50 mb-1" />
                                <div className="h-1.5 rounded bg-slate-300/60 w-3/4" />
                            </motion.div>
                        </div>

                        {/* Footer */}
                        <motion.div
                            animate={slideIn(B_IN + 1.6, B_OUT, 'bottom', 10)}
                            transition={loop}
                            className="h-3 rounded bg-slate-200/60 w-full"
                        />
                    </div>
                </motion.div>

                {/* Launch dot */}
                <motion.div
                    animate={{
                        ...fade(2.5, B_OUT, 1),
                        scale: [0, 0, 1.2, 1, 1, 0] as number[],
                    }}
                    transition={loop}
                    className="absolute top-[12%] left-[5%] lg:left-[8%] z-20"
                >
                    <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_3px_rgba(52,211,153,0.6)]"
                        style={{ marginLeft: 270, marginTop: 10 }} />
                </motion.div>

                {/* Pulse ring 1 */}
                <motion.div
                    animate={{ opacity: [0, 0, 0.9, 0, 0], scale: [0.3, 0.3, 1, 3, 3] }}
                    transition={{ ...loop, times: [0, 2.4 / D, 2.6 / D, 3.6 / D, 1] }}
                    className="absolute top-[12%] left-[5%] lg:left-[8%] z-10"
                    style={{ marginLeft: 260, marginTop: -1 }}
                >
                    <div className="w-8 h-8 rounded-full border-2 border-emerald-400/80" />
                </motion.div>

                {/* Pulse ring 2 */}
                <motion.div
                    animate={{ opacity: [0, 0, 0.6, 0, 0], scale: [0.3, 0.3, 1, 4, 4] }}
                    transition={{ ...loop, times: [0, 2.6 / D, 2.8 / D, 3.8 / D, 1] }}
                    className="absolute top-[12%] left-[5%] lg:left-[8%] z-10"
                    style={{ marginLeft: 260, marginTop: -1 }}
                >
                    <div className="w-8 h-8 rounded-full border border-emerald-400/50" />
                </motion.div>

                {/* Browser glow on launch */}
                <motion.div
                    animate={{ opacity: [0, 0, 0.15, 0, 0] }}
                    transition={{ ...loop, times: [0, 2.5 / D, 2.8 / D, 3.6 / D, 1] }}
                    className="absolute top-[12%] left-[5%] lg:left-[8%] w-72 lg:w-80 h-64 rounded-xl bg-emerald-400 z-[9] blur-xl"
                />

                {/* ── SEGMENT 2: Component card (4.8s → 9.5s) ────────────── */}
                <motion.div
                    animate={{
                        ...fade(C_IN, C_OUT, 0.9),
                        y: [20, 20, 0, 0, 10, 20] as number[],
                    }}
                    transition={loop}
                    className="absolute top-[22%] left-[50%] -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-[10%] w-56 lg:w-60 rounded-xl border border-red-300/60 bg-white/40 backdrop-blur-sm overflow-hidden z-10 shadow-md"
                >
                    <div className="p-3 space-y-2">
                        {/* Card header */}
                        <motion.div
                            animate={slideIn(C_IN + 0.2, C_OUT, 'right', 20)}
                            transition={loop}
                            className="flex items-center gap-2"
                        >
                            <div className="w-8 h-8 rounded-lg bg-red-300/60 shrink-0" />
                            <div className="flex-1 space-y-1">
                                <div className="h-2.5 rounded bg-slate-700/25 w-3/4" />
                                <div className="h-2 rounded bg-slate-400/30 w-full" />
                            </div>
                        </motion.div>
                        {/* Image block */}
                        <motion.div
                            animate={slideIn(C_IN + 0.5, C_OUT, 'right', 15)}
                            transition={loop}
                            className="h-14 rounded-lg bg-slate-200/70 border border-slate-300/40"
                        />
                        {/* Text lines */}
                        <motion.div
                            animate={slideIn(C_IN + 0.7, C_OUT, 'right', 15)}
                            transition={loop}
                            className="space-y-1"
                        >
                            <div className="h-2 rounded bg-slate-300/60 w-full" />
                            <div className="h-2 rounded bg-slate-300/50 w-2/3" />
                        </motion.div>
                        {/* Stats row */}
                        <motion.div
                            animate={slideIn(C_IN + 0.9, C_OUT, 'bottom', 10)}
                            transition={loop}
                            className="flex gap-2 pt-0.5"
                        >
                            <div className="flex-1 h-6 rounded-lg bg-emerald-100/70 border border-emerald-200/50 flex items-center justify-center">
                                <div className="w-6 h-1.5 rounded bg-emerald-400/60" />
                            </div>
                            <div className="flex-1 h-6 rounded-lg bg-slate-100/70 border border-slate-200/40" />
                            <div className="flex-1 h-6 rounded-lg bg-slate-100/70 border border-slate-200/40" />
                        </motion.div>
                        {/* CTA button */}
                        <motion.div animate={slideIn(C_IN + 1.1, C_OUT, 'right', 10)} transition={loop}>
                            <div className="h-6 rounded-full bg-red-400/50 w-3/5" />
                        </motion.div>
                        {/* Progress/analytics bar */}
                        <motion.div
                            animate={slideIn(C_IN + 1.3, C_OUT, 'bottom', 8)}
                            transition={loop}
                            className="space-y-1 pt-0.5"
                        >
                            <div className="h-1.5 rounded-full bg-slate-200/60 w-full overflow-hidden">
                                <div className="h-full bg-red-400/50 rounded-full" style={{ width: '65%' }} />
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-200/60 w-full overflow-hidden">
                                <div className="h-full bg-amber-400/40 rounded-full" style={{ width: '40%' }} />
                            </div>
                        </motion.div>
                    </div>
                </motion.div>

                {/* ── SEGMENT 3: Phone mockup (9.8s → 14.2s) ──────────────── */}
                <motion.div
                    animate={{
                        ...fade(P_IN, P_OUT, 0.85),
                        y: [18, 18, 0, 0, 10, 18] as number[],
                    }}
                    transition={loop}
                    className="absolute top-[15%] left-[50%] -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-[14%] w-24 h-44 rounded-2xl border-2 border-slate-300/60 bg-white/35 backdrop-blur-sm overflow-hidden z-10 shadow-md"
                >
                    {/* Notch */}
                    <div className="mx-auto mt-1.5 w-10 h-2 rounded-full bg-slate-300/60" />
                    <div className="p-2 mt-1 space-y-1.5">
                        <motion.div
                            animate={slideIn(P_IN + 0.2, P_OUT, 'bottom', 10, 0.9)}
                            transition={loop}
                            className="h-2 rounded bg-red-300/60 w-full"
                        />
                        <motion.div
                            animate={slideIn(P_IN + 0.4, P_OUT, 'bottom', 10, 0.9)}
                            transition={loop}
                            className="h-7 rounded-lg bg-slate-200/60 w-full"
                        />
                        <motion.div
                            animate={slideIn(P_IN + 0.6, P_OUT, 'bottom', 8, 0.9)}
                            transition={loop}
                            className="h-1.5 rounded bg-slate-300/50 w-3/4"
                        />
                        <motion.div
                            animate={slideIn(P_IN + 0.8, P_OUT, 'bottom', 8, 0.9)}
                            transition={loop}
                            className="flex gap-1"
                        >
                            <div className="flex-1 h-4 rounded bg-slate-100/70 border border-slate-200/50" />
                            <div className="flex-1 h-4 rounded bg-slate-100/70 border border-slate-200/50" />
                        </motion.div>
                        <motion.div
                            animate={slideIn(P_IN + 1.0, P_OUT, 'bottom', 8, 0.9)}
                            transition={loop}
                        >
                            <div className="h-5 rounded-full bg-red-400/50 w-2/3 mx-auto" />
                        </motion.div>
                    </div>
                    {/* Home bar */}
                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-slate-400/40" />
                </motion.div>

                {/* Phone glow accent */}
                <motion.div
                    animate={{ opacity: [0, 0, 0.1, 0.05, 0, 0] }}
                    transition={{ ...loop, times: [0, P_IN / D, (P_IN + 0.5) / D, (P_OUT - 1) / D, P_OUT / D, 1] }}
                    className="absolute top-[15%] left-[50%] -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-[14%] w-24 h-44 rounded-2xl bg-red-400 z-[9] blur-xl"
                />
            </div>

            {/* ━━━ Mobile — two states alternating ━━━ */}
            <div className="block md:hidden">
                {/* Mobile state 1: browser (0.2 → 7s) */}
                <motion.div
                    animate={{
                        ...fade(0.2, 6.8, 0.65),
                        y: [10, 10, 0, 0, 5, 10] as number[],
                    }}
                    transition={loop}
                    className="absolute top-[8%] left-1/2 -translate-x-1/2 w-56 rounded-xl border border-slate-300/50 bg-white/30 overflow-hidden z-10 shadow-sm"
                >
                    <div className="flex items-center gap-1 px-2 h-6 border-b border-slate-200/40 bg-white/40 shrink-0">
                        <div className="w-2 h-2 rounded-full bg-red-400/60" />
                        <div className="w-2 h-2 rounded-full bg-amber-300/40" />
                        <div className="w-2 h-2 rounded-full bg-green-300/40" />
                        <div className="flex-1 mx-1.5 h-2 rounded bg-slate-200/50" />
                    </div>
                    <div className="p-2 space-y-1.5">
                        <motion.div animate={slideIn(0.4, 6.8, 'left', 15, 0.8)} transition={loop} className="h-2.5 rounded bg-red-300/50 w-full" />
                        <motion.div animate={slideIn(0.6, 6.8, 'left', 15, 0.8)} transition={loop} className="h-6 rounded bg-slate-200/50 w-full" />
                        <motion.div animate={slideIn(0.8, 6.8, 'left', 10, 0.8)} transition={loop}>
                            <div className="w-14 h-3.5 rounded-full bg-red-400/50" />
                        </motion.div>
                        <div className="flex gap-1">
                            <motion.div animate={slideIn(1.0, 6.8, 'bottom', 10, 0.8)} transition={loop} className="flex-1 h-6 rounded bg-slate-100/70 border border-slate-200/40" />
                            <motion.div animate={slideIn(1.2, 6.8, 'bottom', 10, 0.8)} transition={loop} className="flex-1 h-6 rounded bg-slate-100/70 border border-slate-200/40" />
                        </div>
                    </div>
                </motion.div>

                {/* Mobile launch dot */}
                <motion.div
                    animate={{
                        ...fade(3.0, 6.5, 1),
                        scale: [0, 0, 1.2, 1, 1, 0] as number[],
                    }}
                    transition={loop}
                    className="absolute top-[8%] left-1/2 z-20"
                    style={{ marginLeft: 95, marginTop: 7 }}
                >
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]" />
                </motion.div>

                {/* Mobile pulse ring */}
                <motion.div
                    animate={{ opacity: [0, 0, 0.7, 0, 0], scale: [0.3, 0.3, 1, 2.5, 2.5] }}
                    transition={{ ...loop, times: [0, 2.9 / D, 3.1 / D, 4.1 / D, 1] }}
                    className="absolute top-[8%] left-1/2 z-10"
                    style={{ marginLeft: 88, marginTop: 1 }}
                >
                    <div className="w-6 h-6 rounded-full border-2 border-emerald-400/70" />
                </motion.div>

                {/* Mobile state 2: phone (7.5 → 14.5s) */}
                <motion.div
                    animate={{
                        ...fade(7.5, 14.2, 0.65),
                        y: [15, 15, 0, 0, 8, 15] as number[],
                    }}
                    transition={loop}
                    className="absolute top-[6%] left-1/2 -translate-x-1/2 w-20 h-40 rounded-2xl border-2 border-slate-300/50 bg-white/30 overflow-hidden z-10 shadow-sm"
                >
                    <div className="mx-auto mt-1 w-8 h-1.5 rounded-full bg-slate-300/50" />
                    <div className="p-1.5 mt-0.5 space-y-1">
                        <motion.div animate={slideIn(7.7, 14.2, 'bottom', 8, 0.8)} transition={loop} className="h-1.5 rounded bg-red-300/60 w-full" />
                        <motion.div animate={slideIn(7.9, 14.2, 'bottom', 8, 0.8)} transition={loop} className="h-4 rounded bg-slate-200/60 w-full" />
                        <motion.div animate={slideIn(8.1, 14.2, 'bottom', 8, 0.8)} transition={loop} className="h-1 rounded bg-slate-300/50 w-3/4" />
                        <motion.div animate={slideIn(8.3, 14.2, 'bottom', 8, 0.8)} transition={loop} className="flex gap-0.5">
                            <div className="flex-1 h-3 rounded bg-slate-200/50" />
                            <div className="flex-1 h-3 rounded bg-slate-200/50" />
                        </motion.div>
                    </div>
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-7 h-1 rounded-full bg-slate-400/35" />
                </motion.div>
            </div>
        </div>
    );
}
