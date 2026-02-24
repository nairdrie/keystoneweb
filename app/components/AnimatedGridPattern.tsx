'use client';

import { motion } from 'framer-motion';

export default function AnimatedGridPattern() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Soft gradient background overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-transparent to-white/90 z-20" />

            {/* Grid Pattern */}
            <div className="absolute inset-0 opacity-[0.15]">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                    <defs>
                        <pattern
                            id="grid"
                            width="60"
                            height="60"
                            patternUnits="userSpaceOnUse"
                        >
                            <path
                                d="M 60 0 L 0 0 0 60"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1"
                                className="text-slate-900"
                            />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>

            {/* Floating Animated Geometric Nodes (Subtle Web Building Vibe) */}
            <motion.div
                animate={{
                    y: [0, -30, 0],
                    rotate: [0, 45, 0],
                    opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                    duration: 12,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
                className="absolute top-[20%] left-[15%] w-64 h-64 border-2 border-red-200 rounded-2xl bg-gradient-to-tr from-red-50 to-transparent z-10"
            />

            <motion.div
                animate={{
                    y: [0, 40, 0],
                    x: [0, -20, 0],
                    rotate: [0, -30, 0],
                    opacity: [0.2, 0.5, 0.2],
                }}
                transition={{
                    duration: 15,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 2,
                }}
                className="absolute bottom-[20%] right-[10%] w-96 h-96 border-2 border-slate-200 rounded-full bg-gradient-to-bl from-slate-50 to-transparent z-10"
            />

            <motion.div
                animate={{
                    y: [0, -20, 0],
                    x: [0, 30, 0],
                    scale: [1, 1.1, 1],
                    opacity: [0.15, 0.3, 0.15],
                }}
                transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 5,
                }}
                className="absolute top-[40%] right-[30%] w-48 h-48 border-2 border-red-100 rotate-12 bg-white z-10 shadow-xl"
            />
        </div>
    );
}
