// Shared text-style types/helpers for inline rich text editing.
// Used by EditableText and RichTextToolbar.

export interface TextShadowSettings {
    enabled: boolean;
    x: number;
    y: number;
    blur: number;
    color: string;
}

export const DEFAULT_TEXT_SHADOW: TextShadowSettings = {
    enabled: true,
    x: 0,
    y: 2,
    blur: 8,
    color: 'rgba(0,0,0,0.35)',
};

export function textShadowToCss(s?: TextShadowSettings | null): string | undefined {
    if (!s || !s.enabled) return undefined;
    return `${s.x}px ${s.y}px ${s.blur}px ${s.color}`;
}

export type TextAlignValue = 'left' | 'center' | 'right' | 'justify';

export interface TextStyles {
    fontFamily?: string;
    fontSize?: string;
    color?: string;
    fontWeight?: string;
    letterSpacing?: string;
    lineHeight?: string;
    textAlign?: TextAlignValue;
    textShadow?: TextShadowSettings;
}

export const FONT_SIZE_SLIDER = {
    min: 8,
    max: 160,
    step: 1,
    unit: 'px',
    fallback: 16,
};

export const FONT_WEIGHT_SLIDER = {
    min: 100,
    max: 900,
    step: 100,
    fallback: 400,
};

export const LETTER_SPACING_SLIDER = {
    min: -5,
    max: 20,
    step: 0.1,
    unit: 'px',
    fallback: 0,
};

export const LINE_HEIGHT_SLIDER = {
    min: 0,
    max: 3,
    step: 0.05,
    fallback: 1.4,
};

// Parse a CSS length value into a number in px. Returns the slider fallback
// when the value can't be parsed. Handles px, rem, em, %, and unitless.
export function parseLengthPx(value: string | undefined, fallbackPx: number, basePx = 16): number {
    if (!value) return fallbackPx;
    const trimmed = String(value).trim();
    const match = /^(-?\d*\.?\d+)\s*([a-z%]*)$/i.exec(trimmed);
    if (!match) return fallbackPx;
    const n = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    if (!isFinite(n)) return fallbackPx;
    switch (unit) {
        case '':
        case 'px': return n;
        case 'rem':
        case 'em': return n * basePx;
        case '%': return (n / 100) * basePx;
        default: return n;
    }
}

// Parse a unitless or "x.xx" line-height into a number.
export function parseUnitless(value: string | undefined, fallback: number): number {
    if (value === undefined || value === null || value === '') return fallback;
    const n = parseFloat(String(value));
    return isFinite(n) ? n : fallback;
}

export const POPULAR_FONTS = [
    'Inter', 'Roboto', 'Poppins', 'Montserrat', 'Raleway',
    'Nunito', 'DM Sans', 'Plus Jakarta Sans', 'Space Grotesk', 'Barlow',
    'Oswald', 'Bebas Neue', 'Anton', 'Fjalla One', 'Teko',
    'Righteous', 'Russo One', 'Exo 2', 'Alfa Slab One', 'Ultra',
    'Abril Fatface', 'Playfair Display', 'Merriweather', 'Lora', 'Cormorant Garamond',
    'Libre Baskerville', 'Bitter', 'EB Garamond', 'Spectral', 'Crimson Text',
    'Pacifico', 'Fredoka One', 'Baloo 2', 'Comfortaa', 'Lilita One',
    'Permanent Marker', 'Caveat', 'Patrick Hand', 'Varela Round', 'Boogaloo',
    'Dancing Script', 'Lobster', 'Sacramento', 'Great Vibes', 'Satisfy',
    'Cookie', 'Yellowtail', 'Allura', 'Alex Brush', 'Parisienne',
];

export const NEUTRAL_SWATCHES = [
    '#ffffff', '#f1f5f9', '#cbd5e1', '#94a3b8',
    '#475569', '#1e293b', '#0f172a', '#000000',
];
