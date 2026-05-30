export const TEMPLATE_PREVIEW_STYLES = [
  'luxe',
  'vivid',
  'airy',
  'edge',
  'classic',
  'organic',
  'sleek',
  'vibrant',
  'atlas',
  'editorial',
  'booked',
  'menu',
  'craft',
  'retro',
  'proof',
  'gallery',
  'builder',
  'commerce',
  'foundation',
  'wellness',
  'estate',
  'studio',
  'learn',
  'occasion',
] as const;

export type TemplatePreviewStyle = typeof TEMPLATE_PREVIEW_STYLES[number];

export const TEMPLATE_PREVIEW_VERSION = '20260502-cdp-v2';

const VERSIONED_TEMPLATE_PREVIEWS = new Set<TemplatePreviewStyle>([
  'atlas',
  'editorial',
  'booked',
  'menu',
  'craft',
  'retro',
  'proof',
  'gallery',
]);

export const TEMPLATE_PREVIEW_IMAGES: Record<TemplatePreviewStyle, string> =
  Object.fromEntries(TEMPLATE_PREVIEW_STYLES.map((style) => [
    style,
    VERSIONED_TEMPLATE_PREVIEWS.has(style)
      ? `/templates/${style}-${TEMPLATE_PREVIEW_VERSION}.png`
      : `/templates/${style}.png`,
  ])) as Record<TemplatePreviewStyle, string>;

const TEMPLATE_PREVIEW_ALIASES: Partial<Record<TemplatePreviewStyle, TemplatePreviewStyle>> = {
  builder: 'proof',
  commerce: 'craft',
  foundation: 'craft',
  wellness: 'booked',
  estate: 'gallery',
  studio: 'gallery',
  learn: 'editorial',
  occasion: 'retro',
};

export function getTemplatePreviewStyle(templateId: string): TemplatePreviewStyle | undefined {
  const normalized = templateId.toLowerCase().replace(/-/g, '_');
  return TEMPLATE_PREVIEW_STYLES.find((style) => normalized.includes(style));
}

export function getTemplatePreviewImage(templateId: string): string | undefined {
  const style = getTemplatePreviewStyle(templateId);
  const resolvedStyle = style ? TEMPLATE_PREVIEW_ALIASES[style] || style : undefined;
  return resolvedStyle ? TEMPLATE_PREVIEW_IMAGES[resolvedStyle] : undefined;
}
