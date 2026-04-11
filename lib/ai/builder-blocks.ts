export const VALID_BUILDER_BLOCK_TYPES = [
  'hero',
  'text',
  'image',
  'servicesGrid',
  'featuresList',
  'aboutImageText',
  'testimonials',
  'stats',
  'gallery',
  'contact',
  'faq',
  'cta',
  'booking',
  'productGrid',
  'contact_form',
  'map',
  'custom_html',
  'pricing',
  'logoCloud',
  'team',
  'blog',
  'resources',
  'carousel',
  'video',
  'deliveryLinks',
  'menu',
  'events',
  'pdf',
  'featuredQuote',
] as const;

export type ValidBuilderBlockType = (typeof VALID_BUILDER_BLOCK_TYPES)[number];

export const VALID_BUILDER_BLOCK_TYPE_SET = new Set<string>(VALID_BUILDER_BLOCK_TYPES);

export function isValidBuilderBlockType(value: string): value is ValidBuilderBlockType {
  return VALID_BUILDER_BLOCK_TYPE_SET.has(value);
}
