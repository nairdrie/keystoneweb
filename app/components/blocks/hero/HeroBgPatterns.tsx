'use client';

/**
 * Hero block static patterns.
 *
 * Each pattern renders a tiled SVG (or CSS background) into an `absolute
 * inset-0` layer. They accept the same `colors: string[]` contract as
 * animations, and a small set of geometric controls (scale, rotation,
 * opacity) applied uniformly by the renderer.
 */

import { useId } from 'react';
import type { ColorSlot, HeroBgVariantMeta } from './hero-bg-shared';
import { mix } from './hero-bg-shared';

export type HeroBgPatternId =
    // Geometric
    | 'dotsGrid'
    | 'dotsFade'
    | 'gridLines'
    | 'diagonalLines'
    | 'crosshatch'
    | 'isometricGrid'
    // Organic
    | 'topographic'
    | 'seigaiha'
    | 'wavyLines'
    | 'concentricCircles'
    // Tessellations
    | 'chevron'
    | 'herringbone'
    | 'hexagons'
    | 'triangles'
    | 'plusSigns'
    // Sophisticated
    | 'blueprint'
    | 'circuitTrace'
    | 'terrazzo'
    | 'confetti'
    | 'staticNoise';

export type HeroBgPatternMeta = HeroBgVariantMeta<HeroBgPatternId>;

const SLOT_BG = (label = 'Background', def = '#0f172a'): ColorSlot => ({ label, defaultToken: def });
const SLOT_LINE = (label = 'Line'): ColorSlot => ({ label, defaultToken: 'palette:primary' });
const SLOT_ACCENT = (label = 'Accent'): ColorSlot => ({ label, defaultToken: 'palette:secondary' });
const SLOT_HIGHLIGHT = (label = 'Highlight'): ColorSlot => ({ label, defaultToken: 'palette:accent' });

export const HERO_BG_PATTERN_LIST: HeroBgPatternMeta[] = [
    {
        id: 'dotsGrid',
        label: 'Dot Grid',
        description: 'Minimalist dot matrix with even spacing.',
        colorSlots: [SLOT_BG('Background', '#ffffff'), SLOT_LINE('Dot')],
    },
    {
        id: 'dotsFade',
        label: 'Halftone Fade',
        description: 'Halftone-style dots scaling down toward the edges.',
        colorSlots: [SLOT_BG('Background', '#0f172a'), SLOT_HIGHLIGHT('Dot')],
    },
    {
        id: 'gridLines',
        label: 'Grid Lines',
        description: 'Architectural grid with crisp 1px lines.',
        colorSlots: [SLOT_BG('Background', '#ffffff'), SLOT_LINE('Line')],
    },
    {
        id: 'diagonalLines',
        label: 'Diagonal Lines',
        description: 'Crisp 45° lines for energetic motion.',
        colorSlots: [SLOT_BG('Background', '#0f172a'), SLOT_ACCENT('Line')],
    },
    {
        id: 'crosshatch',
        label: 'Crosshatch',
        description: 'Stylized cross hatching for editorial texture.',
        colorSlots: [SLOT_BG('Background', '#ffffff'), SLOT_LINE('Line')],
    },
    {
        id: 'isometricGrid',
        label: 'Isometric Grid',
        description: '3D-angled wireframe with subtle highlights.',
        colorSlots: [SLOT_BG('Background', '#0b1220'), SLOT_LINE('Line'), SLOT_HIGHLIGHT('Highlight')],
    },
    {
        id: 'topographic',
        label: 'Topographic',
        description: 'Elegant winding contour lines.',
        colorSlots: [SLOT_BG('Background', '#0a1224'), SLOT_LINE('Line A'), SLOT_HIGHLIGHT('Line B')],
    },
    {
        id: 'seigaiha',
        label: 'Seigaiha',
        description: 'Modernized Japanese wave pattern.',
        colorSlots: [SLOT_BG('Background', '#0c1a36'), SLOT_LINE('Wave')],
    },
    {
        id: 'wavyLines',
        label: 'Wavy Lines',
        description: 'Continuous parallel wavy lines.',
        colorSlots: [SLOT_BG('Background', '#0f172a'), SLOT_HIGHLIGHT('Line')],
    },
    {
        id: 'concentricCircles',
        label: 'Concentric Circles',
        description: 'Concentric rings repeating across a grid.',
        colorSlots: [SLOT_BG('Background', '#ffffff'), SLOT_LINE('Ring')],
    },
    {
        id: 'chevron',
        label: 'Chevron',
        description: 'Stylized chevron tessellation.',
        colorSlots: [SLOT_BG('Background', '#0f172a'), SLOT_LINE('Color A'), SLOT_ACCENT('Color B')],
    },
    {
        id: 'herringbone',
        label: 'Herringbone',
        description: 'Refined herringbone tile.',
        colorSlots: [SLOT_BG('Background', '#0f172a'), SLOT_HIGHLIGHT('Tile')],
    },
    {
        id: 'hexagons',
        label: 'Hexagons',
        description: 'Crisp hexagonal honeycomb wireframe.',
        colorSlots: [SLOT_BG('Background', '#0f172a'), SLOT_HIGHLIGHT('Edge')],
    },
    {
        id: 'triangles',
        label: 'Triangles',
        description: 'Subtle triangle tessellation.',
        colorSlots: [SLOT_BG('Background', '#0b1224'), SLOT_LINE('Color A'), SLOT_HIGHLIGHT('Color B')],
    },
    {
        id: 'plusSigns',
        label: 'Plus Grid',
        description: 'Sparse plus marks aligned to a grid.',
        colorSlots: [SLOT_BG('Background', '#ffffff'), SLOT_LINE('Plus')],
    },
    {
        id: 'blueprint',
        label: 'Blueprint',
        description: 'Technical blueprint with corner ticks.',
        colorSlots: [SLOT_BG('Background', '#0c2a4a'), SLOT_HIGHLIGHT('Lines')],
    },
    {
        id: 'circuitTrace',
        label: 'Circuit Trace',
        description: 'Static circuit-board traces and pads.',
        colorSlots: [SLOT_BG('Background', '#04111d'), SLOT_HIGHLIGHT('Trace'), SLOT_ACCENT('Pad')],
    },
    {
        id: 'terrazzo',
        label: 'Terrazzo',
        description: 'Stylized terrazzo chips on a soft surface.',
        colorSlots: [SLOT_BG('Background', '#f3f4f6'), SLOT_LINE('Chip A'), SLOT_ACCENT('Chip B'), SLOT_HIGHLIGHT('Chip C')],
    },
    {
        id: 'confetti',
        label: 'Confetti',
        description: 'Sparse modern confetti shapes.',
        colorSlots: [SLOT_BG('Background', '#ffffff'), SLOT_LINE('Color A'), SLOT_ACCENT('Color B'), SLOT_HIGHLIGHT('Color C')],
    },
    {
        id: 'staticNoise',
        label: 'Static Noise',
        description: 'Subtle film-grain texture (no motion).',
        colorSlots: [SLOT_BG('Background', '#0f172a'), SLOT_LINE('Tint')],
    },
];

export const HERO_BG_PATTERN_META: Record<HeroBgPatternId, HeroBgPatternMeta> =
    HERO_BG_PATTERN_LIST.reduce((acc, m) => {
        acc[m.id] = m;
        return acc;
    }, {} as Record<HeroBgPatternId, HeroBgPatternMeta>);

interface PatternProps {
    colors: string[];
    /** 0.5 - 2.0; multiplies the natural tile size. */
    scale: number;
    /** Degrees, applied to the tile layer. */
    rotation: number;
    /** 0 - 1 over the pattern (in addition to any overlay). */
    opacity: number;
}

/**
 * Apply scale + rotation to the tile layer. We scale via background-size
 * (or transform on SVGs) and rotate via CSS transform.
 */
function tileWrapper(scale: number, rotation: number, opacity: number, children: React.ReactNode, bg: string) {
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: bg }}>
            <div
                className="absolute inset-[-25%]"
                style={{
                    transform: `rotate(${rotation}deg)`,
                    opacity,
                }}
            >
                <div className="absolute inset-0" style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// SVG-pattern based tiles. We render a single <svg> filling the wrapper and
// reference a <pattern> via fill="url(#id)" — this gives crisp, infinite tiling
// regardless of viewport size.
// ---------------------------------------------------------------------------

function svgPattern(id: string, w: number, h: number, children: React.ReactNode): React.ReactNode {
    return (
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
            <defs>
                <pattern id={id} x={0} y={0} width={w} height={h} patternUnits="userSpaceOnUse">
                    {children}
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${id})`} />
        </svg>
    );
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

function DotsGrid({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, dot] = colors;
    const id = useId().replace(/[:]/g, '');
    return tileWrapper(scale, rotation, opacity, svgPattern(`p-${id}`, 24, 24, <circle cx={2} cy={2} r={1.4} fill={dot} />), bg);
}

function DotsFade({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, dot] = colors;
    const id = useId().replace(/[:]/g, '');
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: bg }}>
            <div
                className="absolute inset-[-25%]"
                style={{
                    transform: `rotate(${rotation}deg)`,
                    opacity,
                    maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
                    WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
                }}
            >
                <div className="absolute inset-0" style={{ transform: `scale(${scale})` }}>
                    {svgPattern(`p-${id}`, 18, 18, <circle cx={2} cy={2} r={1.6} fill={dot} />)}
                </div>
            </div>
        </div>
    );
}

function GridLines({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, line] = colors;
    const id = useId().replace(/[:]/g, '');
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 32, 32,
        <>
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke={line} strokeOpacity={0.35} strokeWidth={1} />
        </>,
    ), bg);
}

function DiagonalLines({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, line] = colors;
    const id = useId().replace(/[:]/g, '');
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 18, 18,
        <line x1={0} y1={18} x2={18} y2={0} stroke={line} strokeOpacity={0.45} strokeWidth={1.5} />,
    ), bg);
}

function Crosshatch({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, line] = colors;
    const id = useId().replace(/[:]/g, '');
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 16, 16,
        <>
            <line x1={0} y1={16} x2={16} y2={0} stroke={line} strokeOpacity={0.3} strokeWidth={1} />
            <line x1={0} y1={0} x2={16} y2={16} stroke={line} strokeOpacity={0.3} strokeWidth={1} />
        </>,
    ), bg);
}

function IsometricGrid({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, line, highlight] = colors;
    const id = useId().replace(/[:]/g, '');
    // 30°/-30°/vertical lines = isometric base.
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 60, 52,
        <>
            <line x1={0} y1={0} x2={30} y2={52} stroke={line} strokeOpacity={0.35} strokeWidth={1} />
            <line x1={30} y1={52} x2={60} y2={0} stroke={line} strokeOpacity={0.35} strokeWidth={1} />
            <line x1={30} y1={0} x2={30} y2={52} stroke={highlight} strokeOpacity={0.18} strokeWidth={1} />
        </>,
    ), bg);
}

function Topographic({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, lineA, lineB] = colors;
    const id = useId().replace(/[:]/g, '');
    // Multiple concentric blob-like rings produce contour-line feel.
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 200, 200,
        <>
            {[20, 36, 52, 70, 90].map((r, i) => (
                <ellipse key={i} cx={70} cy={80} rx={r} ry={r * 0.7} fill="none" stroke={i % 2 ? lineB : lineA} strokeOpacity={0.45} strokeWidth={1} />
            ))}
            {[14, 28, 44, 60, 78].map((r, i) => (
                <ellipse key={i} cx={150} cy={140} rx={r} ry={r * 0.65} fill="none" stroke={i % 2 ? lineA : lineB} strokeOpacity={0.4} strokeWidth={1} />
            ))}
        </>,
    ), bg);
}

function Seigaiha({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, wave] = colors;
    const id = useId().replace(/[:]/g, '');
    // Classic interlocking arcs in a 60×30 tile.
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 60, 30,
        <>
            <circle cx={30} cy={0} r={28} fill="none" stroke={wave} strokeOpacity={0.45} strokeWidth={1.2} />
            <circle cx={30} cy={0} r={20} fill="none" stroke={wave} strokeOpacity={0.35} strokeWidth={1.2} />
            <circle cx={30} cy={0} r={12} fill="none" stroke={wave} strokeOpacity={0.25} strokeWidth={1.2} />
            <circle cx={0} cy={30} r={28} fill="none" stroke={wave} strokeOpacity={0.45} strokeWidth={1.2} />
            <circle cx={0} cy={30} r={20} fill="none" stroke={wave} strokeOpacity={0.35} strokeWidth={1.2} />
            <circle cx={0} cy={30} r={12} fill="none" stroke={wave} strokeOpacity={0.25} strokeWidth={1.2} />
            <circle cx={60} cy={30} r={28} fill="none" stroke={wave} strokeOpacity={0.45} strokeWidth={1.2} />
            <circle cx={60} cy={30} r={20} fill="none" stroke={wave} strokeOpacity={0.35} strokeWidth={1.2} />
            <circle cx={60} cy={30} r={12} fill="none" stroke={wave} strokeOpacity={0.25} strokeWidth={1.2} />
        </>,
    ), bg);
}

function WavyLines({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, line] = colors;
    const id = useId().replace(/[:]/g, '');
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 80, 24,
        <>
            <path d="M0 12 C 20 0, 40 24, 80 12" fill="none" stroke={line} strokeOpacity={0.4} strokeWidth={1.2} />
        </>,
    ), bg);
}

function ConcentricCircles({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, ring] = colors;
    const id = useId().replace(/[:]/g, '');
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 48, 48,
        <>
            {[6, 12, 18].map((r, i) => (
                <circle key={i} cx={24} cy={24} r={r} fill="none" stroke={ring} strokeOpacity={0.4} strokeWidth={1} />
            ))}
        </>,
    ), bg);
}

function Chevron({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, a, b] = colors;
    const id = useId().replace(/[:]/g, '');
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 40, 20,
        <>
            <path d="M0 20 L20 0 L40 20 L20 12 Z" fill={a} fillOpacity={0.5} />
            <path d="M0 20 L20 12 L40 20 L40 20 Z" fill={b} fillOpacity={0.35} />
        </>,
    ), bg);
}

function Herringbone({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, tile] = colors;
    const id = useId().replace(/[:]/g, '');
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 48, 48,
        <>
            <rect x={0} y={4} width={20} height={6} rx={1} fill={tile} fillOpacity={0.35} transform="rotate(45 10 7)" />
            <rect x={24} y={4} width={20} height={6} rx={1} fill={tile} fillOpacity={0.35} transform="rotate(-45 34 7)" />
            <rect x={0} y={28} width={20} height={6} rx={1} fill={tile} fillOpacity={0.35} transform="rotate(-45 10 31)" />
            <rect x={24} y={28} width={20} height={6} rx={1} fill={tile} fillOpacity={0.35} transform="rotate(45 34 31)" />
        </>,
    ), bg);
}

function Hexagons({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, edge] = colors;
    const id = useId().replace(/[:]/g, '');
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 56, 48,
        <>
            <polygon points="14,2 42,2 56,24 42,46 14,46 0,24" fill="none" stroke={edge} strokeOpacity={0.35} strokeWidth={1} />
            <polygon points="42,26 70,26 84,48 70,70 42,70 28,48" fill="none" stroke={edge} strokeOpacity={0.18} strokeWidth={1} />
        </>,
    ), bg);
}

function Triangles({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, a, b] = colors;
    const id = useId().replace(/[:]/g, '');
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 40, 36,
        <>
            <polygon points="0,36 20,0 40,36" fill={a} fillOpacity={0.18} />
            <polygon points="20,0 40,36 60,0" fill={b} fillOpacity={0.14} />
            <polygon points="-20,0 0,36 20,0" fill={b} fillOpacity={0.12} />
        </>,
    ), bg);
}

function PlusSigns({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, plus] = colors;
    const id = useId().replace(/[:]/g, '');
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 32, 32,
        <>
            <path d="M16 10 L16 22 M10 16 L22 16" stroke={plus} strokeOpacity={0.4} strokeWidth={1.4} strokeLinecap="round" />
        </>,
    ), bg);
}

function Blueprint({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, lines] = colors;
    const id = useId().replace(/[:]/g, '');
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 96, 96,
        <>
            {/* Major grid */}
            <path d="M 96 0 L 0 0 0 96" fill="none" stroke={lines} strokeOpacity={0.18} strokeWidth={1} />
            {/* Minor grid */}
            {[24, 48, 72].map((p) => (
                <g key={p}>
                    <line x1={p} y1={0} x2={p} y2={96} stroke={lines} strokeOpacity={0.08} strokeWidth={0.7} />
                    <line x1={0} y1={p} x2={96} y2={p} stroke={lines} strokeOpacity={0.08} strokeWidth={0.7} />
                </g>
            ))}
            {/* Corner ticks */}
            <path d="M 0 8 L 0 0 L 8 0 M 96 88 L 96 96 L 88 96" stroke={lines} strokeOpacity={0.5} strokeWidth={1.2} fill="none" />
        </>,
    ), bg);
}

function CircuitTrace({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, trace, pad] = colors;
    const id = useId().replace(/[:]/g, '');
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 80, 80,
        <>
            <path d="M0 20 H30 L40 30 V60 H80" stroke={trace} strokeOpacity={0.45} strokeWidth={1.3} fill="none" />
            <path d="M0 60 H20 L30 50 V20 H60 L70 30 V70 H80" stroke={trace} strokeOpacity={0.35} strokeWidth={1.3} fill="none" />
            <circle cx={40} cy={30} r={2.4} fill={pad} />
            <circle cx={60} cy={20} r={2.4} fill={pad} />
            <circle cx={70} cy={70} r={2.4} fill={pad} />
            <circle cx={20} cy={60} r={2.4} fill={pad} />
        </>,
    ), bg);
}

function Terrazzo({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, a, b, c] = colors;
    const id = useId().replace(/[:]/g, '');
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 140, 140,
        <>
            <polygon points="20,30 40,28 38,46 24,50" fill={a} fillOpacity={0.7} />
            <polygon points="80,20 100,30 90,50 76,42" fill={b} fillOpacity={0.65} />
            <polygon points="50,70 72,68 70,90 52,92" fill={c} fillOpacity={0.7} />
            <polygon points="110,90 130,80 132,108 118,114" fill={a} fillOpacity={0.6} />
            <polygon points="14,100 32,108 24,128 8,118" fill={b} fillOpacity={0.6} />
            <circle cx={120} cy={40} r={6} fill={c} fillOpacity={0.65} />
            <circle cx={60} cy={120} r={5} fill={a} fillOpacity={0.55} />
            <polygon points="86,108 104,104 100,120 88,124" fill={b} fillOpacity={0.55} />
        </>,
    ), bg);
}

function Confetti({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, a, b, c] = colors;
    const id = useId().replace(/[:]/g, '');
    return tileWrapper(scale, rotation, opacity, svgPattern(
        `p-${id}`, 120, 120,
        <>
            <rect x={20} y={30} width={10} height={3} fill={a} transform="rotate(20 25 31)" />
            <rect x={60} y={20} width={8} height={3} fill={b} transform="rotate(-30 64 21)" />
            <rect x={100} y={50} width={10} height={3} fill={c} transform="rotate(45 105 51)" />
            <rect x={30} y={80} width={9} height={3} fill={c} transform="rotate(-15 34 81)" />
            <rect x={75} y={90} width={11} height={3} fill={a} transform="rotate(60 80 91)" />
            <circle cx={50} cy={55} r={2} fill={b} />
            <circle cx={90} cy={20} r={1.6} fill={a} />
            <circle cx={110} cy={100} r={2} fill={b} />
            <circle cx={20} cy={110} r={1.6} fill={c} />
        </>,
    ), bg);
}

function StaticNoise({ colors, scale, rotation, opacity }: PatternProps) {
    const [bg, tint] = colors;
    // Deterministic SVG turbulence — no animation.
    const noiseDataUri =
        `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.45 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;
    return (
        <div className="absolute inset-0 overflow-hidden" aria-hidden style={{ background: bg }}>
            <div
                className="absolute inset-[-15%]"
                style={{
                    transform: `rotate(${rotation}deg) scale(${scale})`,
                    opacity,
                    backgroundImage: noiseDataUri,
                    backgroundSize: '240px 240px',
                    mixBlendMode: 'overlay',
                    filter: 'contrast(140%)',
                }}
            />
            <div
                className="absolute inset-0 mix-blend-overlay"
                style={{ background: mix(tint, 30, 'transparent'), opacity: opacity * 0.35 }}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const HERO_BG_PATTERNS: Record<HeroBgPatternId, { Component: React.ComponentType<PatternProps> }> = {
    dotsGrid: { Component: DotsGrid },
    dotsFade: { Component: DotsFade },
    gridLines: { Component: GridLines },
    diagonalLines: { Component: DiagonalLines },
    crosshatch: { Component: Crosshatch },
    isometricGrid: { Component: IsometricGrid },
    topographic: { Component: Topographic },
    seigaiha: { Component: Seigaiha },
    wavyLines: { Component: WavyLines },
    concentricCircles: { Component: ConcentricCircles },
    chevron: { Component: Chevron },
    herringbone: { Component: Herringbone },
    hexagons: { Component: Hexagons },
    triangles: { Component: Triangles },
    plusSigns: { Component: PlusSigns },
    blueprint: { Component: Blueprint },
    circuitTrace: { Component: CircuitTrace },
    terrazzo: { Component: Terrazzo },
    confetti: { Component: Confetti },
    staticNoise: { Component: StaticNoise },
};

export const DEFAULT_PATTERN_OPTIONS = {
    scale: 1,
    rotation: 0,
    opacity: 1,
};

export function HeroBgPattern({
    id,
    colors,
    scale = 1,
    rotation = 0,
    opacity = 1,
}: {
    id: HeroBgPatternId;
    colors: string[];
    scale?: number;
    rotation?: number;
    opacity?: number;
}) {
    const entry = HERO_BG_PATTERNS[id];
    if (!entry) return null;
    const Comp = entry.Component;
    return <Comp colors={colors} scale={scale} rotation={rotation} opacity={opacity} />;
}
