import type { CSSProperties } from 'react';
import { contrastRatio, readableTextColorForBackground } from '@/lib/palette-colors';

export const CARD_STYLE_DEFINITIONS = [
  { id: 'soft', label: 'Soft', description: 'Pillowed cards with airy depth and no hard outline.', recommendedTemplates: ['booked', 'craft', 'wellness'] },
  { id: 'bordered', label: 'Bordered', description: 'Crisp outlined cards with flat, structured edges.', recommendedTemplates: ['atlas', 'builder', 'proof'] },
  { id: 'elevated', label: 'Raised', description: 'Larger radius and stronger shadow for premium blocks.', recommendedTemplates: ['booked', 'commerce', 'wellness'] },
  { id: 'splitMedia', label: 'Showcase', description: 'Media-forward cards with a soft frame and subtle accent.', recommendedTemplates: ['commerce', 'estate', 'gallery'] },
  { id: 'accent', label: 'Accent Rail', description: 'Clean cards with a palette accent rule.', recommendedTemplates: ['atlas', 'menu', 'proof'] },
  { id: 'poster', label: 'Poster', description: 'Image-led, edge-to-edge cards with minimal chrome.', recommendedTemplates: ['gallery', 'menu', 'occasion'] },
  { id: 'offset', label: 'Offset', description: 'Bold border with an offset accent shadow.', recommendedTemplates: ['craft', 'retro', 'studio'] },
  { id: 'minimal', label: 'Minimal', description: 'No visible card shell; lets content breathe.', recommendedTemplates: ['editorial', 'gallery', 'studio'] },
  { id: 'solid', label: 'Solid Brand', description: 'Filled brand-color cards with high contrast.', recommendedTemplates: ['proof', 'retro', 'occasion'] },
  { id: 'glass', label: 'Glass', description: 'Light translucent surface with a softened edge.', recommendedTemplates: ['booked', 'wellness', 'estate'] },
  { id: 'editorial', label: 'Editorial Rule', description: 'Square paper cards with strong horizontal rules.', recommendedTemplates: ['editorial', 'learn', 'foundation'] },
  { id: 'inset', label: 'Inset', description: 'Pressed-in surface for calm service details.', recommendedTemplates: ['craft', 'foundation', 'wellness'] },
  { id: 'slab', label: 'Slab', description: 'Heavy structural border and sturdy shadow.', recommendedTemplates: ['builder', 'proof', 'atlas'] },
  { id: 'outline', label: 'Outline', description: 'Dashed outline for light, modular sections.', recommendedTemplates: ['atlas', 'studio', 'learn'] },
  { id: 'glow', label: 'Glow', description: 'Soft colored shadow for high-energy brands.', recommendedTemplates: ['retro', 'occasion', 'studio'] },
  { id: 'gradient', label: 'Gradient Wash', description: 'Subtle palette wash across the card surface.', recommendedTemplates: ['commerce', 'retro', 'occasion'] },
  { id: 'luxe', label: 'Luxe Hairline', description: 'Fine rules and restrained depth for refined brands.', recommendedTemplates: ['estate', 'editorial', 'gallery'] },
  { id: 'utility', label: 'Utility', description: 'Compact dashboard-like cards for dense information.', recommendedTemplates: ['atlas', 'builder', 'learn'] },
  { id: 'playful', label: 'Playful', description: 'Chunky border and lifted color shadow.', recommendedTemplates: ['retro', 'occasion', 'craft'] },
  { id: 'clipped', label: 'Clipped', description: 'Crisp clipped corner for portfolio and hospitality blocks.', recommendedTemplates: ['gallery', 'menu', 'studio'] },
] as const;

export type CardStyle = typeof CARD_STYLE_DEFINITIONS[number]['id'];

export const CARD_STYLE_OPTIONS = CARD_STYLE_DEFINITIONS.map((style) => style.id) as readonly CardStyle[];
export const SURFACE_STYLE_OPTIONS = ['white', 'accent', 'transparent', 'primary', 'secondary', 'gradient'] as const;
export const MEDIA_ASPECT_OPTIONS = ['landscape', 'square', 'portrait', 'wide'] as const;
export const MEDIA_TREATMENT_OPTIONS = ['contained', 'fullBleed', 'framed', 'soft', 'circle'] as const;
export const MARKER_STYLE_OPTIONS = ['plain', 'numbered', 'badge', 'framed', 'accentLine', 'none'] as const;
export const ICON_STYLE_OPTIONS = ['plain', 'badge', 'numbered', 'framed'] as const;
export const SPACING_DENSITY_OPTIONS = ['compact', 'standard', 'spacious'] as const;
export const TEXT_ALIGN_OPTIONS = ['left', 'center'] as const;
export const GALLERY_FRAME_OPTIONS = ['clean', 'rounded', 'gapless', 'editorial', 'poster'] as const;
export const CARD_SURFACE_OPACITY_OPTIONS = ['solid', 'translucent'] as const;
export const CARD_BORDER_STYLE_OPTIONS = ['none', 'solid', 'dashed', 'dotted'] as const;
export const CARD_BORDER_SIDE_OPTIONS = ['all', 'x', 'y', 'top', 'right', 'bottom', 'left', 'none'] as const;
export const CARD_COLOR_TOKEN_OPTIONS = ['neutral', 'primary', 'secondary', 'accent', 'white', 'transparent'] as const;
export const CARD_SHADOW_OPTIONS = ['none', 'soft', 'medium', 'large', 'inset', 'offset', 'glow', 'chunky'] as const;
export const CARD_ACCENT_SIDE_OPTIONS = ['none', 'top', 'right', 'bottom', 'left'] as const;
export const CARD_MEDIA_LAYOUT_OPTIONS = ['stacked', 'split', 'fullBleed', 'none'] as const;
export const CARD_MEDIA_SIZE_OPTIONS = ['compact', 'standard', 'large', 'full'] as const;
export const CARD_CORNER_EFFECT_OPTIONS = ['none', 'clipped'] as const;

export type SurfaceStyle = typeof SURFACE_STYLE_OPTIONS[number];
export type MediaAspect = typeof MEDIA_ASPECT_OPTIONS[number];
export type MediaTreatment = typeof MEDIA_TREATMENT_OPTIONS[number];
export type MarkerStyle = typeof MARKER_STYLE_OPTIONS[number];
export type IconStyle = typeof ICON_STYLE_OPTIONS[number];
export type SpacingDensity = typeof SPACING_DENSITY_OPTIONS[number];
export type TextAlign = typeof TEXT_ALIGN_OPTIONS[number];
export type GalleryFrameStyle = typeof GALLERY_FRAME_OPTIONS[number];
export type CardPresetId = CardStyle;
export type CardSurfaceOpacity = typeof CARD_SURFACE_OPACITY_OPTIONS[number];
export type CardBorderStyle = typeof CARD_BORDER_STYLE_OPTIONS[number];
export type CardBorderSide = typeof CARD_BORDER_SIDE_OPTIONS[number];
export type CardColorToken = typeof CARD_COLOR_TOKEN_OPTIONS[number];
export type CardColorValue = string;
export type CardShadow = typeof CARD_SHADOW_OPTIONS[number];
export type CardAccentSide = typeof CARD_ACCENT_SIDE_OPTIONS[number];
export type CardMediaLayout = typeof CARD_MEDIA_LAYOUT_OPTIONS[number];
export type CardMediaSize = typeof CARD_MEDIA_SIZE_OPTIONS[number];
export type CardCornerEffect = typeof CARD_CORNER_EFFECT_OPTIONS[number];

export type CardSettings = {
  presetId?: CardPresetId | 'custom';
  surface?: CardColorValue;
  surfaceOpacity?: number;
  gradientFrom?: CardColorValue;
  gradientTo?: CardColorValue;
  gradientVia?: CardColorValue;
  gradientAngle?: number;
  paddingPx?: number;
  radiusPx?: number;
  borderWidthPx?: number;
  borderStyle?: CardBorderStyle;
  borderColor?: CardColorValue;
  borderSides?: CardBorderSide;
  shadow?: CardShadow;
  shadowEnabled?: boolean;
  shadowX?: number;
  shadowY?: number;
  shadowBlur?: number;
  shadowInset?: boolean;
  shadowColor?: CardColorValue;
  shadowOpacity?: number;
  paddingDensity?: SpacingDensity | 'none';
  textAlign?: TextAlign;
  accentSide?: CardAccentSide;
  accentWidthPx?: number;
  accentColor?: CardColorValue;
  mediaLayout?: CardMediaLayout;
  mediaAspect?: MediaAspect;
  mediaTreatment?: MediaTreatment;
  mediaSize?: CardMediaSize;
  mediaSizePercent?: number;
  mediaRadiusPx?: number;
  markerStyle?: MarkerStyle;
  iconStyle?: IconStyle;
  cornerEffect?: CardCornerEffect;
};

export type CardShadowControlSettings = Required<Pick<CardSettings, 'shadowEnabled' | 'shadowX' | 'shadowY' | 'shadowBlur' | 'shadowInset'>>;
type CardGradientSettings = Pick<CardSettings, 'gradientFrom' | 'gradientTo' | 'gradientVia' | 'gradientAngle'>;
type CardPaddingSettings = Pick<CardSettings, 'paddingPx'>;
type CardMediaNumericSettings = Pick<CardSettings, 'mediaSizePercent' | 'mediaRadiusPx'>;

type CardPresetRecipe = Required<Omit<CardSettings, 'presetId' | keyof CardShadowControlSettings | keyof CardGradientSettings | keyof CardPaddingSettings | keyof CardMediaNumericSettings>> & Partial<CardShadowControlSettings> & Partial<CardGradientSettings> & Partial<CardPaddingSettings> & Partial<CardMediaNumericSettings>;
export type CompleteCardPresetRecipe = Required<Omit<CardSettings, 'presetId'>>;

export type ResolvedCardSettings = Required<Omit<CardSettings, 'presetId'>> & {
  presetId: CardPresetId | 'custom';
  basePresetId: CardPresetId;
  isCustom: boolean;
};

type Palette = Record<string, string | undefined>;

const DEFAULT_CARD_GRADIENT = {
  gradientFrom: 'accent',
  gradientTo: 'secondary',
  gradientVia: 'white',
  gradientAngle: 135,
} as const;

export const CARD_PRESET_RECIPES: Record<CardPresetId, CompleteCardPresetRecipe> = completeCardPresetRecipes({
  soft: {
    surface: 'white',
    surfaceOpacity: 1,
    radiusPx: 24,
    borderWidthPx: 0,
    borderStyle: 'none',
    borderColor: 'transparent',
    borderSides: 'none',
    shadow: 'medium',
    shadowColor: 'primary',
    shadowOpacity: 0.1,
    paddingDensity: 'standard',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'contained',
    mediaSize: 'standard',
    markerStyle: 'numbered',
    iconStyle: 'badge',
    cornerEffect: 'none',
  },
  bordered: {
    surface: 'white',
    surfaceOpacity: 1,
    radiusPx: 10,
    borderWidthPx: 2,
    borderStyle: 'solid',
    borderColor: 'neutral',
    borderSides: 'all',
    shadow: 'none',
    shadowColor: 'neutral',
    shadowOpacity: 0,
    paddingDensity: 'standard',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'contained',
    mediaSize: 'standard',
    markerStyle: 'numbered',
    iconStyle: 'framed',
    cornerEffect: 'none',
  },
  elevated: {
    surface: 'white',
    surfaceOpacity: 1,
    radiusPx: 24,
    borderWidthPx: 0,
    borderStyle: 'none',
    borderColor: 'transparent',
    borderSides: 'none',
    shadow: 'large',
    shadowColor: 'neutral',
    shadowOpacity: 0.18,
    paddingDensity: 'spacious',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'soft',
    mediaSize: 'standard',
    markerStyle: 'numbered',
    iconStyle: 'badge',
    cornerEffect: 'none',
  },
  splitMedia: {
    surface: 'white',
    surfaceOpacity: 1,
    radiusPx: 20,
    borderWidthPx: 1,
    borderStyle: 'solid',
    borderColor: 'neutral',
    borderSides: 'all',
    shadow: 'medium',
    shadowColor: 'neutral',
    shadowOpacity: 0.12,
    paddingDensity: 'standard',
    textAlign: 'left',
    accentSide: 'bottom',
    accentWidthPx: 3,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'soft',
    mediaSize: 'large',
    mediaSizePercent: 90,
    markerStyle: 'framed',
    iconStyle: 'framed',
    cornerEffect: 'none',
  },
  accent: {
    surface: 'white',
    surfaceOpacity: 1,
    radiusPx: 16,
    borderWidthPx: 1,
    borderStyle: 'solid',
    borderColor: 'neutral',
    borderSides: 'all',
    shadow: 'soft',
    shadowColor: 'neutral',
    shadowOpacity: 0.1,
    paddingDensity: 'standard',
    textAlign: 'left',
    accentSide: 'top',
    accentWidthPx: 4,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'contained',
    mediaSize: 'standard',
    markerStyle: 'accentLine',
    iconStyle: 'badge',
    cornerEffect: 'none',
  },
  poster: {
    surface: 'white',
    surfaceOpacity: 1,
    radiusPx: 0,
    borderWidthPx: 1,
    borderStyle: 'solid',
    borderColor: 'neutral',
    borderSides: 'all',
    shadow: 'none',
    shadowColor: 'neutral',
    shadowOpacity: 0,
    paddingDensity: 'none',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'fullBleed',
    mediaAspect: 'landscape',
    mediaTreatment: 'fullBleed',
    mediaSize: 'full',
    markerStyle: 'plain',
    iconStyle: 'plain',
    cornerEffect: 'none',
  },
  offset: {
    surface: 'white',
    surfaceOpacity: 1,
    radiusPx: 8,
    borderWidthPx: 2,
    borderStyle: 'solid',
    borderColor: 'primary',
    borderSides: 'all',
    shadow: 'offset',
    shadowColor: 'secondary',
    shadowOpacity: 1,
    paddingDensity: 'standard',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'contained',
    mediaSize: 'standard',
    markerStyle: 'framed',
    iconStyle: 'numbered',
    cornerEffect: 'none',
  },
  minimal: {
    surface: 'transparent',
    surfaceOpacity: 1,
    radiusPx: 0,
    borderWidthPx: 0,
    borderStyle: 'none',
    borderColor: 'transparent',
    borderSides: 'none',
    shadow: 'none',
    shadowColor: 'neutral',
    shadowOpacity: 0,
    paddingDensity: 'none',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'contained',
    mediaSize: 'standard',
    markerStyle: 'plain',
    iconStyle: 'plain',
    cornerEffect: 'none',
  },
  solid: {
    surface: 'primary',
    surfaceOpacity: 1,
    radiusPx: 16,
    borderWidthPx: 0,
    borderStyle: 'none',
    borderColor: 'transparent',
    borderSides: 'none',
    shadow: 'soft',
    shadowColor: 'primary',
    shadowOpacity: 0.18,
    paddingDensity: 'standard',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'contained',
    mediaSize: 'standard',
    markerStyle: 'badge',
    iconStyle: 'badge',
    cornerEffect: 'none',
  },
  glass: {
    surface: 'white',
    surfaceOpacity: 0.72,
    radiusPx: 24,
    borderWidthPx: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.7)',
    borderSides: 'all',
    shadow: 'medium',
    shadowX: 0,
    shadowY: 10,
    shadowBlur: 15,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    paddingDensity: 'standard',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'soft',
    mediaSize: 'standard',
    markerStyle: 'badge',
    iconStyle: 'badge',
    cornerEffect: 'none',
  },
  editorial: {
    surface: 'white',
    surfaceOpacity: 1,
    radiusPx: 0,
    borderWidthPx: 1,
    borderStyle: 'solid',
    borderColor: 'primary',
    borderSides: 'y',
    shadow: 'none',
    shadowColor: 'neutral',
    shadowOpacity: 0,
    paddingDensity: 'compact',
    textAlign: 'left',
    accentSide: 'top',
    accentWidthPx: 1,
    accentColor: 'primary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'contained',
    mediaSize: 'standard',
    markerStyle: 'plain',
    iconStyle: 'plain',
    cornerEffect: 'none',
  },
  inset: {
    surface: 'white',
    surfaceOpacity: 1,
    radiusPx: 16,
    borderWidthPx: 1,
    borderStyle: 'solid',
    borderColor: 'neutral',
    borderSides: 'all',
    shadow: 'inset',
    shadowColor: 'primary',
    shadowOpacity: 0.08,
    paddingDensity: 'standard',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'contained',
    mediaSize: 'standard',
    markerStyle: 'numbered',
    iconStyle: 'framed',
    cornerEffect: 'none',
  },
  slab: {
    surface: 'white',
    surfaceOpacity: 1,
    radiusPx: 6,
    borderWidthPx: 2,
    borderStyle: 'solid',
    borderColor: 'primary',
    borderSides: 'all',
    shadow: 'chunky',
    shadowColor: 'primary',
    shadowOpacity: 0.95,
    paddingDensity: 'standard',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'contained',
    mediaSize: 'standard',
    markerStyle: 'badge',
    iconStyle: 'framed',
    cornerEffect: 'none',
  },
  outline: {
    surface: 'transparent',
    surfaceOpacity: 1,
    radiusPx: 16,
    borderWidthPx: 2,
    borderStyle: 'dashed',
    borderColor: 'secondary',
    borderSides: 'all',
    shadow: 'none',
    shadowColor: 'neutral',
    shadowOpacity: 0,
    paddingDensity: 'standard',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'contained',
    mediaSize: 'standard',
    markerStyle: 'plain',
    iconStyle: 'framed',
    cornerEffect: 'none',
  },
  glow: {
    surface: 'white',
    surfaceOpacity: 1,
    radiusPx: 24,
    borderWidthPx: 1,
    borderStyle: 'solid',
    borderColor: 'secondary',
    borderSides: 'all',
    shadow: 'glow',
    shadowColor: 'secondary',
    shadowOpacity: 0.24,
    paddingDensity: 'standard',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'soft',
    mediaSize: 'standard',
    markerStyle: 'badge',
    iconStyle: 'badge',
    cornerEffect: 'none',
  },
  gradient: {
    surface: 'gradient',
    surfaceOpacity: 1,
    gradientFrom: 'accent',
    gradientTo: 'secondary',
    gradientVia: 'white',
    gradientAngle: 135,
    radiusPx: 24,
    borderWidthPx: 1,
    borderStyle: 'solid',
    borderColor: 'secondary',
    borderSides: 'all',
    shadow: 'large',
    shadowColor: 'secondary',
    shadowOpacity: 0.16,
    paddingDensity: 'standard',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'soft',
    mediaSize: 'standard',
    markerStyle: 'badge',
    iconStyle: 'badge',
    cornerEffect: 'none',
  },
  luxe: {
    surface: 'white',
    surfaceOpacity: 1,
    radiusPx: 0,
    borderWidthPx: 1,
    borderStyle: 'solid',
    borderColor: 'primary',
    borderSides: 'all',
    shadow: 'large',
    shadowColor: 'primary',
    shadowOpacity: 0.08,
    paddingDensity: 'spacious',
    textAlign: 'left',
    accentSide: 'top',
    accentWidthPx: 1,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'contained',
    mediaSize: 'standard',
    markerStyle: 'plain',
    iconStyle: 'plain',
    cornerEffect: 'none',
  },
  utility: {
    surface: 'accent',
    surfaceOpacity: 1,
    radiusPx: 8,
    borderWidthPx: 1,
    borderStyle: 'solid',
    borderColor: 'primary',
    borderSides: 'all',
    shadow: 'none',
    shadowColor: 'neutral',
    shadowOpacity: 0,
    paddingDensity: 'compact',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'contained',
    mediaSize: 'compact',
    markerStyle: 'badge',
    iconStyle: 'framed',
    cornerEffect: 'none',
  },
  playful: {
    surface: 'white',
    surfaceOpacity: 1,
    radiusPx: 24,
    borderWidthPx: 2,
    borderStyle: 'solid',
    borderColor: 'secondary',
    borderSides: 'all',
    shadow: 'chunky',
    shadowColor: 'secondary',
    shadowOpacity: 0.2,
    paddingDensity: 'standard',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'stacked',
    mediaAspect: 'landscape',
    mediaTreatment: 'soft',
    mediaSize: 'standard',
    markerStyle: 'framed',
    iconStyle: 'numbered',
    cornerEffect: 'none',
  },
  clipped: {
    surface: 'white',
    surfaceOpacity: 1,
    radiusPx: 12,
    borderWidthPx: 1,
    borderStyle: 'solid',
    borderColor: 'neutral',
    borderSides: 'all',
    shadow: 'medium',
    shadowColor: 'neutral',
    shadowOpacity: 0.14,
    paddingDensity: 'standard',
    textAlign: 'left',
    accentSide: 'none',
    accentWidthPx: 0,
    accentColor: 'secondary',
    mediaLayout: 'fullBleed',
    mediaAspect: 'landscape',
    mediaTreatment: 'fullBleed',
    mediaSize: 'full',
    markerStyle: 'plain',
    iconStyle: 'plain',
    cornerEffect: 'clipped',
  },
});

export function readStyleOption<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? value as T : fallback;
}

export function readCardSettings(value: unknown): CardSettings | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const settings: CardSettings = {};

  const presetId = readPresetId(source.presetId);
  if (presetId) settings.presetId = presetId;

  if (hasOwn(source, 'surface')) settings.surface = readCardColorValue(source.surface, CARD_PRESET_RECIPES.soft.surface);
  if (hasOwn(source, 'surfaceOpacity')) settings.surfaceOpacity = clampNumber(source.surfaceOpacity, CARD_PRESET_RECIPES.soft.surfaceOpacity, 0.1, 1);
  if (hasOwn(source, 'gradientFrom')) settings.gradientFrom = readCardColorValue(source.gradientFrom, CARD_PRESET_RECIPES.soft.gradientFrom);
  if (hasOwn(source, 'gradientTo')) settings.gradientTo = readCardColorValue(source.gradientTo, CARD_PRESET_RECIPES.soft.gradientTo);
  if (hasOwn(source, 'gradientVia')) settings.gradientVia = readOptionalCardColorValue(source.gradientVia);
  if (hasOwn(source, 'gradientAngle')) settings.gradientAngle = clampNumber(source.gradientAngle, CARD_PRESET_RECIPES.soft.gradientAngle, 0, 360);
  if (hasOwn(source, 'paddingPx')) settings.paddingPx = clampNumber(source.paddingPx, CARD_PRESET_RECIPES.soft.paddingPx, 0, 96);
  if (hasOwn(source, 'radiusPx')) settings.radiusPx = clampNumber(source.radiusPx, CARD_PRESET_RECIPES.soft.radiusPx, 0, 40);
  if (hasOwn(source, 'borderWidthPx')) settings.borderWidthPx = clampNumber(source.borderWidthPx, CARD_PRESET_RECIPES.soft.borderWidthPx, 0, 8);
  if (hasOwn(source, 'borderStyle')) settings.borderStyle = readStyleOption(source.borderStyle, CARD_BORDER_STYLE_OPTIONS, CARD_PRESET_RECIPES.soft.borderStyle);
  if (hasOwn(source, 'borderColor')) settings.borderColor = readCardColorValue(source.borderColor, CARD_PRESET_RECIPES.soft.borderColor);
  if (hasOwn(source, 'borderSides')) settings.borderSides = readStyleOption(source.borderSides, CARD_BORDER_SIDE_OPTIONS, CARD_PRESET_RECIPES.soft.borderSides);
  if (hasOwn(source, 'shadow')) settings.shadow = readStyleOption(source.shadow, CARD_SHADOW_OPTIONS, CARD_PRESET_RECIPES.soft.shadow);
  if (hasOwn(source, 'shadowEnabled')) settings.shadowEnabled = readBoolean(source.shadowEnabled, CARD_PRESET_RECIPES.soft.shadow !== 'none');
  if (hasOwn(source, 'shadowX')) settings.shadowX = clampNumber(source.shadowX, 0, -80, 80);
  if (hasOwn(source, 'shadowY')) settings.shadowY = clampNumber(source.shadowY, 8, -80, 80);
  if (hasOwn(source, 'shadowBlur')) settings.shadowBlur = clampNumber(source.shadowBlur, 24, 0, 120);
  if (hasOwn(source, 'shadowInset')) settings.shadowInset = readBoolean(source.shadowInset, false);
  if (hasOwn(source, 'shadowColor')) settings.shadowColor = readCardColorValue(source.shadowColor, CARD_PRESET_RECIPES.soft.shadowColor);
  if (hasOwn(source, 'shadowOpacity')) settings.shadowOpacity = clampNumber(source.shadowOpacity, CARD_PRESET_RECIPES.soft.shadowOpacity, 0, 1);
  if (hasOwn(source, 'paddingDensity')) settings.paddingDensity = readPaddingDensity(source.paddingDensity, CARD_PRESET_RECIPES.soft.paddingDensity);
  if (hasOwn(source, 'textAlign')) settings.textAlign = readStyleOption(source.textAlign, TEXT_ALIGN_OPTIONS, CARD_PRESET_RECIPES.soft.textAlign);
  if (hasOwn(source, 'accentSide')) settings.accentSide = readStyleOption(source.accentSide, CARD_ACCENT_SIDE_OPTIONS, CARD_PRESET_RECIPES.soft.accentSide);
  if (hasOwn(source, 'accentWidthPx')) settings.accentWidthPx = clampNumber(source.accentWidthPx, CARD_PRESET_RECIPES.soft.accentWidthPx, 0, 12);
  if (hasOwn(source, 'accentColor')) settings.accentColor = readCardColorValue(source.accentColor, CARD_PRESET_RECIPES.soft.accentColor);
  if (hasOwn(source, 'mediaLayout')) settings.mediaLayout = readStyleOption(source.mediaLayout, CARD_MEDIA_LAYOUT_OPTIONS, CARD_PRESET_RECIPES.soft.mediaLayout);
  if (hasOwn(source, 'mediaAspect')) settings.mediaAspect = readStyleOption(source.mediaAspect, MEDIA_ASPECT_OPTIONS, CARD_PRESET_RECIPES.soft.mediaAspect);
  if (hasOwn(source, 'mediaTreatment')) settings.mediaTreatment = readStyleOption(source.mediaTreatment, MEDIA_TREATMENT_OPTIONS, CARD_PRESET_RECIPES.soft.mediaTreatment);
  if (hasOwn(source, 'mediaSize')) settings.mediaSize = readStyleOption(source.mediaSize, CARD_MEDIA_SIZE_OPTIONS, CARD_PRESET_RECIPES.soft.mediaSize);
  if (hasOwn(source, 'mediaSizePercent')) settings.mediaSizePercent = clampNumber(source.mediaSizePercent, CARD_PRESET_RECIPES.soft.mediaSizePercent, 35, 100);
  if (hasOwn(source, 'mediaRadiusPx')) settings.mediaRadiusPx = clampNumber(source.mediaRadiusPx, CARD_PRESET_RECIPES.soft.mediaRadiusPx, 0, 100);
  if (hasOwn(source, 'markerStyle')) settings.markerStyle = readStyleOption(source.markerStyle, MARKER_STYLE_OPTIONS, CARD_PRESET_RECIPES.soft.markerStyle);
  if (hasOwn(source, 'iconStyle')) settings.iconStyle = readStyleOption(source.iconStyle, ICON_STYLE_OPTIONS, CARD_PRESET_RECIPES.soft.iconStyle);
  if (hasOwn(source, 'cornerEffect')) settings.cornerEffect = readStyleOption(source.cornerEffect, CARD_CORNER_EFFECT_OPTIONS, CARD_PRESET_RECIPES.soft.cornerEffect);

  return settings;
}

export function readCardPresetId(value: unknown, fallback: CardPresetId = 'soft'): CardPresetId {
  return readStyleOption(value, CARD_STYLE_OPTIONS, fallback);
}

export function resolveCardPresetId(data: Record<string, unknown>, fallback: CardPresetId = 'soft'): CardPresetId {
  const settings = readCardSettings(data.cardSettings);
  if (settings?.presetId && settings.presetId !== 'custom') return settings.presetId;
  return readCardPresetId(data.cardStyle, fallback);
}

export function hasUniversalCardSettings(data: Record<string, unknown>): boolean {
  const value = data.cardSettings;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Boolean(readCardSettings(value)?.presetId)
    || Object.keys(value as Record<string, unknown>).some((key) => key !== 'presetId');
}

export function resolveUniversalCardSettings(
  data: Record<string, unknown>,
  options: {
    fallbackPreset?: CardPresetId;
    fallbackTextAlign?: TextAlign;
    fallbackMarkerStyle?: MarkerStyle;
    fallbackIconStyle?: IconStyle;
  } = {},
): ResolvedCardSettings | null {
  if (!hasUniversalCardSettings(data)) return null;

  const storedSettings = readCardSettings(data.cardSettings) || {};
  const basePresetId = storedSettings.presetId && storedSettings.presetId !== 'custom'
    ? storedSettings.presetId
    : readCardPresetId(data.cardStyle, options.fallbackPreset || 'soft');
  const recipe = CARD_PRESET_RECIPES[basePresetId];
  const legacySurfaceFallback = readStyleOption(recipe.surface, SURFACE_STYLE_OPTIONS, 'white');
  const legacySurface = getSurfaceStyle(data.surfaceStyle, basePresetId, legacySurfaceFallback);
  const legacyPaddingDensity = readStyleOption(data.spacingDensity, SPACING_DENSITY_OPTIONS, recipe.paddingDensity === 'none' ? 'standard' : recipe.paddingDensity);
  const legacyTextAlign = readStyleOption(data.textAlign, TEXT_ALIGN_OPTIONS, options.fallbackTextAlign || recipe.textAlign);
  const legacyMarkerStyle = readStyleOption(data.markerStyle, MARKER_STYLE_OPTIONS, options.fallbackMarkerStyle || recipe.markerStyle);
  const legacyIconStyle = readStyleOption(data.iconStyle, ICON_STYLE_OPTIONS, options.fallbackIconStyle || recipe.iconStyle);
  const legacyMediaAspect = readStyleOption(data.mediaAspect, MEDIA_ASPECT_OPTIONS, recipe.mediaAspect);
  const legacyMediaTreatment = readStyleOption(data.mediaTreatment, MEDIA_TREATMENT_OPTIONS, recipe.mediaTreatment);

  const settings = {
    ...recipe,
    surface: legacySurface,
    paddingDensity: legacyPaddingDensity,
    textAlign: legacyTextAlign,
    markerStyle: legacyMarkerStyle,
    iconStyle: legacyIconStyle,
    mediaAspect: legacyMediaAspect,
    mediaTreatment: legacyMediaTreatment,
    ...storedSettings,
  };
  const resolvedShadow = readStyleOption(settings.shadow, CARD_SHADOW_OPTIONS, recipe.shadow);
  const shadowDefaults = getCardShadowDefaults(resolvedShadow);
  const resolvedPaddingDensity = readPaddingDensity(settings.paddingDensity, recipe.paddingDensity);
  const storedHasPaddingDensity = hasOwn(storedSettings as Record<string, unknown>, 'paddingDensity');
  const storedHasPaddingPx = hasOwn(storedSettings as Record<string, unknown>, 'paddingPx');
  const storedHasMediaSize = hasOwn(storedSettings as Record<string, unknown>, 'mediaSize');
  const storedHasMediaSizePercent = hasOwn(storedSettings as Record<string, unknown>, 'mediaSizePercent');
  const paddingPxFallback = storedHasPaddingDensity && !storedHasPaddingPx
    ? getPaddingPxForDensity(resolvedPaddingDensity, recipe.mediaLayout, recipe.paddingPx)
    : recipe.paddingPx;
  const mediaSizePercentFallback = storedHasMediaSize && !storedHasMediaSizePercent
    ? getMediaSizePercentForOption(settings.mediaSize, recipe.mediaSize)
    : recipe.mediaSizePercent;

  const resolved: ResolvedCardSettings = {
    presetId: storedSettings.presetId || basePresetId,
    basePresetId,
    isCustom: storedSettings.presetId === 'custom',
    surface: readCardColorValue(settings.surface, recipe.surface),
    surfaceOpacity: clampNumber(settings.surfaceOpacity, recipe.surfaceOpacity, 0.1, 1),
    gradientFrom: readCardColorValue(settings.gradientFrom, recipe.gradientFrom),
    gradientTo: readCardColorValue(settings.gradientTo, recipe.gradientTo),
    gradientVia: typeof settings.gradientVia === 'string' ? readOptionalCardColorValue(settings.gradientVia) : recipe.gradientVia,
    gradientAngle: clampNumber(settings.gradientAngle, recipe.gradientAngle, 0, 360),
    paddingPx: clampNumber(settings.paddingPx, paddingPxFallback, 0, 96),
    radiusPx: clampNumber(settings.radiusPx, recipe.radiusPx, 0, 40),
    borderWidthPx: clampNumber(settings.borderWidthPx, recipe.borderWidthPx, 0, 8),
    borderStyle: readStyleOption(settings.borderStyle, CARD_BORDER_STYLE_OPTIONS, recipe.borderStyle),
    borderColor: readCardColorValue(settings.borderColor, recipe.borderColor),
    borderSides: readStyleOption(settings.borderSides, CARD_BORDER_SIDE_OPTIONS, recipe.borderSides),
    shadow: resolvedShadow,
    shadowEnabled: readBoolean(settings.shadowEnabled, shadowDefaults.shadowEnabled),
    shadowX: clampNumber(settings.shadowX, shadowDefaults.shadowX, -80, 80),
    shadowY: clampNumber(settings.shadowY, shadowDefaults.shadowY, -80, 80),
    shadowBlur: clampNumber(settings.shadowBlur, shadowDefaults.shadowBlur, 0, 120),
    shadowInset: readBoolean(settings.shadowInset, shadowDefaults.shadowInset),
    shadowColor: readCardColorValue(settings.shadowColor, recipe.shadowColor),
    shadowOpacity: clampNumber(settings.shadowOpacity, recipe.shadowOpacity, 0, 1),
    paddingDensity: resolvedPaddingDensity,
    textAlign: readStyleOption(settings.textAlign, TEXT_ALIGN_OPTIONS, recipe.textAlign),
    accentSide: readStyleOption(settings.accentSide, CARD_ACCENT_SIDE_OPTIONS, recipe.accentSide),
    accentWidthPx: clampNumber(settings.accentWidthPx, recipe.accentWidthPx, 0, 12),
    accentColor: readCardColorValue(settings.accentColor, recipe.accentColor),
    mediaLayout: readStyleOption(settings.mediaLayout, CARD_MEDIA_LAYOUT_OPTIONS, recipe.mediaLayout),
    mediaAspect: readStyleOption(settings.mediaAspect, MEDIA_ASPECT_OPTIONS, recipe.mediaAspect),
    mediaTreatment: readStyleOption(settings.mediaTreatment, MEDIA_TREATMENT_OPTIONS, recipe.mediaTreatment),
    mediaSize: readStyleOption(settings.mediaSize, CARD_MEDIA_SIZE_OPTIONS, recipe.mediaSize),
    mediaSizePercent: clampNumber(settings.mediaSizePercent, mediaSizePercentFallback, 35, 100),
    mediaRadiusPx: clampNumber(settings.mediaRadiusPx, recipe.mediaRadiusPx, 0, 100),
    markerStyle: readStyleOption(settings.markerStyle, MARKER_STYLE_OPTIONS, recipe.markerStyle),
    iconStyle: readStyleOption(settings.iconStyle, ICON_STYLE_OPTIONS, recipe.iconStyle),
    cornerEffect: readStyleOption(settings.cornerEffect, CARD_CORNER_EFFECT_OPTIONS, recipe.cornerEffect),
  };

  return resolved;
}

export function buildCardSettingsForPreset(presetId: unknown): CardSettings {
  const resolvedPresetId = readCardPresetId(presetId, 'soft');
  return {
    ...CARD_PRESET_RECIPES[resolvedPresetId],
    presetId: resolvedPresetId,
  };
}

export function getCardShadowDefaults(shadow: unknown): CardShadowControlSettings {
  switch (readStyleOption(shadow, CARD_SHADOW_OPTIONS, 'soft')) {
    case 'none':
      return { shadowEnabled: false, shadowX: 0, shadowY: 0, shadowBlur: 0, shadowInset: false };
    case 'medium':
      return { shadowEnabled: true, shadowX: 0, shadowY: 16, shadowBlur: 36, shadowInset: false };
    case 'large':
      return { shadowEnabled: true, shadowX: 0, shadowY: 24, shadowBlur: 60, shadowInset: false };
    case 'inset':
      return { shadowEnabled: true, shadowX: 0, shadowY: 1, shadowBlur: 8, shadowInset: true };
    case 'offset':
      return { shadowEnabled: true, shadowX: 8, shadowY: 8, shadowBlur: 0, shadowInset: false };
    case 'glow':
      return { shadowEnabled: true, shadowX: 0, shadowY: 18, shadowBlur: 45, shadowInset: false };
    case 'chunky':
      return { shadowEnabled: true, shadowX: 6, shadowY: 6, shadowBlur: 0, shadowInset: false };
    case 'soft':
    default:
      return { shadowEnabled: true, shadowX: 0, shadowY: 8, shadowBlur: 24, shadowInset: false };
  }
}

export function getCardShadowPaintBuffer(
  settings: Pick<CompleteCardPresetRecipe, 'shadowEnabled' | 'shadowX' | 'shadowY' | 'shadowBlur' | 'shadowInset' | 'shadowOpacity'> | null | undefined,
): number {
  if (!settings?.shadowEnabled || settings.shadowInset || settings.shadowOpacity <= 0) return 0;
  const xExtent = Math.abs(settings.shadowX || 0);
  const yExtent = Math.abs(settings.shadowY || 0);
  return Math.ceil(Math.max(xExtent, yExtent) + Math.max(0, settings.shadowBlur || 0) + 8);
}

export function getCardPresetShadowPaintBuffer(presetId: unknown): number {
  return getCardShadowPaintBuffer(CARD_PRESET_RECIPES[readCardPresetId(presetId, 'soft')]);
}

export function getCardShadowTopPaintBuffer(
  settings: Pick<CompleteCardPresetRecipe, 'shadowEnabled' | 'shadowY' | 'shadowBlur' | 'shadowInset' | 'shadowOpacity'> | null | undefined,
): number {
  if (!settings?.shadowEnabled || settings.shadowInset || settings.shadowOpacity <= 0) return 0;
  const topExtent = Math.max(0, Math.max(0, settings.shadowBlur || 0) - (settings.shadowY || 0));
  return topExtent <= 0 ? 0 : Math.ceil(topExtent + 8);
}

export function getCardPresetShadowTopPaintBuffer(presetId: unknown): number {
  return getCardShadowTopPaintBuffer(CARD_PRESET_RECIPES[readCardPresetId(presetId, 'soft')]);
}

export function getCardShadowSafeContainerStyle(
  bufferPx: number,
  overflow: CSSProperties['overflow'] = 'visible',
): CSSProperties {
  if (bufferPx <= 0) return { overflow };
  return {
    margin: -bufferPx,
    padding: bufferPx,
    overflow,
  };
}

function completeCardPresetRecipes(recipes: Record<CardPresetId, CardPresetRecipe>): Record<CardPresetId, CompleteCardPresetRecipe> {
  const completed = {} as Record<CardPresetId, CompleteCardPresetRecipe>;
  for (const [presetId, recipe] of Object.entries(recipes) as Array<[CardPresetId, CardPresetRecipe]>) {
    const defaults = getCardShadowDefaults(recipe.shadow);
    completed[presetId] = {
      ...recipe,
      shadowEnabled: recipe.shadowEnabled ?? defaults.shadowEnabled,
      shadowX: recipe.shadowX ?? defaults.shadowX,
      shadowY: recipe.shadowY ?? defaults.shadowY,
      shadowBlur: recipe.shadowBlur ?? defaults.shadowBlur,
      shadowInset: recipe.shadowInset ?? defaults.shadowInset,
      gradientFrom: recipe.gradientFrom ?? DEFAULT_CARD_GRADIENT.gradientFrom,
      gradientTo: recipe.gradientTo ?? DEFAULT_CARD_GRADIENT.gradientTo,
      gradientVia: recipe.gradientVia ?? DEFAULT_CARD_GRADIENT.gradientVia,
      gradientAngle: recipe.gradientAngle ?? DEFAULT_CARD_GRADIENT.gradientAngle,
      paddingPx: recipe.paddingPx ?? getPaddingPxForDensity(recipe.paddingDensity, recipe.mediaLayout),
      mediaSizePercent: recipe.mediaSizePercent ?? 100,
      mediaRadiusPx: recipe.mediaRadiusPx ?? getMediaRadiusPxForTreatment(recipe.mediaTreatment),
    };
  }
  return completed;
}

export function getUniversalCardClassName(settings: ResolvedCardSettings): string {
  const base = settings.cornerEffect === 'clipped'
    ? 'overflow-hidden bg-white'
    : 'bg-white';
  return `${base}${settings.surfaceOpacity < 1 ? ' backdrop-blur' : ''}`;
}

export function getUniversalCardPaddingClass(settings: ResolvedCardSettings): string {
  void settings;
  return '';
}

export function getUniversalCardTextPaddingClass(settings: ResolvedCardSettings): string {
  void settings;
  return '';
}

export function getUniversalCardTextPaddingStyle(settings: ResolvedCardSettings): CSSProperties | undefined {
  if (settings.mediaLayout !== 'split' && settings.mediaLayout !== 'fullBleed') return undefined;
  return { padding: settings.paddingPx };
}

export function getUniversalCardInlineStyle(settings: ResolvedCardSettings, palette: Palette): CSSProperties {
  const isGradientSurface = settings.surface === 'gradient';
  const surfaceColor = isGradientSurface ? '#ffffff' : resolveCardColor(settings.surface, palette);
  const inline: CSSProperties = {
    backgroundColor: surfaceColor,
    borderRadius: settings.radiusPx,
    boxShadow: buildCardShadow(settings, palette),
    padding: settings.mediaLayout === 'split' || settings.mediaLayout === 'fullBleed' ? 0 : settings.paddingPx,
  };

  if (settings.surface === 'transparent') {
    inline.backgroundColor = 'transparent';
  } else if (!isGradientSurface && settings.surfaceOpacity < 1) {
    inline.backgroundColor = colorWithAlpha(surfaceColor, settings.surfaceOpacity);
  }

  applyCardBorder(inline, settings, palette);
  applyCardAccent(inline, settings, palette);

  if (isGradientSurface) {
    inline.background = buildCardGradientSurface({
      from: settings.gradientFrom,
      to: settings.gradientTo,
      via: settings.gradientVia,
      angle: settings.gradientAngle,
    }, palette, settings.surfaceOpacity);
  }

  if (settings.surfaceOpacity < 1) {
    inline.backdropFilter = 'blur(8px)';
  }

  if (settings.cornerEffect === 'clipped') {
    inline.clipPath = 'polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%)';
  }

  return inline;
}

export function getUniversalCardTextColor(settings: ResolvedCardSettings, palette: Palette): string {
  if (settings.surface === 'gradient') {
    return readableTextColorForGradient(settings, palette);
  }
  return getSurfaceTextColor(settings.surface, palette);
}

function readableTextColorForGradient(settings: ResolvedCardSettings, palette: Palette): string {
  const preferred = palette.primary || '#111827';
  const fallback = readableTextColorForBackground(resolveCardColor(settings.gradientFrom, palette), preferred);
  const stops = [settings.gradientFrom, settings.gradientVia, settings.gradientTo]
    .map((stop) => resolveCardColor(stop, palette))
    .filter((stop) => stop && stop !== 'transparent');
  if (stops.length === 0) return fallback;

  const candidates = uniqueColorCandidates([preferred, '#111827', '#0f172a', '#ffffff']);
  const scored = candidates
    .map((color) => ({ color, ratio: minimumContrastRatio(color, stops) }))
    .filter((item): item is { color: string; ratio: number } => item.ratio !== null);
  if (scored.length === 0) return fallback;

  const preferredScore = scored.find((item) => item.color.toLowerCase() === preferred.toLowerCase());
  if (preferredScore && preferredScore.ratio >= 4.5) return preferred;

  return scored.reduce((best, item) => (item.ratio > best.ratio ? item : best), scored[0]).color;
}

function uniqueColorCandidates(colors: string[]): string[] {
  const seen = new Set<string>();
  return colors.filter((color) => {
    const normalized = color.trim().toLowerCase();
    if (!normalized || normalized === 'transparent' || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function minimumContrastRatio(textColor: string, backgroundStops: string[]): number | null {
  let lowest: number | null = null;
  for (const stop of backgroundStops) {
    const ratio = contrastRatio(textColor, stop);
    if (ratio === null) return null;
    lowest = lowest === null ? ratio : Math.min(lowest, ratio);
  }
  return lowest;
}

export function shouldLockCardTextToSurface(surface: string | undefined): boolean {
  return surface === 'primary' || surface === 'secondary' || surface === 'gradient';
}

export function getCardPresetLabel(presetId: unknown): string {
  if (presetId === 'custom') return 'Custom';
  const id = readCardPresetId(presetId, 'soft');
  return CARD_STYLE_DEFINITIONS.find((style) => style.id === id)?.label || id;
}

export function getCardStyleClass(style: CardStyle): string {
  switch (style) {
    case 'bordered':
      return 'rounded-lg border-2 border-slate-200 bg-white shadow-none';
    case 'elevated':
      return 'rounded-3xl border border-transparent bg-white shadow-xl hover:shadow-2xl';
    case 'splitMedia':
      return 'rounded-2xl border border-slate-100 bg-white shadow-md hover:shadow-lg';
    case 'glass':
      return 'rounded-3xl border border-white/60 bg-white/70 shadow-lg backdrop-blur';
    case 'editorial':
      return 'rounded-none border-y bg-white shadow-none';
    case 'inset':
      return 'rounded-2xl border border-slate-200 bg-white shadow-inner';
    case 'slab':
      return 'rounded-md border-2 bg-white shadow-none';
    case 'outline':
      return 'rounded-2xl border-2 border-dashed bg-transparent shadow-none';
    case 'glow':
      return 'rounded-3xl border border-transparent bg-white shadow-lg hover:shadow-xl';
    case 'gradient':
      return 'rounded-3xl border border-transparent bg-white shadow-lg';
    case 'luxe':
      return 'rounded-none border border-slate-200 bg-white shadow-sm';
    case 'utility':
      return 'rounded-lg border border-slate-200 bg-slate-50 shadow-none';
    case 'playful':
      return 'rounded-3xl border-2 bg-white shadow-md';
    case 'clipped':
      return 'overflow-hidden rounded-xl border border-slate-100 bg-white shadow-md';
    case 'accent':
      return 'rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md';
    case 'poster':
      return 'rounded-none border bg-white shadow-none overflow-hidden';
    case 'offset':
      return 'rounded-lg border-2 bg-white shadow-none';
    case 'minimal':
      return 'rounded-none border-0 bg-transparent shadow-none';
    case 'solid':
      return 'rounded-2xl border border-transparent shadow-sm';
    case 'soft':
    default:
      return 'rounded-3xl border border-transparent bg-white shadow-lg hover:shadow-xl';
  }
}

export function getCardPaddingClass(style: CardStyle, density: SpacingDensity = 'standard'): string {
  if (style === 'poster') return 'p-0';
  if (style === 'minimal') return 'p-0';
  if (style === 'splitMedia') {
    if (density === 'compact') return 'p-5';
    if (density === 'spacious') return 'p-10';
    return 'p-8';
  }
  if (style === 'utility') {
    if (density === 'compact') return 'p-4';
    if (density === 'spacious') return 'p-8';
    return 'p-6';
  }
  if (density === 'compact') return 'p-5';
  if (density === 'spacious') return style === 'bordered' ? 'p-9' : 'p-10';
  if (style === 'bordered') return 'p-7';
  return 'p-8';
}

export function getCardTextPaddingClass(style: CardStyle, density: SpacingDensity = 'standard'): string {
  if (density === 'compact') return 'p-5';
  if (density === 'spacious') return 'p-9';
  return 'p-7 pt-5';
}

export function getSpacingDensity(value: unknown, fallback: SpacingDensity = 'standard'): SpacingDensity {
  return readStyleOption(value, SPACING_DENSITY_OPTIONS, fallback);
}

export function getSurfaceStyle(value: unknown, cardStyle: CardStyle, fallback: SurfaceStyle = 'white'): SurfaceStyle {
  const styleFallback = cardStyle === 'solid'
    ? 'primary'
    : cardStyle === 'accent' || cardStyle === 'gradient'
      ? 'accent'
      : fallback;
  return readStyleOption(value, SURFACE_STYLE_OPTIONS, styleFallback);
}

export function getCardInlineStyle(style: CardStyle, surface: SurfaceStyle, palette: Palette): CSSProperties {
  const primary = palette.primary || '#111827';
  const secondary = palette.secondary || '#dc2626';
  const accent = palette.accent || '#f8fafc';
  const inline: CSSProperties = {};

  if (surface === 'accent') inline.backgroundColor = accent;
  if (surface === 'primary') inline.backgroundColor = primary;
  if (surface === 'secondary') inline.backgroundColor = secondary;
  if (surface === 'transparent') inline.backgroundColor = 'transparent';
  if (surface === 'gradient') inline.background = buildDefaultCardGradientSurface(secondary, accent);

  if (style === 'accent') {
    inline.borderTop = `4px solid ${secondary}`;
  }
  if (style === 'offset') {
    inline.borderColor = primary;
    inline.boxShadow = `8px 8px 0 ${secondary}`;
  }
  if (style === 'glass') {
    inline.backgroundColor = surface === 'transparent' ? colorWithAlpha('#ffffff', 0.16) : colorWithAlpha('#ffffff', 0.72);
    inline.borderColor = colorWithAlpha('#ffffff', 0.7);
  }
  if (style === 'editorial') {
    inline.borderColor = primary;
  }
  if (style === 'inset') {
    inline.boxShadow = `inset 0 1px 8px ${colorWithAlpha(primary, 0.08)}`;
  }
  if (style === 'slab') {
    inline.borderColor = primary;
    inline.boxShadow = `6px 6px 0 ${colorWithAlpha(primary, 0.95)}`;
  }
  if (style === 'outline') {
    inline.borderColor = secondary;
  }
  if (style === 'glow') {
    inline.borderColor = colorWithAlpha(secondary, 0.22);
    inline.boxShadow = `0 18px 45px ${colorWithAlpha(secondary, 0.24)}`;
  }
  if (style === 'gradient') {
    inline.background = surface === 'gradient' || surface === 'accent'
      ? buildDefaultCardGradientSurface(secondary, accent)
      : `linear-gradient(135deg, ${primary}, ${secondary})`;
    inline.borderColor = colorWithAlpha(secondary, 0.18);
  }
  if (style === 'luxe') {
    inline.borderColor = colorWithAlpha(primary, 0.22);
    inline.borderTop = `1px solid ${secondary}`;
    inline.boxShadow = `0 20px 60px ${colorWithAlpha(primary, 0.08)}`;
  }
  if (style === 'utility') {
    inline.borderColor = colorWithAlpha(primary, 0.14);
  }
  if (style === 'playful') {
    inline.borderColor = secondary;
    inline.boxShadow = `0 10px 0 ${colorWithAlpha(secondary, 0.2)}`;
  }
  if (style === 'clipped') {
    inline.clipPath = 'polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%)';
  }
  if (style === 'solid' && surface === 'white') {
    inline.backgroundColor = primary;
  }

  return inline;
}

export function getSurfaceTextColor(surface: string | undefined, palette: Palette): string {
  const preferred = palette.primary || '#111827';
  if (!surface || surface === 'transparent' || surface === 'gradient') return preferred;
  return readableTextColorForBackground(resolveCardColor(surface, palette), preferred);
}

export function getMediaAspectClass(aspect: unknown, fallback: MediaAspect = 'landscape'): string {
  const value = readStyleOption(aspect, MEDIA_ASPECT_OPTIONS, fallback);
  switch (value) {
    case 'square':
      return 'aspect-square';
    case 'portrait':
      return 'aspect-[3/4]';
    case 'wide':
      return 'aspect-[16/9]';
    case 'landscape':
    default:
      return 'aspect-[4/3]';
  }
}

export function getMediaTreatmentClass(treatment: unknown, fallback: MediaTreatment = 'contained'): string {
  const value = readStyleOption(treatment, MEDIA_TREATMENT_OPTIONS, fallback);
  switch (value) {
    case 'fullBleed':
      return 'rounded-none';
    case 'framed':
      return 'rounded-2xl ring-8 ring-white shadow-lg';
    case 'soft':
      return 'rounded-3xl';
    case 'circle':
      return 'rounded-full aspect-square';
    case 'contained':
    default:
      return 'rounded-xl';
  }
}

export function getMediaSizePercentForOption(size: unknown, fallback: CardMediaSize = 'standard'): number {
  switch (readStyleOption(size, CARD_MEDIA_SIZE_OPTIONS, fallback)) {
    case 'compact':
      return 60;
    case 'large':
      return 90;
    case 'full':
      return 100;
    case 'standard':
    default:
      return 80;
  }
}

export function getMediaSizeOptionForPercent(percent: unknown): CardMediaSize {
  const value = clampNumber(percent, getMediaSizePercentForOption('standard'), 35, 100);
  if (value >= 96) return 'full';
  if (value >= 83) return 'large';
  if (value <= 66) return 'compact';
  return 'standard';
}

export function getMediaRadiusPxForTreatment(treatment: unknown, fallback: MediaTreatment = 'contained'): number {
  switch (readStyleOption(treatment, MEDIA_TREATMENT_OPTIONS, fallback)) {
    case 'fullBleed':
      return 0;
    case 'soft':
      return 24;
    case 'circle':
      return 100;
    case 'framed':
      return 16;
    case 'contained':
    default:
      return 12;
  }
}

export function getTextAlignClass(value: unknown): string {
  return readStyleOption(value, TEXT_ALIGN_OPTIONS, 'left') === 'center' ? 'text-center' : 'text-left';
}

export function getGalleryFrameStyle(value: unknown): GalleryFrameStyle {
  return readStyleOption(value, GALLERY_FRAME_OPTIONS, 'clean');
}

export function getGalleryGapClass(frameStyle: GalleryFrameStyle): string {
  if (frameStyle === 'gapless') return 'gap-0';
  if (frameStyle === 'editorial') return 'gap-2';
  return 'gap-4';
}

export function getGalleryTileClass(frameStyle: GalleryFrameStyle): string {
  switch (frameStyle) {
    case 'rounded':
      return 'overflow-hidden rounded-3xl';
    case 'poster':
      return 'overflow-hidden rounded-none border border-slate-200 bg-white p-2 shadow-sm';
    case 'gapless':
      return 'overflow-hidden rounded-none';
    case 'editorial':
      return 'overflow-hidden rounded-lg';
    case 'clean':
    default:
      return 'overflow-hidden rounded-none';
  }
}

function readPresetId(value: unknown): CardPresetId | 'custom' | undefined {
  if (value === 'custom') return 'custom';
  if (typeof value === 'string' && (CARD_STYLE_OPTIONS as readonly string[]).includes(value)) return value as CardPresetId;
  return undefined;
}

function hasOwn(source: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function readCardColorValue(value: unknown, fallback: CardColorValue): CardColorValue {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function readOptionalCardColorValue(value: unknown): CardColorValue {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function readPaddingDensity(value: unknown, fallback: SpacingDensity | 'none'): SpacingDensity | 'none' {
  if (value === 'none') return 'none';
  return readStyleOption(value, SPACING_DENSITY_OPTIONS, fallback === 'none' ? 'standard' : fallback);
}

function getPaddingPxForDensity(
  density: SpacingDensity | 'none',
  mediaLayout: CardMediaLayout = 'stacked',
  noneFallback = 0,
): number {
  if (density === 'compact') return 20;
  if (density === 'spacious') return 40;
  if (density === 'standard') return 32;
  return mediaLayout === 'split' || mediaLayout === 'fullBleed' ? Math.max(noneFallback, 28) : 0;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function resolveCardColor(value: string | undefined, palette: Palette): string {
  const token = typeof value === 'string' ? value.trim() : '';

  if (token.startsWith('palette:')) {
    return resolveCardColor(token.slice('palette:'.length), palette);
  }

  switch (token) {
    case 'primary':
      return palette.primary || '#111827';
    case 'secondary':
      return palette.secondary || '#dc2626';
    case 'accent':
      return palette.accent || '#f8fafc';
    case 'white':
      return '#ffffff';
    case 'transparent':
      return 'transparent';
    case 'neutral':
      return '#e5e7eb';
    case 'gradient':
      return palette.accent || '#f8fafc';
    default:
      return token || '#ffffff';
  }
}

function buildCardGradientSurface(
  gradient: { from: string; to: string; via?: string; angle: number },
  palette: Palette,
  opacity = 1,
): string {
  const safeOpacity = Math.min(1, Math.max(0, opacity));
  const from = applyGradientStopOpacity(resolveCardColor(gradient.from, palette), safeOpacity);
  const to = applyGradientStopOpacity(resolveCardColor(gradient.to, palette), safeOpacity);
  const via = gradient.via ? applyGradientStopOpacity(resolveCardColor(gradient.via, palette), safeOpacity) : '';
  const angle = Math.min(360, Math.max(0, Number.isFinite(gradient.angle) ? gradient.angle : DEFAULT_CARD_GRADIENT.gradientAngle));
  return via
    ? `linear-gradient(${angle}deg, ${from}, ${via} 55%, ${to})`
    : `linear-gradient(${angle}deg, ${from}, ${to})`;
}

function buildDefaultCardGradientSurface(secondary: string, accent: string): string {
  return `linear-gradient(135deg, ${accent}, #ffffff 55%, ${colorWithAlpha(secondary, 0.16)})`;
}

function applyGradientStopOpacity(color: string, opacity: number): string {
  if (opacity >= 1 || color === 'transparent') return color;
  return colorWithAlpha(color, opacity);
}

function applyCardBorder(inline: CSSProperties, settings: ResolvedCardSettings, palette: Palette) {
  if (settings.borderStyle === 'none' || settings.borderSides === 'none' || settings.borderWidthPx <= 0) {
    inline.border = '0 solid transparent';
    return;
  }

  const value = `${settings.borderWidthPx}px ${settings.borderStyle} ${resolveCardColor(settings.borderColor, palette)}`;
  if (settings.borderSides === 'all') {
    inline.border = value;
    return;
  }

  inline.border = '0 solid transparent';
  if (settings.borderSides === 'x') {
    inline.borderLeft = value;
    inline.borderRight = value;
  }
  if (settings.borderSides === 'y') {
    inline.borderTop = value;
    inline.borderBottom = value;
  }
  if (settings.borderSides === 'top') inline.borderTop = value;
  if (settings.borderSides === 'right') inline.borderRight = value;
  if (settings.borderSides === 'bottom') inline.borderBottom = value;
  if (settings.borderSides === 'left') inline.borderLeft = value;
}

function applyCardAccent(inline: CSSProperties, settings: ResolvedCardSettings, palette: Palette) {
  if (settings.accentSide === 'none' || settings.accentWidthPx <= 0) return;
  const value = `${settings.accentWidthPx}px solid ${resolveCardColor(settings.accentColor, palette)}`;
  if (settings.accentSide === 'top') inline.borderTop = value;
  if (settings.accentSide === 'right') inline.borderRight = value;
  if (settings.accentSide === 'bottom') inline.borderBottom = value;
  if (settings.accentSide === 'left') inline.borderLeft = value;
}

function buildCardShadow(settings: ResolvedCardSettings, palette: Palette): string {
  if (!settings.shadowEnabled || settings.shadowOpacity <= 0) return 'none';
  const color = colorWithAlpha(resolveCardColor(settings.shadowColor, palette), settings.shadowOpacity);
  const inset = settings.shadowInset ? 'inset ' : '';
  return `${inset}${settings.shadowX}px ${settings.shadowY}px ${settings.shadowBlur}px ${color}`;
}

function colorWithAlpha(color: string, alpha: number): string {
  const normalized = color.trim();
  const shortHex = normalized.match(/^#([0-9a-fA-F]{3})$/);
  const fullHex = normalized.match(/^#([0-9a-fA-F]{6})$/);

  if (shortHex) {
    const [r, g, b] = shortHex[1].split('').map((channel) => parseInt(`${channel}${channel}`, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  if (fullHex) {
    const value = fullHex[1];
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return normalized;
}
