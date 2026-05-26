'use client';

/**
 * Hero block animated backgrounds.
 *
 * Every animation:
 *   - fills its parent (`absolute inset-0`)
 *   - receives a `colors: string[]` prop indexed against the meta's
 *     `colorSlots` array (defaults coming from the site palette)
 *   - respects `prefers-reduced-motion` via `motion-reduce:` Tailwind variants
 *
 * To consume:
 *   const meta = HERO_BG_ANIMATION_META[id];
 *   const Comp = HERO_BG_ANIMATIONS[id]?.Component;
 *   <Comp colors={resolvedColors} />
 */

import { CSSProperties, useEffect, useId, useMemo, useRef } from 'react';
import type { ColorSlot, HeroBgVariantMeta } from './hero-bg-shared';
import { mix } from './hero-bg-shared';

export type HeroBgAnimationId =
    // Aurora / mesh / liquid
    | 'aurora'
    | 'meshGradient'
    | 'liquidBlobs'
    | 'nebulaShift'
    // Particles / cosmos
    | 'particleField'
    | 'starfield'
    | 'bokehOrbs'
    // Tech / grid
    | 'gridPulse'
    | 'gridBeams'
    | 'tronGrid'
    | 'circuitNetwork'
    // Waves / flow
    | 'sineWaves'
    | 'flowField'
    | 'silkRibbons'
    // Geometric / motion
    | 'geometricDrift'
    | 'diagonalStripes'
    | 'sunburstRays'
    | 'kaleidoscope'
    // Weather
    | 'snowfall'
    // Texture / interactive
    | 'noiseGrain'
    | 'cursorSpotlight';

export type HeroBgAnimationMeta = HeroBgVariantMeta<HeroBgAnimationId>;

interface AnimComponentProps {
    colors: string[];
    speed?: number;
}

// ---------------------------------------------------------------------------
// Slot defaults — keep aligned with the rendered components.
// ---------------------------------------------------------------------------

const SLOT_GLOW = (label = 'Glow'): ColorSlot => ({ label, defaultToken: 'palette:secondary' });
const SLOT_PRIMARY = (label = 'Primary'): ColorSlot => ({ label, defaultToken: 'palette:primary' });
const SLOT_ACCENT = (label = 'Accent'): ColorSlot => ({ label, defaultToken: 'palette:accent' });

export const HERO_BG_ANIMATION_LIST: HeroBgAnimationMeta[] = [
    {
        id: 'aurora',
        label: 'Aurora',
        description: 'Soft drifting ribbons of color.',
        colorSlots: [
            { label: 'Background', defaultToken: '#080820' },
            SLOT_PRIMARY('Ribbon A'),
            SLOT_GLOW('Ribbon B'),
            SLOT_ACCENT('Highlight'),
        ],
    },
    {
        id: 'meshGradient',
        label: 'Mesh Gradient',
        description: 'Three radial gradients drifting like liquid glass.',
        colorSlots: [
            SLOT_PRIMARY('Base'),
            SLOT_GLOW('Blob A'),
            SLOT_ACCENT('Blob B'),
            { label: 'Blob C', defaultToken: 'palette:primary' },
        ],
    },
    {
        id: 'liquidBlobs',
        label: 'Liquid Blobs',
        description: 'Morphing organic blobs with a gooey blend.',
        colorSlots: [
            { label: 'Background', defaultToken: '#0b0822' },
            SLOT_PRIMARY('Blob A'),
            SLOT_GLOW('Blob B'),
            SLOT_ACCENT('Blob C'),
        ],
    },
    {
        id: 'nebulaShift',
        label: 'Nebula Shift',
        description: 'Slow cosmic clouds drifting in deep space.',
        colorSlots: [
            { label: 'Space', defaultToken: '#020617' },
            SLOT_PRIMARY('Cloud A'),
            SLOT_GLOW('Cloud B'),
            SLOT_ACCENT('Highlights'),
        ],
    },
    {
        id: 'particleField',
        label: 'Particle Field',
        description: 'Soft drifting points of light rising upward.',
        colorSlots: [
            { label: 'Background', defaultToken: '#06080f' },
            SLOT_ACCENT('Particle'),
            SLOT_GLOW('Glow'),
        ],
    },
    {
        id: 'starfield',
        label: 'Starfield',
        description: 'Twinkling micro-stars with a slow nebula drift.',
        colorSlots: [
            { label: 'Sky', defaultToken: '#03040a' },
            { label: 'Stars', defaultToken: '#ffffff' },
            SLOT_GLOW('Nebula A'),
            SLOT_PRIMARY('Nebula B'),
        ],
    },
    {
        id: 'bokehOrbs',
        label: 'Bokeh Orbs',
        description: 'Glowing soft circles drifting and breathing.',
        colorSlots: [
            { label: 'Background', defaultToken: '#0b0a1f' },
            SLOT_PRIMARY('Orb A'),
            SLOT_GLOW('Orb B'),
            SLOT_ACCENT('Orb C'),
        ],
    },
    {
        id: 'gridPulse',
        label: 'Grid Pulse',
        description: 'Pulsing line grid masked toward the center.',
        colorSlots: [
            SLOT_PRIMARY('Background'),
            SLOT_GLOW('Glow tint'),
            SLOT_ACCENT('Grid line'),
        ],
    },
    {
        id: 'gridBeams',
        label: 'Grid Beams',
        description: 'Vertical light beams traversing a Stripe-style grid.',
        colorSlots: [
            { label: 'Background', defaultToken: '#020617' },
            SLOT_ACCENT('Grid'),
            SLOT_GLOW('Beam A'),
            SLOT_PRIMARY('Beam B'),
        ],
    },
    {
        id: 'tronGrid',
        label: 'Tron Grid',
        description: 'Glowing perspective grid receding to the horizon.',
        colorSlots: [
            { label: 'Sky', defaultToken: '#020617' },
            SLOT_PRIMARY('Horizon'),
            SLOT_GLOW('Grid'),
        ],
    },
    {
        id: 'circuitNetwork',
        label: 'Circuit Network',
        description: 'Animated network nodes pulsing along edges.',
        colorSlots: [
            { label: 'Background', defaultToken: '#040713' },
            SLOT_GLOW('Edge'),
            SLOT_ACCENT('Node'),
        ],
    },
    {
        id: 'sineWaves',
        label: 'Sine Waves',
        description: 'Layered SVG wave loops gliding sideways.',
        colorSlots: [
            { label: 'Background', defaultToken: '#0c4a6e' },
            SLOT_PRIMARY('Wave back'),
            SLOT_GLOW('Wave mid'),
            SLOT_ACCENT('Wave front'),
        ],
    },
    {
        id: 'flowField',
        label: 'Flow Field',
        description: 'Subtle vector lines flowing along a noise field.',
        colorSlots: [
            { label: 'Background', defaultToken: '#0a0a1a' },
            SLOT_GLOW('Line'),
            SLOT_ACCENT('Highlight'),
        ],
    },
    {
        id: 'silkRibbons',
        label: 'Silk Ribbons',
        description: 'Silk-like flowing ribbons across the frame.',
        colorSlots: [
            { label: 'Background', defaultToken: '#080612' },
            SLOT_PRIMARY('Ribbon A'),
            SLOT_GLOW('Ribbon B'),
            SLOT_ACCENT('Ribbon C'),
        ],
    },
    {
        id: 'geometricDrift',
        label: 'Geometric Drift',
        description: 'Translucent shapes floating slowly.',
        colorSlots: [
            SLOT_PRIMARY('Background A'),
            SLOT_GLOW('Background B'),
            SLOT_ACCENT('Shape'),
        ],
    },
    {
        id: 'diagonalStripes',
        label: 'Diagonal Stripes',
        description: 'Smooth diagonal stripes scrolling at an angle.',
        colorSlots: [
            SLOT_PRIMARY('Background'),
            SLOT_GLOW('Stripe'),
        ],
    },
    {
        id: 'sunburstRays',
        label: 'Sunburst Rays',
        description: 'Slowly rotating conic rays radiating outward.',
        colorSlots: [
            SLOT_PRIMARY('Background'),
            SLOT_GLOW('Glow'),
            SLOT_ACCENT('Ray'),
        ],
    },
    {
        id: 'kaleidoscope',
        label: 'Kaleidoscope',
        description: 'Slowly rotating multi-color kaleidoscope.',
        colorSlots: [
            { label: 'Background', defaultToken: '#0a0820' },
            SLOT_PRIMARY('Slice A'),
            SLOT_GLOW('Slice B'),
            SLOT_ACCENT('Slice C'),
        ],
    },
    {
        id: 'snowfall',
        label: 'Snowfall',
        description: 'Gentle snowflakes drifting down with parallax depth.',
        colorSlots: [
            { label: 'Background', defaultToken: '#0f172a' },
            { label: 'Snowflake', defaultToken: '#ffffff' },
            SLOT_GLOW('Glow'),
        ],
    },
    {
        id: 'noiseGrain',
        label: 'Noise Grain',
        description: 'Animated film-grain over a colored gradient.',
        colorSlots: [
            SLOT_PRIMARY('Gradient A'),
            SLOT_GLOW('Gradient B'),
        ],
    },
    {
        id: 'cursorSpotlight',
        label: 'Cursor Spotlight',
        description: 'Subtle radial glow that follows the cursor.',
        colorSlots: [
            { label: 'Background', defaultToken: '#06070d' },
            SLOT_GLOW('Spotlight'),
            SLOT_ACCENT('Mesh tint'),
        ],
    },
];

export const HERO_BG_ANIMATION_META: Record<HeroBgAnimationId, HeroBgAnimationMeta> =
    HERO_BG_ANIMATION_LIST.reduce((acc, m) => {
        acc[m.id] = m;
        return acc;
    }, {} as Record<HeroBgAnimationId, HeroBgAnimationMeta>);

// ---------------------------------------------------------------------------
// Keyframes — global stylesheet injected once (idempotent in React).
// ---------------------------------------------------------------------------

const KEYFRAMES = `
@keyframes ksAuroraDrift1 { 0%,100% { transform: translate3d(-12%,-4%,0) rotate(-8deg) scale(1.05); } 50% { transform: translate3d(14%,-2%,0) rotate(4deg) scale(1.15); } }
@keyframes ksAuroraDrift2 { 0%,100% { transform: translate3d(8%,6%,0) rotate(6deg) scale(1.1); } 50% { transform: translate3d(-10%,-4%,0) rotate(-5deg) scale(1.0); } }
@keyframes ksAuroraDrift3 { 0%,100% { transform: translate3d(0%,8%,0) rotate(-2deg) scale(1.0); } 50% { transform: translate3d(6%,-6%,0) rotate(3deg) scale(1.2); } }
@keyframes ksMeshA { 0%,100% { transform: translate(0%,0%) scale(1); } 50% { transform: translate(18%,-12%) scale(1.1); } }
@keyframes ksMeshB { 0%,100% { transform: translate(0%,0%) scale(1); } 50% { transform: translate(-14%,16%) scale(1.05); } }
@keyframes ksMeshC { 0%,100% { transform: translate(0%,0%) scale(1); } 50% { transform: translate(12%,18%) scale(1.12); } }
@keyframes ksMeshD { 0%,100% { transform: translate(0%,0%) scale(1); } 50% { transform: translate(-16%,-10%) scale(1.08); } }
@keyframes ksBlobA { 0%,100% { border-radius: 60% 40% 55% 45% / 50% 60% 40% 50%; transform: translate(-6%,4%) rotate(0deg); } 50% { border-radius: 40% 60% 45% 55% / 60% 40% 60% 40%; transform: translate(8%,-6%) rotate(8deg); } }
@keyframes ksBlobB { 0%,100% { border-radius: 50% 50% 40% 60% / 60% 40% 50% 50%; transform: translate(6%,-4%) rotate(-6deg); } 50% { border-radius: 60% 40% 60% 40% / 40% 60% 40% 60%; transform: translate(-8%,8%) rotate(4deg); } }
@keyframes ksBlobC { 0%,100% { border-radius: 45% 55% 50% 50% / 50% 50% 55% 45%; transform: translate(0,6%) rotate(0deg); } 50% { border-radius: 55% 45% 60% 40% / 40% 60% 45% 55%; transform: translate(4%,-8%) rotate(6deg); } }
@keyframes ksNebulaSlow { 0%,100% { transform: translate3d(-4%,0,0) scale(1.15); opacity: .6; } 50% { transform: translate3d(6%,-3%,0) scale(1.3); opacity: .85; } }
@keyframes ksGeoFloat { 0% { transform: translate3d(0,0,0) rotate(0); } 100% { transform: translate3d(0,-30px,0) rotate(180deg); } }
@keyframes ksStripes { from { background-position: 0 0; } to { background-position: 96px 96px; } }
@keyframes ksParticle { 0% { transform: translate3d(0,0,0); opacity: 0; } 8%,90% { opacity: 1; } 100% { transform: translate3d(0,-140px,0); opacity: 0; } }
@keyframes ksWave { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes ksGrain { 0% { transform: translate(0,0); } 25% { transform: translate(-5%,-10%); } 50% { transform: translate(7%,3%); } 75% { transform: translate(-3%,8%); } 100% { transform: translate(0,0); } }
@keyframes ksOrb { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px,-15px) scale(1.06); } }
@keyframes ksGridPulse { 0%,100% { opacity: .25; } 50% { opacity: .55; } }
@keyframes ksRays { from { transform: rotate(0); } to { transform: rotate(360deg); } }
@keyframes ksRaysReverse { from { transform: rotate(0); } to { transform: rotate(-360deg); } }
@keyframes ksTwinkle { 0%,100% { opacity: 0.15; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }
@keyframes ksBeamFall { 0% { transform: translateY(-110%); opacity: 0; } 8% { opacity: 1; } 92% { opacity: 1; } 100% { transform: translateY(110%); opacity: 0; } }
@keyframes ksTronScroll { 0% { transform: translateY(0); } 100% { transform: translateY(60px); } }
@keyframes ksCircuitDash { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -200; } }
@keyframes ksCircuitNode { 0%,100% { opacity: .35; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
@keyframes ksFlowDash { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -120; } }
@keyframes ksSilkA { 0%,100% { transform: translate3d(-12%,-4%,0) rotate(-2deg); } 50% { transform: translate3d(8%,2%,0) rotate(2deg); } }
@keyframes ksSilkB { 0%,100% { transform: translate3d(8%,4%,0) rotate(2deg); } 50% { transform: translate3d(-10%,-2%,0) rotate(-3deg); } }
@keyframes ksSilkC { 0%,100% { transform: translate3d(-4%,8%,0) rotate(0); } 50% { transform: translate3d(6%,-4%,0) rotate(2deg); } }
@keyframes ksKaleido { from { transform: rotate(0); } to { transform: rotate(360deg); } }
@keyframes ksKaleidoCounter { from { transform: rotate(0); } to { transform: rotate(-360deg); } }
@keyframes ksSnowfall { 0% { transform: translate3d(0,-10%,0); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translate3d(0,110vh,0); opacity: 0; } }
@keyframes ksSnowSway { 0%,100% { margin-left: 0; } 25% { margin-left: 15px; } 75% { margin-left: -15px; } }
`;

function Keyframes() {
    // Repeated <style> mounts are harmless — modern browsers de-duplicate
    // identical @keyframes declarations within the document.
    return <style data-ks-hero-bg dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />;
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

function Aurora({ colors }: AnimComponentProps) {
    const [bg, c1, c2, c3] = colors;
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: bg }}>
            <Keyframes />
            <div
                className="absolute -inset-[20%] motion-reduce:!animate-none"
                style={{
                    background: `radial-gradient(60% 40% at 30% 50%, ${mix(c1, 80)}, transparent 70%)`,
                    filter: 'blur(70px)',
                    animation: 'ksAuroraDrift1 18s ease-in-out infinite',
                }}
            />
            <div
                className="absolute -inset-[20%] motion-reduce:!animate-none"
                style={{
                    background: `radial-gradient(50% 35% at 70% 60%, ${mix(c2, 80)}, transparent 70%)`,
                    filter: 'blur(80px)',
                    animation: 'ksAuroraDrift2 22s ease-in-out infinite',
                }}
            />
            <div
                className="absolute -inset-[20%] motion-reduce:!animate-none"
                style={{
                    background: `radial-gradient(45% 30% at 50% 30%, ${mix(c3, 60)}, transparent 70%)`,
                    filter: 'blur(60px)',
                    animation: 'ksAuroraDrift3 26s ease-in-out infinite',
                }}
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(8,8,30,.45), rgba(8,8,30,.15))' }} />
        </div>
    );
}

function MeshGradient({ colors }: AnimComponentProps) {
    const [bg, a, b, c] = colors;
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: bg }}>
            <Keyframes />
            <div className="absolute inset-[-10%] motion-reduce:!animate-none" style={{ background: `radial-gradient(circle at 18% 22%, ${mix(a, 75)}, transparent 55%)`, animation: 'ksMeshA 16s ease-in-out infinite' }} />
            <div className="absolute inset-[-10%] motion-reduce:!animate-none" style={{ background: `radial-gradient(circle at 82% 28%, ${mix(b, 70)}, transparent 55%)`, animation: 'ksMeshB 20s ease-in-out infinite' }} />
            <div className="absolute inset-[-10%] motion-reduce:!animate-none" style={{ background: `radial-gradient(circle at 60% 80%, ${mix(c, 80)}, transparent 55%)`, animation: 'ksMeshC 24s ease-in-out infinite' }} />
            <div className="absolute inset-[-10%] motion-reduce:!animate-none" style={{ background: `radial-gradient(circle at 25% 75%, ${mix(a, 50)}, transparent 50%)`, animation: 'ksMeshD 28s ease-in-out infinite' }} />
        </div>
    );
}

function LiquidBlobs({ colors }: AnimComponentProps) {
    const filterId = useId().replace(/[:]/g, '');
    const [bg, a, b, c] = colors;
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: bg }}>
            <Keyframes />
            <svg className="absolute inset-0 h-0 w-0" aria-hidden>
                <defs>
                    <filter id={`goo-${filterId}`}>
                        <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="blur" />
                        <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="goo" />
                        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                    </filter>
                </defs>
            </svg>
            <div className="absolute inset-0" style={{ filter: `url(#goo-${filterId})` }}>
                <div
                    className="absolute left-[10%] top-[18%] motion-reduce:!animate-none"
                    style={{ width: 360, height: 360, background: a, opacity: 0.85, animation: 'ksBlobA 14s ease-in-out infinite' }}
                />
                <div
                    className="absolute left-[55%] top-[30%] motion-reduce:!animate-none"
                    style={{ width: 280, height: 280, background: b, opacity: 0.85, animation: 'ksBlobB 18s ease-in-out infinite' }}
                />
                <div
                    className="absolute left-[30%] top-[55%] motion-reduce:!animate-none"
                    style={{ width: 320, height: 320, background: c, opacity: 0.85, animation: 'ksBlobC 16s ease-in-out infinite' }}
                />
            </div>
        </div>
    );
}

function NebulaShift({ colors }: AnimComponentProps) {
    const [bg, a, b, c] = colors;
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: bg }}>
            <Keyframes />
            <div className="absolute -inset-[15%] motion-reduce:!animate-none" style={{ background: `radial-gradient(ellipse 70% 55% at 30% 40%, ${mix(a, 60)}, transparent 70%)`, filter: 'blur(40px)', animation: 'ksNebulaSlow 42s ease-in-out infinite' }} />
            <div className="absolute -inset-[15%] motion-reduce:!animate-none" style={{ background: `radial-gradient(ellipse 50% 70% at 70% 65%, ${mix(b, 50)}, transparent 70%)`, filter: 'blur(60px)', animation: 'ksNebulaSlow 56s ease-in-out infinite reverse' }} />
            <div className="absolute -inset-[15%] motion-reduce:!animate-none" style={{ background: `radial-gradient(ellipse 30% 30% at 50% 50%, ${mix(c, 70)}, transparent 80%)`, filter: 'blur(30px)', animation: 'ksNebulaSlow 70s ease-in-out infinite' }} />
            {/* Faint stars */}
            <div
                className="absolute inset-0 opacity-60"
                style={{
                    backgroundImage: 'radial-gradient(rgba(255,255,255,0.65) 1px, transparent 1.2px), radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1.2px)',
                    backgroundSize: '120px 120px, 200px 200px',
                    backgroundPosition: '0 0, 60px 80px',
                }}
            />
        </div>
    );
}

function ParticleField({ colors }: AnimComponentProps) {
    const [bg, particle, glow] = colors;
    const particles = Array.from({ length: 42 }, (_, i) => ({
        left: `${(i * 73 + 17) % 100}%`,
        size: 2 + (i % 4),
        delay: `${(i % 16) * 0.6}s`,
        duration: `${10 + (i % 8) * 1.5}s`,
    }));
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: `radial-gradient(ellipse at center, ${bg} 0%, #050810 100%)` }}>
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
                        background: particle,
                        boxShadow: `0 0 8px 2px ${mix(glow, 40)}`,
                        animation: `ksParticle ${p.duration} linear ${p.delay} infinite`,
                    }}
                />
            ))}
        </div>
    );
}

function Starfield({ colors }: AnimComponentProps) {
    const [sky, star, nebA, nebB] = colors;
    const stars = Array.from({ length: 70 }, (_, i) => ({
        left: `${(i * 53 + 11) % 100}%`,
        top: `${(i * 89 + 23) % 100}%`,
        size: 1 + (i % 3) * 0.5,
        delay: `${(i % 18) * 0.4}s`,
        duration: `${3 + (i % 5)}s`,
    }));
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: sky }}>
            <Keyframes />
            {/* Drifting nebula */}
            <div className="absolute -inset-[15%] motion-reduce:!animate-none" style={{ background: `radial-gradient(ellipse 60% 40% at 35% 35%, ${mix(nebA, 35)}, transparent 70%)`, filter: 'blur(40px)', animation: 'ksNebulaSlow 60s ease-in-out infinite' }} />
            <div className="absolute -inset-[15%] motion-reduce:!animate-none" style={{ background: `radial-gradient(ellipse 50% 30% at 70% 65%, ${mix(nebB, 35)}, transparent 70%)`, filter: 'blur(50px)', animation: 'ksNebulaSlow 80s ease-in-out infinite reverse' }} />
            {/* Stars */}
            {stars.map((s, i) => (
                <span
                    key={i}
                    className="absolute motion-reduce:!animate-none"
                    style={{
                        left: s.left,
                        top: s.top,
                        width: s.size,
                        height: s.size,
                        borderRadius: '9999px',
                        background: star,
                        boxShadow: `0 0 6px ${mix(star, 60)}`,
                        animation: `ksTwinkle ${s.duration} ease-in-out ${s.delay} infinite`,
                    }}
                />
            ))}
        </div>
    );
}

function BokehOrbs({ colors }: AnimComponentProps) {
    const [bg, a, b, c] = colors;
    const orbs = [
        { left: '12%', top: '18%', size: 240, color: b, delay: '0s' },
        { left: '70%', top: '10%', size: 180, color: c, delay: '1.2s' },
        { left: '55%', top: '60%', size: 280, color: a, delay: '0.4s' },
        { left: '85%', top: '70%', size: 170, color: b, delay: '2s' },
        { left: '20%', top: '78%', size: 220, color: c, delay: '1.6s' },
    ];
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: `radial-gradient(ellipse at top, ${mix(bg, 90, '#000000')}, #050617 80%)` }}>
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
                        opacity: 0.6,
                        mixBlendMode: 'screen',
                        animation: `ksOrb ${10 + i * 2}s ease-in-out ${o.delay} infinite alternate`,
                    }}
                />
            ))}
        </div>
    );
}

function GridPulse({ colors }: AnimComponentProps) {
    const [bg, glowTint, line] = colors;
    const gridStyle: CSSProperties = {
        backgroundImage:
            `linear-gradient(${mix(line, 40)} 1px, transparent 1px), ` +
            `linear-gradient(90deg, ${mix(line, 40)} 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
    };
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: `linear-gradient(180deg, ${bg} 0%, ${mix(glowTint, 50, bg)} 100%)` }}>
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

function GridBeams({ colors }: AnimComponentProps) {
    const [bg, grid, beamA, beamB] = colors;
    const beams = [
        { left: '15%', color: beamA, delay: '0s', duration: '7s' },
        { left: '38%', color: beamB, delay: '2s', duration: '9s' },
        { left: '60%', color: beamA, delay: '4s', duration: '8s' },
        { left: '82%', color: beamB, delay: '1.2s', duration: '11s' },
    ];
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: bg }}>
            <Keyframes />
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage:
                        `linear-gradient(${mix(grid, 30)} 1px, transparent 1px), ` +
                        `linear-gradient(90deg, ${mix(grid, 30)} 1px, transparent 1px)`,
                    backgroundSize: '64px 64px',
                    maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 85%)',
                    WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 85%)',
                }}
            />
            {beams.map((b, i) => (
                <div
                    key={i}
                    className="absolute top-0 bottom-0 motion-reduce:!animate-none"
                    style={{
                        left: b.left,
                        width: 2,
                        background: `linear-gradient(180deg, transparent 0%, ${b.color} 30%, ${b.color} 70%, transparent 100%)`,
                        boxShadow: `0 0 22px 4px ${mix(b.color, 80)}`,
                        animation: `ksBeamFall ${b.duration} linear ${b.delay} infinite`,
                    }}
                />
            ))}
        </div>
    );
}

function TronGrid({ colors }: AnimComponentProps) {
    const [sky, horizon, grid] = colors;
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: `linear-gradient(180deg, ${sky} 0%, ${mix(horizon, 60, sky)} 65%, ${mix(horizon, 90, '#000000')} 100%)` }}>
            <Keyframes />
            {/* Horizon glow */}
            <div className="absolute inset-x-0 top-[55%] h-px" style={{ background: mix(grid, 100), boxShadow: `0 0 50px 8px ${mix(grid, 70)}` }} />
            {/* Perspective grid */}
            <div className="absolute inset-x-0 bottom-0 top-[55%]" style={{ perspective: '600px' }}>
                <div
                    className="absolute inset-0 motion-reduce:!animate-none"
                    style={{
                        transform: 'rotateX(60deg)',
                        transformOrigin: '50% 0%',
                        backgroundImage:
                            `linear-gradient(${mix(grid, 65)} 1px, transparent 1px), ` +
                            `linear-gradient(90deg, ${mix(grid, 65)} 1px, transparent 1px)`,
                        backgroundSize: '60px 60px',
                        animation: 'ksTronScroll 2.4s linear infinite',
                    }}
                />
            </div>
        </div>
    );
}

function CircuitNetwork({ colors }: AnimComponentProps) {
    const [bg, edge, node] = colors;
    // Predetermined node positions for stability across renders.
    const nodes = [
        { cx: 80, cy: 60 }, { cx: 220, cy: 90 }, { cx: 340, cy: 50 },
        { cx: 120, cy: 180 }, { cx: 260, cy: 200 }, { cx: 380, cy: 160 },
        { cx: 60, cy: 300 }, { cx: 200, cy: 320 }, { cx: 320, cy: 280 },
        { cx: 460, cy: 230 }, { cx: 480, cy: 90 }, { cx: 540, cy: 300 },
    ];
    const edges: [number, number][] = [
        [0, 1], [1, 2], [2, 10], [1, 4], [3, 4], [4, 5], [5, 9], [3, 6],
        [6, 7], [7, 8], [8, 9], [4, 7], [9, 11], [10, 5], [8, 11],
    ];
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: bg }}>
            <Keyframes />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 380" preserveAspectRatio="xMidYMid slice">
                <g stroke={mix(edge, 70)} strokeWidth={1} fill="none" strokeDasharray="4 6" className="motion-reduce:!animate-none" style={{ animation: 'ksCircuitDash 16s linear infinite' }}>
                    {edges.map(([a, b], i) => (
                        <line key={i} x1={nodes[a].cx} y1={nodes[a].cy} x2={nodes[b].cx} y2={nodes[b].cy} />
                    ))}
                </g>
                <g fill={node}>
                    {nodes.map((n, i) => (
                        <circle
                            key={i}
                            cx={n.cx}
                            cy={n.cy}
                            r={3}
                            className="motion-reduce:!animate-none"
                            style={{
                                animation: `ksCircuitNode ${3 + (i % 4)}s ease-in-out ${(i % 7) * 0.4}s infinite`,
                                filter: `drop-shadow(0 0 6px ${mix(node, 80)})`,
                            }}
                        />
                    ))}
                </g>
            </svg>
        </div>
    );
}

function SineWaves({ colors }: AnimComponentProps) {
    const [bg, back, mid, front] = colors;
    const wavePath = 'M0,160 C320,260 640,60 960,160 C1280,260 1600,60 1920,160 L1920,320 L0,320 Z';
    const layers = [
        { color: back, dur: 16, opacity: 1, bottom: 0 },
        { color: mid, dur: 22, opacity: 0.75, bottom: 8 },
        { color: front, dur: 30, opacity: 0.55, bottom: 16 },
    ];
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: `linear-gradient(180deg, ${mix(bg, 95, '#000000')}, ${bg})` }}>
            <Keyframes />
            {layers.map((l, i) => (
                <svg
                    key={i}
                    viewBox="0 0 1920 320"
                    preserveAspectRatio="none"
                    className="absolute left-0 right-0 motion-reduce:!animate-none"
                    style={{ bottom: `${l.bottom}%`, width: '200%', height: '40%', animation: `ksWave ${l.dur}s linear infinite`, opacity: l.opacity }}
                >
                    <path d={wavePath} fill={l.color} />
                    <path d={wavePath} fill={l.color} transform="translate(1920 0)" />
                </svg>
            ))}
        </div>
    );
}

function FlowField({ colors }: AnimComponentProps) {
    const [bg, line, highlight] = colors;
    // Pre-baked flowing path family — keeps rendering deterministic.
    const paths = [
        'M-20 60 C 120 20, 280 120, 420 80 S 720 40, 880 90',
        'M-20 130 C 150 80, 280 200, 460 150 S 740 110, 900 160',
        'M-20 200 C 120 160, 320 260, 480 220 S 760 180, 900 230',
        'M-20 270 C 160 230, 300 330, 480 290 S 760 250, 900 300',
        'M-20 340 C 140 300, 320 400, 500 360 S 780 320, 900 370',
    ];
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: bg }}>
            <Keyframes />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 880 400" preserveAspectRatio="xMidYMid slice">
                <defs>
                    <linearGradient id="ks-flow-grad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={mix(line, 0)} stopOpacity={0} />
                        <stop offset="50%" stopColor={mix(line, 90)} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={mix(highlight, 0)} stopOpacity={0} />
                    </linearGradient>
                </defs>
                {paths.map((d, i) => (
                    <path
                        key={i}
                        d={d}
                        stroke="url(#ks-flow-grad)"
                        strokeWidth={1}
                        fill="none"
                        strokeDasharray="6 8"
                        className="motion-reduce:!animate-none"
                        style={{ animation: `ksFlowDash ${8 + i * 2}s linear ${i * 0.4}s infinite` }}
                    />
                ))}
            </svg>
        </div>
    );
}

function SilkRibbons({ colors }: AnimComponentProps) {
    const [bg, a, b, c] = colors;
    const ribbon = (color: string, anim: string, top: string, rotate: number, opacity: number, blur: number) => (
        <div
            className="absolute inset-x-[-30%] h-[60%] motion-reduce:!animate-none"
            style={{
                top,
                background: `linear-gradient(90deg, transparent 0%, ${mix(color, 70)} 30%, ${mix(color, 90)} 50%, ${mix(color, 70)} 70%, transparent 100%)`,
                transform: `rotate(${rotate}deg)`,
                filter: `blur(${blur}px)`,
                opacity,
                animation: anim,
                mixBlendMode: 'screen',
            }}
        />
    );
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: bg }}>
            <Keyframes />
            {ribbon(a, 'ksSilkA 18s ease-in-out infinite', '15%', -8, 0.8, 24)}
            {ribbon(b, 'ksSilkB 22s ease-in-out infinite', '40%', 4, 0.7, 28)}
            {ribbon(c, 'ksSilkC 26s ease-in-out infinite', '65%', -3, 0.65, 32)}
        </div>
    );
}

function GeometricDrift({ colors }: AnimComponentProps) {
    const [bgA, bgB, shape] = colors;
    const shapes = [
        { left: '8%', top: '20%', size: 120, delay: '0s', duration: '14s', rotate: 30, opacity: 0.18 },
        { left: '70%', top: '12%', size: 80, delay: '2s', duration: '18s', rotate: 60, opacity: 0.22 },
        { left: '40%', top: '55%', size: 160, delay: '1s', duration: '20s', rotate: 90, opacity: 0.14 },
        { left: '85%', top: '70%', size: 100, delay: '3s', duration: '16s', rotate: 45, opacity: 0.2 },
        { left: '15%', top: '78%', size: 70, delay: '4s', duration: '12s', rotate: 0, opacity: 0.24 },
    ];
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: `linear-gradient(135deg, ${bgA}, ${bgB})` }}>
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
                        background: mix(shape, 55),
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

function DiagonalStripes({ colors }: AnimComponentProps) {
    const [bg, stripe] = colors;
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: bg }}>
            <Keyframes />
            <div
                className="absolute inset-0 motion-reduce:!animate-none"
                style={{
                    backgroundImage: `repeating-linear-gradient(45deg, ${mix(stripe, 22)} 0 28px, transparent 28px 96px)`,
                    animation: 'ksStripes 8s linear infinite',
                }}
            />
        </div>
    );
}

function SunburstRays({ colors }: AnimComponentProps) {
    const [bg, glow, ray] = colors;
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: `radial-gradient(ellipse at center, ${mix(glow, 45)}, ${bg} 80%)` }}>
            <Keyframes />
            <div
                className="absolute -inset-1/2 motion-reduce:!animate-none"
                style={{
                    background:
                        `conic-gradient(from 0deg, ${mix(ray, 70)} 0 6deg, transparent 6deg 18deg, ${mix(ray, 50)} 18deg 24deg, transparent 24deg 36deg)`,
                    opacity: 0.45,
                    animation: 'ksRays 90s linear infinite',
                }}
            />
        </div>
    );
}

function Kaleidoscope({ colors }: AnimComponentProps) {
    const [bg, a, b, c] = colors;
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: bg }}>
            <Keyframes />
            <div
                className="absolute -inset-1/2 motion-reduce:!animate-none"
                style={{
                    background: `conic-gradient(from 0deg, ${mix(a, 70)} 0 30deg, ${mix(b, 70)} 30deg 60deg, ${mix(c, 70)} 60deg 90deg, ${mix(a, 70)} 90deg 120deg, ${mix(b, 70)} 120deg 150deg, ${mix(c, 70)} 150deg 180deg, ${mix(a, 70)} 180deg 210deg, ${mix(b, 70)} 210deg 240deg, ${mix(c, 70)} 240deg 270deg, ${mix(a, 70)} 270deg 300deg, ${mix(b, 70)} 300deg 330deg, ${mix(c, 70)} 330deg 360deg)`,
                    filter: 'blur(40px)',
                    opacity: 0.55,
                    animation: 'ksKaleido 80s linear infinite',
                }}
            />
            <div
                className="absolute -inset-1/2 motion-reduce:!animate-none"
                style={{
                    background: `conic-gradient(from 30deg, ${mix(a, 50)} 0 45deg, transparent 45deg 90deg, ${mix(b, 50)} 90deg 135deg, transparent 135deg 180deg, ${mix(c, 50)} 180deg 225deg, transparent 225deg 270deg, ${mix(a, 50)} 270deg 315deg, transparent 315deg 360deg)`,
                    filter: 'blur(20px)',
                    opacity: 0.4,
                    animation: 'ksKaleidoCounter 120s linear infinite',
                }}
            />
        </div>
    );
}

function Snowfall({ colors, speed = 1 }: AnimComponentProps) {
    const [bg, flake, glow] = colors;
    const multiplier = 1 / Math.max(0.1, speed);
    const flakes = useMemo(() =>
        Array.from({ length: 60 }, (_, i) => {
            const layer = i % 3;
            const size = layer === 0 ? 2 + (i % 3) : layer === 1 ? 3 + (i % 3) : 5 + (i % 4);
            const baseDuration = layer === 0 ? 18 + (i % 6) * 2 : layer === 1 ? 14 + (i % 5) * 2 : 10 + (i % 4) * 2;
            return {
                left: `${(i * 61 + 13) % 100}%`,
                size,
                opacity: layer === 0 ? 0.3 : layer === 1 ? 0.5 : 0.8,
                blur: layer === 0 ? 2 : layer === 1 ? 1 : 0,
                duration: baseDuration * multiplier,
                swayDuration: (6 + (i % 5) * 2) * multiplier,
                delay: (i % 20) * 0.7,
            };
        }),
    [multiplier]);
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: bg }}>
            <Keyframes />
            {flakes.map((f, i) => (
                <span
                    key={i}
                    className="absolute top-0 motion-reduce:!animate-none"
                    style={{
                        left: f.left,
                        width: f.size,
                        height: f.size,
                        borderRadius: '9999px',
                        background: flake,
                        boxShadow: `0 0 ${f.size + 2}px ${mix(glow, 40)}`,
                        opacity: f.opacity,
                        filter: f.blur ? `blur(${f.blur}px)` : undefined,
                        animation: `ksSnowfall ${f.duration}s linear ${f.delay}s infinite, ksSnowSway ${f.swayDuration}s ease-in-out ${f.delay}s infinite`,
                    }}
                />
            ))}
        </div>
    );
}

function NoiseGrain({ colors }: AnimComponentProps) {
    const [a, b] = colors;
    const noiseDataUri =
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.4 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
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

function CursorSpotlight({ colors }: AnimComponentProps) {
    const [bg, glow, mesh] = colors;
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const onMove = (e: MouseEvent) => {
            const rect = el.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            el.style.setProperty('--ks-mx', `${x}%`);
            el.style.setProperty('--ks-my', `${y}%`);
        };
        const onLeave = () => {
            el.style.setProperty('--ks-mx', '50%');
            el.style.setProperty('--ks-my', '50%');
        };
        el.addEventListener('mousemove', onMove);
        el.addEventListener('mouseleave', onLeave);
        return () => {
            el.removeEventListener('mousemove', onMove);
            el.removeEventListener('mouseleave', onLeave);
        };
    }, []);
    return (
        <div
            ref={ref}
            className="absolute inset-0 overflow-hidden"
            aria-hidden
            style={{
                background: bg,
                ['--ks-mx' as string]: '50%',
                ['--ks-my' as string]: '40%',
            }}
        >
            <Keyframes />
            <div
                className="absolute inset-0"
                style={{
                    background: `radial-gradient(ellipse 50% 35% at 30% 30%, ${mix(mesh, 35)}, transparent 70%), radial-gradient(ellipse 50% 35% at 75% 65%, ${mix(mesh, 25)}, transparent 70%)`,
                    filter: 'blur(40px)',
                }}
            />
            <div
                className="absolute inset-0 transition-[background] duration-200"
                style={{
                    background: `radial-gradient(circle 320px at var(--ks-mx) var(--ks-my), ${mix(glow, 60)}, transparent 65%)`,
                }}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const HERO_BG_ANIMATIONS: Record<HeroBgAnimationId, { Component: React.ComponentType<AnimComponentProps> }> = {
    aurora: { Component: Aurora },
    meshGradient: { Component: MeshGradient },
    liquidBlobs: { Component: LiquidBlobs },
    nebulaShift: { Component: NebulaShift },
    particleField: { Component: ParticleField },
    starfield: { Component: Starfield },
    bokehOrbs: { Component: BokehOrbs },
    gridPulse: { Component: GridPulse },
    gridBeams: { Component: GridBeams },
    tronGrid: { Component: TronGrid },
    circuitNetwork: { Component: CircuitNetwork },
    sineWaves: { Component: SineWaves },
    flowField: { Component: FlowField },
    silkRibbons: { Component: SilkRibbons },
    geometricDrift: { Component: GeometricDrift },
    diagonalStripes: { Component: DiagonalStripes },
    sunburstRays: { Component: SunburstRays },
    kaleidoscope: { Component: Kaleidoscope },
    snowfall: { Component: Snowfall },
    noiseGrain: { Component: NoiseGrain },
    cursorSpotlight: { Component: CursorSpotlight },
};

export function HeroBgAnimation({ id, colors, speed }: { id: HeroBgAnimationId; colors: string[]; speed?: number }) {
    const entry = HERO_BG_ANIMATIONS[id];
    if (!entry) return null;
    const Comp = entry.Component;
    return <Comp colors={colors} speed={speed} />;
}
