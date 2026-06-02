import { PRESET_TEMPLATE_DISPLAYS, type PresetTemplateStyle } from '@/lib/templates/preset-template-display';

const LEGACY_TEMPLATE_PREVIEW_STYLES = [
  'luxe',
  'vivid',
  'airy',
  'edge',
  'classic',
  'organic',
  'sleek',
  'vibrant',
] as const;

export const PRESET_TEMPLATE_PREVIEW_STYLES = Object.keys(PRESET_TEMPLATE_DISPLAYS) as PresetTemplateStyle[];

export const TEMPLATE_PREVIEW_STYLES = [
  ...LEGACY_TEMPLATE_PREVIEW_STYLES,
  ...PRESET_TEMPLATE_PREVIEW_STYLES,
] as const;

export type TemplatePreviewStyle = typeof TEMPLATE_PREVIEW_STYLES[number];

function isPresetTemplatePreviewStyle(style: TemplatePreviewStyle): style is PresetTemplateStyle {
  return style in PRESET_TEMPLATE_DISPLAYS;
}

export const TEMPLATE_PREVIEW_IMAGES: Record<TemplatePreviewStyle, string> =
  Object.fromEntries(TEMPLATE_PREVIEW_STYLES.map((style) => [
    style,
    isPresetTemplatePreviewStyle(style) ? `/templates/${style}.svg` : `/templates/${style}.png`,
  ])) as Record<TemplatePreviewStyle, string>;

export function getTemplatePreviewStyle(templateId: string): TemplatePreviewStyle | undefined {
  const normalized = templateId.toLowerCase().replace(/-/g, '_');
  return TEMPLATE_PREVIEW_STYLES.find((style) => normalized.includes(style));
}

export function getTemplatePreviewImage(templateId: string): string | undefined {
  const style = getTemplatePreviewStyle(templateId);
  return style ? TEMPLATE_PREVIEW_IMAGES[style] : undefined;
}
