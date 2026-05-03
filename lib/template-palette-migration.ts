type PaletteColors = Record<string, string | undefined>;
type TemplatePalettes = Record<string, PaletteColors>;

const PALETTE_KEYS = ['primary', 'secondary', 'accent'] as const;
const PALETTE_TOKEN_RE = /^palette:(primary|secondary|accent)$/;
const CSS_COLOR_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
const TOKEN_AWARE_COLOR_FIELDS = new Set(['backgroundColor', 'activeColor', 'bgColor']);
const CUSTOM_CSS_FIELDS = new Set(['__customCss', 'customCss', 'css']);

type PaletteToken = `palette:${typeof PALETTE_KEYS[number]}`;

interface MigrationContext {
  colorToToken: Map<string, PaletteToken>;
  replacements: number;
}

export interface PaletteTokenMigrationResult<T> {
  data: T;
  changed: boolean;
  replacements: number;
}

export function migratePaletteTokensInDesignData<T>(
  designData: T,
  palettes: TemplatePalettes,
  selectedPaletteKey?: string,
): PaletteTokenMigrationResult<T> {
  const context: MigrationContext = {
    colorToToken: buildColorTokenMap(palettes, selectedPaletteKey),
    replacements: 0,
  };

  if (context.colorToToken.size === 0) {
    return { data: designData, changed: false, replacements: 0 };
  }

  const data = migrateValue(designData, undefined, context) as T;

  return {
    data,
    changed: context.replacements > 0,
    replacements: context.replacements,
  };
}

function migrateValue(value: unknown, key: string | undefined, context: MigrationContext): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const migrated = value.map((item) => {
      const next = migrateValue(item, undefined, context);
      if (next !== item) changed = true;
      return next;
    });
    return changed ? migrated : value;
  }

  if (value && typeof value === 'object') {
    let changed = false;
    const migrated: Record<string, unknown> = {};

    for (const [childKey, childValue] of Object.entries(value)) {
      const next = migrateValue(childValue, childKey, context);
      migrated[childKey] = next;
      if (next !== childValue) changed = true;
    }

    return changed ? migrated : value;
  }

  if (typeof value !== 'string') return value;
  if (PALETTE_TOKEN_RE.test(value)) return value;

  if (key && TOKEN_AWARE_COLOR_FIELDS.has(key)) {
    const token = context.colorToToken.get(normalizeHex(value));
    if (token) {
      context.replacements += 1;
      return token;
    }
  }

  if (key && CUSTOM_CSS_FIELDS.has(key)) {
    const migrated = value.replace(CSS_COLOR_RE, (match) => {
      const token = context.colorToToken.get(normalizeHex(match));
      if (!token) return match;
      context.replacements += 1;
      return `var(--${token.replace('palette:', '')})`;
    });
    return migrated === value ? value : migrated;
  }

  return value;
}

function buildColorTokenMap(palettes: TemplatePalettes, selectedPaletteKey?: string): Map<string, PaletteToken> {
  const colorToToken = new Map<string, PaletteToken>();
  const orderedPalettes: PaletteColors[] = [];

  if (selectedPaletteKey && palettes[selectedPaletteKey]) {
    orderedPalettes.push(palettes[selectedPaletteKey]);
  }

  for (const [key, palette] of Object.entries(palettes || {})) {
    if (key !== selectedPaletteKey) orderedPalettes.push(palette);
  }

  for (const palette of orderedPalettes) {
    for (const key of PALETTE_KEYS) {
      const color = palette?.[key];
      if (!color) continue;

      const normalized = normalizeHex(color);
      if (normalized && !colorToToken.has(normalized)) {
        colorToToken.set(normalized, `palette:${key}`);
      }
    }
  }

  return colorToToken;
}

function normalizeHex(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/.test(trimmed)) return '';

  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }

  return trimmed;
}
