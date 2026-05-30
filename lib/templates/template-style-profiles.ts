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
    css: 'servicesGrid cardStyle:"gradient" or "glow", carousel cardStyle:"offset", testimonials cardStyle:"elevated", palette-token outlines, button settings left editable',
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
    css: 'servicesGrid cardStyle:"bordered" or "slab", stats cardStyle:"utility", testimonials cardStyle:"editorial", clear section dividers, restrained shadows',
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
    name: 'Atlas',
    bestFor: 'B2B consulting, SaaS, advisory, finance, operations teams',
    palette: 'slate or navy primary, teal or blue secondary, cool light accent',
    fonts: 'Space Grotesk heading with Inter body',
    header: 'logo left, nav right, CTA on right, white or transparent overlay for hero',
    hero: 'split or minimal hero with operational clarity, proof, and a page-linked CTA',
    blocks: 'hero, stats, logoCloud, servicesGrid, pricing, featuredQuote, contact_form',
    css: 'servicesGrid cardStyle:"bordered" or "utility", spacingDensity:"standard", stats cardStyle:"accent", carousel cardStyle:"outline", iconStyle:"framed", surfaceStyle:"white", gallery frameStyle:"editorial"',
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
    css: 'servicesGrid cardStyle:"minimal" or "editorial", spacingDensity:"compact", testimonials cardStyle:"editorial", gallery frameStyle:"editorial", aboutImageText mediaTreatment:"contained", textAlign:"left"',
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
    css: 'servicesGrid cardStyle:"elevated", surfaceStyle:"accent", spacingDensity:"spacious", testimonials cardStyle:"glass" or "soft", stats cardStyle:"inset", aboutImageText mediaTreatment:"soft"',
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
    css: 'gallery frameStyle:"rounded", mediaAspect:"landscape", carousel cardStyle:"poster", mediaTreatment:"fullBleed", servicesGrid cardStyle:"accent" or "clipped", surfaceStyle:"accent"',
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
    css: 'aboutImageText mediaTreatment:"framed", servicesGrid cardStyle:"offset" or "playful", markerStyle:"framed", testimonials cardStyle:"inset", gallery frameStyle:"rounded", carousel cardStyle:"elevated"',
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
    css: 'servicesGrid cardStyle:"offset" or "playful", markerStyle:"plain", carousel cardStyle:"glow", iconStyle:"numbered", testimonials cardStyle:"offset", stats cardStyle:"solid", surfaceStyle:"secondary"',
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
    css: 'servicesGrid cardStyle:"slab" or "bordered", markerStyle:"badge", testimonials cardStyle:"accent", stats cardStyle:"solid", surfaceStyle:"primary", spacingDensity:"compact"',
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
    css: 'gallery frameStyle:"gapless", carousel cardStyle:"poster" or "clipped", mediaTreatment:"fullBleed", iconStyle:"plain", aboutImageText mediaTreatment:"fullBleed", servicesGrid cardStyle:"minimal"',
  },
  {
    id: 'builder',
    name: 'Builder',
    bestFor: 'contractors, handyman, plumbing, electrical, HVAC, landscaping, cleaning, mechanics, field service teams',
    palette: 'charcoal or blueprint primary, workwear amber or reliable green secondary, clean light accent',
    fonts: 'Merriweather or Space Grotesk heading with Inter body',
    header: 'white or primary header with phone/estimate CTA visible on the right',
    hero: 'split hero with service area, proof, and estimate-first CTA',
    blocks: 'hero, servicesGrid, stats, testimonials, estimateForm, faq, contact',
    css: 'servicesGrid cardStyle:"bordered" or "slab", cardSettings presetId:"bordered", markerStyle:"badge", stats cardStyle:"utility", testimonials cardStyle:"bordered", compact practical spacing',
  },
  {
    id: 'commerce',
    name: 'Commerce',
    bestFor: 'ecommerce, retail, subscriptions, dropshipping, digital products, product catalogs',
    palette: 'high-clarity dark primary with conversion blue, orange, or teal secondary and light product accent',
    fonts: 'Space Grotesk or Outfit heading with Inter body',
    header: 'logo left, product search enabled for shops, nav right, shop CTA when needed',
    hero: 'product-first split hero with offer, category promise, and shop CTA',
    blocks: 'hero, productGrid, carousel, testimonials, pricing, cta',
    css: 'carousel cardStyle:"elevated" or "poster", servicesGrid cardStyle:"gradient", productGrid variant:"grid", surfaceStyle:"white"',
  },
  {
    id: 'foundation',
    name: 'Foundation',
    bestFor: 'nonprofits, charities, churches, associations, foundations, community groups',
    palette: 'grounded green, navy, or warm ink primary with hopeful secondary and soft accent',
    fonts: 'Fraunces or Libre Baskerville heading with Karla or Inter body',
    header: 'clear nav with donate/get involved CTA and simple community-first spacing',
    hero: 'mission-led hero with who is served, why it matters, and participation CTA',
    blocks: 'hero, aboutImageText, stats, featuredQuote, events, resources, contact',
    css: 'servicesGrid cardStyle:"inset" or "editorial", testimonials cardStyle:"soft", stats cardStyle:"accent", cardSettings accentSide:"top", warm accessible surfaces',
  },
  {
    id: 'wellness',
    name: 'Wellness',
    bestFor: 'therapy, wellness, spa, yoga, health, coaching, calm fitness services',
    palette: 'soft green, slate, rose, or clay primary with calming secondary and pale accent',
    fonts: 'Nunito, Lato, or Inter with gentle weights',
    header: 'white header, relaxed spacing, booking CTA on the right',
    hero: 'split hero with care promise, reassuring copy, and booking CTA',
    blocks: 'hero, booking, servicesGrid, aboutImageText, testimonials, faq, contact',
    css: 'servicesGrid cardStyle:"soft" or "glass", cardSettings surfaceOpacity:0.72, testimonials cardStyle:"glass", stats cardStyle:"inset", spacious gentle rhythm',
  },
  {
    id: 'estate',
    name: 'Estate',
    bestFor: 'real estate, property, interiors, home staging, architecture-adjacent services',
    palette: 'black, slate, or stone primary with muted metallic/green secondary and gallery-white accent',
    fonts: 'Sora or Inter heading with Inter body',
    header: 'minimal header with listing/contact CTA and image-first navigation feel',
    hero: 'fullImage or split hero with premium property positioning and clear inquiry CTA',
    blocks: 'hero, gallery, carousel, stats, featuredQuote, contact_form, map',
    css: 'gallery frameStyle:"poster" or "gapless", carousel cardStyle:"poster" or "luxe", cardSettings mediaLayout:"fullBleed", servicesGrid cardStyle:"luxe"',
  },
  {
    id: 'studio',
    name: 'Studio',
    bestFor: 'agencies, freelancers, brand studios, design services, creative consultants',
    palette: 'ink or monochrome primary with precise blue, pink, or neutral secondary and crisp accent',
    fonts: 'Space Grotesk, Sora, or Inter with disciplined weights',
    header: 'minimal nav, project/start CTA, sparse but confident spacing',
    hero: 'visual or editorial hero with focused offer and portfolio/service CTA',
    blocks: 'hero, gallery, servicesGrid, featuredQuote, carousel, contact_form',
    css: 'servicesGrid cardStyle:"outline" or "offset", cardSettings borderStyle:"dashed", carousel cardStyle:"clipped", gallery frameStyle:"editorial", minimal shadows',
  },
  {
    id: 'learn',
    name: 'Learn',
    bestFor: 'education, tutors, courses, workshops, coaching programs, schools',
    palette: 'navy, ink, or campus green primary with blue/amber secondary and readable light accent',
    fonts: 'Libre Baskerville or Space Grotesk heading with Source Sans or Inter body',
    header: 'clear course navigation with enroll/contact CTA',
    hero: 'structured hero with outcome, audience, and start/enroll CTA',
    blocks: 'hero, servicesGrid, pricing, resources, testimonials, faq, contact',
    css: 'servicesGrid cardStyle:"utility" or "editorial", cardSettings paddingDensity:"compact", resources variant:"grid", stats cardStyle:"bordered", textAlign:"left"',
  },
  {
    id: 'occasion',
    name: 'Occasion',
    bestFor: 'events, weddings, venues, planners, florists, pop-ups, celebrations',
    palette: 'celebratory primary with pink, orange, violet, or gold secondary and warm light accent',
    fonts: 'Space Grotesk or Playfair Display heading with DM Sans or Inter body',
    header: 'image-friendly header with plan/book CTA and compact event nav',
    hero: 'image or colorful hero with event promise, date/venue context, and inquiry CTA',
    blocks: 'hero, events, gallery, carousel, testimonials, contact_form, cta',
    css: 'carousel cardStyle:"playful" or "poster", servicesGrid cardStyle:"gradient", cardSettings shadow:"glow", gallery frameStyle:"rounded", lively spacing without custom CSS',
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
    return [
      `- ${profile.id} (${profile.name})${marker}: best for ${profile.bestFor}.`,
      `  Palette: ${profile.palette}.`,
      `  Fonts: ${profile.fonts}.`,
      `  Header: ${profile.header}.`,
      `  Hero: ${profile.hero}.`,
      `  Blocks/settings: ${profile.blocks}.`,
      `  Editable style settings: ${profile.css}.`,
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
