'use client';

import { useState, useEffect } from 'react';
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
// How long the arch animation takes to fully build (last stone delay + spring settle)
const ARCH_ANIM_DURATION_MS = 2200;
// Interval at which the arch replays
const ARCH_REPLAY_MS = 5500;

export default function EditorLoadingScreen({ message }: { message?: string } = {}) {
    const isAiBuilding = !!message; // if a message is passed, we're in AI building mode
    const [messageIndex, setMessageIndex] = useState(0);
    const [archKey, setArchKey] = useState(0); // changing key forces re-mount → replays animation

    // Cycle through building messages
    useEffect(() => {
        if (!isAiBuilding) return;
        const interval = setInterval(() => {
            setMessageIndex((prev: number) => (prev + 1) % AI_BUILDING_MESSAGES.length);
        }, MESSAGE_CYCLE_MS);
        return () => clearInterval(interval);
    }, [isAiBuilding]);

    // Replay arch animation periodically
    useEffect(() => {
        if (!isAiBuilding) return;
        const interval = setInterval(() => {
            setArchKey((prev: number) => prev + 1);
        }, ARCH_REPLAY_MS);
        return () => clearInterval(interval);
    }, [isAiBuilding]);

    const displayMessage = isAiBuilding ? AI_BUILDING_MESSAGES[messageIndex] : message;

    // Precise SVG coordinates spanning an arch with inner radius 30 and outer radius 70.
    // Center at (100, 90). The pillars extend straight down to y=170.
    const archStones = [
        // L1 (Base 1)
        { points: "25,168 25,128 65,128 65,168", cx: 45, cy: 148, isKeystone: false },
        // R1 (Base 1)
        { points: "135,168 135,128 175,128 175,168", cx: 155, cy: 148, isKeystone: false },
        // L2 (Base 2)
        { points: "25,126 25,90 65,90 65,126", cx: 45, cy: 108, isKeystone: false },
        // R2 (Base 2)
        { points: "135,126 135,90 175,90 175,126", cx: 155, cy: 108, isKeystone: false },

        // L3 (Lower Curve)
        { points: "25,88 38.5,49.5 72,71.5 65,88", cx: 50, cy: 74, isKeystone: false },

        // R3 (Lower Curve)
        { points: "161.5,49.5 175,88 135,88 128,71.5", cx: 150, cy: 74, isKeystone: false },

        // L4 (Upper Curve)
        { points: "41.5,46.5 75,22 88.5,59.5 73.5,69", cx: 69.6, cy: 49.2, isKeystone: false },

        // R4 (Upper Curve)
        { points: "125,22 158.5,46.5 126.5,69 111.5,59.5", cx: 130.4, cy: 49.2, isKeystone: false },

        // Keystone (Top Center)
        { points: "78.5,21 121.5,21 108.5,58 91.5,58", cx: 100, cy: 39.5, isKeystone: true },
    ];

    return (
        <div className="w-full min-h-screen flex flex-col items-center justify-center bg-red-600 relative overflow-hidden">
            {/* Background glow behind arch */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500 rounded-full blur-[100px] opacity-50 pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center">
                {/* Perfect fitted SVG Archway Container — key change forces re-mount to replay animation */}
                <svg key={archKey} viewBox="0 0 200 200" className="w-64 h-64 relative mb-12 overflow-visible drop-shadow-2xl">
                    <defs>
                        <linearGradient id="stoneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#ffffff" />
                            <stop offset="100%" stopColor="#f8fafc" />
                        </linearGradient>
                        <linearGradient id="keystoneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#ffffff" />
                            <stop offset="100%" stopColor="#fef3c7" />
                        </linearGradient>
                    </defs>

                    {archStones.map((stone, index) => {
                        const step = Math.floor(index / 2);
                        const delay = stone.isKeystone ? 1.0 : step * 0.15;

                        return (
                            <motion.polygon
                                key={index}
                                points={stone.points}
                                initial={{ scale: 0 }}
                                animate={{ scale: 0.85 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 20,
                                    mass: 1.5,
                                    delay: delay,
                                }}
                                style={{ transformOrigin: `${stone.cx}px ${stone.cy}px` }}
                                fill="url(#stoneGrad)"
                                stroke="url(#stoneGrad)"
                                strokeWidth="4"
                                strokeLinejoin="round"
                            />
                        );
                    })}
                </svg>

                {/* Cycling status message with crossfade */}
                <div className="h-8 flex items-center justify-center">
                    <AnimatePresence mode="wait">
                        {displayMessage && (
                            <motion.p
                                key={displayMessage}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.4 }}
                                className="text-white/90 text-lg font-semibold text-center"
                            >
                                {displayMessage}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5, duration: 1 }}
                    className="flex justify-center items-center gap-2 mt-4"
                >
                    <span className="w-2.5 h-2.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: "300ms" }} />
                </motion.div>
            </div>
        </div>
    );
}
