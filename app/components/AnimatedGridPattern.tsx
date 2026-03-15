'use client';

import { motion } from 'framer-motion';

const D = 12; // loop duration in seconds

// Keyframe helper: element is invisible, fades in at `inAt`, holds until `outAt`, fades out
function fade(inAt: number, outAt: number, peak = 1) {
    const i0 = Math.max(0, inAt - 0.4) / D;
    const i1 = inAt / D;
    const o0 = outAt / D;
    const o1 = Math.min(D, outAt + 0.5) / D;
    return {
        opacity: [0, 0, peak, peak, 0, 0] as number[],
        times: [0, i0, i1, o0, o1, 1] as number[],
    };
}

// For elements that also grow in on the X axis (draw-in effect)
function drawIn(inAt: number, outAt: number, peak = 1) {
    const i0 = Math.max(0, inAt - 0.35) / D;
    const i1 = inAt / D;
    const o0 = outAt / D;
    const o1 = Math.min(D, outAt + 0.5) / D;
    return {
        opacity: [0, 0, peak, peak, 0, 0] as number[],
        scaleX: [0, 0, 1, 1, 0.6, 0] as number[],
        times: [0, i0, i1, o0, o1, 1] as number[],
    };
}

const loop = { duration: D, repeat: Infinity, ease: 'easeInOut' as const };

// Timeline (seconds):
// 0.4  – browser frame fades in
// 0.9  – nav bar draws in
// 1.3  – hero block draws in
// 1.7  – card 1 draws in
// 2.0  – card 2 draws in
// 2.3  – card 3 draws in
// 2.6  – footer bar draws in
// 3.2  – green "live" dot + pulse ring
// 6.0  – everything fades out
// 6.5  – gone → silent until 12s loop restart

const OUT = 6.0;

export default function AnimatedGridPattern() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
            {/* Gradient overlays — keeps text legible */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-white/50 z-20" />
            <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-transparent to-white/30 z-20" />

            {/* Subtle grid texture */}
            <div className="absolute inset-0 opacity-[0.10]">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                    <defs>
                        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-900" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>

            {/* ── Main browser mockup (left) ─────────────────────── */}
            <motion.div
                animate={fade(0.4, OUT, 0.9)}
                transition={loop}
                className="absolute top-[14%] left-[7%] w-64 rounded-xl border border-slate-300/60 bg-white/30 backdrop-blur-sm overflow-hidden z-10 shadow-sm"
            >
                {/* Browser chrome */}
                <div className="flex items-center gap-1.5 px-3 h-7 border-b border-slate-200/50 bg-white/40 shrink-0">
                    <div className="w-2 h-2 rounded-full bg-red-300/80" />
                    <div className="w-2 h-2 rounded-full bg-slate-300/50" />
                    <div className="w-2 h-2 rounded-full bg-slate-300/50" />
                    <div className="flex-1 mx-2 h-2.5 rounded bg-slate-200/60" />
                </div>

                {/* Page wireframe */}
                <div className="p-2.5 space-y-1.5">
                    {/* Nav */}
                    <motion.div
                        animate={drawIn(0.9, OUT)}
                        transition={loop}
                        style={{ originX: 0 }}
                        className="h-3 rounded bg-red-300/50 w-full"
                    />
                    {/* Hero block */}
                    <motion.div
                        animate={drawIn(1.3, OUT)}
                        transition={loop}
                        style={{ originX: 0 }}
                        className="h-10 rounded bg-slate-200/60 w-full"
                    />
                    {/* Cards row */}
                    <div className="flex gap-1.5">
                        <motion.div
                            animate={drawIn(1.7, OUT)}
                            transition={loop}
                            style={{ originX: 0 }}
                            className="h-6 rounded bg-slate-200/50 flex-1"
                        />
                        <motion.div
                            animate={drawIn(2.0, OUT)}
                            transition={loop}
                            style={{ originX: 0 }}
                            className="h-6 rounded bg-slate-200/50 flex-1"
                        />
                        <motion.div
                            animate={drawIn(2.3, OUT)}
                            transition={loop}
                            style={{ originX: 0 }}
                            className="h-6 rounded bg-slate-200/50 flex-1"
                        />
                    </div>
                    {/* Footer bar */}
                    <motion.div
                        animate={drawIn(2.6, OUT)}
                        transition={loop}
                        style={{ originX: 0 }}
                        className="h-2.5 rounded bg-slate-100/70 w-full"
                    />
                </div>
            </motion.div>

            {/* "Live" green dot on the browser */}
            <motion.div
                animate={fade(3.2, OUT, 1)}
                transition={loop}
                className="absolute top-[14%] left-[7%] z-20 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]"
                style={{ marginLeft: 242, marginTop: 8 }}
            />

            {/* Launch pulse ring */}
            <motion.div
                animate={{
                    opacity: [0, 0, 0.8, 0, 0],
                    scale: [0.6, 0.6, 1, 2.2, 2.2],
                    times: [0, 3.1 / D, 3.3 / D, 5.0 / D, 1],
                }}
                transition={loop}
                className="absolute top-[14%] left-[7%] z-10 w-10 h-10 rounded-full border-2 border-emerald-400/70"
                style={{ marginLeft: 237, marginTop: 3 }}
            />

            {/* ── Right side card component ──────────────────────── */}
            <motion.div
                animate={fade(1.5, OUT, 0.75)}
                transition={loop}
                className="absolute top-[32%] right-[9%] w-44 rounded-xl border border-red-200/50 bg-white/20 overflow-hidden z-10 shadow-sm"
            >
                <div className="p-3 space-y-1.5">
                    <motion.div
                        animate={drawIn(1.9, OUT, 0.9)}
                        transition={loop}
                        style={{ originX: 0 }}
                        className="h-2.5 rounded bg-red-300/50 w-2/3"
                    />
                    <motion.div
                        animate={drawIn(2.2, OUT, 0.9)}
                        transition={loop}
                        style={{ originX: 0 }}
                        className="h-8 rounded bg-slate-200/50 w-full"
                    />
                    <motion.div
                        animate={drawIn(2.5, OUT, 0.9)}
                        transition={loop}
                        style={{ originX: 0 }}
                        className="h-2.5 rounded bg-slate-100/60 w-4/5"
                    />
                    {/* CTA button shape */}
                    <motion.div
                        animate={drawIn(2.8, OUT, 0.9)}
                        transition={loop}
                        style={{ originX: 0 }}
                        className="h-5 rounded-full bg-red-300/50 w-1/2"
                    />
                </div>
            </motion.div>

            {/* ── Tiny floating nav element (bottom-left area) ───── */}
            <motion.div
                animate={fade(2.2, OUT, 0.5)}
                transition={loop}
                className="absolute bottom-[22%] left-[22%] z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200/50 bg-white/15"
            >
                <motion.div
                    animate={drawIn(2.5, OUT, 0.7)}
                    transition={loop}
                    style={{ originX: 0 }}
                    className="w-12 h-2 rounded bg-slate-300/50"
                />
                <motion.div
                    animate={drawIn(2.7, OUT, 0.7)}
                    transition={loop}
                    style={{ originX: 0 }}
                    className="w-8 h-2 rounded bg-slate-300/40"
                />
                <motion.div
                    animate={drawIn(2.9, OUT, 0.7)}
                    transition={loop}
                    style={{ originX: 0 }}
                    className="w-8 h-2 rounded bg-slate-300/40"
                />
                <motion.div
                    animate={drawIn(3.1, OUT, 0.7)}
                    transition={loop}
                    style={{ originX: 0 }}
                    className="w-10 h-4 rounded-full bg-red-300/50 ml-2"
                />
            </motion.div>
        </div>
    );
}
