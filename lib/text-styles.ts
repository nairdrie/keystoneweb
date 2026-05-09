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
    textAlign?: TextAlignValue;
    textShadow?: TextShadowSettings;
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

export const FONT_SIZE_PRESETS = [
    { label: 'XS', val: '0.75rem' },
    { label: 'SM', val: '0.875rem' },
    { label: 'Base', val: '1rem' },
    { label: 'LG', val: '1.25rem' },
    { label: 'XL', val: '1.5rem' },
    { label: '2XL', val: '2rem' },
    { label: '4XL', val: '3rem' },
    { label: 'Hero', val: '5rem' },
];

export const FONT_WEIGHT_PRESETS = [
    { label: 'Thin', value: '100' },
    { label: 'Extra Light', value: '200' },
    { label: 'Light', value: '300' },
    { label: 'Regular', value: '400' },
    { label: 'Medium', value: '500' },
    { label: 'Semi Bold', value: '600' },
    { label: 'Bold', value: '700' },
    { label: 'Extra Bold', value: '800' },
    { label: 'Black', value: '900' },
];

export const NEUTRAL_SWATCHES = [
    '#ffffff', '#f1f5f9', '#cbd5e1', '#94a3b8',
    '#475569', '#1e293b', '#0f172a', '#000000',
];
