import {
  getBuilderBlockDisplayName,
  resolveBuilderBlock,
  type KeystoneBlockDisplayName,
} from '@/lib/builder/existing-blocks';

export type ArchitectureBusinessType = 'services' | 'products' | 'portfolio' | 'nonprofit' | 'other';

export interface ArchitectureBlock {
  displayName: KeystoneBlockDisplayName;
  blockType: string;
  purpose: string;
  required?: boolean;
}

export interface ArchitecturePage {
  slug: string;
  title: string;
  displayName: string;
  role: string;
  brief: string;
  blocks: ArchitectureBlock[];
}

export interface SiteArchitecture {
  businessType: ArchitectureBusinessType;
  category: string;
  categoryLabel: string;
  home: ArchitecturePage;
  pages: ArchitecturePage[];
  managedContent: {
    products: boolean;
    menu: boolean;
    booking: boolean;
    blog: boolean;
    events: boolean;
    membership: boolean;
  };
  forbiddenBlockTypes: string[];
}

export interface SiteArchitectureInput {
  businessType?: string | null;
  category?: string | null;
  templateId?: string | null;
  requestedPageIds?: string[] | null;
  requestedPageLabels?: string[] | null;
  description?: string | null;
  extras?: string | null;
}

const FOOD_CATEGORIES = new Set(['restaurant', 'food', 'cafe', 'coffee', 'bar', 'bakery', 'catering', 'foodtruck', 'food_truck']);
const APPOINTMENT_CATEGORIES = new Set(['salon', 'fitness', 'coaching', 'clinic', 'wellness', 'therapy', 'tutor', 'education']);
const TRADE_CATEGORIES = new Set(['plumber', 'electrical', 'electrician', 'hvac', 'heating', 'handyman', 'mechanic', 'trades', 'cleaning', 'landscaping']);
const PRODUCT_CATEGORIES = new Set(['products', 'ecommerce', 'handmade', 'crafts', 'digital', 'dropship', 'subscription']);
const PORTFOLIO_CATEGORIES = new Set(['portfolio', 'photographer', 'designer', 'artist', 'videographer', 'architect', 'agency']);
const NONPROFIT_CATEGORIES = new Set(['nonprofit', 'charity', 'association', 'community', 'foundation', 'church']);
const BLOG_CATEGORIES = new Set(['blog', 'content', 'publication', 'newsletter', 'articles']);

export function buildSiteArchitecture(input: SiteArchitectureInput): SiteArchitecture {
  const category = normalizeCategory(input.category) || inferCategory(input.description, input.requestedPageLabels);
  const businessType = normalizeBusinessType(input.businessType) || inferBusinessType(category, input.description);
  const categoryLabel = labelForCategory(category);
  const requested = normalizeRequestedPages(input.requestedPageIds, input.requestedPageLabels);

  let architecture = architectureForKind(businessType, category, categoryLabel, requested);
  architecture = addCompatibleRequestedPages(architecture, requested, category);

  return architecture;
}

export function renderArchitectureForAi(architecture: SiteArchitecture): string {
  const pages = [architecture.home, ...architecture.pages]
    .map((page) => renderPageArchitectureForAi(page))
    .join('\n\n');

  const managed: string[] = [];
  for (const [key, value] of Object.entries(architecture.managedContent)) {
    if (value) managed.push(key);
  }

  const forbidden = architecture.forbiddenBlockTypes.length
    ? architecture.forbiddenBlockTypes.map(getBuilderBlockDisplayName).join(', ')
    : 'none';

  return `DETERMINISTIC SITE ARCHITECTURE:
- Business type: ${architecture.businessType}
- Industry/category: ${architecture.categoryLabel}
- Managed content expected: ${managed.join(', ') || 'none'}
- Forbidden block types for this industry: ${forbidden}

Pages are made from blocks. Blocks are not pages. The AI must fill content into the approved blocks below and must not add, remove, rename, or substitute pages/blocks.

${pages}`;
}

export function renderPageArchitectureForAi(page: ArchitecturePage): string {
  return `${page.title} page (${page.slug})
Brief: ${page.brief}
Approved blocks in exact order:
${page.blocks.map((block, index) => `${index + 1}. ${block.blockType} (${block.displayName}) - ${block.purpose}`).join('\n')}`;
}

export function buildFallbackBlocksForArchitecture(
  blocks: readonly ArchitectureBlock[] | undefined,
  siteTitle: string,
  pageSlug: string,
): Array<{ blockType: string; data: Record<string, unknown> }> {
  return (blocks ?? []).map((block) => ({
    blockType: block.blockType,
    data: fallbackDataForBlock(block.blockType, siteTitle, pageSlug),
  }));
}

function architectureForKind(
  businessType: ArchitectureBusinessType,
  category: string,
  categoryLabel: string,
  requested: Set<string>,
): SiteArchitecture {
  if (FOOD_CATEGORIES.has(category) || (category === 'general' && requested.has('menu'))) {
    return restaurantArchitecture(categoryLabel, requested);
  }
  if (businessType === 'products' || PRODUCT_CATEGORIES.has(category) || requested.has('shop')) {
    return productsArchitecture(categoryLabel, requested);
  }
  if (businessType === 'portfolio' || PORTFOLIO_CATEGORIES.has(category) || requested.has('gallery') || requested.has('portfolio')) {
    return portfolioArchitecture(categoryLabel, requested);
  }
  if (businessType === 'nonprofit' || NONPROFIT_CATEGORIES.has(category)) {
    return nonprofitArchitecture(categoryLabel, requested);
  }
  if (BLOG_CATEGORIES.has(category) || requested.has('blog') || requested.has('articles')) {
    return blogArchitecture(categoryLabel, requested);
  }
  if (APPOINTMENT_CATEGORIES.has(category) || requested.has('booking')) {
    return appointmentServiceArchitecture(categoryLabel, requested);
  }
  return serviceArchitecture(categoryLabel, requested, TRADE_CATEGORIES.has(category));
}

function serviceArchitecture(categoryLabel: string, requested: Set<string>, isTrade: boolean): SiteArchitecture {
  const quoteBlock = isTrade ? block('Estimate / Quote Form', 'Collect job details and quote requests.') : block('Contact Form', 'Collect service inquiries.');
  return site('services', categoryLabel, {
    home: page('home', 'Home', 'Home', 'home', `Introduce the ${categoryLabel.toLowerCase()} business, core services, proof, and the next step.`, [
      block('Hero Section', 'State the service promise and primary action.'),
      block('Services Grid', 'Show the main service categories.'),
      block('Features / Why Us', 'Explain differentiators and trust factors.'),
      block('Stats / Numbers', 'Show scannable credibility markers.'),
      block('Testimonials', 'Add social proof.'),
      quoteBlock,
    ]),
    pages: [
      page('services', 'Services', 'Services', 'services', `Detail the ${categoryLabel.toLowerCase()} services and how to request help.`, [
        block('Services Grid', 'List service offerings.'),
        block('Pricing Table', 'Show starter packages or quote ranges when useful.'),
        block('FAQ Accordion', 'Answer practical service questions.'),
        block('Call to Action', 'Send visitors to quote or contact.'),
      ]),
      page('about', 'About', 'About', 'about', 'Build trust with story, credentials, and customer outcomes.', [
        block('About (Image + Text)', 'Explain background and approach.'),
        block('Features / Why Us', 'Summarize trust points.'),
        block('Testimonials', 'Show customer feedback.'),
        block('Call to Action', 'Prompt the next action.'),
      ]),
      page('contact', 'Contact', 'Contact', 'contact', 'Give visitors several ways to contact the business.', [
        block('Contact Info', 'Show phone, email, area, and hours.'),
        quoteBlock,
        block('Google Map', 'Show location or service area if relevant.'),
      ]),
      ...(requested.has('booking') ? [bookingPage(categoryLabel)] : []),
    ],
    managedContent: { products: false, menu: false, booking: requested.has('booking'), blog: false, events: false, membership: false },
    forbiddenBlockTypes: ['menu', 'deliveryLinks'],
  });
}

function appointmentServiceArchitecture(categoryLabel: string, requested: Set<string>): SiteArchitecture {
  return site('services', categoryLabel, {
    home: page('home', 'Home', 'Home', 'home', `Introduce the ${categoryLabel.toLowerCase()} business, services, booking flow, and trust signals.`, [
      block('Hero Section', 'State the appointment-led offer.'),
      block('Services Grid', 'Show bookable services.'),
      block('Booking / Appointments', 'Let visitors book appointments.'),
      block('Testimonials', 'Show social proof.'),
      block('FAQ Accordion', 'Answer booking questions.'),
      block('Call to Action', 'Reinforce booking or contact.'),
    ]),
    pages: [
      page('services', 'Services', 'Services', 'services', `Explain the ${categoryLabel.toLowerCase()} services visitors can book.`, [
        block('Services Grid', 'List services.'),
        block('Pricing Table', 'Show packages or session options.'),
        block('FAQ Accordion', 'Answer service and booking questions.'),
      ]),
      bookingPage(categoryLabel),
      page('about', 'About', 'About', 'about', 'Introduce the people, approach, and atmosphere.', [
        block('About (Image + Text)', 'Tell the story.'),
        block('Team Members', 'Show staff or coaches if useful.'),
        block('Testimonials', 'Share customer feedback.'),
      ]),
      page('contact', 'Contact', 'Contact', 'contact', 'Provide contact details and a fallback inquiry form.', [
        block('Contact Info', 'Show contact details and hours.'),
        block('Contact Form', 'Collect questions before booking.'),
        block('Google Map', 'Show the location when relevant.'),
      ]),
    ],
    managedContent: { products: false, menu: false, booking: true, blog: false, events: false, membership: false },
    forbiddenBlockTypes: ['menu', 'deliveryLinks'],
  });
}

function restaurantArchitecture(categoryLabel: string, requested: Set<string>): SiteArchitecture {
  return site('other', categoryLabel, {
    home: page('home', 'Home', 'Home', 'home', 'Introduce the restaurant, food, atmosphere, menu preview, and visit/order actions.', [
      block('Hero Section', 'Lead with the restaurant concept and primary action.'),
      block('Menu', 'Preview real menu sections using the managed menu block.'),
      block('Image Gallery', 'Show food, drinks, and space.'),
      block('Delivery App Links', 'Link to order or delivery options.'),
      block('Contact Info', 'Show location and hours.'),
      block('Call to Action', 'Drive visitors to menu, booking, or ordering.'),
    ]),
    pages: [
      page('menu', 'Menu', 'Menu', 'menu', 'Show the full restaurant menu using the existing Menu block.', [
        block('Menu', 'Display managed menu items.'),
        block('Delivery App Links', 'Offer online ordering links.'),
        ...(requested.has('booking') ? [block('Booking / Appointments', 'Support reservations or appointments.')] : []),
        block('Contact Info', 'Show hours and location near the menu.'),
      ]),
      page('visit', 'Visit', 'Visit', 'contact', 'Help guests find and contact the restaurant.', [
        block('Contact Info', 'Show address, phone, and hours.'),
        block('Google Map', 'Show the location.'),
        block('Contact Form', 'Collect private event or general inquiries.'),
      ]),
      ...(requested.has('gallery') ? [galleryPage(categoryLabel)] : []),
    ],
    managedContent: { products: false, menu: true, booking: requested.has('booking'), blog: false, events: false, membership: false },
    forbiddenBlockTypes: ['productGrid'],
  });
}

function productsArchitecture(categoryLabel: string, requested: Set<string>): SiteArchitecture {
  return site('products', categoryLabel, {
    home: page('home', 'Home', 'Home', 'home', `Introduce the ${categoryLabel.toLowerCase()} shop, featured products, story, and buying path.`, [
      block('Hero Section', 'State the shop offer and link to products.'),
      block('Product Catalog', 'Show featured products from the managed catalog.'),
      block('Content Carousel', 'Highlight collections, drops, or product benefits.'),
      block('Image Gallery', 'Show product lifestyle imagery.'),
      block('Testimonials', 'Build buyer trust.'),
      block('Call to Action', 'Drive visitors to shop or contact.'),
    ]),
    pages: [
      page('shop', 'Shop', 'Shop', 'shop', 'Display products using the existing Product Catalog block.', [
        block('Product Catalog', 'List managed products.'),
        block('Featured Quote', 'Add brand or customer context.'),
        block('FAQ Accordion', 'Answer shipping, returns, or product questions.'),
        block('Call to Action', 'Help undecided shoppers contact the business.'),
      ]),
      page('about', 'About', 'About', 'about', 'Tell the product story and build trust.', [
        block('About (Image + Text)', 'Explain the maker, brand, or process.'),
        block('Image Gallery', 'Show process or product details.'),
        block('Testimonials', 'Share customer feedback.'),
      ]),
      page('contact', 'Contact', 'Contact', 'contact', 'Handle questions, custom orders, and support.', [
        block('Contact Form', 'Collect customer messages.'),
        block('Contact Info', 'Show contact details.'),
      ]),
      ...(requested.has('gallery') ? [galleryPage(categoryLabel)] : []),
    ],
    managedContent: { products: true, menu: false, booking: false, blog: false, events: false, membership: false },
    forbiddenBlockTypes: ['menu', 'deliveryLinks'],
  });
}

function portfolioArchitecture(categoryLabel: string, requested: Set<string>): SiteArchitecture {
  return site('portfolio', categoryLabel, {
    home: page('home', 'Home', 'Home', 'home', `Introduce the ${categoryLabel.toLowerCase()} work, selected projects, process, and inquiry path.`, [
      block('Hero Section', 'Lead with the creative positioning.'),
      block('Image Gallery', 'Show selected work.'),
      block('About (Image + Text)', 'Explain the process or point of view.'),
      block('Featured Quote', 'Add a strong testimonial or artist statement.'),
      block('Services Grid', 'Show available creative services.'),
      block('Contact Form', 'Invite project inquiries.'),
    ]),
    pages: [
      galleryPage(categoryLabel, 'portfolio', 'Portfolio', 'Portfolio'),
      page('about', 'About', 'About', 'about', 'Introduce the person, studio, or creative approach.', [
        block('About (Image + Text)', 'Tell the story.'),
        block('Featured Quote', 'Show a point of view or testimonial.'),
        block('Team Members', 'Show team members if relevant.'),
      ]),
      page('contact', 'Inquire', 'Inquire', 'contact', 'Collect project inquiries.', [
        block('Contact Form', 'Collect project details.'),
        block('Contact Info', 'Show other contact options.'),
      ]),
      ...(requested.has('services') ? [page('services', 'Services', 'Services', 'services', 'Describe creative services and packages.', [
        block('Services Grid', 'List creative services.'),
        block('Pricing Table', 'Show package examples if useful.'),
        block('FAQ Accordion', 'Answer project-fit questions.'),
      ])] : []),
    ],
    managedContent: { products: false, menu: false, booking: requested.has('booking'), blog: false, events: false, membership: false },
    forbiddenBlockTypes: ['menu', 'deliveryLinks'],
  });
}

function nonprofitArchitecture(categoryLabel: string, requested: Set<string>): SiteArchitecture {
  return site('nonprofit', categoryLabel, {
    home: page('home', 'Home', 'Home', 'home', `Introduce the ${categoryLabel.toLowerCase()} mission, impact, programs, and ways to get involved.`, [
      block('Hero Section', 'State the mission and primary action.'),
      block('Stats / Numbers', 'Show impact numbers.'),
      block('Services Grid', 'Present programs or initiatives.'),
      block('Events', 'Show upcoming community activity.'),
      block('Resources', 'Share helpful links or documents.'),
      block('Call to Action', 'Invite involvement without inventing a donation block.'),
    ]),
    pages: [
      page('mission', 'Mission', 'Mission', 'about', 'Explain the mission, community, and impact.', [
        block('About (Image + Text)', 'Tell the mission story.'),
        block('Stats / Numbers', 'Show impact.'),
        block('Featured Quote', 'Highlight a community voice.'),
      ]),
      page('programs', 'Programs', 'Programs', 'programs', 'Show programs using existing content blocks.', [
        block('Services Grid', 'List programs or services.'),
        block('Resources', 'Share program resources.'),
        block('Events', 'Connect programs to events.'),
      ]),
      page('get-involved', 'Get Involved', 'Get Involved', 'cta', 'Give visitors practical next steps.', [
        block('Call to Action', 'Invite volunteering, membership, or contact.'),
        block('Contact Form', 'Collect interest forms.'),
        block('Events', 'Show opportunities to participate.'),
      ]),
      page('contact', 'Contact', 'Contact', 'contact', 'Let visitors reach the organization.', [
        block('Contact Form', 'Collect messages.'),
        block('Contact Info', 'Show contact details.'),
        block('Google Map', 'Show location when relevant.'),
      ]),
    ],
    managedContent: { products: false, menu: false, booking: false, blog: false, events: true, membership: requested.has('membership') },
    forbiddenBlockTypes: ['menu', 'deliveryLinks', 'productGrid'],
  });
}

function blogArchitecture(categoryLabel: string, requested: Set<string>): SiteArchitecture {
  return site('other', categoryLabel, {
    home: page('home', 'Home', 'Home', 'home', `Introduce the ${categoryLabel.toLowerCase()} publication, featured articles, and subscription/contact path.`, [
      block('Hero Section', 'Introduce the editorial premise.'),
      block('Blog / News', 'Show article feed.'),
      block('Featured Quote', 'Add editorial positioning.'),
      block('Resources', 'Offer useful links or downloads.'),
      block('Call to Action', 'Invite subscription or contact.'),
    ]),
    pages: [
      page('articles', 'Articles', 'Articles', 'blog', 'List published articles or news posts.', [
        block('Blog / News', 'Display the managed blog feed.'),
        block('Resources', 'Collect related resources.'),
        block('Call to Action', 'Invite readers to subscribe or contact.'),
      ]),
      page('about', 'About', 'About', 'about', 'Explain the publication or author.', [
        block('About (Image + Text)', 'Tell the story.'),
        block('Featured Quote', 'Add voice and positioning.'),
      ]),
      page('contact', 'Contact', 'Contact', 'contact', 'Provide a contact or submission path.', [
        block('Contact Form', 'Collect messages.'),
        block('Contact Info', 'Show contact details.'),
      ]),
      ...(requested.has('events') ? [page('events', 'Events', 'Events', 'events', 'Show events related to the publication or community.', [
        block('Events', 'List events.'),
        block('Call to Action', 'Invite registration or contact.'),
      ])] : []),
    ],
    managedContent: { products: false, menu: false, booking: false, blog: true, events: requested.has('events'), membership: false },
    forbiddenBlockTypes: ['menu', 'deliveryLinks'],
  });
}

function addCompatibleRequestedPages(architecture: SiteArchitecture, requested: Set<string>, category: string): SiteArchitecture {
  const pages = [...architecture.pages];
  const seen = new Set(pages.map((page) => page.slug));
  const add = (next: ArchitecturePage | null) => {
    if (!next || seen.has(next.slug)) return;
    pages.push(next);
    seen.add(next.slug);
  };

  if (requested.has('pricing')) add(page('pricing', 'Pricing', 'Pricing', 'pricing', 'Show pricing or package options.', [
    block('Pricing Table', 'Show plans, packages, or starting prices.'),
    block('FAQ Accordion', 'Answer pricing questions.'),
    block('Call to Action', 'Send visitors to contact or booking.'),
  ]));

  if (requested.has('faq')) add(page('faq', 'FAQ', 'FAQ', 'faq', 'Answer common questions.', [
    block('FAQ Accordion', 'List common questions and answers.'),
    block('Contact Form', 'Collect remaining questions.'),
    block('Call to Action', 'Offer a next step.'),
  ]));

  if (requested.has('team')) add(page('team', 'Team', 'Team', 'team', 'Introduce people behind the business.', [
    block('Team Members', 'Show staff or leadership.'),
    block('About (Image + Text)', 'Explain the team approach.'),
    block('Call to Action', 'Invite contact.'),
  ]));

  if (requested.has('blog') && !architecture.managedContent.blog && !FOOD_CATEGORIES.has(category)) {
    add(page('blog', 'Blog', 'Blog', 'blog', 'Display articles or updates.', [
      block('Blog / News', 'Show blog posts.'),
      block('Call to Action', 'Invite readers to contact or subscribe.'),
    ]));
    architecture.managedContent.blog = true;
  }

  return { ...architecture, pages };
}

function bookingPage(categoryLabel: string): ArchitecturePage {
  return page('booking', 'Booking', 'Booking', 'booking', `Let visitors book ${categoryLabel.toLowerCase()} services or consultations.`, [
    block('Booking / Appointments', 'Show the managed booking flow.'),
    block('Services Grid', 'Summarize bookable services.'),
    block('FAQ Accordion', 'Answer booking questions.'),
  ]);
}

function galleryPage(categoryLabel: string, slug = 'gallery', title = 'Gallery', displayName = 'Gallery'): ArchitecturePage {
  return page(slug, title, displayName, 'gallery', `Show ${categoryLabel.toLowerCase()} visuals or selected work.`, [
    block('Image Gallery', 'Show images.'),
    block('Content Carousel', 'Highlight selected moments or projects.'),
    block('Featured Quote', 'Add context or testimonial.'),
    block('Call to Action', 'Invite the next step.'),
  ]);
}

function site(
  businessType: ArchitectureBusinessType,
  categoryLabel: string,
  config: Omit<SiteArchitecture, 'businessType' | 'category' | 'categoryLabel'>,
): SiteArchitecture {
  const { home, pages, ...rest } = config;
  return {
    businessType,
    category: normalizeCategory(categoryLabel),
    categoryLabel,
    ...rest,
    home: compactArchitecturePage(home),
    pages: pages.map(compactArchitecturePage),
  };
}

function page(
  slug: string,
  title: string,
  displayName: string,
  role: string,
  brief: string,
  blocks: ArchitectureBlock[],
): ArchitecturePage {
  return { slug, title, displayName, role, brief, blocks };
}

function compactArchitecturePage(page: ArchitecturePage): ArchitecturePage {
  const blocks: ArchitectureBlock[] = [];
  for (const next of page.blocks) {
    const previous = blocks[blocks.length - 1];
    if (!previous) {
      blocks.push(next);
      continue;
    }

    if (previous.blockType === next.blockType) continue;

    const previousFamily = architectureBlockFamily(previous.blockType);
    if (previousFamily === 'form' && previousFamily === architectureBlockFamily(next.blockType)) continue;

    blocks.push(next);
  }

  return blocks.length === page.blocks.length ? page : { ...page, blocks };
}

function architectureBlockFamily(blockType: string): string {
  if (blockType === 'contact_form' || blockType === 'estimateForm') return 'form';
  return blockType;
}

function block(displayName: KeystoneBlockDisplayName, purpose: string): ArchitectureBlock {
  const resolved = resolveBuilderBlock(displayName);
  if (!resolved) {
    throw new Error(`Unknown Keystone builder block: ${displayName}`);
  }
  return {
    displayName: resolved.displayName,
    blockType: resolved.internalType,
    purpose,
    required: true,
  };
}

function fallbackDataForBlock(blockType: string, siteTitle: string, pageSlug: string): Record<string, unknown> {
  const pageTitle = titleFromSlug(pageSlug);
  switch (blockType) {
    case 'hero':
      return {
        variant: 'split',
        title: pageSlug === 'home' ? siteTitle : `${pageTitle} at ${siteTitle}`,
        subtitle: 'Use this section to explain what visitors can do next.',
        buttonText: pageSlug === 'home' ? 'Get in touch' : 'Contact us',
        buttonTextLink: { linkType: 'page', pageSlug: 'contact' },
      };
    case 'servicesGrid':
      return {
        title: pageSlug === 'programs' ? 'Programs' : 'Services',
        subtitle: 'Edit these offerings to match the business.',
        items: [
          { title: 'Primary offering', description: 'Describe the main service or program.' },
          { title: 'Second offering', description: 'Describe another important option.' },
          { title: 'Custom support', description: 'Explain how visitors can request something specific.' },
        ],
      };
    case 'featuresList':
      return { title: 'Why choose us', items: ['Clear communication', 'Reliable follow-through', 'Practical next steps'] };
    case 'stats':
      return { title: 'At a glance', variant: 'cards', items: [{ value: '4.9/5', label: 'Average rating' }, { value: '500+', label: 'Customers helped' }, { value: '24 hr', label: 'Typical response' }] };
    case 'testimonials':
      return { title: 'What people say', variant: 'cards', items: [{ name: 'Local customer', role: 'Customer', quote: 'The process was clear from the first message.', rating: 5 }] };
    case 'estimateForm':
      return {
        title: 'Request a quote',
        description: 'Tell us what you need and we will follow up.',
        submitText: 'Request quote',
        successMessage: 'Thanks. We will follow up shortly.',
        fields: [
          { id: 'service-needed', label: 'Service needed', type: 'text', required: true },
          { id: 'timeline', label: 'Timeline', type: 'select', required: true, options: ['As soon as possible', 'This week', 'Flexible'] },
        ],
      };
    case 'contact_form':
      return { title: 'Send a message', description: 'Tell us how we can help.', submitText: 'Send message', successMessage: 'Thanks. We will be in touch shortly.' };
    case 'contact':
      return { title: 'Contact us', phone: '', email: '', address: '', hours: '' };
    case 'map':
      return { title: 'Find us', address: '' };
    case 'faq':
      return { title: 'Common questions', items: [{ question: 'How do I get started?', answer: 'Send a request and we will reply with next steps.' }, { question: 'Can I ask a custom question?', answer: 'Yes. Use the contact form and include the details.' }] };
    case 'cta':
      return { title: `Ready to work with ${siteTitle}?`, subtitle: 'Reach out and we will help with the next step.', buttonText: 'Contact us', buttonTextLink: { linkType: 'page', pageSlug: 'contact' } };
    case 'pricing':
      return { title: 'Pricing', variant: 'cards', tiers: [{ name: 'Starter', price: 'Custom', period: '', description: 'A focused first step.', features: ['Clear scope', 'Next steps'], highlighted: false, buttonText: 'Ask about pricing' }] };
    case 'aboutImageText':
      return { title: `About ${siteTitle}`, description: 'Use this space to explain the story, approach, and people behind the business.', items: ['Thoughtful process', 'Customer-focused', 'Built locally'], imagePosition: 'right' };
    case 'team':
      return { title: 'Meet the team', variant: 'grid', showBio: true, members: [{ name: 'Team member', role: 'Role', bio: 'Add a short bio here.' }] };
    case 'gallery':
      return { title: pageSlug === 'portfolio' ? 'Selected work' : 'Gallery', subtitle: 'Add images that show the work, product, or space.', columns: 3 };
    case 'carousel':
      return { title: 'Highlights', variant: 'cards', items: [{ mediaType: 'icon', icon: 'Star', title: 'Highlight one', text: 'Describe a featured offer, project, or benefit.' }] };
    case 'featuredQuote':
      return { variant: 'minimal', quote: 'Add a quote, testimonial, or short statement that builds confidence.', personName: siteTitle, personTitle: '' };
    case 'productGrid':
      return { variant: 'grid', featuredOnly: false, showSeeMore: false };
    case 'menu':
      return { menuTitle: 'Menu', menuSubtitle: 'Browse by section.', mode: 'items', variant: 'list', showPrices: true, showDescriptions: true, showMenuTabs: true, categoryStyle: 'heading' };
    case 'deliveryLinks':
      return { title: 'Order online', subtitle: 'Choose pickup or delivery.', links: [{ id: 'custom-order', platform: 'custom', label: 'Order online', url: '', enabled: true }] };
    case 'booking':
      return {};
    case 'blog':
      return { title: 'Latest updates', subtitle: 'Articles, news, and notes.', layout: 'grid', showExcerpt: true };
    case 'events':
      return { title: 'Upcoming events', subtitle: 'Add events from the admin dashboard.', sortOrder: 'asc', showPast: false };
    case 'resources':
      return { title: 'Resources', subtitle: 'Helpful links and information.', variant: 'grid', items: [{ id: 'resource-1', type: 'text', title: 'Getting started', description: 'Add a useful resource.', body: 'Replace this text with practical information.' }] };
    case 'video':
      return { title: 'Watch', caption: '', videoUrl: '', variant: 'contained' };
    default:
      return {};
  }
}

function normalizeRequestedPages(ids?: string[] | null, labels?: string[] | null): Set<string> {
  const requested = new Set<string>();
  for (const value of [...(ids ?? []), ...(labels ?? [])]) {
    const normalized = normalizeCategory(value);
    if (!normalized || normalized === 'home') continue;
    if (normalized.includes('shop') || normalized.includes('product')) requested.add('shop');
    else if (normalized.includes('service')) requested.add('services');
    else if (normalized.includes('about') || normalized.includes('mission')) requested.add('about');
    else if (normalized.includes('contact') || normalized.includes('inquire') || normalized.includes('visit')) requested.add('contact');
    else if (normalized.includes('booking') || normalized.includes('appointment')) requested.add('booking');
    else if (normalized.includes('menu')) requested.add('menu');
    else if (normalized.includes('gallery') || normalized.includes('portfolio')) requested.add('gallery');
    else if (normalized.includes('blog') || normalized.includes('article')) requested.add('blog');
    else if (normalized.includes('pricing')) requested.add('pricing');
    else if (normalized.includes('faq')) requested.add('faq');
    else if (normalized.includes('team')) requested.add('team');
    else requested.add(normalized.replace(/_/g, '-'));
  }
  return requested;
}

function normalizeBusinessType(value?: string | null): ArchitectureBusinessType | null {
  const normalized = normalizeCategory(value);
  if (normalized === 'service') return 'services';
  if (normalized === 'product') return 'products';
  if (normalized === 'services' || normalized === 'products' || normalized === 'portfolio' || normalized === 'nonprofit' || normalized === 'other') {
    return normalized;
  }
  return null;
}

function inferBusinessType(category: string, description?: string | null): ArchitectureBusinessType {
  const text = normalizeCategory(`${category} ${description ?? ''}`);
  if (PRODUCT_CATEGORIES.has(category) || /\b(shop|store|ecommerce|product|sell|merch)\b/.test(text)) return 'products';
  if (PORTFOLIO_CATEGORIES.has(category) || /\b(portfolio|photographer|designer|artist|videographer|work)\b/.test(text)) return 'portfolio';
  if (NONPROFIT_CATEGORIES.has(category) || /\b(nonprofit|non profit|charity|association|foundation|church|community)\b/.test(text)) return 'nonprofit';
  if (FOOD_CATEGORIES.has(category) || /\b(restaurant|cafe|bar|bakery|menu|food)\b/.test(text)) return 'other';
  return 'services';
}

function inferCategory(description?: string | null, labels?: string[] | null): string {
  const text = normalizeCategory(`${description ?? ''} ${(labels ?? []).join(' ')}`);
  const checks: Array<[string, RegExp]> = [
    ['plumber', /\b(plumb|plumber|drain|pipe|water heater)\b/],
    ['electrical', /\b(electric|electrician|wiring|panel|breaker)\b/],
    ['hvac', /\b(hvac|heating|cooling|furnace|air conditioning)\b/],
    ['restaurant', /\b(restaurant|cafe|coffee|bar|bakery|food[_ ]truck|pizza|menu)\b/],
    ['salon', /\b(salon|spa|hair|nail|massage|esthetic)\b/],
    ['fitness', /\b(fitness|gym|coach|training|yoga|pilates)\b/],
    ['consulting', /\b(consult|advisor|agency|law|lawyer|accounting|professional)\b/],
    ['handmade', /\b(handmade|craft|ceramic|pottery|maker|studio|product)\b/],
    ['photographer', /\b(photo|photographer|portfolio)\b/],
    ['nonprofit', /\b(nonprofit|non[_ ]profit|charity|foundation|association|community)\b/],
    ['blog', /\b(blog|publication|newsletter|articles)\b/],
  ];
  return checks.find(([, pattern]) => pattern.test(text))?.[0] ?? 'general';
}

function normalizeCategory(value?: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function labelForCategory(category: string): string {
  const labels: Record<string, string> = {
    electrical: 'Electrician',
    hvac: 'HVAC',
    ecommerce: 'E-Commerce',
    handmade: 'Handmade',
    nonprofit: 'Non-Profit',
    realestate: 'Real Estate',
    restaurant: 'Restaurant',
    general: 'General',
  };
  return labels[category] ?? titleFromSlug(category.replace(/_/g, '-'));
}

function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Page';
}
