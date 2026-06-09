export type PaletteColors = Record<string, string | undefined>;

const PALETTE_TOKEN_PREFIX = 'palette:';
const PALETTE_KEYS = new Set(['primary', 'secondary', 'accent']);

export function resolvePaletteColor(value: unknown, palette: PaletteColors, fallback = ''): string {
  if (typeof value !== 'string') return fallback;

  const color = value.trim();
  if (!color) return fallback;

  if (color.startsWith(PALETTE_TOKEN_PREFIX)) {
    const key = color.slice(PALETTE_TOKEN_PREFIX.length);
    return PALETTE_KEYS.has(key) ? palette[key] || fallback : fallback;
  }

  return color;
}

export function isPaletteColorToken(value: unknown): value is `palette:${string}` {
  return typeof value === 'string' && value.startsWith(PALETTE_TOKEN_PREFIX);
}

export type GradientConfig = { from: string; to: string; via?: string; angle: number };

export function resolveGradientCss(
  gradient: unknown,
  palette: PaletteColors,
  fallbackFrom = '#1f2937',
  fallbackTo = '#ef4444',
): string {
  if (!gradient || typeof gradient !== 'object' || Array.isArray(gradient)) return '';
  const grad = gradient as Partial<GradientConfig>;
  const from = resolvePaletteColor(grad.from, palette, fallbackFrom);
  const to = resolvePaletteColor(grad.to, palette, fallbackTo);
  const via = grad.via ? resolvePaletteColor(grad.via, palette, '#ffffff') : null;
  const stops = via ? `${from}, ${via}, ${to}` : `${from}, ${to}`;
  const angle = Number.isFinite(grad.angle) ? Number(grad.angle) : 135;
  return `linear-gradient(${angle}deg, ${stops})`;
}

export function readableTextColorForBackground(
  backgroundColor: string,
  preferredTextColor = '#111827',
  lightTextColor = '#ffffff',
  darkTextColor = '#111827',
): string {
  const preferredRatio = contrastRatio(preferredTextColor, backgroundColor);
  if (preferredRatio !== null && preferredRatio >= 4.5) return preferredTextColor;

  const lightRatio = contrastRatio(lightTextColor, backgroundColor);
  const darkRatio = contrastRatio(darkTextColor, backgroundColor);
  if (lightRatio === null && darkRatio === null) return preferredTextColor;

  return (lightRatio ?? 0) >= (darkRatio ?? 0) ? lightTextColor : darkTextColor;
}

export function readableAccentColorForBackground(
  backgroundColor: string,
  preferredAccentColor = '#dc2626',
  fallbackTextColor = '#111827',
): string {
  const preferredRatio = contrastRatio(preferredAccentColor, backgroundColor);
  if (preferredRatio !== null && preferredRatio >= 3) return preferredAccentColor;

  const fallbackRatio = contrastRatio(fallbackTextColor, backgroundColor);
  if (fallbackRatio !== null && fallbackRatio >= 3) return fallbackTextColor;

  return readableTextColorForBackground(backgroundColor, fallbackTextColor);
}

export function contrastRatio(colorA: string, colorB: string): number | null {
  const rgbA = cssColorToRgb(colorA);
  const rgbB = cssColorToRgb(colorB);
  if (!rgbA || !rgbB) return null;

  const lumA = relativeLuminance(rgbA.r, rgbA.g, rgbA.b);
  const lumB = relativeLuminance(rgbB.r, rgbB.g, rgbB.b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function cssColorToRgb(value: string): { r: number; g: number; b: number } | null {
  const normalized = value.trim();
  const short = normalized.match(/^#([0-9a-f]{3})$/i);
  if (short) {
    const [r, g, b] = short[1].split('').map((part) => parseInt(part + part, 16));
    return { r, g, b };
  }

  const full = normalized.match(/^#([0-9a-f]{6})$/i);
  if (full) {
    const hex = full[1];
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  const rgba = normalized.match(/^rgba?\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*(?:,\s*([+-]?\d*\.?\d+)\s*)?\)$/i);
  if (rgba) {
    const rgb = {
      r: clampColorChannel(Number(rgba[1])),
      g: clampColorChannel(Number(rgba[2])),
      b: clampColorChannel(Number(rgba[3])),
    };
    const alpha = rgba[4] === undefined ? 1 : clampAlpha(Number(rgba[4]));
    if (alpha >= 1) return rgb;
    return {
      r: Math.round(rgb.r * alpha + 255 * (1 - alpha)),
      g: Math.round(rgb.g * alpha + 255 * (1 - alpha)),
      b: Math.round(rgb.b * alpha + 255 * (1 - alpha)),
    };
  }

  return null;
}

function clampColorChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(255, Math.max(0, Math.round(value)));
}

function clampAlpha(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
