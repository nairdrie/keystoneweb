'use client';

import { motion } from 'framer-motion';

export default function EditorLoadingScreen() {
    // Precise SVG coordinates spanning an arch with inner radius 30 and outer radius 70.
    // Center at (100, 90). The pillars extend straight down to y=170.
    // We calculate proper trapezoidal angles (180 to 144, 144 to 108, 108 to 72, 72 to 36, 36 to 0) 
    // to ensure they fit together with zero gaps.
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
                {/* Perfect fitted SVG Archway Container */}
                <svg viewBox="0 0 200 200" className="w-64 h-64 relative mb-12 overflow-visible drop-shadow-2xl">
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
                        // Delay mapping.
                        // We want base first, then middle, then lower curves, upper curves, then keystone.
                        // Order of drawing matching pairs: 0&1, 2&3, 4&5, 6&7, 8 (keystone)
                        const step = Math.floor(index / 2);
                        const delay = stone.isKeystone ? 1.0 : step * 0.15;

                        return (
                            <motion.polygon
                                key={index}
                                points={stone.points}
                                // Start at scale 0, no translating, no opacity fade
                                initial={{ scale: 0 }}
                                // Pop slightly larger, then settle to a scaled-down size for true transparent gaps
                                animate={{ scale: 0.85 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 20,
                                    mass: 1.5,
                                    delay: delay,
                                }}
                                // Scale relative to the exact center of this specific polygon shape
                                style={{ transformOrigin: `${stone.cx}px ${stone.cy}px` }}
                                fill="url(#stoneGrad)"
                                // We use a thick stroke of the SAME gradient to create rounded corners,
                                // while the scale reduction creates the true transparent gaps underneath!
                                stroke="url(#stoneGrad)"
                                strokeWidth="4"
                                strokeLinejoin="round"
                            />
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}
