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
