'use client';

import { motion } from 'framer-motion';

const D = 7; // total loop duration — snappy

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

// Slide-in from a direction + fade
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

// ── Timeline (7s loop) ──────────────────────────────────
// 0.2s  browser frame slides up
// 0.4s  nav bar slides in from left
// 0.6s  hero heading lines slide in from left
// 0.8s  hero image placeholder slides in from right
// 1.0s  CTA button slides in from left
// 1.2s  card 1 slides up
// 1.4s  card 2 slides up
// 1.6s  card 3 slides up
// 1.8s  footer slides in
// 2.2s  ★ LAUNCH — green dot + pulse rings
// 3.5s  hold
// 3.8s  everything fades out
// 4.3s  gone → pause until 7s restart

const OUT = 3.8;

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

            {/* ━━━ Main browser mockup (left side, hidden on mobile) ━━━ */}
            <div className="hidden md:block">
                {/* Browser frame */}
                <motion.div
                    animate={{
                        ...fade(0.2, OUT, 1),
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

                    {/* Page wireframe content */}
                    <div className="p-3 space-y-2">
                        {/* Nav bar with logo + links */}
                        <motion.div
                            animate={slideIn(0.4, OUT, 'left', 30)}
                            transition={loop}
                            className="flex items-center gap-2"
                        >
                            <div className="w-5 h-5 rounded bg-red-400/70" />
                            <div className="flex-1" />
                            <div className="w-8 h-2 rounded bg-slate-300/70" />
                            <div className="w-8 h-2 rounded bg-slate-300/70" />
                            <div className="w-8 h-2 rounded bg-slate-300/70" />
                        </motion.div>

                        {/* Hero section — heading + image side by side */}
                        <motion.div
                            animate={slideIn(0.6, OUT, 'left', 25)}
                            transition={loop}
                            className="flex gap-2 items-start"
                        >
                            {/* Text side */}
                            <div className="flex-1 space-y-1.5 pt-1">
                                <div className="h-3 rounded bg-slate-800/25 w-full" />
                                <div className="h-3 rounded bg-slate-800/20 w-4/5" />
                                <div className="h-2 rounded bg-slate-400/30 w-full mt-1" />
                                <div className="h-2 rounded bg-slate-400/30 w-3/4" />
                            </div>
                            {/* Image placeholder */}
                            <motion.div
                                animate={slideIn(0.8, OUT, 'right', 20)}
                                transition={loop}
                                className="w-20 h-16 rounded-lg bg-slate-200/80 border border-slate-300/50 flex items-center justify-center shrink-0"
                            >
                                <svg className="w-6 h-6 text-slate-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                                </svg>
                            </motion.div>
                        </motion.div>

                        {/* CTA button */}
                        <motion.div
                            animate={slideIn(1.0, OUT, 'left', 15)}
                            transition={loop}
                        >
                            <div className="w-20 h-5 rounded-full bg-red-400/60" />
                        </motion.div>

                        {/* Feature cards row */}
                        <div className="flex gap-1.5 pt-1">
                            <motion.div
                                animate={slideIn(1.2, OUT, 'bottom', 15)}
                                transition={loop}
                                className="flex-1 h-12 rounded-lg bg-slate-100/80 border border-slate-200/60 p-1.5"
                            >
                                <div className="w-4 h-4 rounded bg-red-300/50 mb-1" />
                                <div className="h-1.5 rounded bg-slate-300/60 w-3/4" />
                            </motion.div>
                            <motion.div
                                animate={slideIn(1.4, OUT, 'bottom', 15)}
                                transition={loop}
                                className="flex-1 h-12 rounded-lg bg-slate-100/80 border border-slate-200/60 p-1.5"
                            >
                                <div className="w-4 h-4 rounded bg-amber-300/50 mb-1" />
                                <div className="h-1.5 rounded bg-slate-300/60 w-3/4" />
                            </motion.div>
                            <motion.div
                                animate={slideIn(1.6, OUT, 'bottom', 15)}
                                transition={loop}
                                className="flex-1 h-12 rounded-lg bg-slate-100/80 border border-slate-200/60 p-1.5"
                            >
                                <div className="w-4 h-4 rounded bg-emerald-300/50 mb-1" />
                                <div className="h-1.5 rounded bg-slate-300/60 w-3/4" />
                            </motion.div>
                        </div>

                        {/* Footer */}
                        <motion.div
                            animate={slideIn(1.8, OUT, 'bottom', 10)}
                            transition={loop}
                            className="h-3 rounded bg-slate-200/60 w-full"
                        />
                    </div>
                </motion.div>

                {/* ★ LAUNCH — green "live" dot on browser chrome */}
                <motion.div
                    animate={{
                        ...fade(2.2, OUT, 1),
                        scale: [0, 0, 1.2, 1, 1, 0] as number[],
                    }}
                    transition={loop}
                    className="absolute top-[12%] left-[5%] lg:left-[8%] z-20"
                >
                    <div
                        className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_3px_rgba(52,211,153,0.6)]"
                        style={{ marginLeft: 270, marginTop: 10 }}
                    />
                </motion.div>

                {/* Launch pulse ring 1 — centered on the green dot */}
                <motion.div
                    animate={{
                        opacity: [0, 0, 0.9, 0, 0],
                        scale: [0.3, 0.3, 1, 3, 3],
                    }}
                    transition={{ ...loop, times: [0, 2.1 / D, 2.3 / D, 3.2 / D, 1] }}
                    className="absolute top-[12%] left-[5%] lg:left-[8%] z-10"
                    style={{ marginLeft: 260, marginTop: -1 }}
                >
                    <div className="w-8 h-8 rounded-full border-2 border-emerald-400/80" />
                </motion.div>

                {/* Launch pulse ring 2 (delayed, wider) */}
                <motion.div
                    animate={{
                        opacity: [0, 0, 0.6, 0, 0],
                        scale: [0.3, 0.3, 1, 4, 4],
                    }}
                    transition={{ ...loop, times: [0, 2.3 / D, 2.5 / D, 3.5 / D, 1] }}
                    className="absolute top-[12%] left-[5%] lg:left-[8%] z-10"
                    style={{ marginLeft: 260, marginTop: -1 }}
                >
                    <div className="w-8 h-8 rounded-full border border-emerald-400/50" />
                </motion.div>

                {/* Browser glow on launch */}
                <motion.div
                    animate={{
                        opacity: [0, 0, 0.15, 0, 0],
                    }}
                    transition={{ ...loop, times: [0, 2.2 / D, 2.5 / D, 3.3 / D, 1] }}
                    className="absolute top-[12%] left-[5%] lg:left-[8%] w-72 lg:w-80 h-64 rounded-xl bg-emerald-400 z-[9] blur-xl"
                />
            </div>

            {/* ━━━ Right side — floating component card (hidden on mobile) ━━━ */}
            <div className="hidden md:block">
                <motion.div
                    animate={{
                        ...fade(0.8, OUT, 0.9),
                        y: [20, 20, 0, 0, 10, 20] as number[],
                    }}
                    transition={loop}
                    className="absolute top-[28%] right-[6%] lg:right-[10%] w-48 lg:w-52 rounded-xl border border-red-300/60 bg-white/40 backdrop-blur-sm overflow-hidden z-10 shadow-md"
                >
                    <div className="p-3 space-y-2">
                        {/* Card header */}
                        <motion.div
                            animate={slideIn(1.0, OUT, 'right', 20)}
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
                            animate={slideIn(1.3, OUT, 'right', 15)}
                            transition={loop}
                            className="h-14 rounded-lg bg-slate-200/70 border border-slate-300/40"
                        />
                        {/* Text lines */}
                        <motion.div
                            animate={slideIn(1.5, OUT, 'right', 15)}
                            transition={loop}
                            className="space-y-1"
                        >
                            <div className="h-2 rounded bg-slate-300/60 w-full" />
                            <div className="h-2 rounded bg-slate-300/50 w-2/3" />
                        </motion.div>
                        {/* CTA button */}
                        <motion.div
                            animate={slideIn(1.7, OUT, 'right', 10)}
                            transition={loop}
                        >
                            <div className="h-6 rounded-full bg-red-400/50 w-3/5" />
                        </motion.div>
                    </div>
                </motion.div>

                {/* ── Small floating phone outline (bottom right) ──── */}
                <motion.div
                    animate={{
                        ...fade(1.4, OUT, 0.7),
                        y: [15, 15, 0, 0, 8, 15] as number[],
                    }}
                    transition={loop}
                    className="absolute bottom-[18%] right-[18%] lg:right-[22%] w-20 h-36 rounded-xl border-2 border-slate-300/60 bg-white/30 overflow-hidden z-10"
                >
                    {/* Phone notch */}
                    <div className="mx-auto mt-1 w-8 h-1.5 rounded-full bg-slate-300/60" />
                    <div className="p-1.5 mt-1 space-y-1">
                        <motion.div animate={slideIn(1.7, OUT, 'bottom', 8, 0.8)} transition={loop} className="h-1.5 rounded bg-red-300/60 w-full" />
                        <motion.div animate={slideIn(1.9, OUT, 'bottom', 8, 0.8)} transition={loop} className="h-4 rounded bg-slate-200/60 w-full" />
                        <motion.div animate={slideIn(2.0, OUT, 'bottom', 8, 0.8)} transition={loop} className="h-1 rounded bg-slate-300/50 w-3/4" />
                        <motion.div animate={slideIn(2.1, OUT, 'bottom', 8, 0.8)} transition={loop} className="flex gap-0.5">
                            <div className="flex-1 h-3 rounded bg-slate-200/50" />
                            <div className="flex-1 h-3 rounded bg-slate-200/50" />
                        </motion.div>
                    </div>
                </motion.div>
            </div>

            {/* ━━━ Mobile version — simpler, centered ━━━ */}
            <div className="block md:hidden">
                {/* Single centered browser outline */}
                <motion.div
                    animate={{
                        ...fade(0.2, OUT, 0.6),
                        y: [10, 10, 0, 0, 5, 10] as number[],
                    }}
                    transition={loop}
                    className="absolute top-[8%] left-1/2 -translate-x-1/2 w-56 rounded-xl border border-slate-300/50 bg-white/30 overflow-hidden z-10 shadow-sm"
                >
                    {/* Chrome */}
                    <div className="flex items-center gap-1 px-2 h-6 border-b border-slate-200/40 bg-white/40 shrink-0">
                        <div className="w-2 h-2 rounded-full bg-red-400/60" />
                        <div className="w-2 h-2 rounded-full bg-amber-300/40" />
                        <div className="w-2 h-2 rounded-full bg-green-300/40" />
                        <div className="flex-1 mx-1.5 h-2 rounded bg-slate-200/50" />
                    </div>
                    <div className="p-2 space-y-1.5">
                        <motion.div animate={slideIn(0.4, OUT, 'left', 15, 0.8)} transition={loop} className="h-2.5 rounded bg-red-300/50 w-full" />
                        <motion.div animate={slideIn(0.6, OUT, 'left', 15, 0.8)} transition={loop} className="h-6 rounded bg-slate-200/50 w-full" />
                        <motion.div animate={slideIn(0.8, OUT, 'left', 10, 0.8)} transition={loop}>
                            <div className="w-14 h-3.5 rounded-full bg-red-400/50" />
                        </motion.div>
                        <div className="flex gap-1">
                            <motion.div animate={slideIn(1.0, OUT, 'bottom', 10, 0.8)} transition={loop} className="flex-1 h-6 rounded bg-slate-100/70 border border-slate-200/40" />
                            <motion.div animate={slideIn(1.2, OUT, 'bottom', 10, 0.8)} transition={loop} className="flex-1 h-6 rounded bg-slate-100/70 border border-slate-200/40" />
                        </div>
                    </div>
                </motion.div>

                {/* Mobile launch dot */}
                <motion.div
                    animate={{
                        ...fade(2.0, OUT, 1),
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
                    animate={{
                        opacity: [0, 0, 0.7, 0, 0],
                        scale: [0.3, 0.3, 1, 2.5, 2.5],
                    }}
                    transition={{ ...loop, times: [0, 1.9 / D, 2.1 / D, 3.0 / D, 1] }}
                    className="absolute top-[8%] left-1/2 z-10"
                    style={{ marginLeft: 88, marginTop: 1 }}
                >
                    <div className="w-6 h-6 rounded-full border-2 border-emerald-400/70" />
                </motion.div>
            </div>
        </div>
    );
}
