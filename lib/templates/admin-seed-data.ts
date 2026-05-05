import type { SupabaseClient } from '@supabase/supabase-js';

const image = (id: string, width = 1400, height = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&h=${height}&q=80`;

type BlogSeed = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string;
  author: string;
  tags: string[];
  published_at: string;
  sort_order: number;
  is_featured?: boolean;
};

type MenuSeed = {
  name: string;
  description: string;
  price: string;
  menu_section: string;
  menu_section_order: number;
  category: string;
  category_order: number;
  image_url: string;
  sort_order: number;
  is_featured?: boolean;
  icon_tags?: string[];
};

type ProductSeed = {
  name: string;
  brand?: string | null;
  description: string;
  price_cents: number;
  category: string;
  subcategory: string;
  images: string[];
  tags?: string[];
  is_featured?: boolean;
};

const EDITORIAL_BLOG_SEEDS: BlogSeed[] = [
  {
    title: 'The case for smaller, sharper websites',
    slug: 'smaller-sharper-websites',
    excerpt: 'A practical look at why content architecture beats bloated pages.',
    content: '<p>The strongest local brands are not louder. They are more specific. A smaller website can do more when every page has a job, every section earns attention, and every call to action is obvious.</p><p>Start with the questions customers already ask. Turn those answers into clear pages, useful examples, and proof that reduces hesitation.</p>',
    cover_image: image('photo-1495020689067-958852a7765e'),
    author: 'Avery Stone',
    tags: ['Strategy'],
    published_at: '2026-04-18T12:00:00.000Z',
    sort_order: 0,
    is_featured: true,
  },
  {
    title: 'How to turn expertise into a repeatable column',
    slug: 'repeatable-column',
    excerpt: 'Simple editorial formats that help busy experts publish consistently.',
    content: '<p>Consistency gets easier when the format is already decided. A repeatable column gives you a familiar frame: one observation, one example, one practical takeaway.</p><p>Use the same structure each week and let the subject matter change. Readers learn what to expect, and publishing stops feeling like starting from nothing.</p>',
    cover_image: image('photo-1516321318423-f06f85e504b3'),
    author: 'Nora Bell',
    tags: ['Publishing'],
    published_at: '2026-04-11T12:00:00.000Z',
    sort_order: 1,
  },
  {
    title: 'What your about page should actually do',
    slug: 'about-page-job',
    excerpt: 'Move beyond biography and create useful context for trust.',
    content: '<p>An about page is not just a biography. It is a trust page. It should explain who you serve, how you think, what customers can expect, and why your approach works.</p><p>Keep the personal story, but anchor it to the customer decision. The best about pages make the next step feel safer.</p>',
    cover_image: image('photo-1497366754035-f200968a6e72'),
    author: 'Mika Lane',
    tags: ['Brand'],
    published_at: '2026-04-04T12:00:00.000Z',
    sort_order: 2,
  },
];

const MENU_ITEM_SEEDS: MenuSeed[] = [
  {
    name: 'Soft Scramble Toast',
    description: 'Herbed eggs, cultured butter, sourdough, chives.',
    price: '$15',
    menu_section: 'Breakfast',
    menu_section_order: 0,
    category: 'Morning Plates',
    category_order: 0,
    image_url: image('photo-1525351484163-7529414344d8'),
    sort_order: 0,
    is_featured: true,
    icon_tags: ['vegetarian'],
  },
  {
    name: 'Citrus Ricotta Pancakes',
    description: 'Lemon ricotta, berry compote, maple butter.',
    price: '$17',
    menu_section: 'Breakfast',
    menu_section_order: 0,
    category: 'Morning Plates',
    category_order: 0,
    image_url: image('photo-1528207776546-365bb710ee93'),
    sort_order: 1,
  },
  {
    name: 'Seasonal Salad',
    description: 'Greens, herbs, pickled shallot, house vinaigrette.',
    price: '$16',
    menu_section: 'Lunch',
    menu_section_order: 1,
    category: 'Greens',
    category_order: 0,
    image_url: image('photo-1540420773420-3366772f4999'),
    sort_order: 0,
    is_featured: true,
    icon_tags: ['vegan', 'gluten_free'],
  },
  {
    name: 'Grilled Chicken Sandwich',
    description: 'Lemon aioli, market greens, house pickles.',
    price: '$19',
    menu_section: 'Lunch',
    menu_section_order: 1,
    category: 'Sandwiches',
    category_order: 1,
    image_url: image('photo-1528735602780-2552fd46c7af'),
    sort_order: 1,
  },
  {
    name: 'Charred Broccolini',
    description: 'Lemon aioli, chili crisp, toasted almond.',
    price: '$14',
    menu_section: 'Dinner',
    menu_section_order: 2,
    category: 'Small Plates',
    category_order: 0,
    image_url: image('photo-1546069901-ba9599a7e63c'),
    sort_order: 0,
    icon_tags: ['vegan', 'spicy'],
  },
  {
    name: 'Brown Butter Gnocchi',
    description: 'Sage, parmesan, roasted squash.',
    price: '$24',
    menu_section: 'Dinner',
    menu_section_order: 2,
    category: 'Mains',
    category_order: 1,
    image_url: image('photo-1473093295043-cdd812d0e601'),
    sort_order: 1,
    is_featured: true,
    icon_tags: ['vegetarian'],
  },
  {
    name: 'Roast Chicken',
    description: 'Pan jus, crispy potatoes, bitter greens.',
    price: '$29',
    menu_section: 'Dinner',
    menu_section_order: 2,
    category: 'Mains',
    category_order: 1,
    image_url: image('photo-1532550907401-a500c9a57435'),
    sort_order: 2,
  },
  {
    name: 'House Spritz',
    description: 'Bitter orange, sparkling wine, rosemary.',
    price: '$13',
    menu_section: 'Drinks',
    menu_section_order: 3,
    category: 'Cocktails',
    category_order: 0,
    image_url: image('photo-1551024709-8f23befc6f87'),
    sort_order: 0,
    is_featured: true,
    icon_tags: ['vegan', 'gluten_free'],
  },
  {
    name: 'Espresso Tonic',
    description: 'Cold espresso, tonic, orange peel.',
    price: '$7',
    menu_section: 'Drinks',
    menu_section_order: 3,
    category: 'Coffee & Zero-Proof',
    category_order: 1,
    image_url: image('photo-1517701604599-bb29b565090c'),
    sort_order: 1,
  },
  {
    name: 'Citrus Olive Cake',
    description: 'Whipped mascarpone and seasonal citrus.',
    price: '$11',
    menu_section: 'Dinner',
    menu_section_order: 2,
    category: 'Dessert',
    category_order: 2,
    image_url: image('photo-1488477181946-6428a0291777'),
    sort_order: 0,
    icon_tags: ['vegetarian'],
  },
];

const CRAFT_PRODUCT_SEEDS: ProductSeed[] = [
  {
    name: 'Thrown Stoneware Mug',
    brand: 'Marlow Made',
    description: 'A hand-thrown mug with a soft glaze and everyday weight.',
    price_cents: 4200,
    category: 'Tableware',
    subcategory: 'Mugs',
    images: [image('photo-1528756514091-dee5ecaa3278')],
    tags: ['Template sample', 'Handmade'],
    is_featured: true,
  },
  {
    name: 'Speckled Serving Bowl',
    brand: 'Marlow Made',
    description: 'A shallow bowl for shared meals, fruit, or a generous salad.',
    price_cents: 8600,
    category: 'Tableware',
    subcategory: 'Bowls',
    images: [image('photo-1452860606245-08befc0ff44b')],
    tags: ['Template sample', 'Small batch'],
    is_featured: true,
  },
  {
    name: 'Bud Vase Trio',
    brand: 'Marlow Made',
    description: 'Three small vases for stems, shelves, and quiet corners.',
    price_cents: 6400,
    category: 'Home Objects',
    subcategory: 'Vases',
    images: [image('photo-1513519245088-0e12902e5a38')],
    tags: ['Template sample'],
  },
  {
    name: 'Linen Market Tote',
    brand: 'Marlow Made',
    description: 'A sturdy everyday tote for studio visits, markets, and errands.',
    price_cents: 3800,
    category: 'Accessories',
    subcategory: 'Totes',
    images: [image('photo-1524758631624-e2822e304c36')],
    tags: ['Template sample'],
  },
];

const RETRO_PRODUCT_SEEDS: ProductSeed[] = [
  {
    name: 'Drop Day Poster',
    brand: 'Pixel Supply',
    description: 'A limited risograph-inspired print for launch walls and pop-ups.',
    price_cents: 2800,
    category: 'Drops',
    subcategory: 'Prints',
    images: [image('photo-1513364776144-60967b0f800f')],
    tags: ['Template sample', 'Limited'],
    is_featured: true,
  },
  {
    name: 'Sticker Pack',
    brand: 'Pixel Supply',
    description: 'A punchy set of vinyl stickers for laptops, bottles, and cases.',
    price_cents: 1200,
    category: 'Drops',
    subcategory: 'Stickers',
    images: [image('photo-1492691527719-9d1e07e534b4')],
    tags: ['Template sample'],
  },
  {
    name: 'Launch Tee',
    brand: 'Pixel Supply',
    description: 'A soft tee with a bold front graphic and easy everyday fit.',
    price_cents: 4400,
    category: 'Apparel',
    subcategory: 'Shirts',
    images: [image('photo-1503341504253-dff4815485f1')],
    tags: ['Template sample'],
    is_featured: true,
  },
  {
    name: 'Creator Bundle',
    brand: 'Pixel Supply',
    description: 'A curated kit with print, stickers, and a small surprise insert.',
    price_cents: 6800,
    category: 'Bundles',
    subcategory: 'Kits',
    images: [image('photo-1518005020951-eccb494ad742')],
    tags: ['Template sample', 'Bundle'],
  },
];

export async function seedTemplateAdminContent(
  admin: SupabaseClient,
  siteId: string,
  templateId: string,
  context: { businessType?: string | null; category?: string | null } = {},
) {
  const normalized = templateId.toLowerCase().replace(/-/g, '_');
  const category = (context.category || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const businessType = (context.businessType || '').toLowerCase();
  const isFood = ['restaurant', 'food', 'cafe', 'coffee', 'bar', 'bakery', 'food_truck'].some((value) => category.includes(value));
  const isProducts = businessType === 'products' || ['ecommerce', 'handmade', 'craft', 'digital', 'dropship', 'subscription'].some((value) => category.includes(value));
  const isBlog = category.includes('blog') || category.includes('content') || category.includes('publication');

  if (normalized.includes('editorial') || isBlog) {
    await seedBlogPosts(admin, siteId);
  }

  if (normalized.includes('menu') || isFood) {
    await seedMenuItems(admin, siteId);
  }

  if (normalized.includes('craft') || (isProducts && !normalized.includes('retro'))) {
    await seedProducts(admin, siteId, CRAFT_PRODUCT_SEEDS);
  }

  if (normalized.includes('retro')) {
    await seedProducts(admin, siteId, RETRO_PRODUCT_SEEDS);
  }
}

async function seedProducts(admin: SupabaseClient, siteId: string, products: ProductSeed[]) {
  const { count, error: countError } = await admin
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('is_archived', false);

  if (countError) throw countError;
  if ((count ?? 0) > 0) return;

  const rows = products.map((product, index) => ({
    site_id: siteId,
    name: product.name,
    brand: product.brand || null,
    description: product.description,
    price_cents: product.price_cents,
    compare_at_cents: null,
    currency: 'CAD',
    images: product.images,
    variants: [],
    options: [],
    inventory_count: -1,
    is_active: true,
    is_featured: product.is_featured === true,
    status: 'published',
    category: product.category,
    subcategory: product.subcategory,
    tags: product.tags || ['Template sample'],
    slug: `${slugify(product.name)}-${index + 1}`,
    sort_order: index,
  }));

  const { error } = await admin.from('products').insert(rows);
  if (error) throw error;
}

async function seedBlogPosts(admin: SupabaseClient, siteId: string) {
  const { count, error: countError } = await admin
    .from('blog_posts')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId);

  if (countError) throw countError;
  if ((count ?? 0) > 0) return;

  const { error } = await admin.from('blog_posts').insert(
    EDITORIAL_BLOG_SEEDS.map((post) => ({
      site_id: siteId,
      ...post,
      is_published: true,
      created_at: post.published_at,
      updated_at: post.published_at,
    })),
  );

  if (error) throw error;
}

async function seedMenuItems(admin: SupabaseClient, siteId: string) {
  const { count, error: countError } = await admin
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId);

  if (countError) throw countError;
  if ((count ?? 0) > 0) return;

  const rows = MENU_ITEM_SEEDS.map((item) => ({
    site_id: siteId,
    name: item.name,
    description: item.description,
    price: item.price,
    menu_section: item.menu_section,
    menu_section_order: item.menu_section_order,
    category: item.category,
    category_order: item.category_order,
    image_url: item.image_url,
    sort_order: item.sort_order,
    is_available: true,
    icon_tags: item.icon_tags || [],
  }));

  const { error } = await admin.from('menu_items').insert(rows);

  if (error && error.message.toLowerCase().includes('category_order')) {
    const fallbackRows = rows.map((item) => ({
      site_id: item.site_id,
      name: item.name,
      description: item.description,
      price: item.price,
      menu_section: item.menu_section,
      menu_section_order: item.menu_section_order,
      category: item.category,
      image_url: item.image_url,
      sort_order: item.sort_order,
      is_available: item.is_available,
    }));
    const { error: fallbackError } = await admin.from('menu_items').insert(fallbackRows);
    if (fallbackError) throw fallbackError;
  } else if (error && error.message.toLowerCase().includes('menu_section_order')) {
    const fallbackRows = rows.map((item) => ({
      site_id: item.site_id,
      name: item.name,
      description: item.description,
      price: item.price,
      menu_section: item.menu_section,
      category: item.category,
      category_order: item.category_order,
      image_url: item.image_url,
      sort_order: item.sort_order,
      is_available: item.is_available,
    }));
    const { error: fallbackError } = await admin.from('menu_items').insert(fallbackRows);
    if (fallbackError) throw fallbackError;
  } else if (error && error.message.toLowerCase().includes('menu_section')) {
    const fallbackRows = rows.map((item) => ({
      site_id: item.site_id,
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      category_order: item.category_order,
      image_url: item.image_url,
      sort_order: item.sort_order,
      is_available: item.is_available,
    }));
    const { error: fallbackError } = await admin.from('menu_items').insert(fallbackRows);
    if (fallbackError) throw fallbackError;
  } else if (error && error.message.toLowerCase().includes('icon_tags')) {
    const fallbackRows = rows.map((item) => {
      const { icon_tags: _iconTags, ...rest } = item;
      return rest;
    });
    const { error: fallbackError } = await admin.from('menu_items').insert(fallbackRows);
    if (fallbackError) throw fallbackError;
  } else if (error) {
    throw error;
  }

  const featuredNames = MENU_ITEM_SEEDS
    .filter((item) => item.is_featured)
    .map((item) => item.name);

  if (featuredNames.length > 0) {
    const { error: featuredError } = await admin
      .from('menu_items')
      .update({ is_featured: true })
      .eq('site_id', siteId)
      .in('name', featuredNames);

    if (featuredError && !featuredError.message.toLowerCase().includes('is_featured')) {
      throw featuredError;
    }
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || 'template-product';
}
