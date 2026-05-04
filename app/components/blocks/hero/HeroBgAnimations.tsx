'use client';

/**
 * Background animations for the Hero block. Each animation is a small
 * presentational component that fills its parent (`absolute inset-0`),
 * uses the palette CSS variables (`--primary`, `--secondary`, `--accent`)
 * already published by BlockWrapper, and respects `prefers-reduced-motion`
 * via `motion-reduce:` Tailwind variants where possible.
 *
 * Usage:
 *   const Anim = HERO_BG_ANIMATIONS[id]?.Component;
 *   if (Anim) <Anim />
 */

import { CSSProperties } from 'react';

export type HeroBgAnimationId =
    | 'aurora'
    | 'meshGradient'
    | 'geometricDrift'
    | 'diagonalStripes'
    | 'particleField'
    | 'sineWaves'
    | 'noiseGrain'
    | 'bokehOrbs'
    | 'gridPulse'
    | 'sunburstRays';

export interface HeroBgAnimationMeta {
    id: HeroBgAnimationId;
    label: string;
    description: string;
}

export const HERO_BG_ANIMATION_LIST: HeroBgAnimationMeta[] = [
    { id: 'aurora', label: 'Aurora', description: 'Soft drifting ribbons of color.' },
    { id: 'meshGradient', label: 'Mesh Gradient', description: 'Three radial gradients drifting.' },
    { id: 'geometricDrift', label: 'Geometric Drift', description: 'Translucent shapes floating slowly.' },
    { id: 'diagonalStripes', label: 'Diagonal Stripes', description: 'Animated diagonal stripes.' },
    { id: 'particleField', label: 'Particle Field', description: 'Soft drifting points of light.' },
    { id: 'sineWaves', label: 'Sine Waves', description: 'Layered SVG wave loops.' },
    { id: 'noiseGrain', label: 'Noise Grain', description: 'Animated film-grain overlay.' },
    { id: 'bokehOrbs', label: 'Bokeh Orbs', description: 'Glowing soft circles drifting.' },
    { id: 'gridPulse', label: 'Grid Pulse', description: 'Pulsing line grid.' },
    { id: 'sunburstRays', label: 'Sunburst Rays', description: 'Slow rotating conic rays.' },
];

const KEYFRAMES = `
@keyframes ksAuroraDrift { 0%,100% { transform: translate3d(-10%, 0, 0) rotate(-6deg); } 50% { transform: translate3d(10%, -4%, 0) rotate(2deg); } }
@keyframes ksAuroraDrift2 { 0%,100% { transform: translate3d(8%, 6%, 0) rotate(4deg); } 50% { transform: translate3d(-6%, -2%, 0) rotate(-3deg); } }
@keyframes ksMeshA { 0%,100% { transform: translate(0%, 0%); } 50% { transform: translate(15%, -10%); } }
@keyframes ksMeshB { 0%,100% { transform: translate(0%, 0%); } 50% { transform: translate(-12%, 14%); } }
@keyframes ksMeshC { 0%,100% { transform: translate(0%, 0%); } 50% { transform: translate(10%, 18%); } }
@keyframes ksGeoFloat { 0% { transform: translate3d(0, 0, 0) rotate(0); } 100% { transform: translate3d(0, -30px, 0) rotate(180deg); } }
@keyframes ksStripes { from { background-position: 0 0; } to { background-position: 64px 64px; } }
@keyframes ksParticle { 0% { transform: translate3d(0, 0, 0); opacity: 0; } 10%,90% { opacity: 1; } 100% { transform: translate3d(0, -120px, 0); opacity: 0; } }
@keyframes ksWave { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes ksGrain { 0% { transform: translate(0, 0); } 25% { transform: translate(-5%, -10%); } 50% { transform: translate(7%, 3%); } 75% { transform: translate(-3%, 8%); } 100% { transform: translate(0, 0); } }
@keyframes ksOrb { 0%,100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(20px, -15px) scale(1.05); } }
@keyframes ksGridPulse { 0%,100% { opacity: .25; } 50% { opacity: .55; } }
@keyframes ksRays { from { transform: rotate(0); } to { transform: rotate(360deg); } }
`;

function Keyframes() {
    return <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />;
}

function Aurora() {
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
            <Keyframes />
            <div
                className="absolute -inset-[20%] motion-reduce:!animate-none"
                style={{
                    background: 'radial-gradient(60% 40% at 30% 50%, color-mix(in srgb, var(--secondary, #ec4899) 80%, transparent), transparent 70%)',
                    filter: 'blur(60px)',
                    animation: 'ksAuroraDrift 18s ease-in-out infinite',
                }}
            />
            <div
                className="absolute -inset-[20%] motion-reduce:!animate-none"
                style={{
                    background: 'radial-gradient(50% 35% at 70% 60%, color-mix(in srgb, var(--primary, #6366f1) 80%, transparent), transparent 70%)',
                    filter: 'blur(70px)',
                    animation: 'ksAuroraDrift2 22s ease-in-out infinite',
                }}
            />
            <div
                className="absolute -inset-[20%] motion-reduce:!animate-none"
                style={{
                    background: 'radial-gradient(40% 30% at 50% 30%, color-mix(in srgb, var(--accent, #f1f5f9) 60%, transparent), transparent 70%)',
                    filter: 'blur(50px)',
                    animation: 'ksAuroraDrift 26s ease-in-out infinite reverse',
                }}
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(8,8,30,.55), rgba(8,8,30,.2))' }} />
        </div>
    );
}

function MeshGradient() {
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: 'var(--primary, #1e293b)' }}>
            <Keyframes />
            <div className="absolute inset-0 motion-reduce:!animate-none" style={{ background: 'radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--secondary, #ec4899) 70%, transparent), transparent 50%)', animation: 'ksMeshA 14s ease-in-out infinite' }} />
            <div className="absolute inset-0 motion-reduce:!animate-none" style={{ background: 'radial-gradient(circle at 80% 30%, color-mix(in srgb, var(--accent, #f1f5f9) 60%, transparent), transparent 55%)', animation: 'ksMeshB 18s ease-in-out infinite' }} />
            <div className="absolute inset-0 motion-reduce:!animate-none" style={{ background: 'radial-gradient(circle at 60% 80%, color-mix(in srgb, var(--primary, #6366f1) 90%, transparent), transparent 55%)', animation: 'ksMeshC 22s ease-in-out infinite' }} />
        </div>
    );
}

function GeometricDrift() {
    const shapes: { left: string; top: string; size: number; delay: string; duration: string; rotate: number; opacity: number }[] = [
        { left: '8%', top: '20%', size: 120, delay: '0s', duration: '14s', rotate: 30, opacity: 0.18 },
        { left: '70%', top: '12%', size: 80, delay: '2s', duration: '18s', rotate: 60, opacity: 0.22 },
        { left: '40%', top: '55%', size: 160, delay: '1s', duration: '20s', rotate: 90, opacity: 0.14 },
        { left: '85%', top: '70%', size: 100, delay: '3s', duration: '16s', rotate: 45, opacity: 0.2 },
        { left: '15%', top: '78%', size: 70, delay: '4s', duration: '12s', rotate: 0, opacity: 0.24 },
    ];
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: 'linear-gradient(135deg, var(--primary, #312e81), var(--secondary, #be185d))' }}>
            <Keyframes />
            {shapes.map((s, i) => (
                <div
                    key={i}
                    className="absolute motion-reduce:!animate-none"
                    style={{
                        left: s.left,
                        top: s.top,
                        width: s.size,
                        height: s.size,
                        background: 'color-mix(in srgb, var(--accent, #f8fafc) 55%, transparent)',
                        clipPath: i % 2 === 0
                            ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
                            : 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
                        opacity: s.opacity,
                        animation: `ksGeoFloat ${s.duration} linear ${s.delay} infinite alternate`,
                        transform: `rotate(${s.rotate}deg)`,
                    }}
                />
            ))}
        </div>
    );
}

function DiagonalStripes() {
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: 'var(--primary, #0f172a)' }}>
            <Keyframes />
            <div
                className="absolute inset-0 motion-reduce:!animate-none"
                style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, color-mix(in srgb, var(--secondary, #fbbf24) 24%, transparent) 0 24px, transparent 24px 64px)',
                    animation: 'ksStripes 6s linear infinite',
                }}
            />
        </div>
    );
}

function ParticleField() {
    const particles = Array.from({ length: 36 }, (_, i) => ({
        left: `${(i * 73) % 100}%`,
        size: 2 + (i % 4),
        delay: `${(i % 12) * 0.7}s`,
        duration: `${10 + (i % 8) * 1.5}s`,
    }));
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: 'radial-gradient(ellipse at center, var(--primary, #0c1326) 0%, #050810 100%)' }}>
            <Keyframes />
            {particles.map((p, i) => (
                <span
                    key={i}
                    className="absolute bottom-0 motion-reduce:!animate-none"
                    style={{
                        left: p.left,
                        width: p.size,
                        height: p.size,
                        borderRadius: '9999px',
                        background: 'color-mix(in srgb, var(--accent, #fafafa) 90%, transparent)',
                        boxShadow: '0 0 8px 2px color-mix(in srgb, var(--accent, #fafafa) 30%, transparent)',
                        animation: `ksParticle ${p.duration} linear ${p.delay} infinite`,
                    }}
                />
            ))}
        </div>
    );
}

function SineWaves() {
    const wavePath = 'M0,160 C320,260 640,60 960,160 C1280,260 1600,60 1920,160 L1920,320 L0,320 Z';
    const layers = [
        { color: 'var(--primary, #1e293b)', dur: 16, opacity: 1 },
        { color: 'var(--secondary, #38bdf8)', dur: 22, opacity: 0.7 },
        { color: 'var(--accent, #f1f5f9)', dur: 30, opacity: 0.5 },
    ];
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--primary, #0c4a6e) 95%, black), var(--primary, #0c4a6e))' }}>
            <Keyframes />
            {layers.map((l, i) => (
                <svg
                    key={i}
                    viewBox="0 0 1920 320"
                    preserveAspectRatio="none"
                    className="absolute left-0 right-0 motion-reduce:!animate-none"
                    style={{
                        bottom: `${i * 8}%`,
                        width: '200%',
                        height: '40%',
                        animation: `ksWave ${l.dur}s linear infinite`,
                        opacity: l.opacity,
                    }}
                >
                    <path d={wavePath} fill={l.color} />
                    <path d={wavePath} fill={l.color} transform="translate(1920 0)" />
                </svg>
            ))}
        </div>
    );
}

function NoiseGrain() {
    const noiseDataUri =
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.4 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: 'linear-gradient(135deg, var(--primary, #1f1b2e), var(--secondary, #6d28d9))' }}>
            <Keyframes />
            <div
                className="absolute -inset-1/4 motion-reduce:!animate-none"
                style={{
                    backgroundImage: noiseDataUri,
                    backgroundSize: '200px 200px',
                    mixBlendMode: 'overlay',
                    opacity: 0.5,
                    animation: 'ksGrain 1.4s steps(6) infinite',
                }}
            />
        </div>
    );
}

function BokehOrbs() {
    const orbs: { left: string; top: string; size: number; color: string; delay: string }[] = [
        { left: '12%', top: '18%', size: 220, color: 'var(--secondary, #f472b6)', delay: '0s' },
        { left: '70%', top: '10%', size: 180, color: 'var(--accent, #fbbf24)', delay: '1.2s' },
        { left: '55%', top: '60%', size: 260, color: 'var(--primary, #818cf8)', delay: '0.4s' },
        { left: '85%', top: '70%', size: 160, color: 'var(--secondary, #f472b6)', delay: '2s' },
        { left: '20%', top: '78%', size: 200, color: 'var(--accent, #fbbf24)', delay: '1.6s' },
    ];
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: 'radial-gradient(ellipse at top, color-mix(in srgb, var(--primary, #1e1b4b) 90%, black), #050617 80%)' }}>
            <Keyframes />
            {orbs.map((o, i) => (
                <div
                    key={i}
                    className="absolute rounded-full motion-reduce:!animate-none"
                    style={{
                        left: o.left,
                        top: o.top,
                        width: o.size,
                        height: o.size,
                        background: `radial-gradient(circle at 35% 35%, ${o.color}, transparent 70%)`,
                        filter: 'blur(28px)',
                        opacity: 0.55,
                        mixBlendMode: 'screen',
                        animation: `ksOrb ${10 + (i * 2)}s ease-in-out ${o.delay} infinite alternate`,
                    }}
                />
            ))}
        </div>
    );
}

function GridPulse() {
    const gridStyle: CSSProperties = {
        backgroundImage:
            'linear-gradient(color-mix(in srgb, var(--accent, #94a3b8) 35%, transparent) 1px, transparent 1px), ' +
            'linear-gradient(90deg, color-mix(in srgb, var(--accent, #94a3b8) 35%, transparent) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
    };
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: 'linear-gradient(180deg, var(--primary, #020617) 0%, color-mix(in srgb, var(--primary, #020617) 70%, var(--secondary, #0ea5e9)) 100%)' }}>
            <Keyframes />
            <div
                className="absolute inset-0 motion-reduce:!animate-none"
                style={{
                    ...gridStyle,
                    animation: 'ksGridPulse 4.5s ease-in-out infinite',
                    maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
                    WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
                }}
            />
        </div>
    );
}

function SunburstRays() {
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: 'radial-gradient(ellipse at center, color-mix(in srgb, var(--secondary, #f59e0b) 45%, transparent), var(--primary, #7c2d12) 80%)' }}>
            <Keyframes />
            <div
                className="absolute -inset-1/2 motion-reduce:!animate-none"
                style={{
                    background:
                        'conic-gradient(from 0deg, color-mix(in srgb, var(--accent, #fde68a) 70%, transparent) 0 6deg, transparent 6deg 18deg, color-mix(in srgb, var(--accent, #fde68a) 50%, transparent) 18deg 24deg, transparent 24deg 36deg)',
                    opacity: 0.45,
                    animation: 'ksRays 90s linear infinite',
                }}
            />
        </div>
    );
}

export const HERO_BG_ANIMATIONS: Record<HeroBgAnimationId, { Component: React.ComponentType }> = {
    aurora: { Component: Aurora },
    meshGradient: { Component: MeshGradient },
    geometricDrift: { Component: GeometricDrift },
    diagonalStripes: { Component: DiagonalStripes },
    particleField: { Component: ParticleField },
    sineWaves: { Component: SineWaves },
    noiseGrain: { Component: NoiseGrain },
    bokehOrbs: { Component: BokehOrbs },
    gridPulse: { Component: GridPulse },
    sunburstRays: { Component: SunburstRays },
};

export function HeroBgAnimation({ id }: { id: HeroBgAnimationId }) {
    const entry = HERO_BG_ANIMATIONS[id];
    if (!entry) return null;
    const Comp = entry.Component;
    return <Comp />;
}
