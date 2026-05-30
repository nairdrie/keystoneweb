import { resolvePaletteColor, type PaletteColors } from '@/lib/palette-colors';

export type ResponsiveBreakpoint = 'desktop' | 'tablet' | 'mobile';

export type ResponsiveValue<T> = {
  desktop?: T;
  tablet?: T;
  mobile?: T;
};

export type ResponsiveBoxValue = {
  desktop?: ResponsiveBoxSides;
  tablet?: ResponsiveBoxSides;
  mobile?: ResponsiveBoxSides;
};

export type ResponsiveBoxSides = {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
};

export type LayoutContainerWidth = 'default' | 'narrow' | 'wide' | 'full' | `${number}%`;
export type LayoutHorizontalAlign = 'left' | 'center' | 'right';
export type LayoutVerticalAlign = 'top' | 'middle' | 'bottom';
export type LayoutContentOrder = 'default' | 'text-first' | 'media-first' | 'reverse';

export const LAYOUT_CONTAINER_WIDTH_PERCENT_MIN = 30;
export const LAYOUT_CONTAINER_WIDTH_PERCENT_MAX = 100;

export type SectionLayoutSettings = {
  containerWidth: LayoutContainerWidth;
  horizontalAlign: LayoutHorizontalAlign;
  verticalAlign: LayoutVerticalAlign;
  minHeight?: ResponsiveValue<string>;
  columns?: ResponsiveValue<number>;
  gap?: ResponsiveValue<string>;
  padding?: ResponsiveBoxValue;
  margin?: ResponsiveBoxValue;
  contentOrder?: ResponsiveValue<LayoutContentOrder>;
};

export type SectionSettings = {
  layout: SectionLayoutSettings;
};

export type LayoutCapabilities = {
  supportsContainerWidth: boolean;
  supportsHorizontalAlign: boolean;
  supportsColumns: boolean;
  supportsGap: boolean;
  supportsPadding: boolean;
  supportsMargin: boolean;
};

export const DEFAULT_SECTION_LAYOUT: SectionLayoutSettings = {
  containerWidth: 'default',
  horizontalAlign: 'left',
  verticalAlign: 'top',
  minHeight: undefined,
  columns: undefined,
  gap: undefined,
  padding: undefined,
  margin: undefined,
  contentOrder: undefined,
};

export const DEFAULT_LAYOUT_SETTINGS = DEFAULT_SECTION_LAYOUT;

export const DEFAULT_SECTION_SETTINGS: SectionSettings = {
  layout: DEFAULT_SECTION_LAYOUT,
};

export const DEFAULT_LAYOUT_COLUMN_MAX = 6;

const DEFAULT_CAPABILITIES: LayoutCapabilities = {
  supportsContainerWidth: true,
  supportsHorizontalAlign: true,
  supportsColumns: false,
  supportsGap: false,
  supportsPadding: true,
  supportsMargin: true,
};

const COLUMN_BLOCKS = new Set([
  'servicesGrid',
  'testimonials',
  'stats',
  'gallery',
  'contact',
  'productGrid',
  'pricing',
  'team',
  'blog',
  'menu',
  'deliveryLinks',
  'events',
  'resources',
  'carousel',
  'logoCloud',
  'socialFeed',
]);

const GAP_BLOCKS = new Set([
  ...COLUMN_BLOCKS,
  'featuresList',
  'faq',
  'featuredQuote',
  'carousel',
  'timeline',
]);

export const BLOCK_LAYOUT_CAPABILITIES: Record<string, LayoutCapabilities> = {
  hero: makeCapabilities(),
  text: makeCapabilities(),
  image: makeCapabilities(),
  map: makeCapabilities(),
  custom_html: makeCapabilities(),
  customHtml: makeCapabilities(),
  customHTML: makeCapabilities(),
  servicesGrid: makeColumnCapabilities(),
  featuresList: makeGapCapabilities(),
  aboutImageText: makeCapabilities(),
  cta: makeCapabilities(),
  testimonials: makeColumnCapabilities(),
  stats: makeColumnCapabilities(),
  gallery: makeColumnCapabilities(),
  contact: makeColumnCapabilities(),
  faq: makeGapCapabilities(),
  booking: makeCapabilities(),
  productGrid: makeColumnCapabilities(),
  contact_form: makeCapabilities(),
  contactForm: makeCapabilities(),
  estimateForm: makeCapabilities(),
  logoCloud: makeColumnCapabilities(),
  pricing: makeColumnCapabilities(),
  team: makeColumnCapabilities(),
  blog: makeColumnCapabilities(),
  menu: makeColumnCapabilities(),
  deliveryLinks: makeColumnCapabilities(),
  events: makeColumnCapabilities(),
  pdf: makeCapabilities(),
  resources: makeColumnCapabilities(),
  featuredQuote: makeGapCapabilities(),
  carousel: makeColumnCapabilities(),
  video: makeCapabilities(),
  socialFeed: makeColumnCapabilities(),
  tabBar: makeCapabilities(),
  timeline: makeGapCapabilities(),
  userProfile: makeCapabilities(),
  membershipGate: makeCapabilities(),
  sideBySide: makeCapabilities(),
};

function makeCapabilities(overrides: Partial<LayoutCapabilities> = {}): LayoutCapabilities {
  return { ...DEFAULT_CAPABILITIES, ...overrides };
}

function makeColumnCapabilities(overrides: Partial<LayoutCapabilities> = {}): LayoutCapabilities {
  return makeCapabilities({ supportsColumns: true, supportsGap: true, ...overrides });
}

function makeGapCapabilities(overrides: Partial<LayoutCapabilities> = {}): LayoutCapabilities {
  return makeCapabilities({ supportsGap: true, ...overrides });
}

export function getLayoutCapabilities(blockType: string): LayoutCapabilities {
  return BLOCK_LAYOUT_CAPABILITIES[blockType] || makeCapabilities({
    supportsColumns: COLUMN_BLOCKS.has(blockType),
    supportsGap: GAP_BLOCKS.has(blockType),
  });
}

export function normalizeSectionSettings(value: unknown): SectionSettings {
  const source = isObject(value) ? value as Record<string, unknown> : {};
  const sourceLayout = isObject(source.layout) ? source.layout as Record<string, unknown> : {};

  return {
    layout: {
      containerWidth: normalizeContainerWidth(sourceLayout.containerWidth),
      horizontalAlign: readEnum(sourceLayout.horizontalAlign, ['left', 'center', 'right'], DEFAULT_SECTION_LAYOUT.horizontalAlign),
      verticalAlign: DEFAULT_SECTION_LAYOUT.verticalAlign,
      minHeight: undefined,
      columns: normalizeResponsiveNumber(sourceLayout.columns, 1, DEFAULT_LAYOUT_COLUMN_MAX),
      gap: normalizeResponsiveString(sourceLayout.gap),
      padding: normalizeResponsiveBox(sourceLayout.padding),
      margin: normalizeResponsiveBox(sourceLayout.margin),
      contentOrder: undefined,
    },
  };
}

export function areSectionSettingsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeSectionSettings(a)) === JSON.stringify(normalizeSectionSettings(b));
}

export function hasLayoutOverrides(value: unknown): boolean {
  const settings = normalizeSectionSettings(value).layout;
  return Boolean(
    hasResponsiveValues(settings.columns) ||
    hasResponsiveValues(settings.gap) ||
    hasResponsiveBoxValues(settings.padding) ||
    hasResponsiveBoxValues(settings.margin),
  );
}

export function buildLayoutCss(blockId: string, blockType: string, sectionSettings: unknown, blockData?: unknown): string {
  if (!hasLayoutOverrides(sectionSettings)) return '';

  const capabilities = getLayoutCapabilities(blockType);
  const layout = normalizeSectionSettings(sectionSettings).layout;
  const columnLimit = getLayoutColumnLimit(blockType, blockData);
  const scope = `[data-block-id="${escapeAttribute(blockId)}"]`;
  const sectionTarget = `${scope} > section, ${scope} > div:first-of-type`;
  const contentTarget = [
    `${scope} > section > div:first-child`,
    `${scope} > div:first-of-type`,
    `${scope} .ks-layout-content`,
  ].join(', ');
  const gridTarget = [
    `${scope} > section > div:first-child > .grid`,
    `${scope} > section > div:first-child > div.grid`,
    `${scope} > div:first-of-type > .grid`,
    `${scope} .ks-layout-grid`,
  ].join(', ');
  const stackGapTarget = [
    `${scope} > section > div:first-child > [class*="space-y-"] > :not([hidden]) ~ :not([hidden])`,
    `${scope} > div:first-of-type > [class*="space-y-"] > :not([hidden]) ~ :not([hidden])`,
    `${scope} .ks-layout-stack > :not([hidden]) ~ :not([hidden])`,
  ].join(', ');
  const rules: string[] = [];

  const baseSection: string[] = [];
  const baseContent: string[] = [];
  const baseGrid: string[] = [];
  const baseStackGap: string[] = [];

  if (capabilities.supportsPadding) pushBox(baseSection, 'padding', layout.padding?.desktop);
  if (capabilities.supportsMargin) pushBox(baseSection, 'margin', layout.margin?.desktop);
  if (capabilities.supportsColumns) pushIfValue(baseGrid, 'grid-template-columns', columnsValue(layout.columns?.desktop, columnLimit));
  if (capabilities.supportsGap) pushIfValue(baseGrid, 'gap', layout.gap?.desktop);
  if (capabilities.supportsGap) pushIfValue(baseStackGap, 'margin-top', layout.gap?.desktop);

  pushRule(rules, sectionTarget, baseSection);
  pushRule(rules, contentTarget, baseContent);
  pushRule(rules, gridTarget, baseGrid);
  pushRule(rules, stackGapTarget, baseStackGap);

  for (const [breakpoint, query] of [
    ['tablet', '@media (max-width: 1023px)'] as const,
    ['mobile', '@media (max-width: 767px)'] as const,
  ]) {
    const sectionDeclarations: string[] = [];
    const gridDeclarations: string[] = [];
    const stackGapDeclarations: string[] = [];

    if (capabilities.supportsPadding) pushBox(sectionDeclarations, 'padding', layout.padding?.[breakpoint]);
    if (capabilities.supportsMargin) pushBox(sectionDeclarations, 'margin', layout.margin?.[breakpoint]);
    if (capabilities.supportsColumns) pushIfValue(gridDeclarations, 'grid-template-columns', columnsValue(layout.columns?.[breakpoint], columnLimit));
    if (capabilities.supportsGap) pushIfValue(gridDeclarations, 'gap', layout.gap?.[breakpoint]);
    if (capabilities.supportsGap) pushIfValue(stackGapDeclarations, 'margin-top', layout.gap?.[breakpoint]);

    const nested: string[] = [];
    pushRule(nested, sectionTarget, sectionDeclarations);
    pushRule(nested, gridTarget, gridDeclarations);
    pushRule(nested, stackGapTarget, stackGapDeclarations);
    if (nested.length > 0) rules.push(`${query} { ${nested.join(' ')} }`);
  }

  return rules.join('\n');
}

export function buildSectionStyleCss(
  blockId: string,
  blockData: unknown,
  palette: PaletteColors = {},
): string {
  const data = isObject(blockData) ? blockData : {};
  const backgroundColor = sanitizeCssColor(resolvePaletteColor(data.backgroundColor, palette, ''));
  if (!backgroundColor) return '';

  const scope = `[data-block-id="${escapeAttribute(blockId)}"]`;
  const targets = [
    `${scope} > section`,
    `${scope} > div:first-of-type`,
  ].join(', ');
  const heroFallbackTarget = `${scope} > section .hero-bg-fallback`;

  return [
    `${targets} { background-color: ${backgroundColor} !important; }`,
    `${heroFallbackTarget} { background-color: ${backgroundColor} !important; }`,
  ].join('\n');
}

export function getLayoutColumnLimit(
  blockType: string,
  blockData?: unknown,
  fallbackMax = DEFAULT_LAYOUT_COLUMN_MAX,
): number {
  const normalizedFallback = normalizeColumnLimit(fallbackMax);
  const itemCount = getColumnItemCount(blockType, blockData);
  return itemCount ? Math.min(normalizedFallback, itemCount) : normalizedFallback;
}

function normalizeResponsiveString(value: unknown): ResponsiveValue<string> | undefined {
  if (!isObject(value)) return undefined;
  const result: ResponsiveValue<string> = {};
  for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
    const raw = (value as Record<string, unknown>)[bp];
    const safeValue = sanitizeCssSize(raw);
    if (safeValue) result[bp] = safeValue;
  }
  return hasResponsiveValues(result) ? result : undefined;
}

function normalizeResponsiveNumber(value: unknown, min: number, max: number): ResponsiveValue<number> | undefined {
  if (!isObject(value)) return undefined;
  const result: ResponsiveValue<number> = {};
  for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
    const raw = (value as Record<string, unknown>)[bp];
    const numeric = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(numeric)) result[bp] = Math.min(max, Math.max(min, Math.round(numeric)));
  }
  return hasResponsiveValues(result) ? result : undefined;
}

function normalizeResponsiveBox(value: unknown): ResponsiveBoxValue | undefined {
  if (!isObject(value)) return undefined;
  const result: ResponsiveBoxValue = {};
  for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
    const raw = (value as Record<string, unknown>)[bp];
    if (!isObject(raw)) continue;
    const sides: ResponsiveBoxSides = {};
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const sideValue = (raw as Record<string, unknown>)[side];
      const safeValue = sanitizeCssSize(sideValue);
      if (safeValue) sides[side] = safeValue;
    }
    if (Object.keys(sides).length > 0) result[bp] = sides;
  }
  return hasResponsiveBoxValues(result) ? result : undefined;
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

function normalizeContainerWidth(value: unknown): LayoutContainerWidth {
  if (typeof value !== 'string') return DEFAULT_SECTION_LAYOUT.containerWidth;
  if (['default', 'narrow', 'wide', 'full'].includes(value)) return value as LayoutContainerWidth;
  const percent = getLayoutContainerWidthPercent(value);
  return percent ? `${percent}%` : DEFAULT_SECTION_LAYOUT.containerWidth;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sanitizeCssSize(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return undefined;
  if (/[;{}<>]/.test(trimmed)) return undefined;
  if (/^auto$/i.test(trimmed)) return trimmed;
  if (/^-?\d*\.?\d+$/.test(trimmed)) return `${trimmed}px`;
  if (/^-?\d*\.?\d+(px|rem|em|%|vh|vw|svh|lvh|dvh|svw|lvw|dvw|ch|ex)$/i.test(trimmed)) return trimmed;
  if (/^0$/.test(trimmed)) return trimmed;
  if (/^(calc|clamp|min|max)\([0-9a-z%.\s,+\-*/()]+\)$/i.test(trimmed)) return trimmed;
  return undefined;
}

function sanitizeCssColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return undefined;
  if (/[;{}<>]/.test(trimmed)) return undefined;
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) return trimmed;
  if (/^(transparent|currentcolor)$/i.test(trimmed)) return trimmed;
  if (/^[a-z]+$/i.test(trimmed)) return trimmed;
  if (/^(rgb|rgba|hsl|hsla)\([0-9\s,%.+-]+\)$/i.test(trimmed)) return trimmed;
  return undefined;
}

function hasResponsiveValues<T>(value: ResponsiveValue<T> | undefined): boolean {
  return Boolean(value && Object.values(value).some((entry) => entry !== undefined && entry !== ''));
}

function hasResponsiveBoxValues(value: ResponsiveBoxValue | undefined): boolean {
  return Boolean(value && Object.values(value).some((box) => box && Object.values(box).some(Boolean)));
}

function escapeAttribute(value: string): string {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function pushRule(rules: string[], selector: string, declarations: string[]) {
  if (declarations.length === 0) return;
  rules.push(`${selector} { ${declarations.join('; ')}; }`);
}

function pushIfValue(declarations: string[], property: string, value: string | undefined) {
  if (!value) return;
  declarations.push(`${property}: ${value} !important`);
}

function pushBox(declarations: string[], prefix: 'padding' | 'margin', box: ResponsiveBoxSides | undefined) {
  if (!box) return;
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    if (box[side]) declarations.push(`${prefix}-${side}: ${box[side]} !important`);
  }
}

function columnsValue(value: number | undefined, maxColumns = DEFAULT_LAYOUT_COLUMN_MAX): string | undefined {
  if (!value) return undefined;
  const safeValue = Math.min(normalizeColumnLimit(maxColumns), Math.max(1, Math.round(value)));
  return `repeat(${safeValue}, minmax(0, 1fr))`;
}

function getColumnItemCount(blockType: string, blockData: unknown): number | undefined {
  const data: Record<string, unknown> = isObject(blockData) ? blockData : {};

  switch (blockType) {
    case 'servicesGrid':
      return arrayLengthOrDefault(data.items, 3);
    case 'stats':
      return arrayLengthOrDefault(data.items, 4);
    case 'testimonials':
      return arrayLengthOrDefault(data.items, 3);
    case 'gallery':
      return arrayLength(data.images, { filterEmptyStrings: true });
    case 'contact':
      return arrayLengthOrDefault(data.contactItems, 4);
    case 'pricing':
      return arrayLengthOrDefault(data.tiers, 3);
    case 'team':
      return arrayLengthOrDefault(data.members, 3);
    case 'deliveryLinks':
      return arrayLengthOrDefault(data.links, 3);
    case 'resources':
      return arrayLengthOrDefault(data.items, 3);
    case 'carousel':
      return arrayLengthOrDefault(data.items, 4);
    case 'logoCloud':
      return arrayLength(data.logos, { filterEmptyStrings: true }) || 6;
    case 'socialFeed':
      return arrayLength(data.items);
    default:
      return undefined;
  }
}

function arrayLengthOrDefault(value: unknown, fallback: number): number {
  return arrayLength(value) || fallback;
}

function arrayLength(value: unknown, options: { filterEmptyStrings?: boolean } = {}): number | undefined {
  if (!Array.isArray(value)) return undefined;
  if (!options.filterEmptyStrings) return value.length;
  return value.filter((entry) => typeof entry !== 'string' || entry.trim()).length;
}

function normalizeColumnLimit(value: number): number {
  return Math.max(1, Math.min(DEFAULT_LAYOUT_COLUMN_MAX, Math.floor(value)));
}

export function isFullLayoutContainerWidth(width: LayoutContainerWidth): boolean {
  return width === 'full' || getLayoutContainerWidthPercent(width) === LAYOUT_CONTAINER_WIDTH_PERCENT_MAX;
}

export function getLayoutContainerWidthPercent(width: unknown): number | undefined {
  if (typeof width !== 'string') return undefined;
  const match = width.trim().match(/^(\d{1,3})%$/);
  if (!match) return undefined;
  const percent = Number(match[1]);
  if (
    !Number.isFinite(percent) ||
    percent < LAYOUT_CONTAINER_WIDTH_PERCENT_MIN ||
    percent > LAYOUT_CONTAINER_WIDTH_PERCENT_MAX
  ) {
    return undefined;
  }
  return Math.round(percent);
}
