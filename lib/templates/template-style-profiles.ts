import type { CardStyle } from '@/lib/block-style-options';
import { PRESET_TEMPLATE_DISPLAYS } from '@/lib/templates/preset-template-display';

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
  preferredCardStyles?: Partial<Record<string, readonly CardStyle[]>>;
};

export const TEMPLATE_STYLE_PROFILE_IDS = [
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
    css: 'servicesGrid cardStyle:"luxe" or "editorial", testimonials cardStyle:"glass", carousel cardStyle:"luxe", wide spacing, subtle image radius, no loud shadows',
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
    css: 'servicesGrid cardStyle:"gradient" or "glow", carousel Retro cardStyle:"offset", testimonials cardStyle:"elevated", palette-token outlines, button settings left editable',
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
    css: 'servicesGrid cardStyle:"soft", testimonials cardStyle:"glass", stats cardStyle:"inset", gentle shadows, pill buttons, spacious section rhythm',
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
    css: 'servicesGrid cardStyle:"glow" or "solid", stats cardStyle:"solid", carousel cardStyle:"gradient", angular dividers, no text color overrides',
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
    css: 'servicesGrid cardStyle:"bordered" or Ledger cardStyle:"slab", stats cardStyle:"utility", testimonials cardStyle:"editorial", clear section dividers, restrained shadows',
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
    css: 'servicesGrid cardStyle:"inset" or "soft", carousel cardStyle:"soft" or "elevated", testimonials cardStyle:"soft", organic image shapes, soft borders, warm spacing',
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
    css: 'servicesGrid cardStyle:"outline" or "minimal", carousel cardStyle:"poster", testimonials cardStyle:"luxe", thin rules, image-first spacing, minimal shadows',
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
    css: 'servicesGrid cardStyle:"playful", carousel cardStyle:"gradient", testimonials cardStyle:"elevated", rounded cards, lively shadows, pill controls',
  },
  {
    id: 'atlas',
    name: PRESET_TEMPLATE_DISPLAYS.atlas.name,
    bestFor: 'B2B consulting, SaaS, advisory, finance, operations teams',
    palette: 'slate or navy primary, teal or blue secondary, cool light accent',
    fonts: 'Space Grotesk heading with Inter body',
    header: 'logo left, nav right, CTA on right, white or transparent overlay for hero',
    hero: 'split or minimal hero with operational clarity, proof, and a page-linked CTA',
    blocks: 'hero, stats, logoCloud, servicesGrid, pricing, featuredQuote, contact_form',
    css: 'Use only the Utility (cardStyle:"utility") card preset across card-capable blocks, including stats, services, pricing, carousel, forms, and contact cards. Keep surfaces white/accent and icons framed.',
    preferredCardStyles: { servicesGrid: ['utility'], pricing: ['utility'], stats: ['utility'], carousel: ['utility'], contact_form: ['utility'] },
  },
  {
    id: 'editorial',
    name: PRESET_TEMPLATE_DISPLAYS.editorial.name,
    bestFor: 'publications, writers, newsletters, thought leaders, content-first brands',
    palette: 'ink primary, restrained secondary accent, paper-like accent background',
    fonts: 'Libre Baskerville, Crimson Text, or Playfair Display heading with Source Sans body',
    header: 'centered or above-logo header, optional announcement banner, nav suited to articles',
    hero: 'minimal or centered hero with authored point of view and clear read/subscribe CTA',
    blocks: 'hero, blog, featuredQuote, aboutImageText, resources, logoCloud, cta',
    css: 'Use only the Editorial Rule (cardStyle:"editorial") card preset across card-capable blocks, including section cards, testimonials, FAQ, forms, and contact cards. Keep compact spacing and left-aligned text.',
    preferredCardStyles: { servicesGrid: ['editorial'], testimonials: ['editorial'], faq: ['editorial'], contact_form: ['editorial'] },
  },
  {
    id: 'booked',
    name: PRESET_TEMPLATE_DISPLAYS.booked.name,
    bestFor: 'appointments, clinics, salons, tutors, coaches, one-to-one services',
    palette: 'calm slate or navy primary, friendly teal or rose secondary, soft accent',
    fonts: 'Nunito, Lato, or Inter for both heading and body',
    header: 'logo left, nav right, CTA on right that points to booking or contact',
    hero: 'split hero with appointment promise, booking CTA, and service reassurance',
    blocks: 'hero, booking, servicesGrid, pricing, testimonials, faq, contact',
    css: 'Use only the Raised (cardStyle:"elevated") card preset across card-capable blocks, including services, pricing, carousel, testimonials, FAQ, forms, and contact cards. Keep spacious rhythm and soft media treatment.',
    preferredCardStyles: { servicesGrid: ['elevated'], pricing: ['elevated'], carousel: ['elevated'], testimonials: ['elevated'], faq: ['elevated'] },
  },
  {
    id: 'menu',
    name: PRESET_TEMPLATE_DISPLAYS.menu.name,
    bestFor: 'restaurants, cafes, bakeries, food trucks, pubs',
    palette: 'hospitality warm primary, appetizing secondary, light accent section background',
    fonts: 'Playfair Display or Fraunces heading with Lato or Inter body',
    header: 'transparent overlay or white header with CTA for reserve/order',
    hero: 'fullImage hero for atmosphere, with CTA linked to the menu page',
    blocks: 'hero, menu, gallery, deliveryLinks, contact, map',
    css: 'Use only the Poster (cardStyle:"poster") card preset across card-capable blocks, including carousel, services, contact, forms, and location cards. Keep gallery rounded and menu imagery appetizing.',
    preferredCardStyles: { carousel: ['poster'], contact: ['poster'] },
  },
  {
    id: 'craft',
    name: PRESET_TEMPLATE_DISPLAYS.craft.name,
    bestFor: 'makers, ceramics, handmade goods, local shops, boutique product brands',
    palette: 'clay, sage, ochre, or wool tones with a light handmade accent',
    fonts: 'Fraunces heading with Karla or Inter body',
    header: 'white header, logo left, shop/contact CTA or product search when ecommerce is present',
    hero: 'split hero with maker story and CTA to shop or story',
    blocks: 'hero, productGrid, aboutImageText, gallery, featuredQuote, testimonials, cta',
    css: 'Use only the Showcase (cardStyle:"splitMedia") card preset across card-capable blocks, including product/story showcases, testimonials, carousel, forms, and contact cards. Keep framed media and rounded gallery treatment.',
    preferredCardStyles: { carousel: ['splitMedia'], servicesGrid: ['splitMedia'], testimonials: ['splitMedia'], contact_form: ['splitMedia'] },
  },
  {
    id: 'retro',
    name: PRESET_TEMPLATE_DISPLAYS.retro.name,
    bestFor: 'creators, pop-ups, events, drops, youth brands, playful campaigns',
    palette: 'bold primary with punchy pink, yellow, blue, orange, or lime secondary and light accent',
    fonts: 'Space Grotesk heading with DM Sans body',
    header: 'primary, gradient, or white header with a punchy CTA and compact nav',
    hero: 'centered or split hero with short energetic copy and page-linked CTA',
    blocks: 'hero, productGrid, events, carousel, testimonials, gallery, cta',
    css: 'Use only the Retro (cardStyle:"offset") card preset across Retro blocks, including stats, forms, carousel, services, and testimonials. Keep numbered icons and punchy surfaces.',
    preferredCardStyles: { servicesGrid: ['offset'], carousel: ['offset'], testimonials: ['offset'], contact_form: ['offset'], stats: ['offset'] },
  },
  {
    id: 'proof',
    name: PRESET_TEMPLATE_DISPLAYS.proof.name,
    bestFor: 'contractors, trades, legal, clinics, real estate, trust-heavy services',
    palette: 'navy or charcoal primary, green or amber secondary, light neutral accent',
    fonts: 'Merriweather heading with Source Sans or Inter body',
    header: 'white or primary header with prominent quote/estimate CTA',
    hero: 'split hero with clear service promise, guarantee, and conversion CTA',
    blocks: 'hero, stats, testimonials, logoCloud, estimateForm, servicesGrid, faq, contact',
    css: 'Use only the Ledger (cardStyle:"slab") card preset across card-capable blocks, including stats, services, estimate forms, FAQ, testimonials, and contact cards. Keep badge markers and compact trust-first spacing.',
    preferredCardStyles: { servicesGrid: ['slab'], estimateForm: ['slab'], faq: ['slab'], testimonials: ['slab'], stats: ['slab'] },
  },
  {
    id: 'gallery',
    name: PRESET_TEMPLATE_DISPLAYS.gallery.name,
    bestFor: 'photographers, designers, artists, architects, studios, portfolios',
    palette: 'monochrome or gallery-neutral primary, quiet secondary, clean accent',
    fonts: 'Sora or Inter heading with Inter body',
    header: 'transparent overlay for image heroes or very minimal white header',
    hero: 'fullImage or minimal hero with visual-first positioning and restrained copy',
    blocks: 'hero, gallery, featuredQuote, aboutImageText, contact_form, cta',
    css: 'Use only the Clipped (cardStyle:"clipped") card preset across card-capable blocks, including project cards, carousel, services, inquiry forms, and contact cards. Keep full-bleed media and gapless galleries.',
    preferredCardStyles: { carousel: ['clipped'], servicesGrid: ['clipped'], contact_form: ['clipped'] },
  },
  {
    id: 'builder',
    name: PRESET_TEMPLATE_DISPLAYS.builder.name,
    bestFor: 'contractors, handyman, plumbing, electrical, HVAC, landscaping, cleaning, mechanics, field service teams',
    palette: 'charcoal or blueprint primary, workwear amber or reliable green secondary, clean light accent',
    fonts: 'Merriweather or Space Grotesk heading with Inter body',
    header: 'white or primary header with phone/estimate CTA visible on the right',
    hero: 'split hero with service area, proof, and estimate-first CTA',
    blocks: 'hero, servicesGrid, stats, testimonials, estimateForm, faq, contact',
    css: 'Use only the Bordered (cardStyle:"bordered") card preset across card-capable blocks, including services, stats, testimonials, estimate forms, FAQ, and contact cards. Keep badge markers and compact practical spacing.',
    preferredCardStyles: { servicesGrid: ['bordered'], stats: ['bordered'], testimonials: ['bordered'], estimateForm: ['bordered'], faq: ['bordered'] },
  },
  {
    id: 'commerce',
    name: PRESET_TEMPLATE_DISPLAYS.commerce.name,
    bestFor: 'ecommerce, retail, subscriptions, dropshipping, digital products, product catalogs',
    palette: 'high-clarity dark primary with conversion blue, orange, or teal secondary and light product accent',
    fonts: 'Space Grotesk or Outfit heading with Inter body',
    header: 'logo left, product search enabled for shops, nav right, shop CTA when needed',
    hero: 'product-first split hero with offer, category promise, and shop CTA',
    blocks: 'hero, productGrid, carousel, testimonials, pricing, cta',
    css: 'Use only the Gradient Wash (cardStyle:"gradient") card preset across card-capable blocks, including conversion cards, offers, product-led carousel, features, forms, and contact cards. Keep productGrid variant:"grid".',
    preferredCardStyles: { servicesGrid: ['gradient'], pricing: ['gradient'], contact_form: ['gradient'], carousel: ['gradient'] },
  },
  {
    id: 'foundation',
    name: PRESET_TEMPLATE_DISPLAYS.foundation.name,
    bestFor: 'nonprofits, charities, churches, associations, foundations, community groups',
    palette: 'grounded green, navy, or warm ink primary with hopeful secondary and soft accent',
    fonts: 'Fraunces or Libre Baskerville heading with Karla or Inter body',
    header: 'clear nav with donate/get involved CTA and simple community-first spacing',
    hero: 'mission-led hero with who is served, why it matters, and participation CTA',
    blocks: 'hero, aboutImageText, stats, featuredQuote, events, resources, contact',
    css: 'Use only the Inset (cardStyle:"inset") card preset across card-capable blocks, including participation cards, impact stats, resources, FAQ, forms, and contact cards. Keep warm accessible surfaces.',
    preferredCardStyles: { servicesGrid: ['inset'], stats: ['inset'], contact: ['inset'], resources: ['inset'], faq: ['inset'] },
  },
  {
    id: 'wellness',
    name: PRESET_TEMPLATE_DISPLAYS.wellness.name,
    bestFor: 'therapy, wellness, spa, yoga, health, coaching, calm fitness services',
    palette: 'soft green, slate, rose, or clay primary with calming secondary and pale accent',
    fonts: 'Nunito, Lato, or Inter with gentle weights',
    header: 'white header, relaxed spacing, booking CTA on the right',
    hero: 'split hero with care promise, reassuring copy, and booking CTA',
    blocks: 'hero, booking, servicesGrid, aboutImageText, testimonials, faq, contact',
    css: 'Use only the Soft (cardStyle:"soft") card preset across card-capable blocks, including care cards, services, FAQ, testimonials, forms, and contact cards. Keep spacious gentle rhythm.',
    preferredCardStyles: { servicesGrid: ['soft'], faq: ['soft'], testimonials: ['soft'], contact_form: ['soft'] },
  },
  {
    id: 'estate',
    name: PRESET_TEMPLATE_DISPLAYS.estate.name,
    bestFor: 'real estate, property, interiors, home staging, architecture-adjacent services',
    palette: 'black, slate, or stone primary with muted metallic/green secondary and gallery-white accent',
    fonts: 'Sora or Inter heading with Inter body',
    header: 'minimal header with listing/contact CTA and image-first navigation feel',
    hero: 'fullImage or split hero with premium property positioning and clear inquiry CTA',
    blocks: 'hero, gallery, carousel, stats, featuredQuote, contact_form, map',
    css: 'Use only the Luxe Hairline (cardStyle:"luxe") card preset across card-capable blocks, including property cards, contact cards, listings, visual carousel, forms, and services. Keep gallery frameStyle:"poster" or "gapless".',
    preferredCardStyles: { servicesGrid: ['luxe'], contact_form: ['luxe'], contact: ['luxe'], carousel: ['luxe'] },
  },
  {
    id: 'studio',
    name: PRESET_TEMPLATE_DISPLAYS.studio.name,
    bestFor: 'agencies, freelancers, brand studios, design services, creative consultants',
    palette: 'ink or monochrome primary with precise blue, pink, or neutral secondary and crisp accent',
    fonts: 'Space Grotesk, Sora, or Inter with disciplined weights',
    header: 'minimal nav, project/start CTA, sparse but confident spacing',
    hero: 'visual or editorial hero with focused offer and portfolio/service CTA',
    blocks: 'hero, gallery, servicesGrid, featuredQuote, carousel, contact_form',
    css: 'Use only the Outline (cardStyle:"outline") card preset across card-capable blocks, including services, contact, timeline, project carousel, forms, and gallery-adjacent cards. Keep dashed modular borders and minimal shadows.',
    preferredCardStyles: { servicesGrid: ['outline'], contact_form: ['outline'], timeline: ['outline'], carousel: ['outline'] },
  },
  {
    id: 'learn',
    name: PRESET_TEMPLATE_DISPLAYS.learn.name,
    bestFor: 'education, tutors, courses, workshops, coaching programs, schools',
    palette: 'navy, ink, or campus green primary with blue/amber secondary and readable light accent',
    fonts: 'Libre Baskerville or Space Grotesk heading with Source Sans or Inter body',
    header: 'clear course navigation with enroll/contact CTA',
    hero: 'structured hero with outcome, audience, and start/enroll CTA',
    blocks: 'hero, servicesGrid, pricing, resources, testimonials, faq, contact',
    css: 'Use only the Accent Rail (cardStyle:"accent") card preset across card-capable blocks, including modules, resources, FAQ, pricing, stats, forms, and contact cards. Keep compact learning-path structure and left-aligned text.',
    preferredCardStyles: { servicesGrid: ['accent'], faq: ['accent'], contact_form: ['accent'], pricing: ['accent'], stats: ['accent'] },
  },
  {
    id: 'occasion',
    name: PRESET_TEMPLATE_DISPLAYS.occasion.name,
    bestFor: 'events, weddings, venues, planners, florists, pop-ups, celebrations',
    palette: 'celebratory primary with pink, orange, violet, or gold secondary and warm light accent',
    fonts: 'Space Grotesk or Playfair Display heading with DM Sans or Inter body',
    header: 'image-friendly header with plan/book CTA and compact event nav',
    hero: 'image or colorful hero with event promise, date/venue context, and inquiry CTA',
    blocks: 'hero, events, gallery, carousel, testimonials, contact_form, cta',
    css: 'Use only the Playful (cardStyle:"playful") card preset across card-capable blocks, including events, services, carousel, inquiry forms, contact cards, and testimonials. Keep rounded gallery frames and lively spacing.',
    preferredCardStyles: { servicesGrid: ['playful'], carousel: ['playful'], contact_form: ['playful'] },
  },
];

const STYLE_CHIP_TO_PROFILES: Record<string, string[]> = {
  bold: ['retro', 'proof', 'occasion'],
  minimal: ['gallery', 'atlas', 'studio'],
  warm: ['craft', 'menu', 'foundation'],
  luxury: ['estate', 'editorial', 'gallery'],
  playful: ['retro', 'occasion'],
  dark: ['gallery', 'atlas', 'studio'],
  editorial: ['editorial', 'learn', 'atlas'],
  earthy: ['craft', 'foundation', 'wellness'],
};

export function renderTemplateStyleProfilesForAi(input?: {
  styleIds?: readonly string[];
  styleLabels?: readonly string[];
  description?: string;
}): string {
  const likelyIds = new Set(recommendTemplateStyleProfileIds(input));
  const publicProfiles = TEMPLATE_STYLE_PROFILES.filter((profile) => isTemplateStyleProfileId(profile.id));
  const profileLines = publicProfiles.map((profile) => {
    const marker = likelyIds.has(profile.id) ? ' [likely relevant]' : '';
    const preferredCardStyles = renderPreferredCardStyles(profile.preferredCardStyles);
    return [
      `- ${profile.id} (${profile.name})${marker}: best for ${profile.bestFor}.`,
      `  Palette: ${profile.palette}.`,
      `  Fonts: ${profile.fonts}.`,
      `  Header: ${profile.header}.`,
      `  Hero: ${profile.hero}.`,
      `  Blocks/settings: ${profile.blocks}.`,
      ...(preferredCardStyles ? [`  Preferred card presets: ${preferredCardStyles}.`] : []),
      `  Editable style settings: ${profile.css}.`,
    ].join('\n');
  }).join('\n');

  return `STYLE-ONLY TEMPLATE PROFILES:
These profiles describe how public templates should influence AI-generated sites without importing their demo pages, blocks, copy, products, menu items, or images. For onboarding, keep the site on the Custom AI template and express the chosen profile only through user-editable settings: setCustomColors, setFont, setHeaderConfig, supported block fields, admin sample data, and palette-safe block settings. Do not output custom CSS.
When applying presets, use explicit block fields such as contact_form cardStyle, estimateForm cardStyle, pricing cardStyle, and faq cardStyle. Keep every card-capable block on the single card preset assigned to the chosen template.
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
  addIf(text, picked, ['shop', 'store', 'product', 'ecommerce', 'retail', 'subscription', 'dropship', 'digital product'], 'commerce');
  addIf(text, picked, ['handmade', 'pottery', 'ceramic', 'craft', 'artisan', 'maker'], 'craft');
  addIf(text, picked, ['appointment', 'booking', 'clinic', 'salon', 'tutor', 'coach'], 'booked');
  addIf(text, picked, ['therapy', 'therapist', 'wellness', 'spa', 'yoga', 'fitness', 'health'], 'wellness');
  addIf(text, picked, ['portfolio', 'photographer', 'gallery', 'artist', 'designer', 'architect'], 'gallery');
  addIf(text, picked, ['agency', 'freelance', 'studio', 'branding', 'creative'], 'studio');
  addIf(text, picked, ['consulting', 'b2b', 'saas', 'advisor', 'finance', 'operations'], 'atlas');
  addIf(text, picked, ['contractor', 'plumber', 'electrician', 'hvac', 'handyman', 'mechanic', 'cleaning', 'landscaping'], 'builder');
  addIf(text, picked, ['law', 'legal', 'dentist', 'estimate', 'reviews', 'results', 'trust'], 'proof');
  addIf(text, picked, ['real estate', 'realtor', 'property', 'interior', 'home staging'], 'estate');
  addIf(text, picked, ['nonprofit', 'charity', 'association', 'community', 'foundation', 'church'], 'foundation');
  addIf(text, picked, ['course', 'education', 'school', 'class', 'workshop', 'learn'], 'learn');
  addIf(text, picked, ['blog', 'publication', 'writer', 'newsletter', 'article'], 'editorial');
  addIf(text, picked, ['event', 'wedding', 'venue', 'planner', 'festival'], 'occasion');
  addIf(text, picked, ['drop', 'creator', 'playful', 'y2k'], 'retro');

  return [...picked];
}

function renderPreferredCardStyles(value: TemplateStyleProfile['preferredCardStyles']): string {
  if (!value) return '';
  return Object.entries(value)
    .filter((entry): entry is [string, readonly CardStyle[]] => Array.isArray(entry[1]) && entry[1].length > 0)
    .map(([blockType, presets]) => `${blockType}=${presets.join('/')}`)
    .join('; ');
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
