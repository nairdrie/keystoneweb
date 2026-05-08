type FieldCapability = {
  name: string;
  type: string;
  options?: readonly string[];
  defaultValue?: string;
  notes?: string;
};

type BlockCapability = {
  type: string;
  label: string;
  purpose: string;
  aiGuidance?: readonly string[];
  fields: readonly FieldCapability[];
};

export const AI_SUPPORTED_BLOCK_TYPES = [
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
  'estimateForm',
  'socialFeed',
  'tabBar',
] as const;

export const AI_INTENTIONALLY_DISABLED_BLOCK_TYPES = [
  'userProfile',
  'membershipGate',
  'chatSupport',
] as const;

export const HEADER_CONFIG_VALUE_SETS = {
  bgType: ['white', 'primary', 'secondary', 'gradient', 'custom', 'transparent'],
  layout: ['default', 'centeredAboveNav'],
  logoPosition: ['left', 'center', 'above'],
  navPosition: ['left', 'center', 'right'],
  desktopMenuStyle: ['inline', 'hamburger'],
  hamburgerPosition: ['left', 'right'],
  rightElement: ['cta', 'social', 'none'],
  bannerBgType: ['primary', 'secondary', 'custom'],
  sticky: ['always', 'none'],
} as const;

export const HEADER_CONFIG_OPERATION_TEXT = `9. { "op": "setHeaderConfig", "config": {
      "bgType": "white" | "primary" | "secondary" | "gradient" | "custom" | "transparent",
      "bgColor": "#hex",
      "layout": "default" | "centeredAboveNav",
      "logoPosition": "left" | "center" | "above",
      "navPosition": "left" | "center" | "right",
      "desktopMenuStyle": "inline" | "hamburger",
      "hamburgerPosition": "left" | "right",
      "overlay": true | false,
      "sticky": true | false | "always" | "none",
      "rightElement": "cta" | "social" | "none",
      "bannerEnabled": true | false,
      "bannerText": "<short announcement>",
      "bannerBgType": "primary" | "secondary" | "custom",
      "bannerBgColor": "#hex",
      "socialFacebook": "https://...",
      "socialInstagram": "https://...",
      "socialX": "https://...",
      "socialLinkedin": "https://...",
      "socialYoutube": "https://...",
      "navFontSize": "14px" | "0.95rem",
      "navFontWeight": "400" | "500" | "600" | "700",
      "navColor": "#hex",
      "showMemberSignIn": true | false,
      "memberSignInText": "<label>",
      "showProductSearch": true | false
    } }
   Customizes the site header. All config keys are optional; include only intentional choices.
   Header design guidance:
   - Use logoPosition/navPosition/desktopMenuStyle/rightElement to create a deliberate navigation composition.
   - Use overlay:true only when the first block has a strong visual background, usually a media or full-height hero.
   - Use transparent bgType with overlay headers, custom bgType with bgColor, and bannerBgColor only when bannerBgType is "custom".
   - Use social links only when the brief gives real public URLs or explicitly asks for social navigation.
   - showProductSearch is useful for shops; showMemberSignIn is useful for member or gated-content sites.`;

const STRONG_BACKGROUND_BLOCKS = new Set(['cta']);
const STRONG_BACKGROUND_STATS_VARIANTS = new Set(['banner']);
const SAFE_LIGHT_SECTION_BACKGROUND = 'palette:accent';
const SAFE_PRIMARY_COLOR = '#111827';
const SAFE_ACCENT_COLOR = '#f8fafc';
const AI_DISALLOWED_CUSTOM_CSS_KEYS = new Set(['__customCss', 'headerCustomCss']);
const UNIVERSAL_ALLOWED_TOP_LEVEL_KEYS = ['sectionSettings'] as const;

export function sanitizeAiBlockData(blockType: string, rawData: unknown): Record<string, unknown> {
  const data = filterAiBlockDataToAllowedSettings(blockType, clonePlainObject(rawData));
  normalizeSectionBackground(blockType, data);
  normalizeHeroBackgrounds(data);
  sanitizeCustomCssFields(data);
  sanitizeAiCustomHtmlBlock(blockType, data);
  return data;
}

function filterAiBlockDataToAllowedSettings(blockType: string, data: Record<string, unknown>): Record<string, unknown> {
  const allowedKeys = getAllowedBlockDataKeys(blockType);
  if (!allowedKeys || allowedKeys.size === 0) return {};

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowedKeys.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

export function sanitizeAiCustomColors(raw: Record<string, unknown>): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const key of ['primary', 'secondary', 'accent'] as const) {
    const value = raw[key];
    if (typeof value === 'string' && HEX_COLOR.test(value)) {
      colors[key] = normalizeHexColor(value);
    }
  }

  // Block renderers commonly use primary for text on accent section
  // backgrounds. Keep generated palettes in that readable relationship.
  if (colors.primary && relativeLuminance(colors.primary) > 0.72) {
    colors.primary = SAFE_PRIMARY_COLOR;
  }

  if (colors.accent && relativeLuminance(colors.accent) < 0.82) {
    colors.accent = SAFE_ACCENT_COLOR;
  }

  return colors;
}

function clonePlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function normalizeSectionBackground(blockType: string, data: Record<string, unknown>) {
  if (!('backgroundColor' in data)) return;

  const value = typeof data.backgroundColor === 'string' ? data.backgroundColor.trim() : '';
  if (!value) {
    delete data.backgroundColor;
    return;
  }

  if (blockType === 'stats' && STRONG_BACKGROUND_STATS_VARIANTS.has(String(data.variant || 'banner'))) {
    data.backgroundColor = normalizeStrongBackground(value, 'palette:primary');
    return;
  }

  if (STRONG_BACKGROUND_BLOCKS.has(blockType)) {
    data.backgroundColor = normalizeStrongBackground(value, 'palette:secondary');
    return;
  }

  // Most section renderers draw text with palette.primary, so using primary,
  // secondary, or arbitrary hex backgrounds can make generated text unreadable.
  // Keep generated section backgrounds palette-aware and light by default.
  data.backgroundColor = SAFE_LIGHT_SECTION_BACKGROUND;
}

function normalizeStrongBackground(value: string, fallback: string): string {
  return value === 'palette:primary' || value === 'palette:secondary' ? value : fallback;
}

function normalizeHexColor(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

function relativeLuminance(hex: string): number {
  const normalized = normalizeHexColor(hex).replace('#', '');
  if (normalized.length !== 6) return 1;
  const channels = [0, 2, 4].map((start) => parseInt(normalized.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((channel) => (
    channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4)
  ));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function normalizeHeroBackgrounds(data: Record<string, unknown>) {
  const cards = data.cards;
  if (!Array.isArray(cards)) return;

  for (const card of cards) {
    if (!card || typeof card !== 'object') continue;
    const background = (card as Record<string, unknown>).background;
    if (!background || typeof background !== 'object') continue;
    const bg = background as Record<string, unknown>;
    if (bg.type !== 'gradient') continue;

    const gradient = bg.gradient;
    if (!gradient || typeof gradient !== 'object') continue;
    const g = gradient as Record<string, unknown>;

    // Hero gradient text is palette.primary, so generated gradients should stay
    // on the light/accent side unless the user adds media or animation.
    g.from = normalizeLightHeroColor(g.from);
    g.to = normalizeLightHeroColor(g.to, '#ffffff');
    if ('via' in g) g.via = normalizeLightHeroColor(g.via, '#ffffff');
  }
}

function normalizeLightHeroColor(value: unknown, fallback = SAFE_LIGHT_SECTION_BACKGROUND): string {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  if (!v) return fallback;
  if (v === 'palette:accent') return v;
  if (v === '#ffffff' || v.toLowerCase() === '#fff') return '#ffffff';
  return fallback;
}

function sanitizeCustomCssFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    value.forEach(sanitizeCustomCssFields);
    return value;
  }

  if (!value || typeof value !== 'object') return value;

  const obj = value as Record<string, unknown>;
  for (const [key, nested] of Object.entries(obj)) {
    if (AI_DISALLOWED_CUSTOM_CSS_KEYS.has(key)) {
      delete obj[key];
    } else {
      sanitizeCustomCssFields(nested);
    }
  }

  return value;
}

function sanitizeAiCustomHtmlBlock(blockType: string, data: Record<string, unknown>) {
  if (blockType !== 'custom_html' || typeof data.html !== 'string') return;
  data.html = stripAiHtmlCss(data.html);
}

function stripAiHtmlCss(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<link\b[^>]*rel\s*=\s*["']?stylesheet["']?[^>]*>/gi, '')
    .replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/@import\s+[^;<>]+;?/gi, '')
    .trim()
    .slice(0, 5000);
}

let allowedBlockDataKeysCache: Map<string, Set<string>> | null = null;

function getAllowedBlockDataKeys(blockType: string): Set<string> | null {
  if (!allowedBlockDataKeysCache) {
    allowedBlockDataKeysCache = new Map(
      AI_BLOCK_CAPABILITIES.map((block) => {
        const keys = new Set<string>();
        for (const field of block.fields) {
          const key = topLevelKeyFromCapabilityField(field.name);
          if (key && AI_DISALLOWED_CUSTOM_CSS_KEYS.has(key)) continue;
          if (key) keys.add(key);
        }
        const extraKeys = EXTRA_ALLOWED_TOP_LEVEL_KEYS[block.type] ?? [];
        for (const key of UNIVERSAL_ALLOWED_TOP_LEVEL_KEYS) keys.add(key);
        for (const key of extraKeys) keys.add(key);
        return [block.type, keys];
      }),
    );
  }
  return allowedBlockDataKeysCache.get(blockType) ?? null;
}

function topLevelKeyFromCapabilityField(name: string): string | null {
  const key = name.split('.')[0]?.replace(/\[\]$/g, '').trim();
  return key && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : null;
}

const EXTRA_ALLOWED_TOP_LEVEL_KEYS: Record<string, readonly string[]> = {
  hero: ['title', 'subtitle', 'buttonText', 'buttonTextLink', 'variant', 'image', 'videoUrl'],
};

export function sanitizeAiCustomCss(css: string): string {
  // AI-generated custom CSS is intentionally disabled. Human-authored Custom
  // CSS remains available in the builder UI, but generated sites must stay
  // editable through structured block/theme settings.
  void css;
  return '';
}

export const AI_BLOCK_CAPABILITIES: readonly BlockCapability[] = [
  {
    type: 'hero',
    label: 'Hero/Banner section',
    purpose: 'Top-of-page introduction with headline, supporting text, CTA, optional foreground image, and customizable background cards.',
    aiGuidance: [
      'For new sites, prefer the cards structure over legacy title/subtitle fields so the AI controls the same settings the Hero inspector exposes.',
      'Use one card for a static hero; use 2-4 cards only when the business benefits from rotating messages.',
      'Do not leave card title/subtitle/CTA generic. The first card must clearly reflect the business, product, city, or audience from the brief.',
      'Use palette tokens for gradients when possible. Do not invent image/video URLs. If a visual hero needs prompt-aware sample media, set background.type:"image" with an empty image.url or enable content.image with an empty url; the system can fill an editable sample image after generation.',
    ],
    fields: [
      { name: 'cards', type: 'Array<{ id, content, background }>', notes: 'Each card has content.title/subtitle/cta/image and background.image/video/gradient/animation.' },
      { name: 'cards[].content.title', type: '{ enabled:boolean, value:string, align:"left"|"center"|"right" }' },
      { name: 'cards[].content.subtitle', type: '{ enabled:boolean, value:string, align:"left"|"center"|"right" }' },
      { name: 'cards[].content.cta', type: '{ enabled:boolean, label:string, link:Link, icon?:string, align:"left"|"center"|"right" }' },
      { name: 'cards[].content.image', type: '{ enabled:boolean, url:string, side:"left"|"right" }', notes: 'Foreground image. Leave url empty for prompt-aware sample media, or use a supplied/user-selected image URL.' },
      { name: 'cards[].background.type', type: 'string', options: ['image', 'video', 'gradient', 'animation'], defaultValue: 'gradient' },
      { name: 'cards[].background.image', type: '{ url:string }', notes: 'Use with background.type:"image". Leave url empty for prompt-aware sample media.' },
      { name: 'cards[].background.gradient', type: '{ from:string, to:string, via?:string, angle:number }', notes: 'Colors accept hex or palette tokens.' },
      { name: 'cards[].background.video', type: '{ source:"pexels"|"url", url:string }' },
      { name: 'cards[].background.animation', type: '{ id:string }', notes: 'Known animation ids include aurora, mesh, confetti, stripes, starfield, waves, noise, orbs, grid, sunrise.' },
      { name: 'cards[].background.overlay', type: '{ color:string, opacity:number }', notes: 'Opacity should be 0-1.' },
      { name: 'transition', type: '{ type:"fade"|"slide"|"none", intervalSec:number, pauseOnHover:boolean }', defaultValue: 'fade, 5 seconds, pause on hover' },
      { name: 'height', type: '{ desktop, tablet, mobile }', notes: 'Each breakpoint uses { mode:"fitContent"|"fitScreen"|"manual", valuePx:number, revealNext:0|1|2|3 }.' },
      { name: '__customCss', type: 'string', notes: 'Optional block-scoped CSS. Useful classes: .hero-title, .hero-subtitle, .hero-image, .hero-overlay. Do not style the hero button here; use Button Settings.' },
      { name: 'legacy fields', type: 'title, subtitle, buttonText, buttonTextLink, variant, image, videoUrl', notes: 'Still supported by migration, but do not prefer them for new onboarding builds.' },
    ],
  },
  {
    type: 'text',
    label: 'Rich text paragraph',
    purpose: 'Text-heavy content using simple HTML.',
    fields: [
      { name: 'html', type: 'string', notes: 'Supports headings, paragraphs, strong/emphasis, unordered lists, and list items.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'image',
    label: 'Image section',
    purpose: 'A standalone image with optional caption.',
    aiGuidance: ['Do not invent image URLs. For onboarding builds, leave image empty and the system can fill a prompt-aware editable sample image.'],
    fields: [
      { name: 'image', type: 'string', notes: 'Image URL or uploaded asset URL when available.' },
      { name: 'caption', type: 'string' },
      { name: 'image__settings', type: 'object', notes: 'Optional image positioning/crop settings when already present.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'servicesGrid',
    label: 'Services grid layout',
    purpose: 'Repeated service or offering cards.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'subtitle', type: 'string' },
      { name: 'items', type: 'Array<{ title:string, description:string }>', notes: 'Use 1-6 items, tailored to the business.' },
      { name: 'ctaText', type: 'string' },
      { name: 'ctaTextLink', type: 'Link' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'featuresList',
    label: 'Features / Why Us bullet list',
    purpose: 'A short list of differentiators, benefits, or reasons to choose the business.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'items', type: 'string[]', notes: 'Keep each feature concise and specific.' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'aboutImageText',
    label: 'About section with image + text',
    purpose: 'Story or credibility section combining copy, optional bullets, and an image area.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'items', type: 'string[]' },
      { name: 'image', type: 'string', notes: 'Do not invent image URLs. Leave empty for prompt-aware sample media.' },
      { name: 'imagePosition', type: 'string', options: ['left', 'right'] },
      { name: 'variant', type: 'string', options: ['landscape', 'square', 'tall'] },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'testimonials',
    label: 'Customer testimonials',
    purpose: 'Social proof quotes and ratings.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'subtitle', type: 'string' },
      { name: 'variant', type: 'string', options: ['cards', 'single'] },
      { name: 'items', type: 'Array<{ name:string, role:string, quote:string, rating:number }>', notes: 'Use plausible but not fake-specific claims. Rating should be 1-5.' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'stats',
    label: 'Statistics / numbers display',
    purpose: 'Important metrics or quick credibility markers.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'variant', type: 'string', options: ['banner', 'cards'] },
      { name: 'items', type: 'Array<{ value:string, label:string }>' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'gallery',
    label: 'Image gallery',
    purpose: 'Collection of images with optional lightbox and see-more behavior.',
    aiGuidance: ['Use title/subtitle and layout settings. Do not invent image URLs; onboarding sample gallery images are filled by the system after generation.'],
    fields: [
      { name: 'title', type: 'string' },
      { name: 'subtitle', type: 'string' },
      { name: 'images', type: 'Array<string|object>', notes: 'Only include when image assets already exist or are supplied by the user.' },
      { name: 'columns', type: 'number', options: ['2', '3', '4'], defaultValue: '3' },
      { name: 'showLightboxNav', type: 'boolean' },
      { name: 'showLightboxThumbs', type: 'boolean' },
      { name: 'showSeeMore', type: 'boolean' },
      { name: 'seeMore', type: 'string' },
      { name: 'seeMoreLink', type: 'Link' },
      { name: 'seeMoreIcon', type: 'string' },
      { name: 'autoScroll', type: 'boolean' },
      { name: 'autoScrollRows', type: 'number' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'contact',
    label: 'Contact information display',
    purpose: 'Displays phone, email, address, and hours.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'subtitle', type: 'string' },
      { name: 'phone', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'address', type: 'string' },
      { name: 'hours', type: 'string' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'faq',
    label: 'FAQ accordion',
    purpose: 'Expandable questions and answers.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'subtitle', type: 'string' },
      { name: 'items', type: 'Array<{ question:string, answer:string }>', notes: 'Use 2-8 common questions tailored to the prompt.' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'cta',
    label: 'Call to action banner',
    purpose: 'Focused prompt to take the next step.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'subtitle', type: 'string' },
      { name: 'buttonText', type: 'string' },
      { name: 'buttonTextLink', type: 'Link' },
      { name: 'buttonTextIcon', type: 'string' },
      { name: 'showPattern', type: 'boolean' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'contact_form',
    label: 'Contact form',
    purpose: 'Functional inquiry form.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'submitText', type: 'string' },
      { name: 'successMessage', type: 'string' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'map',
    label: 'Google Map embed',
    purpose: 'Map for a physical location.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'address', type: 'string' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'pricing',
    label: 'Pricing tiers / comparison',
    purpose: 'Packages, plans, or service pricing.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'subtitle', type: 'string' },
      { name: 'variant', type: 'string', options: ['cards', 'comparison', 'simple'] },
      { name: 'tiers', type: 'Array<{ name:string, price:string, period:string, description:string, features:string[], highlighted:boolean, buttonText?:string, buttonTextLink?:Link }>' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'logoCloud',
    label: 'Partner / client logos',
    purpose: 'Trust strip or partner/client logo display.',
    aiGuidance: ['Do not invent real partner logos. Use logos only when supplied; otherwise title the section for later user editing.'],
    fields: [
      { name: 'title', type: 'string' },
      { name: 'variant', type: 'string', options: ['inline', 'grid', 'marquee'] },
      { name: 'logos', type: 'Array<object|string>' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'team',
    label: 'Team member profiles',
    purpose: 'People, staff, instructors, or leadership profiles.',
    aiGuidance: ['Avoid inventing real people unless the user supplied names. For generic builds, use role-based placeholder names sparingly.'],
    fields: [
      { name: 'title', type: 'string' },
      { name: 'subtitle', type: 'string' },
      { name: 'variant', type: 'string', options: ['grid', 'cards', 'minimal'] },
      { name: 'columns', type: 'number', notes: '0/omitted means auto; otherwise 2, 3, or 4.' },
      { name: 'showBio', type: 'boolean' },
      { name: 'members', type: 'Array<{ name:string, role:string, bio:string, image?:string }>' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'blog',
    label: 'Blog post feed',
    purpose: 'Displays blog/news posts, optionally with fallback posts for a new template.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'subtitle', type: 'string' },
      { name: 'layout', type: 'string', options: ['grid', 'list', 'magazine'] },
      { name: 'showAuthor', type: 'boolean' },
      { name: 'showDate', type: 'boolean' },
      { name: 'showTags', type: 'boolean' },
      { name: 'showExcerpt', type: 'boolean' },
      { name: 'postsPerPage', type: 'number' },
      { name: 'fallbackPosts', type: 'Array<{ id,title,slug,excerpt,cover_image,author,tags,is_published,published_at,created_at }>', notes: 'Optional placeholder posts for brand-new templates.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'booking',
    label: 'Online booking / appointments',
    purpose: 'Booking interface backed by admin-editable booking services.',
    aiGuidance: ['Use this for appointment-led sites. Initial onboarding sample services can be seeded through the booking manager when the prompt indicates appointments, consultations, or bookings.'],
    fields: [
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'productGrid',
    label: 'E-commerce product display',
    purpose: 'Product listing block backed by the product catalog.',
    aiGuidance: ['This block is useful for shops even when products are added later. Configure visible catalog settings only; onboarding sample products are seeded through the admin product manager.'],
    fields: [
      { name: 'variant', type: 'string', options: ['grid', 'row', 'gridWithSidebar', 'list'] },
      { name: 'categoryFilter', type: 'string' },
      { name: 'subcategoryFilter', type: 'string' },
      { name: 'featuredOnly', type: 'boolean' },
      { name: 'showSeeMore', type: 'boolean' },
      { name: 'seeMoreLabel', type: 'string' },
      { name: 'seeMoreHref', type: 'string' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'resources',
    label: 'Resources section',
    purpose: 'Downloadable files, text resources, or external links.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'subtitle', type: 'string' },
      { name: 'variant', type: 'string', options: ['grid', 'list'] },
      { name: 'items', type: 'Array<{ id,type,title,description,fileUrl?,fileName?,fileType?,body?,url?,openInNewTab? }>', notes: 'type is file, text, or link. fileType is pdf or image.' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'custom_html',
    label: 'Custom HTML embed',
    purpose: 'Fallback for embeds or markup that no structured block supports.',
    aiGuidance: ['Use sparingly. No script tags. Do not use style tags, style attributes, or CSS. Prefer structured blocks whenever possible.'],
    fields: [
      { name: 'html', type: 'string', notes: 'Raw HTML for embeds. No script tags and no CSS.' },
    ],
  },
  {
    type: 'carousel',
    label: 'Content carousel',
    purpose: 'Scrolling content cards or slides.',
    aiGuidance: ['Use mediaType:"image" when a slide should receive prompt-aware sample media. Do not invent image URLs; leave image empty.'],
    fields: [
      { name: 'title', type: 'string' },
      { name: 'subtitle', type: 'string' },
      { name: 'variant', type: 'string', options: ['cards', 'slides', 'minimal'] },
      { name: 'items', type: 'Array<{ mediaType:"image"|"icon", icon?:string, image?:string, title:string, text:string }>' },
      { name: 'autoPlay', type: 'boolean' },
      { name: 'interval', type: 'number', notes: 'Seconds between slides.' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'video',
    label: 'External video embed',
    purpose: 'YouTube, Vimeo, or direct video embed.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'caption', type: 'string' },
      { name: 'videoUrl', type: 'string' },
      { name: 'variant', type: 'string', options: ['contained', 'fullWidth'] },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'deliveryLinks',
    label: 'Delivery app link buttons',
    purpose: 'Food delivery links for restaurant/cafe sites.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'subtitle', type: 'string' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: 'links', type: 'Array<{ id, platform:"ubereats"|"doordash"|"skipthedishes"|"custom", label, url, enabled }>' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'menu',
    label: 'Restaurant / food menu',
    purpose: 'Visual menu block backed by admin menu items or by a PDF.',
    aiGuidance: [
      'Use menuTitle and menuSubtitle, not title/subtitle, for the visible menu heading.',
      'Configure visible design options only. Initial onboarding sample dishes are seeded into the admin menu manager separately.',
      'Use icon_tags only from known/default options unless custom options already exist: gluten_free, vegetarian, vegan, spicy.',
    ],
    fields: [
      { name: 'menuTitle', type: 'string' },
      { name: 'menuSubtitle', type: 'string' },
      { name: 'mode', type: 'string', options: ['items', 'pdf'], defaultValue: 'items' },
      { name: 'variant', type: 'string', options: ['list', 'grid', 'cards', 'compact'], defaultValue: 'list' },
      { name: 'showPrices', type: 'boolean', defaultValue: 'true' },
      { name: 'showDescriptions', type: 'boolean', defaultValue: 'true' },
      { name: 'showMenuTabs', type: 'boolean', defaultValue: 'true' },
      { name: 'showFeaturedImages', type: 'boolean', defaultValue: 'true' },
      { name: 'showImages', type: 'boolean', defaultValue: 'false' },
      { name: 'showMenuIcons', type: 'boolean', defaultValue: 'true' },
      { name: 'categoryStyle', type: 'string', options: ['heading', 'badge', 'divider'], defaultValue: 'heading' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: 'showMenuIconLegend', type: 'boolean' },
      { name: 'menuIconLegendPosition', type: 'string', options: ['top', 'bottom'] },
      { name: 'menuIconLegendMode', type: 'string', options: ['all', 'used', 'custom'] },
      { name: 'menuIconLegendIds', type: 'string[]', notes: 'Used when legend mode is custom.' },
      { name: 'itemDetailEnabled', type: 'boolean', notes: 'Turns item popup on/off.' },
      { name: 'itemDetailShowPhoto', type: 'boolean' },
      { name: 'itemDetailPhotoVisibility', type: 'string', options: ['always', 'menu'], notes: 'menu means show popup photo only when image is already visible in menu, and do not show no-photo placeholders.' },
      { name: 'itemDetailShowName', type: 'boolean' },
      { name: 'itemDetailShowDescription', type: 'boolean' },
      { name: 'itemDetailShowPrice', type: 'boolean' },
      { name: 'itemDetailShowCategory', type: 'boolean' },
      { name: 'itemDetailShowIcons', type: 'boolean' },
      { name: 'itemDetailImageFit', type: 'string', options: ['contain', 'cover', 'center', 'stretch'] },
      { name: 'itemDetailCaptionBg', type: 'string', notes: 'Hex or palette token.' },
      { name: 'itemDetailTextColor', type: 'string', notes: 'Hex or palette token.' },
      { name: 'pdfUrl', type: 'string', notes: 'Used for PDF mode when a PDF exists.' },
      { name: 'pdfLabel', type: 'string' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'events',
    label: 'Events feed',
    purpose: 'Displays upcoming or past events from admin-managed events.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'subtitle', type: 'string' },
      { name: 'sortOrder', type: 'string', options: ['desc', 'asc'] },
      { name: 'showPast', type: 'boolean' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'pdf',
    label: 'PDF document viewer',
    purpose: 'Embedded PDF viewer with optional download.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'pdfUrl', type: 'string', notes: 'Only include when a PDF is already available.' },
      { name: 'showDownload', type: 'boolean' },
      { name: 'downloadLabel', type: 'string' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'featuredQuote',
    label: 'Featured quote / spotlight testimonial',
    purpose: 'Prominent quote, story, or testimonial with optional person photo.',
    fields: [
      { name: 'variant', type: 'string', options: ['centered', 'split', 'minimal', 'essay', 'multiGrid'] },
      { name: 'title', type: 'string' },
      { name: 'eyebrow', type: 'string' },
      { name: 'quote', type: 'string' },
      { name: 'personName', type: 'string' },
      { name: 'personTitle', type: 'string' },
      { name: 'personContext', type: 'string' },
      { name: 'personImage', type: 'string', notes: 'Do not invent image URLs. Leave empty for prompt-aware sample media on image variants.' },
      { name: 'imagePosition', type: 'string', options: ['left', 'right'] },
      { name: 'people', type: 'Array<{ name:string, title:string, quote:string }>', notes: 'Used by multiGrid variant.' },
      { name: 'backgroundColor', type: 'string', notes: 'Hex or palette token.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'estimateForm',
    label: 'Quote and estimate request form',
    purpose: 'Inquiry form with optional live estimate calculator.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'submitText', type: 'string' },
      { name: 'successMessage', type: 'string' },
      { name: 'variant', type: 'string', options: ['simple', 'calculator'] },
      { name: 'fields', type: 'Array<{ id,label,type:"select"|"number"|"text"|"textarea"|"checkbox",required,options,unit }>' },
      { name: 'pricingEnabled', type: 'boolean' },
      { name: 'pricingBasePrice', type: 'number', notes: 'Base price in cents.' },
      { name: 'pricingCurrency', type: 'string', defaultValue: 'CAD' },
      { name: 'pricingRangeSpread', type: 'number', notes: 'Decimal spread, e.g. 0.15.' },
      { name: 'pricingDisclaimer', type: 'string' },
      { name: 'showName', type: 'boolean' },
      { name: 'showEmail', type: 'boolean' },
      { name: 'showPhone', type: 'boolean' },
      { name: 'showAddress', type: 'boolean' },
      { name: 'showPreferredDate', type: 'boolean' },
      { name: 'showMessage', type: 'boolean' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'socialFeed',
    label: 'Social media embeds',
    purpose: 'Embeds public social posts or videos.',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'subtitle', type: 'string' },
      { name: 'variant', type: 'string', options: ['grid', 'single'] },
      { name: 'columns', type: 'number', options: ['1', '2', '3', '4'] },
      { name: 'items', type: 'Array<{ id, url }>', notes: 'Public YouTube, Instagram, TikTok, X/Twitter, or Facebook URLs.' },
      { name: '__customCss', type: 'string' },
    ],
  },
  {
    type: 'tabBar',
    label: 'Horizontal section/page menu bar',
    purpose: 'Navigation tabs linking to pages, sections, custom URLs, or block anchors.',
    fields: [
      { name: 'tabStyle', type: 'string', options: ['underline', 'pills', 'tabs', 'buttons'] },
      { name: 'tabAlign', type: 'string', options: ['left', 'center', 'right', 'stretch'] },
      { name: 'activeColor', type: 'string', notes: 'Hex or palette token.' },
      { name: 'bgColor', type: 'string', notes: 'Hex or palette token.' },
      { name: 'items', type: 'Array<{ id,label,linkType:"page"|"section"|"custom",href,pageId,blockId }>' },
      { name: '__customCss', type: 'string' },
    ],
  },
];

export function renderBlockSchemas(): string {
  const blocks = AI_BLOCK_CAPABILITIES.map((block, index) => {
    const guidance = block.aiGuidance?.length
      ? `\n   AI guidance:\n${block.aiGuidance.map((line) => `   - ${line}`).join('\n')}`
      : '';
    const fields = block.fields
      .filter((field) => {
        const key = topLevelKeyFromCapabilityField(field.name);
        return !key || !AI_DISALLOWED_CUSTOM_CSS_KEYS.has(key);
      })
      .map((field) => {
        const options = field.options?.length ? ` options: ${field.options.join(' | ')}` : '';
        const defaultValue = field.defaultValue ? ` default: ${field.defaultValue}` : '';
        const notes = field.notes ? ` - ${field.notes}` : '';
        return `     ${field.name}: ${field.type}${options}${defaultValue}${notes}`;
      })
      .join('\n');

    return `${index + 1}. "${block.type}" - ${block.label}
   Purpose: ${block.purpose}${guidance}
   data:
${fields}`;
  }).join('\n\n');

  return `AVAILABLE BLOCK TYPES AND THEIR DATA CAPABILITIES:

General rules:
- AI-generated block/header Custom CSS is disabled. Do not output "__customCss" or "headerCustomCss"; the server deletes those keys.
- Color fields that accept a hex color also accept palette tokens: "palette:primary", "palette:secondary", or "palette:accent". Prefer palette tokens for generated designs.
- For generated normal content sections, use "palette:accent" or omit backgroundColor. Use "palette:primary"/"palette:secondary" only for blocks that render their own light text, such as CTA and banner stats.
- The sanitizer drops any data key that is not listed in that block's data capabilities. Do not invent hidden knobs.
- Link fields use { linkType:"page"|"section"|"custom", pageSlug?:string, pageId?:string, blockId?:string, href?:string }. For new pages, prefer linkType:"page" with pageSlug.
- For onboarding/new site builds, template block content is placeholder content. Replace it with blocks and copy tailored to the user's prompt.
- Admin-backed blocks such as menu, products, booking, events, blog, and PDF may require later user setup. Still configure their visible titles/layout/settings. Initial onboarding sample products, menu items, and booking services are seeded separately through admin-editable data, not hidden block fields.
- Do not invent image URLs. For onboarding/new-site builds, image-capable blocks can receive prompt-aware sample media after generation when their image fields are intentionally left empty.
- Button appearance is controlled by editable Button Settings and supported block/header fields.

${blocks}

AI intentionally does not generate these addable/internal blocks unless a future capability explicitly enables them: ${AI_INTENTIONALLY_DISABLED_BLOCK_TYPES.join(', ')}.`;
}

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const CSS_SIZE = /^(?:\d+(?:\.\d+)?)(?:px|rem|em|%)$/;
const FONT_WEIGHT = /^(?:[1-9]00|normal|bold)$/;

function isValidHeaderValue<K extends keyof typeof HEADER_CONFIG_VALUE_SETS>(
  key: K,
  value: unknown,
): value is (typeof HEADER_CONFIG_VALUE_SETS)[K][number] {
  return typeof value === 'string' && (HEADER_CONFIG_VALUE_SETS[key] as readonly string[]).includes(value);
}

function cleanLimitedString(value: unknown, maxLength: number, cleanString: (value: string) => string): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = cleanString(value).trim().slice(0, maxLength);
  return cleaned || null;
}

export function sanitizeAiHeaderConfig(
  raw: unknown,
  cleanString: (value: string) => string = (value) => value,
): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const input = raw as Record<string, unknown>;
  const config: Record<string, unknown> = {};

  for (const key of Object.keys(HEADER_CONFIG_VALUE_SETS) as Array<keyof typeof HEADER_CONFIG_VALUE_SETS>) {
    if (isValidHeaderValue(key, input[key])) {
      config[key] = input[key];
    }
  }

  if (typeof input.sticky === 'boolean') {
    config.sticky = input.sticky;
  }

  for (const key of ['overlay', 'bannerEnabled', 'showMemberSignIn', 'showProductSearch'] as const) {
    if (typeof input[key] === 'boolean') {
      config[key] = input[key];
    }
  }

  for (const key of ['bgColor', 'bannerBgColor', 'navColor'] as const) {
    if (typeof input[key] === 'string' && HEX_COLOR.test(input[key])) {
      config[key] = input[key];
    }
  }

  if (typeof input.navFontSize === 'string' && CSS_SIZE.test(input.navFontSize.trim())) {
    config.navFontSize = input.navFontSize.trim().slice(0, 20);
  }

  if (typeof input.navFontWeight === 'string' && FONT_WEIGHT.test(input.navFontWeight.trim())) {
    config.navFontWeight = input.navFontWeight.trim().slice(0, 20);
  }

  const bannerText = cleanLimitedString(input.bannerText, 200, cleanString);
  if (bannerText !== null) config.bannerText = bannerText;

  const memberSignInText = cleanLimitedString(input.memberSignInText, 80, cleanString);
  if (memberSignInText !== null) config.memberSignInText = memberSignInText;

  for (const key of ['socialFacebook', 'socialInstagram', 'socialX', 'socialLinkedin', 'socialYoutube'] as const) {
    const url = cleanLimitedString(input[key], 300, cleanString);
    if (url && /^https?:\/\//i.test(url)) {
      config[key] = url;
    }
  }

  return config;
}
