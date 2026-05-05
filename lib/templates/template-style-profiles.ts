export type TemplateStyleProfile = {
  id: string;
  name: string;
  bestFor: string;
  palette: string;
  fonts: string;
  header: string;
  hero: string;
  blocks: string;
  css: string;
};

export const TEMPLATE_STYLE_PROFILE_IDS = [
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
] as const;

export type TemplateStyleProfileId = typeof TEMPLATE_STYLE_PROFILE_IDS[number];

export const TEMPLATE_STYLE_PROFILES: readonly TemplateStyleProfile[] = [
  {
    id: 'luxe',
    name: 'Luxe',
    bestFor: 'salons, spas, boutique shops, wedding services, refined personal brands',
    palette: 'warm neutrals with a dark ink primary, soft accent background, and one muted metallic or blush secondary',
    fonts: 'serif heading such as Playfair Display or Cormorant Garamond with a clean sans body',
    header: 'centered or above-logo navigation, generous spacing, CTA on the right when conversion matters',
    hero: 'centered or split hero with short elegant copy and one clear CTA',
    blocks: 'hero, aboutImageText, servicesGrid, testimonials, gallery, cta',
    css: 'hairline borders, wide spacing, subtle image radius, no loud shadows',
  },
  {
    id: 'vivid',
    name: 'Vivid',
    bestFor: 'startups, fitness brands, agencies, bold product launches',
    palette: 'high-saturation secondary with dark readable primary and very light accent',
    fonts: 'chunky sans heading such as Montserrat, Outfit, or Space Grotesk with a simple sans body',
    header: 'primary or gradient header, inline nav, bold CTA, product search only for shops',
    hero: 'split or centered hero with big direct headline and button-led action',
    blocks: 'hero, carousel, servicesGrid, stats, testimonials, pricing, cta',
    css: 'large radius, sticker-like image/card accents, palette-token outlines, button settings left editable',
  },
  {
    id: 'airy',
    name: 'Airy',
    bestFor: 'wellness, coaching, photographers, portfolios, personal brands',
    palette: 'soft pastel secondary, dark slate primary, pale accent background',
    fonts: 'rounded or friendly sans such as Nunito, Lato, or Inter',
    header: 'white header, nav centered or right, simple CTA or social icons',
    hero: 'minimal or split hero with calm copy and comfortable whitespace',
    blocks: 'hero, aboutImageText, gallery, featuresList, testimonials, contact_form',
    css: 'soft card radius, gentle shadows, pill buttons, spacious section rhythm',
  },
  {
    id: 'edge',
    name: 'Edge',
    bestFor: 'software, gaming, cybersecurity, nightlife, audio gear',
    palette: 'deep primary with bright neon or pastel secondary and a light accent for normal sections',
    fonts: 'modern sans or display sans such as Sora, Space Grotesk, or DM Sans',
    header: 'dark primary or transparent overlay header, compact nav, CTA on right',
    hero: 'fullImage, gradient, or animation hero with concise high-contrast copy',
    blocks: 'hero, stats, tabBar, servicesGrid, pricing, faq, cta',
    css: 'sharp borders, glow shadows using secondary, angular dividers, no text color overrides',
  },
  {
    id: 'classic',
    name: 'Classic',
    bestFor: 'law, finance, trades, healthcare, professional services',
    palette: 'navy or charcoal primary, restrained secondary, light accent background',
    fonts: 'Merriweather or Libre Baskerville heading with Source Sans or Inter body',
    header: 'white or primary header, conventional logo left and nav right, clear CTA',
    hero: 'split or centered hero with trust-first headline and practical CTA',
    blocks: 'hero, servicesGrid, stats, testimonials, faq, estimateForm, contact',
    css: 'structured borders, modest radius, clear section dividers, restrained shadows',
  },
  {
    id: 'organic',
    name: 'Organic',
    bestFor: 'community groups, eco brands, cafes, garden centers, yoga, nonprofits',
    palette: 'earthy green or brown primary, warm secondary, cream or off-white accent',
    fonts: 'friendly serif or rounded sans with Karla, Lato, or Inter body',
    header: 'white or transparent header, soft CTA, social icons when useful',
    hero: 'split or fullImage hero with welcoming local copy',
    blocks: 'hero, aboutImageText, featuredQuote, servicesGrid, gallery, contact',
    css: 'organic image shapes, rounded cards, soft borders, warm spacing',
  },
  {
    id: 'sleek',
    name: 'Sleek',
    bestFor: 'architecture, design portfolios, art galleries, fashion, premium products',
    palette: 'monochrome primary/accent with one precise secondary accent',
    fonts: 'Sora, Inter, or Space Grotesk with disciplined weights',
    header: 'minimal white or transparent header, sparse nav, CTA only when needed',
    hero: 'minimal, split, or fullImage hero with short architectural copy',
    blocks: 'hero, gallery, aboutImageText, stats, featuredQuote, contact_form',
    css: 'thin rules, square or low-radius cards, image-first spacing, minimal shadows',
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    bestFor: 'education, events, kids brands, festivals, joyful local campaigns',
    palette: 'bright secondary with cheerful supporting tones and safe light accent',
    fonts: 'rounded sans or bold display sans such as Nunito, Poppins, or Outfit',
    header: 'gradient or white header with friendly CTA and centered nav when playful',
    hero: 'centered or split hero with upbeat copy and visible CTA',
    blocks: 'hero, carousel, featuresList, events, gallery, faq, cta',
    css: 'rounded cards, playful shadows, rotated accents in moderation, pill controls',
  },
  {
    id: 'atlas',
    name: 'Atlas',
    bestFor: 'B2B consulting, SaaS, advisory, finance, operations teams',
    palette: 'slate or navy primary, teal or blue secondary, cool light accent',
    fonts: 'Space Grotesk heading with Inter body',
    header: 'logo left, nav right, CTA on right, white or transparent overlay for hero',
    hero: 'split or minimal hero with operational clarity, proof, and a page-linked CTA',
    blocks: 'hero, stats, logoCloud, servicesGrid, pricing, featuredQuote, contact_form',
    css: 'boardroom hairlines, metric bands, subtle grid lines, no demo-client content',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    bestFor: 'publications, writers, newsletters, thought leaders, content-first brands',
    palette: 'ink primary, restrained secondary accent, paper-like accent background',
    fonts: 'Libre Baskerville, Crimson Text, or Playfair Display heading with Source Sans body',
    header: 'centered or above-logo header, optional announcement banner, nav suited to articles',
    hero: 'minimal or centered hero with authored point of view and clear read/subscribe CTA',
    blocks: 'hero, blog, featuredQuote, aboutImageText, resources, logoCloud, cta',
    css: 'magazine rules, narrow text measures, uppercase labels, careful type scale',
  },
  {
    id: 'booked',
    name: 'Booked',
    bestFor: 'appointments, clinics, salons, tutors, coaches, one-to-one services',
    palette: 'calm slate or navy primary, friendly teal or rose secondary, soft accent',
    fonts: 'Nunito, Lato, or Inter for both heading and body',
    header: 'logo left, nav right, CTA on right that points to booking or contact',
    hero: 'split hero with appointment promise, booking CTA, and service reassurance',
    blocks: 'hero, booking, servicesGrid, pricing, testimonials, faq, contact',
    css: 'soft cards, rounded form sections, clear booking emphasis, gentle shadows',
  },
  {
    id: 'menu',
    name: 'Menu',
    bestFor: 'restaurants, cafes, bakeries, food trucks, pubs',
    palette: 'hospitality warm primary, appetizing secondary, light accent section background',
    fonts: 'Playfair Display or Fraunces heading with Lato or Inter body',
    header: 'transparent overlay or white header with CTA for reserve/order',
    hero: 'fullImage hero for atmosphere, with CTA linked to the menu page',
    blocks: 'hero, menu, gallery, deliveryLinks, contact, map',
    css: 'menu cards, warm dividers, photo radius, button radius that matches the venue',
  },
  {
    id: 'craft',
    name: 'Craft',
    bestFor: 'makers, ceramics, handmade goods, local shops, boutique product brands',
    palette: 'clay, sage, ochre, or wool tones with a light handmade accent',
    fonts: 'Fraunces heading with Karla or Inter body',
    header: 'white header, logo left, shop/contact CTA or product search when ecommerce is present',
    hero: 'split hero with maker story and CTA to shop or story',
    blocks: 'hero, productGrid, aboutImageText, gallery, featuredQuote, testimonials, cta',
    css: 'handmade image radius, soft offset shadows, tactile card borders, palette-safe backgrounds',
  },
  {
    id: 'retro',
    name: 'Retro',
    bestFor: 'creators, pop-ups, events, drops, youth brands, playful campaigns',
    palette: 'bold primary with punchy pink, yellow, blue, orange, or lime secondary and light accent',
    fonts: 'Space Grotesk heading with DM Sans body',
    header: 'primary, gradient, or white header with a punchy CTA and compact nav',
    hero: 'centered or split hero with short energetic copy and page-linked CTA',
    blocks: 'hero, productGrid, events, carousel, testimonials, gallery, cta',
    css: 'chunky borders, offset image/card frames, low radius, playful section dividers',
  },
  {
    id: 'proof',
    name: 'Proof',
    bestFor: 'contractors, trades, legal, clinics, real estate, trust-heavy services',
    palette: 'navy or charcoal primary, green or amber secondary, light neutral accent',
    fonts: 'Merriweather heading with Source Sans or Inter body',
    header: 'white or primary header with prominent quote/estimate CTA',
    hero: 'split hero with clear service promise, guarantee, and conversion CTA',
    blocks: 'hero, stats, testimonials, logoCloud, estimateForm, servicesGrid, faq, contact',
    css: 'review cards, trust badges, practical borders, strong CTA contrast',
  },
  {
    id: 'gallery',
    name: 'Gallery',
    bestFor: 'photographers, designers, artists, architects, studios, portfolios',
    palette: 'monochrome or gallery-neutral primary, quiet secondary, clean accent',
    fonts: 'Sora or Inter heading with Inter body',
    header: 'transparent overlay for image heroes or very minimal white header',
    hero: 'fullImage or minimal hero with visual-first positioning and restrained copy',
    blocks: 'hero, gallery, featuredQuote, aboutImageText, contact_form, cta',
    css: 'full-bleed image moments, tight gallery gaps, square image frames, minimal card chrome',
  },
];

const STYLE_CHIP_TO_PROFILES: Record<string, string[]> = {
  bold: ['vivid', 'retro', 'edge'],
  minimal: ['sleek', 'atlas', 'airy'],
  warm: ['organic', 'craft', 'menu'],
  luxury: ['luxe', 'editorial', 'sleek'],
  playful: ['vibrant', 'retro'],
  dark: ['edge', 'sleek'],
  editorial: ['editorial', 'atlas', 'proof'],
  earthy: ['organic', 'craft'],
};

export function renderTemplateStyleProfilesForAi(input?: {
  styleIds?: readonly string[];
  styleLabels?: readonly string[];
  description?: string;
}): string {
  const likelyIds = new Set(recommendTemplateStyleProfileIds(input));
  const profileLines = TEMPLATE_STYLE_PROFILES.map((profile) => {
    const marker = likelyIds.has(profile.id) ? ' [likely relevant]' : '';
    return [
      `- ${profile.id} (${profile.name})${marker}: best for ${profile.bestFor}.`,
      `  Palette: ${profile.palette}.`,
      `  Fonts: ${profile.fonts}.`,
      `  Header: ${profile.header}.`,
      `  Hero: ${profile.hero}.`,
      `  Blocks/settings: ${profile.blocks}.`,
      `  Visual treatment: ${profile.css}.`,
    ].join('\n');
  }).join('\n');

  return `STYLE-ONLY TEMPLATE PROFILES:
These profiles describe how public templates should influence AI-generated sites without importing their demo pages, blocks, copy, products, menu items, or images. For onboarding, keep the site on the Custom AI template and express the chosen profile only through user-editable settings: setCustomColors, setFont, setHeaderConfig, supported block fields, admin sample data, and palette-safe block settings. Do not output custom CSS.
${profileLines}`;
}

export function recommendTemplateStyleProfileIds(input?: {
  styleIds?: readonly string[];
  styleLabels?: readonly string[];
  description?: string;
}): string[] {
  const picked = new Set<string>();
  for (const id of input?.styleIds ?? []) {
    for (const profileId of STYLE_CHIP_TO_PROFILES[id] ?? []) picked.add(profileId);
  }

  const text = [
    input?.description ?? '',
    ...(input?.styleLabels ?? []),
  ].join(' ').toLowerCase();

  addIf(text, picked, ['restaurant', 'cafe', 'bakery', 'bar', 'food truck', 'menu', 'dining'], 'menu');
  addIf(text, picked, ['shop', 'store', 'product', 'ecommerce', 'retail', 'handmade', 'pottery', 'ceramic', 'craft'], 'craft');
  addIf(text, picked, ['appointment', 'booking', 'clinic', 'salon', 'therapist', 'tutor', 'coach'], 'booked');
  addIf(text, picked, ['portfolio', 'photographer', 'gallery', 'artist', 'designer', 'architect', 'studio'], 'gallery');
  addIf(text, picked, ['consulting', 'b2b', 'saas', 'advisor', 'finance', 'operations'], 'atlas');
  addIf(text, picked, ['contractor', 'plumber', 'electrician', 'law', 'legal', 'dentist', 'real estate', 'estimate'], 'proof');
  addIf(text, picked, ['blog', 'publication', 'writer', 'newsletter', 'article'], 'editorial');
  addIf(text, picked, ['event', 'festival', 'drop', 'creator', 'playful'], 'retro');

  return [...picked];
}

export function isTemplateStyleProfileId(value: unknown): value is TemplateStyleProfileId {
  return typeof value === 'string' && TEMPLATE_STYLE_PROFILE_IDS.includes(value as TemplateStyleProfileId);
}

export function getTemplateStyleProfileNames(ids: readonly string[] | undefined): string[] {
  if (!ids?.length) return [];
  const namesById = new Map(TEMPLATE_STYLE_PROFILES.map((profile) => [profile.id, profile.name]));
  return ids
    .map((id) => namesById.get(id))
    .filter((name): name is string => Boolean(name));
}

function addIf(text: string, picked: Set<string>, needles: readonly string[], profileId: string) {
  if (needles.some((needle) => text.includes(needle))) picked.add(profileId);
}
