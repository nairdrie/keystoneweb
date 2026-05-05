import type { WizardData } from './builder-schema';

type AiBlockLike = {
  blockType: string;
  data: Record<string, unknown>;
};

export type AiSampleProduct = {
  name: string;
  brand?: string | null;
  description?: string | null;
  price_cents: number;
  compare_at_cents?: number | null;
  currency?: string;
  images?: string[];
  category?: string | null;
  subcategory?: string | null;
  tags?: string[];
  is_featured?: boolean;
};

export type AiSampleMenuItem = {
  name: string;
  description?: string | null;
  price?: string | null;
  menu_section: string;
  menu_section_order: number;
  category: string;
  category_order: number;
  image_url?: string | null;
  sort_order: number;
  is_featured?: boolean;
  icon_tags?: string[];
};

export type AiSampleBookingServiceOption = {
  id: string;
  name: string;
  price_cents: number;
  price_type?: 'override' | 'addon';
};

export type AiSampleBookingService = {
  name: string;
  description?: string | null;
  duration_minutes: number;
  price_cents: number;
  currency?: string;
  is_featured?: boolean;
  compare_at_price_cents?: number | null;
  options?: AiSampleBookingServiceOption[] | null;
  options_required?: boolean;
  sort_order: number;
};

export type AiSampleData = {
  products?: AiSampleProduct[];
  menuItems?: AiSampleMenuItem[];
  bookingServices?: AiSampleBookingService[];
};

type SampleContext = {
  siteTitle: string;
  wizardData: WizardData;
  pages?: Array<{ slug: string; title?: string }>;
  blocks?: AiBlockLike[];
  pageSlug?: string;
};

const image = (id: string, width = 1400, height = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&h=${height}&q=80`;

const IMAGE_SETS = {
  pottery: [
    image('photo-1528756514091-dee5ecaa3278'),
    image('photo-1452860606245-08befc0ff44b'),
    image('photo-1513519245088-0e12902e5a38'),
    image('photo-1524758631624-e2822e304c36'),
    image('photo-1500530855697-b586d89ba3ee'),
    image('photo-1508214751196-bcfd4ca60f91'),
  ],
  restaurant: [
    image('photo-1504674900247-0877df9cc836'),
    image('photo-1473093295043-cdd812d0e601'),
    image('photo-1546069901-ba9599a7e63c'),
    image('photo-1488477181946-6428a0291777'),
    image('photo-1517248135467-4c7edcad34c4'),
    image('photo-1551024709-8f23befc6f87'),
  ],
  art: [
    image('photo-1452860606245-08befc0ff44b'),
    image('photo-1513364776144-60967b0f800f'),
    image('photo-1513519245088-0e12902e5a38'),
    image('photo-1492691527719-9d1e07e534b4'),
    image('photo-1516035069371-29a1b244cc32'),
    image('photo-1500534314209-a25ddb2bd429'),
  ],
  fishing: [
    image('photo-1507525428034-b723cf961d3e'),
    image('photo-1471922694854-ff1b63b20054'),
    image('photo-1500530855697-b586d89ba3ee'),
    image('photo-1518005020951-eccb494ad742'),
    image('photo-1500534314209-a25ddb2bd429'),
    image('photo-1503387762-592deb58ef4e'),
  ],
  legal: [
    image('photo-1589829545856-d10d557cf95f'),
    image('photo-1521791136064-7986c2920216'),
    image('photo-1450101499163-c8848c66ca85'),
    image('photo-1497366811353-6870744d04b2'),
    image('photo-1557804506-669a67965ba0'),
    image('photo-1497366754035-f200968a6e72'),
  ],
  wellness: [
    image('photo-1544161515-4ab6ce6db874'),
    image('photo-1519415510236-718bdfcd89c8'),
    image('photo-1522337360788-8b13dee7a37e'),
    image('photo-1515377905703-c4788e51af15'),
    image('photo-1600334089648-b0d9d3028eb2'),
    image('photo-1521590832167-7bcbfaa6381f'),
  ],
  fitness: [
    image('photo-1517836357463-d25dfeac3438'),
    image('photo-1571019613454-1cb2f99b2d8b'),
    image('photo-1534438327276-14e5300c3a48'),
    image('photo-1599058917765-a780eda07a3e'),
    image('photo-1518611012118-696072aa579a'),
    image('photo-1571902943202-507ec2618e8f'),
  ],
  trades: [
    image('photo-1504307651254-35680f356dfd'),
    image('photo-1581090464777-f3220bbe1b8b'),
    image('photo-1581092918056-0c4c3acd3789'),
    image('photo-1581578731548-c64695cc6952'),
    image('photo-1590959651373-a3db0f38a961'),
    image('photo-1607472586893-edb57bdc0e39'),
  ],
  consulting: [
    image('photo-1497366754035-f200968a6e72'),
    image('photo-1556761175-b413da4baf72'),
    image('photo-1557804506-669a67965ba0'),
    image('photo-1497366811353-6870744d04b2'),
    image('photo-1517245386807-bb43f82c33c4'),
    image('photo-1521791136064-7986c2920216'),
  ],
  general: [
    image('photo-1500530855697-b586d89ba3ee'),
    image('photo-1497366754035-f200968a6e72'),
    image('photo-1518005020951-eccb494ad742'),
    image('photo-1524758631624-e2822e304c36'),
    image('photo-1492691527719-9d1e07e534b4'),
    image('photo-1500534314209-a25ddb2bd429'),
  ],
} as const;

export function buildAiSampleData(context: SampleContext): AiSampleData {
  const text = contextText(context);
  const blockTypes = new Set((context.blocks ?? []).map((block) => block.blockType));
  const pageSlugs = new Set((context.pages ?? []).map((page) => page.slug.toLowerCase()));

  const samples: AiSampleData = {};

  if (blockTypes.has('productGrid') || pageSlugs.has('shop') || pageSlugs.has('products') || isProductBrief(text)) {
    samples.products = productSamplesFor(text, context.siteTitle);
  }

  if (blockTypes.has('menu') || pageSlugs.has('menu') || isMenuBrief(text)) {
    samples.menuItems = menuSamplesFor(text);
  }

  if (
    blockTypes.has('booking')
    || pageSlugs.has('booking')
    || pageSlugs.has('book')
    || pageSlugs.has('appointments')
    || isBookingBrief(text)
  ) {
    samples.bookingServices = bookingServiceSamplesFor(text);
  }

  return sanitizeAiSampleDataPayload(samples);
}

export function enrichBlocksWithSampleMedia<T extends AiBlockLike>(blocks: T[], context: SampleContext): T[] {
  const text = contextText(context);
  const sampleImages = sampleImagesFor(text);
  let imageCursor = 0;
  const nextImage = () => {
    const url = sampleImages[imageCursor % sampleImages.length] || IMAGE_SETS.general[0];
    imageCursor += 1;
    return url;
  };

  return blocks.map((block) => {
    if (block.blockType === 'gallery') {
      const currentImages = Array.isArray(block.data?.images) ? block.data.images.filter(Boolean) : [];
      if (currentImages.length > 0) return block;
      return withBlockData(block, { ...block.data, images: [...sampleImages] });
    }

    if (block.blockType === 'hero') {
      const data = enrichHeroWithSampleMedia(block.data, nextImage);
      return data === block.data ? block : withBlockData(block, data);
    }

    if (block.blockType === 'image' || block.blockType === 'aboutImageText') {
      if (hasImageValue(block.data?.image)) return block;
      return withBlockData(block, { ...block.data, image: nextImage() });
    }

    if (block.blockType === 'featuredQuote') {
      if (hasImageValue(block.data?.personImage)) return block;
      const variant = String(block.data?.variant || 'centered');
      if (!['centered', 'split', 'essay', 'minimal'].includes(variant)) return block;
      return withBlockData(block, { ...block.data, personImage: nextImage() });
    }

    if (block.blockType === 'carousel') {
      const items = Array.isArray(block.data?.items) ? block.data.items : [];
      let changed = false;
      const nextItems = items.map((item) => {
        if (!item || typeof item !== 'object') return item;
        const typedItem = item as Record<string, unknown>;
        if (typedItem.mediaType !== 'image' || hasImageValue(typedItem.image)) return item;
        changed = true;
        return { ...typedItem, image: nextImage() };
      });
      return changed ? withBlockData(block, { ...block.data, items: nextItems }) : block;
    }

    return block;
  });
}

export function sanitizeAiSampleDataPayload(raw: unknown): AiSampleData {
  if (!raw || typeof raw !== 'object') return {};
  const input = raw as Record<string, unknown>;
  const out: AiSampleData = {};

  if (Array.isArray(input.products)) {
    const products = input.products
      .map(sanitizeProductSample)
      .filter((product): product is AiSampleProduct => !!product)
      .slice(0, 4);
    if (products.length > 0) out.products = products;
  }

  if (Array.isArray(input.menuItems)) {
    const menuItems = input.menuItems
      .map(sanitizeMenuItemSample)
      .filter((item): item is AiSampleMenuItem => !!item)
      .slice(0, 10);
    if (menuItems.length > 0) out.menuItems = menuItems;
  }

  if (Array.isArray(input.bookingServices)) {
    const bookingServices = input.bookingServices
      .map(sanitizeBookingServiceSample)
      .filter((service): service is AiSampleBookingService => !!service)
      .slice(0, 6);
    if (bookingServices.length > 0) out.bookingServices = bookingServices;
  }

  return out;
}

export function hasAiSampleData(samples: AiSampleData): boolean {
  return Boolean(samples.products?.length || samples.menuItems?.length || samples.bookingServices?.length);
}

function productSamplesFor(text: string, siteTitle: string): AiSampleProduct[] {
  const brand = cleanText(siteTitle, 80) || null;

  if (hasAny(text, ['pottery', 'ceramic', 'clay', 'stoneware', 'vase', 'mug'])) {
    return [
      product('Hand-thrown Mug', brand, 'A wheel-thrown mug with a warm glaze and everyday weight.', 4200, IMAGE_SETS.pottery[0], 'Tableware', 'Mugs', true),
      product('Speckled Serving Bowl', brand, 'A shallow serving bowl made for salads, pasta, and shared tables.', 8600, IMAGE_SETS.pottery[1], 'Tableware', 'Bowls', true),
      product('Bud Vase Trio', brand, 'Three small vases for stems, shelves, and quiet corners.', 6400, IMAGE_SETS.pottery[2], 'Home Objects', 'Vases'),
      product('Ceramic Incense Holder', brand, 'A low-profile holder with a hand-finished glaze.', 2800, IMAGE_SETS.pottery[3], 'Home Objects', 'Accessories'),
    ];
  }

  if (hasAny(text, ['fish', 'fishing', 'tackle', 'halifax', 'coastal', 'marine', 'boat'])) {
    return [
      product('Coastal Tackle Kit', brand, 'A starter set for weekend saltwater trips.', 4900, IMAGE_SETS.fishing[0], 'Gear', 'Kits', true),
      product('Saltwater Jig Pack', brand, 'Weighted jigs in practical colors for changing tides.', 2400, IMAGE_SETS.fishing[1], 'Gear', 'Lures'),
      product('Dock Line Set', brand, 'Durable lines for small boats and day trips.', 3600, IMAGE_SETS.fishing[2], 'Boat Supplies', 'Lines'),
      product('Tideproof Cap', brand, 'A low-profile cap for sun, spray, and early starts.', 3200, IMAGE_SETS.fishing[3], 'Apparel', 'Hats', true),
    ];
  }

  if (hasAny(text, ['art', 'artist', 'craft', 'workshop', 'vancouver', 'handmade', 'maker'])) {
    return [
      product('Studio Starter Kit', brand, 'A curated set of beginner-friendly materials.', 5800, IMAGE_SETS.art[0], 'Kits', 'Starter Sets', true),
      product('Workshop Gift Card', brand, 'A flexible gift for classes, supplies, or studio time.', 7500, IMAGE_SETS.art[1], 'Gift Cards', 'Workshops'),
      product('Handmade Paper Bundle', brand, 'Textured sheets for cards, collage, and small editions.', 3400, IMAGE_SETS.art[2], 'Supplies', 'Paper'),
      product('Limited Print Set', brand, 'A small-batch print set ready for framing.', 9600, IMAGE_SETS.art[3], 'Artwork', 'Prints', true),
    ];
  }

  return [
    product('Signature Starter Bundle', brand, 'A simple entry point for new customers.', 5900, IMAGE_SETS.general[0], 'Featured', 'Bundles', true),
    product('Everyday Favorite', brand, 'A useful staple from the current collection.', 3900, IMAGE_SETS.general[1], 'Featured', 'Essentials'),
    product('Gift Card', brand, 'A flexible option for customers who want to choose later.', 5000, IMAGE_SETS.general[2], 'Gifts', 'Cards'),
    product('Limited Edition Item', brand, 'A small-run item for seasonal launches.', 8900, IMAGE_SETS.general[3], 'Featured', 'Limited', true),
  ];
}

function menuSamplesFor(text: string): AiSampleMenuItem[] {
  if (hasAny(text, ['cafe', 'coffee', 'bakery', 'brunch'])) {
    return [
      menuItem('Espresso Tonic', 'Cold espresso, tonic, orange peel.', '$7', 'Drinks', 0, 'Coffee', 0, IMAGE_SETS.restaurant[5], 0, true),
      menuItem('Honey Oat Latte', 'Espresso, oat milk, local honey.', '$6', 'Drinks', 0, 'Coffee', 0, IMAGE_SETS.restaurant[5], 1),
      menuItem('Citrus Morning Bun', 'Laminated pastry with citrus sugar.', '$6', 'Breakfast', 1, 'Bakery', 0, IMAGE_SETS.restaurant[3], 0, true),
      menuItem('Herbed Egg Toast', 'Soft eggs, herbs, cultured butter, sourdough.', '$15', 'Breakfast', 1, 'Morning Plates', 1, image('photo-1525351484163-7529414344d8'), 1),
      menuItem('Market Grain Bowl', 'Seasonal vegetables, greens, seeds, lemon dressing.', '$17', 'Lunch', 2, 'Bowls', 0, image('photo-1540420773420-3366772f4999'), 0, true),
      menuItem('Chocolate Sea Salt Cookie', 'Dark chocolate, flaky salt, soft center.', '$5', 'Sweets', 3, 'Cookies', 0, IMAGE_SETS.restaurant[3], 0),
    ];
  }

  return [
    menuItem('Seasonal Crudo', 'Citrus, herbs, olive oil, crisp garnish.', '$18', 'Dinner', 0, 'Small Plates', 0, IMAGE_SETS.restaurant[0], 0, true),
    menuItem('Charred Broccolini', 'Lemon aioli, chili crisp, toasted almond.', '$14', 'Dinner', 0, 'Small Plates', 0, IMAGE_SETS.restaurant[2], 1, false, ['vegetarian']),
    menuItem('Brown Butter Gnocchi', 'Sage, parmesan, roasted squash.', '$24', 'Dinner', 0, 'Mains', 1, IMAGE_SETS.restaurant[1], 0, true, ['vegetarian']),
    menuItem('Roast Chicken', 'Pan jus, crispy potatoes, bitter greens.', '$29', 'Dinner', 0, 'Mains', 1, image('photo-1532550907401-a500c9a57435'), 1),
    menuItem('House Spritz', 'Bitter orange, sparkling wine, rosemary.', '$13', 'Drinks', 1, 'Cocktails', 0, IMAGE_SETS.restaurant[5], 0, true),
    menuItem('Citrus Olive Cake', 'Whipped mascarpone and seasonal citrus.', '$11', 'Dessert', 2, 'Sweets', 0, IMAGE_SETS.restaurant[3], 0, false, ['vegetarian']),
  ];
}

function bookingServiceSamplesFor(text: string): AiSampleBookingService[] {
  if (hasAny(text, ['law', 'lawyer', 'legal', 'attorney', 'notary'])) {
    return [
      bookingService('Initial Consultation', 'A focused meeting to understand your situation and outline next steps.', 60, 17500, 0, true),
      bookingService('Contract Review', 'A practical review of terms, risks, and recommended changes.', 90, 35000, 1),
      bookingService('Incorporation Planning', 'Guidance for choosing the right structure and preparing next documents.', 75, 27500, 2),
      bookingService('Follow-up Call', 'A shorter session to answer questions after an initial meeting.', 30, 9500, 3),
    ];
  }

  if (hasAny(text, ['salon', 'spa', 'beauty', 'hair', 'nail', 'massage', 'wellness'])) {
    return [
      bookingService('Signature Cut', 'A consultation, wash, cut, and finish tailored to your style.', 60, 7800, 0, true),
      bookingService('Color Consultation', 'A planning appointment for color goals, timing, and care.', 45, 4500, 1),
      bookingService('Relaxation Massage', 'A calming treatment designed for tension relief and reset time.', 60, 11000, 2, true, [
        bookingOption('60 minutes', 11000),
        bookingOption('90 minutes', 15500),
      ]),
      bookingService('Bridal Trial', 'A trial session for wedding or event hair and makeup planning.', 90, 16500, 3),
    ];
  }

  if (hasAny(text, ['fitness', 'gym', 'trainer', 'coach', 'yoga', 'pilates'])) {
    return [
      bookingService('Intro Assessment', 'A baseline session to review goals, movement, and training fit.', 45, 6500, 0, true),
      bookingService('Personal Training Session', 'One-on-one training with programming matched to your goals.', 60, 9500, 1, true),
      bookingService('Small Group Class', 'A coached group session with room for individual feedback.', 50, 2800, 2),
      bookingService('Monthly Coaching Check-in', 'A review of progress, habits, and the next training cycle.', 30, 4500, 3),
    ];
  }

  if (hasAny(text, ['clinic', 'therapist', 'therapy', 'counselling', 'counseling', 'dental', 'health'])) {
    return [
      bookingService('New Client Consultation', 'A first appointment to understand needs and decide on a care plan.', 60, 13500, 0, true),
      bookingService('Follow-up Session', 'A regular appointment to continue care and review progress.', 50, 11500, 1),
      bookingService('Care Planning Call', 'A shorter call to review options before booking a full session.', 25, 4500, 2),
      bookingService('Virtual Check-in', 'A convenient online appointment for simple follow-up questions.', 30, 6500, 3),
    ];
  }

  if (hasAny(text, ['consultant', 'consulting', 'agency', 'advisor', 'business', 'marketing'])) {
    return [
      bookingService('Discovery Call', 'A short call to understand goals, timing, and fit.', 30, 0, 0, true),
      bookingService('Strategy Session', 'A working session to map priorities, opportunities, and next steps.', 90, 29500, 1, true),
      bookingService('Implementation Workshop', 'A deeper session for planning systems, content, or launch work.', 120, 55000, 2),
      bookingService('Monthly Advisory', 'A recurring review for decisions, accountability, and momentum.', 60, 22500, 3),
    ];
  }

  return [
    bookingService('Consultation', 'A first conversation to understand what you need and recommend next steps.', 45, 7500, 0, true),
    bookingService('Standard Appointment', 'A focused appointment for common requests and service needs.', 60, 12000, 1),
    bookingService('Extended Session', 'A longer session for more detailed planning or hands-on work.', 90, 18000, 2),
    bookingService('Follow-up', 'A shorter appointment to review progress and answer questions.', 30, 6000, 3),
  ];
}

function sampleImagesFor(text: string): string[] {
  if (hasAny(text, ['pottery', 'ceramic', 'clay', 'stoneware'])) return [...IMAGE_SETS.pottery];
  if (hasAny(text, ['restaurant', 'cafe', 'coffee', 'food', 'menu', 'dining', 'bar', 'bakery'])) return [...IMAGE_SETS.restaurant];
  if (hasAny(text, ['fish', 'fishing', 'halifax', 'coastal', 'marine', 'boat'])) return [...IMAGE_SETS.fishing];
  if (hasAny(text, ['art', 'artist', 'craft', 'vancouver', 'workshop', 'maker'])) return [...IMAGE_SETS.art];
  if (hasAny(text, ['law', 'lawyer', 'legal', 'attorney', 'notary'])) return [...IMAGE_SETS.legal];
  if (hasAny(text, ['salon', 'spa', 'beauty', 'hair', 'nail', 'massage', 'wellness', 'clinic', 'therapy', 'therapist'])) return [...IMAGE_SETS.wellness];
  if (hasAny(text, ['fitness', 'gym', 'trainer', 'coach', 'yoga', 'pilates'])) return [...IMAGE_SETS.fitness];
  if (hasAny(text, ['plumbing', 'electric', 'contractor', 'construction', 'renovation', 'repair', 'trades'])) return [...IMAGE_SETS.trades];
  if (hasAny(text, ['consultant', 'consulting', 'agency', 'advisor', 'business', 'marketing'])) return [...IMAGE_SETS.consulting];
  return [...IMAGE_SETS.general];
}

function product(
  name: string,
  brand: string | null,
  description: string,
  price_cents: number,
  imageUrl: string,
  category: string,
  subcategory: string,
  is_featured = false,
): AiSampleProduct {
  return {
    name,
    brand,
    description,
    price_cents,
    currency: 'CAD',
    images: [imageUrl],
    category,
    subcategory,
    tags: ['AI sample'],
    is_featured,
  };
}

function menuItem(
  name: string,
  description: string,
  price: string,
  menu_section: string,
  menu_section_order: number,
  category: string,
  category_order: number,
  image_url: string,
  sort_order: number,
  is_featured = false,
  icon_tags: string[] = [],
): AiSampleMenuItem {
  return {
    name,
    description,
    price,
    menu_section,
    menu_section_order,
    category,
    category_order,
    image_url,
    sort_order,
    is_featured,
    icon_tags,
  };
}

function bookingService(
  name: string,
  description: string,
  duration_minutes: number,
  price_cents: number,
  sort_order: number,
  is_featured = false,
  options: AiSampleBookingServiceOption[] | null = null,
): AiSampleBookingService {
  return {
    name,
    description,
    duration_minutes,
    price_cents,
    currency: 'CAD',
    is_featured,
    compare_at_price_cents: null,
    options,
    options_required: true,
    sort_order,
  };
}

function bookingOption(name: string, price_cents: number): AiSampleBookingServiceOption {
  return {
    id: slugify(name),
    name,
    price_cents,
    price_type: 'override',
  };
}

function sanitizeProductSample(raw: unknown): AiSampleProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const name = cleanText(input.name, 100);
  if (!name) return null;
  const price = typeof input.price_cents === 'number' && Number.isFinite(input.price_cents)
    ? Math.max(0, Math.round(input.price_cents))
    : 0;
  const images = Array.isArray(input.images)
    ? input.images.map(cleanUnsplashUrl).filter((url): url is string => !!url).slice(0, 4)
    : [];
  return {
    name,
    brand: cleanText(input.brand, 80) || null,
    description: cleanText(input.description, 280) || null,
    price_cents: price,
    compare_at_cents: null,
    currency: cleanCurrency(input.currency),
    images,
    category: cleanText(input.category, 80) || null,
    subcategory: cleanText(input.subcategory, 80) || null,
    tags: Array.isArray(input.tags) ? input.tags.map((tag) => cleanText(tag, 40)).filter(Boolean).slice(0, 8) : [],
    is_featured: input.is_featured === true,
  };
}

function sanitizeMenuItemSample(raw: unknown): AiSampleMenuItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const name = cleanText(input.name, 100);
  if (!name) return null;
  return {
    name,
    description: cleanText(input.description, 280) || null,
    price: cleanText(input.price, 30) || null,
    menu_section: cleanText(input.menu_section, 80) || 'Main Menu',
    menu_section_order: cleanNumber(input.menu_section_order),
    category: cleanText(input.category, 80) || 'General',
    category_order: cleanNumber(input.category_order),
    image_url: cleanUnsplashUrl(input.image_url),
    sort_order: cleanNumber(input.sort_order),
    is_featured: input.is_featured === true,
    icon_tags: cleanMenuIconTags(input.icon_tags),
  };
}

function sanitizeBookingServiceSample(raw: unknown): AiSampleBookingService | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const name = cleanText(input.name, 100);
  if (!name) return null;
  const price = typeof input.price_cents === 'number' && Number.isFinite(input.price_cents)
    ? Math.max(0, Math.round(input.price_cents))
    : 0;
  const compareAtPrice = typeof input.compare_at_price_cents === 'number' && Number.isFinite(input.compare_at_price_cents)
    ? Math.max(0, Math.round(input.compare_at_price_cents))
    : null;
  const options = Array.isArray(input.options)
    ? input.options
      .map(sanitizeBookingServiceOption)
      .filter((option): option is AiSampleBookingServiceOption => !!option)
      .slice(0, 6)
    : null;
  return {
    name,
    description: cleanText(input.description, 280) || null,
    duration_minutes: cleanPositiveNumber(input.duration_minutes, 30, 15, 480),
    price_cents: price,
    currency: cleanCurrency(input.currency),
    is_featured: input.is_featured === true,
    compare_at_price_cents: compareAtPrice,
    options,
    options_required: input.options_required !== false,
    sort_order: cleanNumber(input.sort_order),
  };
}

function sanitizeBookingServiceOption(raw: unknown): AiSampleBookingServiceOption | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const name = cleanText(input.name, 80);
  if (!name) return null;
  return {
    id: cleanText(input.id, 80) || slugify(name),
    name,
    price_cents: cleanPositiveNumber(input.price_cents, 0, 0, 1_000_000),
    price_type: input.price_type === 'addon' ? 'addon' : 'override',
  };
}

function contextText(context: SampleContext): string {
  return [
    context.siteTitle,
    context.pageSlug,
    context.wizardData.description,
    context.wizardData.extras,
    ...(context.wizardData.styleLabels ?? []),
    ...(context.wizardData.pageLabels ?? []),
    ...(context.wizardData.pageIds ?? []),
    ...(context.pages ?? []).flatMap((page) => [page.slug, page.title ?? '']),
  ].filter(Boolean).join(' ').toLowerCase();
}

function isProductBrief(text: string): boolean {
  return hasAny(text, ['shop', 'store', 'product', 'products', 'sell', 'ecommerce', 'e-commerce', 'retail', 'pottery', 'ceramic', 'craft', 'jewelry', 'apparel', 'gear']);
}

function isMenuBrief(text: string): boolean {
  return hasAny(text, ['restaurant', 'cafe', 'coffee', 'bakery', 'bar', 'bistro', 'menu', 'dining', 'food truck', 'brunch']);
}

function isBookingBrief(text: string): boolean {
  return hasAny(text, [
    'appointment',
    'appointments',
    'booking',
    'book online',
    'consultation',
    'calendar',
    'salon',
    'spa',
    'clinic',
    'therapist',
    'trainer',
    'coach',
    'lawyer',
    'legal',
  ]);
}

function hasAny(text: string, needles: readonly string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function enrichHeroWithSampleMedia(
  data: Record<string, unknown>,
  nextImage: () => string,
): Record<string, unknown> {
  let changed = false;
  const nextData = { ...data };

  if (Array.isArray(data.cards)) {
    const cards = data.cards.map((card) => {
      if (!card || typeof card !== 'object') return card;
      let nextCard = card as Record<string, unknown>;

      const content = nextCard.content;
      if (content && typeof content === 'object') {
        const nextContent = content as Record<string, unknown>;
        const foreground = nextContent.image;
        if (foreground && typeof foreground === 'object') {
          const imageData = foreground as Record<string, unknown>;
          if (imageData.enabled === true && !hasImageValue(imageData.url)) {
            nextContent.image = { ...imageData, url: nextImage() };
            nextCard = { ...nextCard, content: { ...nextContent } };
            changed = true;
          }
        }
      }

      const background = nextCard.background;
      if (background && typeof background === 'object') {
        const nextBackground = background as Record<string, unknown>;
        if (nextBackground.type === 'image') {
          const bgImage = nextBackground.image && typeof nextBackground.image === 'object'
            ? nextBackground.image as Record<string, unknown>
            : {};
          if (!hasImageValue(bgImage.url)) {
            nextBackground.image = { ...bgImage, url: nextImage() };
            changed = true;
          }
          if (!nextBackground.overlay || typeof nextBackground.overlay !== 'object') {
            nextBackground.overlay = { color: '#000000', opacity: 0.45 };
            changed = true;
          }
          nextCard = { ...nextCard, background: { ...nextBackground } };
        }
      }

      return nextCard;
    });

    if (changed) nextData.cards = cards;
  }

  const legacyVariant = String(data.variant || '').toLowerCase();
  if (!Array.isArray(data.cards) && ['fullimage', 'split', 'image'].includes(legacyVariant) && !hasImageValue(data.image)) {
    nextData.image = nextImage();
    changed = true;
  }

  return changed ? nextData : data;
}

function withBlockData<T extends AiBlockLike>(block: T, data: Record<string, unknown>): T {
  return { ...block, data } as T;
}

function hasImageValue(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function cleanPositiveNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function cleanCurrency(value: unknown): string {
  const currency = typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) : '';
  return currency.length === 3 ? currency : 'CAD';
}

function cleanUnsplashUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!/^https:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9_-]+/i.test(url)) return null;
  return url.slice(0, 500);
}

function cleanMenuIconTags(value: unknown): string[] {
  const allowed = new Set(['gluten_free', 'vegetarian', 'vegan', 'spicy']);
  return Array.isArray(value)
    ? value.filter((tag): tag is string => typeof tag === 'string' && allowed.has(tag)).slice(0, 4)
    : [];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || 'sample-option';
}
