export const KEYSTONE_ALLOWED_BLOCK_DISPLAY_NAMES = [
  'Hero Section',
  'Rich Text Paragraph',
  'Image Section',
  'Services Grid',
  'Features / Why Us',
  'About (Image + Text)',
  'Testimonials',
  'Stats / Numbers',
  'Image Gallery',
  'Contact Info',
  'FAQ Accordion',
  'Call to Action',
  'Booking / Appointments',
  'Product Catalog',
  'Contact Form',
  'Estimate / Quote Form',
  'Logo Cloud / Partners',
  'Pricing Table',
  'Team Members',
  'Google Map',
  'Blog / News',
  'Menu',
  'Delivery App Links',
  'Events',
  'PDF Viewer',
  'Resources',
  'Custom HTML / Embed',
  'Featured Quote',
  'Content Carousel',
  'Video Embed',
  'Social Media Embeds',
  'Tab Bar / Menu Bar',
  'Timeline',
  'User Profile',
  'Membership Gate',
] as const;

export type KeystoneBlockDisplayName = typeof KEYSTONE_ALLOWED_BLOCK_DISPLAY_NAMES[number];

export type ResolvedBuilderBlock = {
  displayName: KeystoneBlockDisplayName;
  internalType: string;
  componentName?: string;
  category?: string;
  supportsManagedContent?: boolean;
  requiresSavedSite?: boolean;
  isProOnly?: boolean;
};

export const EXISTING_BUILDER_BLOCKS: readonly ResolvedBuilderBlock[] = [
  { displayName: 'Hero Section', internalType: 'hero', componentName: 'HeroBlock', category: 'Page Structure' },
  { displayName: 'Rich Text Paragraph', internalType: 'text', componentName: 'TextBlock', category: 'Page Structure' },
  { displayName: 'Image Section', internalType: 'image', componentName: 'ImageBlock', category: 'Media' },
  { displayName: 'Services Grid', internalType: 'servicesGrid', componentName: 'ServicesGridBlock', category: 'Content Lists' },
  { displayName: 'Features / Why Us', internalType: 'featuresList', componentName: 'FeaturesListBlock', category: 'Trust' },
  { displayName: 'About (Image + Text)', internalType: 'aboutImageText', componentName: 'AboutImageTextBlock', category: 'Page Structure' },
  { displayName: 'Testimonials', internalType: 'testimonials', componentName: 'TestimonialsBlock', category: 'Trust' },
  { displayName: 'Stats / Numbers', internalType: 'stats', componentName: 'StatsBlock', category: 'Trust' },
  { displayName: 'Image Gallery', internalType: 'gallery', componentName: 'GalleryBlock', category: 'Media' },
  { displayName: 'Contact Info', internalType: 'contact', componentName: 'ContactBlock', category: 'Contact' },
  { displayName: 'FAQ Accordion', internalType: 'faq', componentName: 'FAQBlock', category: 'Trust' },
  { displayName: 'Call to Action', internalType: 'cta', componentName: 'CtaBlock', category: 'Page Structure' },
  {
    displayName: 'Booking / Appointments',
    internalType: 'booking',
    componentName: 'BookingBlock',
    category: 'Commerce and Scheduling',
    supportsManagedContent: true,
    requiresSavedSite: true,
  },
  {
    displayName: 'Product Catalog',
    internalType: 'productGrid',
    componentName: 'ProductGridBlock',
    category: 'Commerce and Scheduling',
    supportsManagedContent: true,
    requiresSavedSite: true,
  },
  { displayName: 'Contact Form', internalType: 'contact_form', componentName: 'ContactFormBlock', category: 'Contact' },
  { displayName: 'Estimate / Quote Form', internalType: 'estimateForm', componentName: 'EstimateFormBlock', category: 'Contact' },
  { displayName: 'Logo Cloud / Partners', internalType: 'logoCloud', componentName: 'LogoCloudBlock', category: 'Trust' },
  { displayName: 'Pricing Table', internalType: 'pricing', componentName: 'PricingBlock', category: 'Commerce and Scheduling' },
  { displayName: 'Team Members', internalType: 'team', componentName: 'TeamBlock', category: 'Trust' },
  { displayName: 'Google Map', internalType: 'map', componentName: 'MapBlock', category: 'Contact' },
  {
    displayName: 'Blog / News',
    internalType: 'blog',
    componentName: 'BlogBlock',
    category: 'Content Feeds',
    supportsManagedContent: true,
    requiresSavedSite: true,
  },
  {
    displayName: 'Menu',
    internalType: 'menu',
    componentName: 'MenuBlock',
    category: 'Commerce and Scheduling',
    supportsManagedContent: true,
    requiresSavedSite: true,
  },
  { displayName: 'Delivery App Links', internalType: 'deliveryLinks', componentName: 'DeliveryLinksBlock', category: 'Commerce and Scheduling' },
  {
    displayName: 'Events',
    internalType: 'events',
    componentName: 'EventsBlock',
    category: 'Content Feeds',
    supportsManagedContent: true,
    requiresSavedSite: true,
  },
  { displayName: 'PDF Viewer', internalType: 'pdf', componentName: 'PDFBlock', category: 'Media' },
  { displayName: 'Resources', internalType: 'resources', componentName: 'ResourcesBlock', category: 'Content Feeds' },
  { displayName: 'Custom HTML / Embed', internalType: 'custom_html', componentName: 'CustomHTMLBlock', category: 'Advanced', isProOnly: true },
  { displayName: 'Featured Quote', internalType: 'featuredQuote', componentName: 'FeaturedQuoteBlock', category: 'Trust' },
  { displayName: 'Content Carousel', internalType: 'carousel', componentName: 'CarouselBlock', category: 'Content Lists' },
  { displayName: 'Video Embed', internalType: 'video', componentName: 'VideoBlock', category: 'Media' },
  { displayName: 'Social Media Embeds', internalType: 'socialFeed', componentName: 'SocialFeedBlock', category: 'Media' },
  { displayName: 'Tab Bar / Menu Bar', internalType: 'tabBar', componentName: 'TabBarBlock', category: 'Navigation' },
  { displayName: 'Timeline', internalType: 'timeline', componentName: 'TimelineBlock', category: 'Content Lists' },
  { displayName: 'User Profile', internalType: 'userProfile', componentName: 'UserProfileBlock', category: 'Membership', isProOnly: true },
  {
    displayName: 'Membership Gate',
    internalType: 'membershipGate',
    componentName: 'MembershipGateBlock',
    category: 'Membership',
    supportsManagedContent: true,
    requiresSavedSite: true,
    isProOnly: true,
  },
] as const;

const BLOCKS_BY_DISPLAY_NAME = new Map<string, ResolvedBuilderBlock>(
  EXISTING_BUILDER_BLOCKS.map((block) => [normalizeBlockName(block.displayName), block]),
);

const BLOCKS_BY_INTERNAL_TYPE = new Map<string, ResolvedBuilderBlock>(
  EXISTING_BUILDER_BLOCKS.map((block) => [block.internalType, block]),
);

export function resolveBuilderBlock(displayName: KeystoneBlockDisplayName | string): ResolvedBuilderBlock | null {
  return BLOCKS_BY_DISPLAY_NAME.get(normalizeBlockName(displayName)) ?? null;
}

export function resolveBuilderBlockByType(internalType: string): ResolvedBuilderBlock | null {
  return BLOCKS_BY_INTERNAL_TYPE.get(internalType) ?? null;
}

export function getBuilderBlockDisplayName(internalType: string): KeystoneBlockDisplayName | string {
  return resolveBuilderBlockByType(internalType)?.displayName ?? internalType;
}

export function getAllBuilderBlockTypes(): string[] {
  return EXISTING_BUILDER_BLOCKS.map((block) => block.internalType);
}

function normalizeBlockName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
