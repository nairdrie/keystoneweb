'use client';

import { useState, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AI_BUILDING_MESSAGES = [
    "AI is building your site...",
    "Laying the foundation...",
    "Picking the perfect layout...",
    "Choosing colors that pop...",
    "Writing copy that converts...",
    "Arranging sections just right...",
    "Adding the finishing touches...",
    "Polishing every pixel...",
    "Making it look professional...",
    "Almost there, hang tight...",
];

// How long each message displays before cycling
const MESSAGE_CYCLE_MS = 5000;

// Brand coral from the logo mark, and a pale tint of it for the empty stone.
const CORAL = '#ff5f5f';
const PALE = '#ffd9d9';

// The logo's keystone: a rounded trapezoid, wide at the top.
const KEYSTONE_PATH =
    'M 62 30 Q 60 18 72 18 L 128 18 Q 140 18 138 30 L 124 128 Q 122 140 110 140 L 90 140 Q 78 140 76 128 Z';

// Two full wave periods (120 units each) so the surface can scroll
// sideways forever without a seam inside the keystone (x 60–140).
const WAVE_PATH = 'M 40 0 Q 70 -8 100 0 T 160 0 T 220 0 T 280 0 V 200 H 40 Z';

const KEYFRAMES = `
.ks-loader-fill { animation: ks-loader-rise 2.6s cubic-bezier(.45,0,.55,1) infinite; }
.ks-loader-wave { animation: ks-loader-wave 1.1s linear infinite; }
@keyframes ks-loader-rise {
    0% { transform: translateY(150px); opacity: 1 }
    70%, 82% { transform: translateY(8px); opacity: 1 }
    96%, 100% { transform: translateY(8px); opacity: 0 }
}
@keyframes ks-loader-wave { from { transform: translateX(0) } to { transform: translateX(-120px) } }
@media (prefers-reduced-motion: reduce) {
    .ks-loader-fill { animation: ks-loader-pulse 2s ease-in-out infinite; transform: translateY(70px); }
    .ks-loader-wave { animation: none; }
    @keyframes ks-loader-pulse { 50% { opacity: .55 } }
}
`;

interface Props {
    message?: string;
    /**
     * Live progress message from the orchestrator. When provided, it pins
     * the displayed text (no rotation) so the user sees real-time feedback
     * like "Writing the About page…" instead of the generic loop.
     */
    liveMessage?: string | null;
    /**
     * 'fullscreen' (default): occupies the entire viewport (min-h-screen).
     * 'fill': fills the parent container — used when the loader is shown in
     * place of the editor preview while the AI builder is still running on
     * the left sidebar.
     */
    variant?: 'fullscreen' | 'fill';
}

export default function EditorLoadingScreen({ message, liveMessage, variant = 'fullscreen' }: Props = {}) {
    const isAiBuilding = !!message; // if a message is passed, we're in AI building mode
    const [messageIndex, setMessageIndex] = useState(0);
    const clipId = `ks-loader-clip-${useId().replace(/:/g, '')}`;

    // Cycle through generic messages only when there's no live progress.
    useEffect(() => {
        if (!isAiBuilding || liveMessage) return;
        const interval = setInterval(() => {
            setMessageIndex((prev: number) => (prev + 1) % AI_BUILDING_MESSAGES.length);
        }, MESSAGE_CYCLE_MS);
        return () => clearInterval(interval);
    }, [isAiBuilding, liveMessage]);

    const displayMessage = liveMessage
        ? liveMessage
        : isAiBuilding
            ? AI_BUILDING_MESSAGES[messageIndex]
            : message;

    // 'fill' uses absolute positioning so it spans the nearest positioned
    // ancestor (the editor's relative scroll container) instead of the
    // viewport — no white gap below if the inner wrapper has no explicit height.
    const sizingClass = variant === 'fill'
        ? 'absolute inset-0'
        : 'w-full min-h-screen';

    return (
        <div
            role="status"
            aria-label={displayMessage || 'Loading'}
            className={`${sizingClass} flex flex-col items-center justify-center bg-slate-50 overflow-hidden`}
        >
            <style>{KEYFRAMES}</style>

            {/* The logo keystone, filling up with a gentle wave */}
            <svg viewBox="50 10 100 140" className="w-14 h-20 overflow-visible" aria-hidden="true">
                <defs>
                    <clipPath id={clipId}>
                        <path d={KEYSTONE_PATH} />
                    </clipPath>
                </defs>
                <path d={KEYSTONE_PATH} fill={PALE} />
                <g clipPath={`url(#${clipId})`}>
                    <g className="ks-loader-fill">
                        <path d={WAVE_PATH} fill={CORAL} className="ks-loader-wave" />
                    </g>
                </g>
            </svg>

            {/* Status message with crossfade (AI builds / live progress only) */}
            <div className="h-6 mt-6 flex items-center justify-center">
                <AnimatePresence mode="wait">
                    {displayMessage && (
                        <motion.p
                            key={displayMessage}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.35 }}
                            className="text-slate-500 text-sm font-medium text-center px-6"
                        >
                            {displayMessage}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
