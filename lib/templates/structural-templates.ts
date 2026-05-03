import { getTemplatePreviewImage } from '@/lib/template-preview-assets';

export interface StructuralTemplateMetadata {
  id: string;
  template_id: string;
  name: string;
  description: string;
  category: string;
  business_type: string;
  palettes: Record<string, Record<string, string>>;
  customizables: Record<string, string[]>;
  thumbnail_url: string;
  multi_page: boolean;
  has_blog: boolean;
  has_gallery: boolean;
  created_at: string;
  updated_at: string;
  default_content: Record<string, unknown>;
}

const CREATED_AT = '2026-05-02T00:00:00.000Z';

const image = (id: string, width = 1400, height = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&h=${height}&q=80`;

const thumb = (id: string) => getTemplatePreviewImage(id) || image(id, 400, 300);

const block = (type: string, data: Record<string, unknown> = {}) => ({ type, data });

const navItem = (label: string, pageSlug: string) => ({
  label,
  linkType: 'page',
  pageSlug,
});

const customizables = {
  hero: ['title', 'subtitle', 'buttonText', 'variant', 'image', 'background'],
  cta: ['title', 'subtitle', 'buttonText'],
  servicesGrid: ['title', 'subtitle', 'items', 'ctaText'],
  testimonials: ['title', 'subtitle', 'variant', 'items'],
  stats: ['title', 'variant', 'items'],
  aboutImageText: ['title', 'description', 'image', 'items'],
  featuredQuote: ['variant', 'quote', 'personName', 'personTitle', 'people'],
  menu: ['menuTitle', 'menuSubtitle', 'variant'],
  booking: ['services', 'availability'],
  blog: ['title', 'subtitle', 'layout'],
  gallery: ['title', 'subtitle', 'images', 'columns'],
  estimateForm: ['title', 'description', 'variant', 'fields'],
  contact: ['title', 'subtitle', 'phone', 'email', 'address', 'hours'],
};

const ctaLink = { linkType: 'custom', href: '/contact' };
const bookingLink = { linkType: 'custom', href: '/booking' };

export const STRUCTURAL_TEMPLATE_STYLES = [
  'atlas',
  'editorial',
  'booked',
  'menu',
  'craft',
  'retro',
  'proof',
  'gallery',
] as const;

export const ALL_TEMPLATE_STYLES = [
  'luxe',
  'vivid',
  'airy',
  'edge',
  'classic',
  'organic',
  'sleek',
  'vibrant',
  ...STRUCTURAL_TEMPLATE_STYLES,
] as const;

export const STRUCTURAL_TEMPLATE_METADATA: StructuralTemplateMetadata[] = [
  {
    id: 'structural-atlas-general',
    template_id: 'atlas_general',
    name: 'Atlas',
    description: 'A structured B2B layout with metrics, proof, process, and a boardroom-grade CTA.',
    category: 'general',
    business_type: 'both',
    palettes: {
      Boardroom: { primary: '#172033', secondary: '#2f6f73', accent: '#f3f6f4' },
      Ledger: { primary: '#111827', secondary: '#b7791f', accent: '#f8fafc' },
      Signal: { primary: '#102a43', secondary: '#2563eb', accent: '#eff6ff' },
    },
    customizables,
    thumbnail_url: thumb('atlas'),
    multi_page: true,
    has_blog: false,
    has_gallery: false,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    default_content: {
      siteTitle: 'Atlas Advisory',
      titleFont: 'Space Grotesk',
      bodyFont: 'Inter',
      navButtonText: 'Book Strategy Call',
      headerBgType: 'white',
      headerLogoPosition: 'left',
      headerNavPosition: 'right',
      headerRightSide: 'cta',
      __navItems: [
        navItem('Home', 'home'),
        navItem('Services', 'services'),
        navItem('Contact', 'contact'),
      ],
      blocks: [
        block('hero', {
          variant: 'split',
          title: 'Operational clarity for complex teams',
          subtitle: 'Strategy, systems, and reporting for companies that need cleaner decisions and faster execution.',
          buttonText: 'Book Strategy Call',
          buttonTextLink: ctaLink,
          image: image('photo-1497366811353-6870744d04b2'),
          __customCss: '.hero-split { background: linear-gradient(180deg, var(--accent) 0%, #ffffff 100%) !important; } .hero-content { border-left: 6px solid var(--secondary); padding-left: 2rem; } .hero-title { letter-spacing: 0; } .hero-image { border-radius: 8px !important; box-shadow: 24px 24px 0 color-mix(in srgb, var(--secondary) 18%, white) !important; }',
        }),
        block('logoCloud', {
          title: 'Trusted by growth-stage teams, operators, and boards',
          variant: 'marquee',
          backgroundColor: '#ffffff',
        }),
        block('stats', {
          title: 'Measured momentum',
          variant: 'cards',
          backgroundColor: 'palette:accent',
          items: [
            { value: '37%', label: 'Faster reporting cycles' },
            { value: '$42M', label: 'Projects advised' },
            { value: '4.9/5', label: 'Client confidence' },
            { value: '90 days', label: 'Typical rollout' },
          ],
        }),
        block('servicesGrid', {
          title: 'Advisory lanes',
          subtitle: 'Clear engagements with defined outcomes, owners, and operating cadence.',
          backgroundColor: '#ffffff',
          ctaText: 'View full scope',
          items: [
            { title: 'Operating Model', description: 'Design decision rights, team rhythms, and handoff systems that scale.' },
            { title: 'Revenue Systems', description: 'Connect pipeline, customer success, finance, and delivery into one view.' },
            { title: 'Board Reporting', description: 'Translate activity into crisp metrics, risk notes, and next-step decisions.' },
            { title: 'Transformation Office', description: 'Prioritize change programs and keep teams moving without drift.' },
          ],
        }),
        block('carousel', {
          title: 'How engagements move',
          variant: 'slides',
          autoPlay: true,
          interval: 6,
          backgroundColor: 'palette:accent',
          items: [
            { mediaType: 'icon', icon: 'Search', title: 'Diagnose the operating drag', text: 'We map the decisions, systems, and handoffs that slow teams down.' },
            { mediaType: 'icon', icon: 'Target', title: 'Set the operating spine', text: 'We define the cadence, reporting, owners, and decision forums.' },
            { mediaType: 'icon', icon: 'TrendingUp', title: 'Install the rhythm', text: 'We implement lightweight tools and weekly habits that keep momentum visible.' },
          ],
        }),
        block('featuredQuote', {
          variant: 'essay',
          eyebrow: 'Case Note',
          title: 'From stalled initiatives to a single operating rhythm',
          quote: 'Atlas helped us turn a noisy transformation program into a manageable set of weekly decisions. The biggest shift was not another dashboard. It was knowing exactly who owned the next move.',
          personName: 'Maya Chen',
          personTitle: 'COO, Northline Software',
          personContext: 'Private-market SaaS operations',
          imagePosition: 'right',
          personImage: image('photo-1556761175-b413da4baf72'),
          backgroundColor: 'palette:primary',
          __customCss: 'section { color: white; } h2, p { color: white !important; }',
        }),
        block('cta', {
          title: 'Ready to make the next quarter less ambiguous?',
          subtitle: 'Start with a focused strategy call and leave with a practical operating map.',
          buttonText: 'Book Strategy Call',
          buttonTextLink: ctaLink,
          backgroundColor: 'palette:secondary',
          showPattern: true,
        }),
      ],
      extra_pages: [
        {
          slug: 'services',
          title: 'Services',
          display_name: 'Services',
          is_visible_in_nav: true,
          blocks: [
            block('pricing', {
              title: 'Engagement options',
              subtitle: 'Pick the structure that matches your operating challenge.',
              variant: 'simple',
              tiers: [
                { name: 'Diagnostic Sprint', price: '$4.5k', period: '', description: 'Two-week operating assessment.', features: ['Stakeholder interviews', 'System map', 'Priority roadmap'], highlighted: false, buttonText: 'Start Sprint' },
                { name: 'Operating System Build', price: '$12k', period: '', description: 'Six-week implementation engagement.', features: ['Cadence design', 'Metrics model', 'Leadership rollout'], highlighted: true, buttonText: 'Plan Build' },
                { name: 'Fractional Ops Partner', price: 'Custom', period: '', description: 'Ongoing strategic operations support.', features: ['Monthly leadership sessions', 'Board reporting', 'Change program support'], highlighted: false, buttonText: 'Talk Details' },
              ],
            }),
            block('resources', {
              title: 'Decision resources',
              subtitle: 'Useful tools for evaluating operational readiness.',
              variant: 'list',
              items: [
                { id: 'atlas-r1', type: 'text', title: 'Operating Cadence Checklist', description: 'A quick readiness scan for leadership teams.', body: 'Use this checklist to review meeting rhythm, decision rights, KPI ownership, and escalation paths before starting a new change program.' },
                { id: 'atlas-r2', type: 'link', title: 'Board Metrics Primer', description: 'A simple guide for building a sharper operating packet.', url: 'https://example.com', openInNewTab: true },
              ],
            }),
          ],
        },
        {
          slug: 'contact',
          title: 'Contact',
          display_name: 'Contact',
          is_visible_in_nav: true,
          blocks: [
            block('contact_form', {
              title: 'Start the conversation',
              description: 'Tell us what is stuck and what needs to be clearer.',
              submitText: 'Request Strategy Call',
              successMessage: 'Thanks. We will follow up with next steps shortly.',
            }),
          ],
        },
      ],
    },
  },
  {
    id: 'structural-editorial-general',
    template_id: 'editorial_general',
    name: 'Editorial',
    description: 'A magazine-style, content-first template for experts, publications, and thought leaders.',
    category: 'general',
    business_type: 'both',
    palettes: {
      Ink: { primary: '#18110f', secondary: '#b91c1c', accent: '#f7f1e8' },
      Broadsheet: { primary: '#111827', secondary: '#5b6b2b', accent: '#f4f1ea' },
      Column: { primary: '#1f2937', secondary: '#7c3aed', accent: '#f8fafc' },
    },
    customizables,
    thumbnail_url: thumb('editorial'),
    multi_page: true,
    has_blog: true,
    has_gallery: false,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    default_content: {
      siteTitle: 'The Keystone Review',
      titleFont: 'Libre Baskerville',
      bodyFont: 'Source Sans 3',
      navButtonText: 'Subscribe',
      headerBgType: 'white',
      headerLogoPosition: 'above',
      headerNavPosition: 'center',
      headerRightSide: 'none',
      headerShowBanner: true,
      headerBannerText: 'New essays every Thursday',
      headerBannerBgType: 'primary',
      __navItems: [
        navItem('Home', 'home'),
        navItem('Articles', 'articles'),
        navItem('About', 'about'),
      ],
      blocks: [
        block('hero', {
          variant: 'minimal',
          showButton: false,
          title: 'Ideas for people building what comes next',
          subtitle: 'Sharp essays, interviews, and field notes for founders, operators, and independent brands.',
          backgroundColor: 'palette:accent',
          __customCss: 'section { border-bottom: 1px solid var(--primary); } .hero-container { max-width: 72rem !important; } .hero-title { text-transform: uppercase; font-weight: 900; } .hero-footer { border-top: 1px solid var(--primary); padding-top: 2rem; }',
        }),
        block('resources', {
          title: 'Featured desk',
          subtitle: 'Start with the current issue.',
          variant: 'grid',
          backgroundColor: '#ffffff',
          items: [
            { id: 'ed-r1', type: 'text', title: 'The New Local Advantage', description: 'Why small teams can now out-publish larger competitors.', body: 'The strongest local brands are not louder. They are more specific. They publish with a point of view, tell customers what they believe, and make trust easier to evaluate.' },
            { id: 'ed-r2', type: 'text', title: 'Designing for Repeat Attention', description: 'A note on rhythm, voice, and useful constraints.', body: 'The best editorial systems are built around repeatable sections: a lead story, a field note, a quote, and a clear next action.' },
            { id: 'ed-r3', type: 'link', title: 'Interview Archive', description: 'Conversations with builders and independent operators.', url: 'https://example.com', openInNewTab: true },
          ],
        }),
        block('featuredQuote', {
          variant: 'minimal',
          quote: 'A useful publication does not try to sound big. It earns attention by being clear, specific, and unusually helpful.',
          personName: 'Elena Morris',
          personTitle: 'Editor in Chief',
          backgroundColor: 'palette:primary',
          __customCss: 'section { color: var(--accent); } p { color: var(--accent) !important; }',
        }),
        block('blog', {
          title: 'Latest essays',
          subtitle: 'Notes, interviews, and practical criticism.',
          layout: 'magazine',
          postsPerPage: 4,
        }),
        block('team', {
          title: 'Byline',
          variant: 'minimal',
          showBio: true,
          members: [
            { name: 'Avery Stone', role: 'Editor', bio: 'Writes about practical brand systems, local commerce, and useful websites.' },
            { name: 'Nora Bell', role: 'Contributor', bio: 'Covers interviews, independent media, and customer research.' },
          ],
        }),
        block('cta', {
          title: 'Get the next issue',
          subtitle: 'A concise editorial dispatch for builders who prefer signal over noise.',
          buttonText: 'Subscribe',
          backgroundColor: 'palette:secondary',
          showPattern: false,
        }),
      ],
      extra_pages: [
        {
          slug: 'articles',
          title: 'Articles',
          display_name: 'Articles',
          is_visible_in_nav: true,
          blocks: [
            block('blog', {
              title: 'All articles',
              subtitle: 'Browse essays, interviews, and field notes.',
              layout: 'list',
              postsPerPage: 9,
            }),
          ],
        },
        {
          slug: 'about',
          title: 'About',
          display_name: 'About',
          is_visible_in_nav: true,
          blocks: [
            block('aboutImageText', {
              title: 'Built like a small magazine',
              description: 'Editorial is designed for knowledge-led brands that need reading paths, not just landing-page sections.',
              imagePosition: 'right',
              variant: 'tall',
              image: image('photo-1497366754035-f200968a6e72'),
              items: ['Recurring columns', 'Author-forward sections', 'Newsletter CTA', 'Flexible archives'],
            }),
          ],
        },
      ],
    },
  },
  {
    id: 'structural-booked-general',
    template_id: 'booked_general',
    name: 'Booked',
    description: 'An appointment-first layout for clinics, salons, tutors, therapists, and consultants.',
    category: 'general',
    business_type: 'services',
    palettes: {
      Calm: { primary: '#263238', secondary: '#0f9f8f', accent: '#eef8f6' },
      Clinic: { primary: '#1e3a5f', secondary: '#3b82f6', accent: '#eff6ff' },
      Salon: { primary: '#3b2232', secondary: '#d977a8', accent: '#fff1f6' },
    },
    customizables,
    thumbnail_url: thumb('booked'),
    multi_page: true,
    has_blog: false,
    has_gallery: false,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    default_content: {
      siteTitle: 'Booked Studio',
      titleFont: 'Nunito',
      bodyFont: 'Nunito',
      navButtonText: 'Book Now',
      headerBgType: 'white',
      headerLogoPosition: 'left',
      headerNavPosition: 'right',
      headerRightSide: 'cta',
      __navItems: [
        navItem('Home', 'home'),
        navItem('Services', 'services'),
        navItem('Book', 'booking'),
      ],
      blocks: [
        block('hero', {
          variant: 'centered',
          bgType: 'color',
          backgroundColor: 'palette:accent',
          title: 'Book the right appointment in minutes',
          subtitle: 'A calm, practical layout for service providers who want visitors to schedule without friction.',
          buttonText: 'Book Now',
          buttonTextLink: bookingLink,
          __customCss: 'section { border-bottom: 1px solid color-mix(in srgb, var(--secondary) 18%, white); } .hero-title { color: var(--primary) !important; } .hero-subtitle { color: color-mix(in srgb, var(--primary) 76%, white) !important; } .hero-button { background: var(--secondary) !important; color: white !important; border-radius: 14px !important; } .hero-decoration { display: none; }',
        }),
        block('booking', {}),
        block('servicesGrid', {
          title: 'Choose your visit',
          subtitle: 'Clear service paths help visitors know exactly what to book.',
          backgroundColor: '#ffffff',
          items: [
            { title: 'Initial Consultation', description: 'A focused first appointment to understand goals, timing, and fit.' },
            { title: 'Follow-Up Session', description: 'Ongoing support with a familiar provider and consistent plan.' },
            { title: 'Specialist Service', description: 'A dedicated appointment for a specific concern, treatment, or milestone.' },
          ],
        }),
        block('carousel', {
          title: 'What happens next',
          variant: 'minimal',
          backgroundColor: 'palette:accent',
          items: [
            { mediaType: 'icon', icon: 'Calendar', title: 'Pick a time', text: 'Choose a service and availability that works with your schedule.' },
            { mediaType: 'icon', icon: 'Mail', title: 'Confirm details', text: 'Receive confirmation with the practical information you need.' },
            { mediaType: 'icon', icon: 'Heart', title: 'Arrive prepared', text: 'Your provider starts with context so the visit feels focused.' },
          ],
        }),
        block('testimonials', {
          title: 'Clients feel taken care of',
          variant: 'single',
          backgroundColor: '#ffffff',
          items: [
            { name: 'Jordan P.', role: 'Returning Client', quote: 'The booking process was simple, the reminders were clear, and the appointment started right on time.', rating: 5 },
          ],
        }),
        block('cta', {
          title: 'Ready when your calendar is',
          subtitle: 'Book the next available appointment or request a time that works better.',
          buttonText: 'Book Now',
          buttonTextLink: bookingLink,
          backgroundColor: 'palette:secondary',
          showPattern: true,
        }),
      ],
      extra_pages: [
        {
          slug: 'services',
          title: 'Services',
          display_name: 'Services',
          is_visible_in_nav: true,
          blocks: [
            block('pricing', {
              title: 'Service menu',
              subtitle: 'Simple appointment types with clear expectations.',
              variant: 'simple',
              tiers: [
                { name: 'Consultation', price: '$95', period: '', description: 'First visit or discovery call.', features: ['45 minutes', 'Care plan', 'Follow-up notes'], highlighted: true, buttonText: 'Book Consultation' },
                { name: 'Follow-Up', price: '$75', period: '', description: 'Ongoing support session.', features: ['30 minutes', 'Progress review', 'Next steps'], highlighted: false, buttonText: 'Book Follow-Up' },
              ],
            }),
            block('faq', {
              title: 'Before you book',
              subtitle: 'Answers to the questions visitors ask before scheduling.',
              items: [
                { question: 'Can I reschedule?', answer: 'Yes. Rescheduling details can be shared in your confirmation flow.' },
                { question: 'Do you offer virtual appointments?', answer: 'This template supports service details for in-person or virtual visits.' },
                { question: 'What should I bring?', answer: 'Use this section to explain preparation, forms, or arrival details.' },
              ],
            }),
          ],
        },
        {
          slug: 'booking',
          title: 'Book',
          display_name: 'Book',
          is_visible_in_nav: true,
          blocks: [block('booking', {})],
        },
      ],
    },
  },
  {
    id: 'structural-menu-general',
    template_id: 'menu_general',
    name: 'Menu',
    description: 'A restaurant and cafe layout where menu, ordering, hours, and location carry the page.',
    category: 'general',
    business_type: 'services',
    palettes: {
      Bistro: { primary: '#241812', secondary: '#d97706', accent: '#fff7ed' },
      Nori: { primary: '#10231f', secondary: '#f97316', accent: '#f4f1e8' },
      Night: { primary: '#111111', secondary: '#ef4444', accent: '#f8fafc' },
    },
    customizables,
    thumbnail_url: thumb('menu'),
    multi_page: true,
    has_blog: false,
    has_gallery: true,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    default_content: {
      siteTitle: 'Corner Table',
      titleFont: 'Playfair Display',
      bodyFont: 'Lato',
      navButtonText: 'Reserve',
      headerBgType: 'transparent',
      headerOverlay: true,
      headerLogoPosition: 'left',
      headerNavPosition: 'right',
      headerRightSide: 'cta',
      __navItems: [
        navItem('Home', 'home'),
        navItem('Menu', 'menu'),
        navItem('Visit', 'visit'),
      ],
      blocks: [
        block('hero', {
          variant: 'fullImage',
          title: 'A neighborhood table with a seasonal menu',
          subtitle: 'Small plates, fresh pasta, and a dining room built for unhurried evenings.',
          buttonText: 'View Menu',
          image: image('photo-1517248135467-4c7edcad34c4'),
          __customCss: '.hero-container { text-align: left !important; margin-left: max(1rem, calc((100vw - 72rem) / 2)) !important; margin-right: auto !important; } .hero-title, .hero-subtitle { max-width: 42rem; } .hero-button { border-radius: 8px !important; } .hero-overlay { background: linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.2)) !important; }',
        }),
        block('menu', {
          menuTitle: 'Menu highlights',
          menuSubtitle: 'Browse brunch, dinner, and drinks by section.',
          variant: 'cards',
          showPrices: true,
          showDescriptions: true,
          showImages: true,
          showMenuTabs: true,
          categoryStyle: 'badge',
          backgroundColor: 'palette:accent',
        }),
        block('gallery', {
          title: 'From the kitchen',
          subtitle: 'Food, light, and a little Friday-night energy.',
          columns: 4,
          backgroundColor: '#ffffff',
          images: [
            image('photo-1504674900247-0877df9cc836'),
            image('photo-1473093295043-cdd812d0e601'),
            image('photo-1546069901-ba9599a7e63c'),
            image('photo-1488477181946-6428a0291777'),
          ],
        }),
        block('deliveryLinks', {
          title: 'Order for pickup or delivery',
          subtitle: 'Enable your delivery partners or add a custom ordering link.',
          backgroundColor: 'palette:primary',
          links: [
            { id: 'order-custom', platform: 'custom', label: 'Order Online', url: 'https://example.com', enabled: true },
            { id: 'order-uber', platform: 'ubereats', label: 'Uber Eats', url: '', enabled: false },
            { id: 'order-door', platform: 'doordash', label: 'DoorDash', url: '', enabled: false },
          ],
        }),
        block('contact', {
          title: 'Hours and location',
          subtitle: 'Reserve, walk in, or call ahead.',
          phone: '(555) 321-8844',
          email: 'hello@cornertable.example',
          address: '88 Market Street, Your City',
          hours: 'Tue-Sun: 5pm-10pm | Brunch Sat-Sun: 10am-2pm',
          backgroundColor: 'palette:accent',
        }),
      ],
      extra_pages: [
        {
          slug: 'menu',
          title: 'Menu',
          display_name: 'Menu',
          is_visible_in_nav: true,
          blocks: [
            block('menu', {
              menuTitle: 'Full menu',
              menuSubtitle: 'Manage items, categories, prices, and photos from Admin.',
              variant: 'list',
              showPrices: true,
              showDescriptions: true,
              showMenuTabs: true,
              categoryStyle: 'divider',
            }),
          ],
        },
        {
          slug: 'visit',
          title: 'Visit',
          display_name: 'Visit',
          is_visible_in_nav: true,
          blocks: [
            block('contact', {
              title: 'Visit us',
              subtitle: 'Hours, phone, email, and location.',
              phone: '(555) 321-8844',
              email: 'hello@cornertable.example',
              address: '88 Market Street, Your City',
              hours: 'Tue-Sun: 5pm-10pm | Brunch Sat-Sun: 10am-2pm',
            }),
            block('map', { title: 'Find us', address: '88 Market Street, Your City' }),
          ],
        },
      ],
    },
  },
  {
    id: 'structural-craft-general',
    template_id: 'craft_general',
    name: 'Craft',
    description: 'A warm handmade/local template with story, product showcase, soft cards, and community trust.',
    category: 'general',
    business_type: 'both',
    palettes: {
      Clay: { primary: '#3b2a20', secondary: '#c46a3a', accent: '#fff4e8' },
      Sage: { primary: '#2f3d2e', secondary: '#789461', accent: '#f3f0df' },
      Wool: { primary: '#392f2a', secondary: '#a16207', accent: '#fbf4ea' },
    },
    customizables,
    thumbnail_url: thumb('craft'),
    multi_page: true,
    has_blog: false,
    has_gallery: true,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    default_content: {
      siteTitle: 'Marlow Made',
      titleFont: 'Fraunces',
      bodyFont: 'Karla',
      navButtonText: 'Shop Local',
      headerBgType: 'white',
      headerLogoPosition: 'left',
      headerNavPosition: 'center',
      headerRightSide: 'cta',
      __navItems: [
        navItem('Home', 'home'),
        navItem('Story', 'story'),
        navItem('Shop', 'shop'),
      ],
      blocks: [
        block('hero', {
          variant: 'split',
          title: 'Small-batch goods with a human hand',
          subtitle: 'Warm, tactile, locally made pieces for homes that prefer character over sameness.',
          buttonText: 'Shop Local',
          image: image('photo-1452860606245-08befc0ff44b'),
          __customCss: '.hero-split { background: var(--accent) !important; overflow: hidden; } .hero-container { position: relative; } .hero-container:before { content: ""; position: absolute; width: 240px; height: 240px; border-radius: 999px; background: color-mix(in srgb, var(--secondary) 24%, white); left: -80px; top: -40px; z-index: 0; } .hero-content, .hero-container > div { position: relative; z-index: 1; } .hero-image { border-radius: 44% 56% 54% 46% !important; box-shadow: -18px 18px 0 color-mix(in srgb, var(--secondary) 42%, white) !important; } .hero-button { border-radius: 999px !important; }',
        }),
        block('carousel', {
          title: 'Made in small runs',
          subtitle: 'A showcase that feels closer to a market table than a product grid.',
          variant: 'slides',
          backgroundColor: '#ffffff',
          items: [
            { mediaType: 'image', image: image('photo-1528756514091-dee5ecaa3278'), title: 'Ceramic tableware', text: 'Hand-thrown forms with subtle glaze variation.' },
            { mediaType: 'image', image: image('photo-1452860606245-08befc0ff44b'), title: 'Textiles and soft goods', text: 'Natural fibers, limited batches, and careful finishing.' },
            { mediaType: 'image', image: image('photo-1513519245088-0e12902e5a38'), title: 'Custom commissions', text: 'Collaborative pieces for homes, gifts, and local spaces.' },
          ],
        }),
        block('aboutImageText', {
          title: 'The story stays visible',
          description: 'Craft is built for founders, makers, growers, and local shops that need the person behind the work to matter.',
          imagePosition: 'right',
          variant: 'tall',
          image: image('photo-1528756514091-dee5ecaa3278'),
          backgroundColor: 'palette:accent',
          items: ['Made locally', 'Limited batches', 'Natural materials', 'Custom orders welcome'],
          __customCss: 'img { border-radius: 28px !important; }',
        }),
        block('featuredQuote', {
          variant: 'essay',
          eyebrow: 'Founder Note',
          title: 'Every piece should feel like it came from somewhere',
          quote: 'I started making these pieces because I wanted everyday objects to feel less anonymous. The marks, the small variations, the human edges are the point.',
          personName: 'Marlow Finch',
          personTitle: 'Founder and maker',
          personContext: 'Working from a neighborhood studio',
          personImage: image('photo-1508214751196-bcfd4ca60f91'),
          backgroundColor: 'palette:primary',
          __customCss: 'section, h2, p { color: var(--accent) !important; } img { border-radius: 28px !important; }',
        }),
        block('gallery', {
          title: 'Studio fragments',
          subtitle: 'Materials, shelves, finished work, and market days.',
          columns: 3,
          backgroundColor: '#ffffff',
          images: [
            image('photo-1528756514091-dee5ecaa3278'),
            image('photo-1452860606245-08befc0ff44b'),
            image('photo-1513519245088-0e12902e5a38'),
            image('photo-1508214751196-bcfd4ca60f91'),
            image('photo-1524758631624-e2822e304c36'),
            image('photo-1500530855697-b586d89ba3ee'),
          ],
        }),
        block('testimonials', {
          title: 'From the community',
          subtitle: 'Kind words from customers, neighbors, and repeat gift-givers.',
          variant: 'cards',
          backgroundColor: 'palette:accent',
          items: [
            { name: 'Leah W.', role: 'Local Customer', quote: 'It feels special without feeling precious. Exactly what I wanted for our home.', rating: 5 },
            { name: 'Tomas R.', role: 'Cafe Owner', quote: 'The custom pieces made our space feel immediately more personal.', rating: 5 },
            { name: 'Nina S.', role: 'Gift Buyer', quote: 'Beautifully made, wrapped with care, and clearly not mass produced.', rating: 5 },
          ],
        }),
        block('cta', {
          title: 'Find a piece with a story',
          subtitle: 'Browse the current batch, ask about commissions, or visit the next market.',
          buttonText: 'Shop Local',
          backgroundColor: 'palette:secondary',
          showPattern: true,
        }),
      ],
      extra_pages: [
        {
          slug: 'story',
          title: 'Story',
          display_name: 'Story',
          is_visible_in_nav: true,
          blocks: [
            block('aboutImageText', {
              title: 'A studio before a storefront',
              description: 'Use this page for founder story, process, sourcing, and local partnerships.',
              imagePosition: 'left',
              variant: 'square',
              image: image('photo-1528756514091-dee5ecaa3278'),
              items: ['Studio process', 'Sourcing philosophy', 'Community markets', 'Care instructions'],
            }),
          ],
        },
        {
          slug: 'shop',
          title: 'Shop',
          display_name: 'Shop',
          is_visible_in_nav: true,
          blocks: [
            block('productGrid', { variant: 'gridWithSidebar' }),
          ],
        },
      ],
    },
  },
  {
    id: 'structural-retro-general',
    template_id: 'retro_general',
    name: 'Retro',
    description: 'A playful nostalgic/Y2K layout with chunky breaks, stickers, offset panels, and punchy CTAs.',
    category: 'general',
    business_type: 'both',
    palettes: {
      Arcade: { primary: '#151515', secondary: '#ff4fd8', accent: '#fff04f' },
      Bubble: { primary: '#202124', secondary: '#00a6ff', accent: '#fffbeb' },
      Sticker: { primary: '#241b35', secondary: '#f97316', accent: '#ecfccb' },
    },
    customizables,
    thumbnail_url: thumb('retro'),
    multi_page: true,
    has_blog: false,
    has_gallery: true,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    default_content: {
      siteTitle: 'Pixel Pop',
      titleFont: 'Space Grotesk',
      bodyFont: 'DM Sans',
      navButtonText: 'Start Something',
      headerBgType: 'primary',
      headerLogoPosition: 'left',
      headerNavPosition: 'right',
      headerRightSide: 'cta',
      headerShowBanner: true,
      headerBannerText: 'Limited drops, loud ideas, good chaos.',
      headerBannerBgType: 'secondary',
      __navItems: [
        navItem('Home', 'home'),
        navItem('Drops', 'drops'),
        navItem('Contact', 'contact'),
      ],
      blocks: [
        block('hero', {
          variant: 'centered',
          bgType: 'color',
          backgroundColor: 'palette:accent',
          title: 'Make the internet fun again',
          subtitle: 'A bold starter layout for pop-ups, creators, youth brands, events, and playful campaigns.',
          buttonText: 'Start Something',
          __customCss: 'section { border-top: 4px solid var(--primary); border-bottom: 4px solid var(--primary); } .hero-title { color: var(--primary) !important; text-shadow: 4px 4px 0 var(--secondary); } .hero-subtitle { color: var(--primary) !important; font-weight: 800; } .hero-button { background: var(--primary) !important; color: var(--accent) !important; border: 3px solid var(--primary); border-radius: 4px !important; box-shadow: 6px 6px 0 var(--secondary) !important; } .hero-decoration { display: none; }',
        }),
        block('tabBar', {
          tabStyle: 'buttons',
          tabAlign: 'stretch',
          activeColor: 'palette:primary',
          bgColor: 'palette:secondary',
          items: [
            { id: 'retro-tab-1', label: 'Drops', linkType: 'section', href: '#drops' },
            { id: 'retro-tab-2', label: 'Events', linkType: 'section', href: '#events' },
            { id: 'retro-tab-3', label: 'Fan Club', linkType: 'section', href: '#fan-club' },
          ],
        }),
        block('carousel', {
          title: 'What we make',
          subtitle: 'Chunky cards, clear offers, and motion without losing the plot.',
          variant: 'cards',
          backgroundColor: '#ffffff',
          items: [
            { mediaType: 'icon', icon: 'Zap', title: 'Launch pages', text: 'Fast, loud pages for launches, drops, and campaigns.' },
            { mediaType: 'icon', icon: 'Music', title: 'Event energy', text: 'Sections for schedules, guests, recaps, and ticket pushes.' },
            { mediaType: 'icon', icon: 'Palette', title: 'Brand play', text: 'A visual system that feels expressive while staying usable.' },
            { mediaType: 'icon', icon: 'Heart', title: 'Community hooks', text: 'Badges, quotes, and CTAs that invite people in.' },
          ],
          __customCss: 'section { border-bottom: 4px solid var(--primary); } .rounded-2xl { border-radius: 6px !important; border: 3px solid var(--primary) !important; box-shadow: 8px 8px 0 var(--accent) !important; }',
        }),
        block('featuredQuote', {
          variant: 'multiGrid',
          title: 'Sticker-wall proof',
          backgroundColor: 'palette:accent',
          people: [
            { name: 'Jules', title: 'Pop-up organizer', quote: 'It finally felt like our brand had a pulse.' },
            { name: 'Sam', title: 'Creator', quote: 'Loud in the right way, and still simple to navigate.' },
            { name: 'Mina', title: 'Studio lead', quote: 'The sections made campaign updates painless.' },
          ],
          __customCss: 'section { border-bottom: 4px solid var(--primary); }',
        }),
        block('events', {
          title: 'Upcoming moments',
          subtitle: 'Use events for launches, parties, workshops, and community dates.',
          sortOrder: 'asc',
          showPast: false,
          backgroundColor: 'palette:accent',
        }),
        block('cta', {
          title: 'Got a weird idea?',
          subtitle: 'Good. This template is built for brands that need more personality than polish.',
          buttonText: 'Start Something',
          backgroundColor: 'palette:secondary',
          showPattern: false,
          __customCss: 'section { border-top: 4px solid var(--primary); border-bottom: 4px solid var(--primary); } a, button { border-radius: 4px !important; box-shadow: 6px 6px 0 var(--primary) !important; }',
        }),
      ],
      extra_pages: [
        {
          slug: 'drops',
          title: 'Drops',
          display_name: 'Drops',
          is_visible_in_nav: true,
          blocks: [
            block('productGrid', { variant: 'grid' }),
            block('gallery', {
              title: 'Past drops',
              subtitle: 'A punchy archive for launches and campaign shots.',
              columns: 4,
              images: [
                image('photo-1518005020951-eccb494ad742'),
                image('photo-1520453803296-c39eabe2dab4'),
                image('photo-1492684223066-81342ee5ff30'),
                image('photo-1533174072545-7a4b6ad7a6c3'),
              ],
            }),
          ],
        },
        {
          slug: 'contact',
          title: 'Contact',
          display_name: 'Contact',
          is_visible_in_nav: true,
          blocks: [
            block('contact_form', {
              title: 'Send the idea',
              description: 'Tell us what you want to launch, announce, or turn into a thing.',
              submitText: 'Send It',
              successMessage: 'Got it. We will reply soon.',
            }),
          ],
        },
      ],
    },
  },
  {
    id: 'structural-proof-general',
    template_id: 'proof_general',
    name: 'Proof',
    description: 'A credibility-first template for trust-heavy services, with reviews, stats, guarantees, and intake.',
    category: 'general',
    business_type: 'services',
    palettes: {
      Trust: { primary: '#0f172a', secondary: '#15803d', accent: '#f0fdf4' },
      Legal: { primary: '#1f2937', secondary: '#b45309', accent: '#fffbeb' },
      Clinical: { primary: '#123447', secondary: '#0284c7', accent: '#eef8ff' },
    },
    customizables,
    thumbnail_url: thumb('proof'),
    multi_page: true,
    has_blog: false,
    has_gallery: true,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    default_content: {
      siteTitle: 'Proof Partners',
      titleFont: 'Merriweather',
      bodyFont: 'Source Sans 3',
      navButtonText: 'Request Review',
      headerBgType: 'white',
      headerLogoPosition: 'left',
      headerNavPosition: 'right',
      headerRightSide: 'cta',
      headerShowBanner: true,
      headerBannerText: 'Licensed, insured, and reviewed by local clients.',
      headerBannerBgType: 'primary',
      __navItems: [
        navItem('Home', 'home'),
        navItem('Results', 'results'),
        navItem('Estimate', 'estimate'),
      ],
      blocks: [
        block('hero', {
          variant: 'video',
          title: 'Trust is the first conversion',
          subtitle: 'A credibility-led layout for businesses where proof, reviews, and risk reversal matter.',
          buttonText: 'Request Review',
          image: image('photo-1450101499163-c8848c66ca85'),
          __customCss: '.hero-overlay { background: color-mix(in srgb, var(--primary) 72%, transparent) !important; } .hero-button { border-radius: 8px !important; }',
        }),
        block('logoCloud', {
          title: 'Certifications, partners, and local recognition',
          variant: 'grid',
          backgroundColor: 'palette:accent',
        }),
        block('stats', {
          title: 'Results visitors can scan',
          variant: 'banner',
          backgroundColor: 'palette:primary',
          items: [
            { value: '4.9/5', label: 'Average rating' },
            { value: '1,200+', label: 'Jobs completed' },
            { value: '24 hr', label: 'Response window' },
            { value: '100%', label: 'Written estimates' },
          ],
        }),
        block('featuredQuote', {
          variant: 'multiGrid',
          title: 'Real words, specific outcomes',
          backgroundColor: '#ffffff',
          people: [
            { name: 'Alicia M.', title: 'Homeowner', quote: 'They explained the options, documented the work, and followed up after completion.' },
            { name: 'Grant L.', title: 'Business Owner', quote: 'Clear estimate, clean process, and exactly the result they promised.' },
            { name: 'Priya S.', title: 'Client', quote: 'The guarantee was not just copy. They stood behind the work.' },
          ],
        }),
        block('aboutImageText', {
          title: 'The guarantee belongs near the proof',
          description: 'Use this section to explain licensing, insurance, warranties, certifications, and what happens if something is not right.',
          imagePosition: 'left',
          variant: 'square',
          image: image('photo-1554224155-6726b3ff858f'),
          backgroundColor: 'palette:accent',
          items: ['Licensed and insured', 'Written scope before work begins', 'Documented process', 'Satisfaction follow-up'],
        }),
        block('estimateForm', {
          title: 'Get a reviewed estimate',
          description: 'Collect the details needed to qualify, scope, and respond quickly.',
          submitText: 'Request Review',
          successMessage: 'Thanks. We will review your request and respond shortly.',
          variant: 'calculator',
          pricingEnabled: true,
          pricingBasePrice: 25000,
          pricingCurrency: 'USD',
          pricingRangeSpread: 0.2,
          pricingDisclaimer: 'This range is an initial estimate. Final pricing depends on scope, access, and site conditions.',
          showAddress: true,
          showPreferredDate: true,
          fields: [
            { id: 'proof-field-service', label: 'Service type', type: 'select', required: true, options: ['Inspection', 'Repair', 'Installation', 'Consultation'] },
            { id: 'proof-field-size', label: 'Approximate scope', type: 'select', required: true, options: ['Small', 'Medium', 'Large'] },
            { id: 'proof-field-urgency', label: 'Urgency', type: 'select', required: false, options: ['Flexible', 'This week', 'Emergency'] },
          ],
        }),
        block('faq', {
          title: 'Questions that reduce risk',
          subtitle: 'Answer objections before visitors need to ask.',
          items: [
            { question: 'Are estimates written?', answer: 'Yes. Use this answer to explain your estimate and approval process.' },
            { question: 'What credentials do you hold?', answer: 'List licenses, certifications, memberships, or insurance details here.' },
            { question: 'What is guaranteed?', answer: 'Explain warranty, follow-up, and risk-reversal details in plain language.' },
          ],
        }),
        block('cta', {
          title: 'Make the next step feel safe',
          subtitle: 'Invite visitors into a clear, low-risk process.',
          buttonText: 'Request Review',
          backgroundColor: 'palette:secondary',
          showPattern: true,
        }),
      ],
      extra_pages: [
        {
          slug: 'results',
          title: 'Results',
          display_name: 'Results',
          is_visible_in_nav: true,
          blocks: [
            block('gallery', {
              title: 'Before, after, and finished work',
              subtitle: 'Use gallery images for proof-heavy visual evidence.',
              columns: 3,
              images: [
                image('photo-1450101499163-c8848c66ca85'),
                image('photo-1554224155-6726b3ff858f'),
                image('photo-1503387762-592deb58ef4e'),
              ],
            }),
            block('testimonials', {
              title: 'More client proof',
              variant: 'cards',
              items: [
                { name: 'Morgan R.', role: 'Verified Client', quote: 'The process was clear from the first call.', rating: 5 },
                { name: 'Dana T.', role: 'Verified Client', quote: 'Every commitment was documented and met.', rating: 5 },
                { name: 'Chris V.', role: 'Verified Client', quote: 'Professional, careful, and easy to trust.', rating: 5 },
              ],
            }),
          ],
        },
        {
          slug: 'estimate',
          title: 'Estimate',
          display_name: 'Estimate',
          is_visible_in_nav: true,
          blocks: [
            block('estimateForm', {
              title: 'Request an estimate',
              description: 'Share details and get a clear next step.',
              submitText: 'Request Estimate',
              variant: 'simple',
              fields: [
                { id: 'estimate-service', label: 'Service needed', type: 'text', required: true },
                { id: 'estimate-timeframe', label: 'Timeframe', type: 'select', required: false, options: ['Flexible', 'This month', 'Urgent'] },
              ],
            }),
          ],
        },
      ],
    },
  },
  {
    id: 'structural-gallery-general',
    template_id: 'gallery_general',
    name: 'Gallery',
    description: 'An image-first portfolio template with large visuals, project spotlights, and minimal text.',
    category: 'general',
    business_type: 'portfolio',
    palettes: {
      Frame: { primary: '#111111', secondary: '#9ca3af', accent: '#f6f5f2' },
      Atelier: { primary: '#202020', secondary: '#8b5cf6', accent: '#fafafa' },
      Mono: { primary: '#0f172a', secondary: '#64748b', accent: '#f8fafc' },
    },
    customizables,
    thumbnail_url: thumb('gallery'),
    multi_page: true,
    has_blog: false,
    has_gallery: true,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    default_content: {
      siteTitle: 'Northlight Studio',
      titleFont: 'Sora',
      bodyFont: 'Inter',
      navButtonText: 'Inquire',
      headerBgType: 'transparent',
      headerOverlay: true,
      headerLogoPosition: 'left',
      headerNavPosition: 'right',
      headerRightSide: 'cta',
      __navItems: [
        navItem('Home', 'home'),
        navItem('Portfolio', 'portfolio'),
        navItem('Inquire', 'inquire'),
      ],
      blocks: [
        block('hero', {
          variant: 'centered',
          bgType: 'carousel',
          bgCarouselImages: [
            image('photo-1492691527719-9d1e07e534b4'),
            image('photo-1516035069371-29a1b244cc32'),
            image('photo-1500530855697-b586d89ba3ee'),
          ],
          bgCarouselTiming: 6,
          bgCarouselTransition: 'fade',
          title: 'A portfolio that lets the work breathe',
          subtitle: 'Large images, lean copy, and direct project pathways for photographers, designers, makers, and studios.',
          buttonText: 'View Portfolio',
          __customCss: '.hero-centered { min-height: 86vh; display: flex; align-items: flex-end; padding-bottom: 6rem; } .hero-container { text-align: left !important; max-width: 72rem !important; } .hero-title, .hero-subtitle { max-width: 44rem; } .hero-button { display: none !important; } .hero-overlay { background: linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.68)) !important; }',
        }),
        block('image', {
          image: image('photo-1516035069371-29a1b244cc32'),
          image__settings: { altText: 'Large featured portfolio image' },
          __customCss: 'section { padding-top: 0 !important; padding-bottom: 0 !important; background: var(--primary) !important; } div { max-width: none !important; padding: 0 !important; } img { min-height: 70vh !important; border-radius: 0 !important; box-shadow: none !important; }',
        }),
        block('gallery', {
          title: 'Selected work',
          subtitle: 'A visual index for recent projects.',
          columns: 4,
          backgroundColor: 'palette:accent',
          images: [
            image('photo-1492691527719-9d1e07e534b4'),
            image('photo-1516035069371-29a1b244cc32'),
            image('photo-1500530855697-b586d89ba3ee'),
            image('photo-1500534314209-a25ddb2bd429'),
            image('photo-1497366754035-f200968a6e72'),
            image('photo-1500530855697-b586d89ba3ee'),
            image('photo-1518005020951-eccb494ad742'),
            image('photo-1513519245088-0e12902e5a38'),
          ],
          __customCss: '.grid { gap: 2px !important; } img { border-radius: 0 !important; } h2 { text-align: left !important; } p { text-align: left !important; margin-left: 0 !important; }',
        }),
        block('carousel', {
          title: 'Project spotlights',
          variant: 'slides',
          backgroundColor: '#ffffff',
          items: [
            { mediaType: 'image', image: image('photo-1500530855697-b586d89ba3ee'), title: 'Residential interiors', text: 'A quiet visual story for a warm, light-filled renovation.' },
            { mediaType: 'image', image: image('photo-1492691527719-9d1e07e534b4'), title: 'Editorial portrait series', text: 'Portraits with restrained framing and a simple narrative arc.' },
            { mediaType: 'image', image: image('photo-1516035069371-29a1b244cc32'), title: 'Campaign stills', text: 'Clean product imagery designed for launch pages and social crops.' },
          ],
        }),
        block('featuredQuote', {
          variant: 'minimal',
          quote: 'The site should feel like a gallery wall: enough structure to guide you, enough quiet for the work to carry the room.',
          personName: 'Northlight Studio',
          personTitle: 'Portfolio note',
          backgroundColor: 'palette:primary',
          __customCss: 'section, p { color: #ffffff !important; }',
        }),
        block('cta', {
          title: 'Have a project in mind?',
          subtitle: 'Send a few details and we will reply with availability, fit, and next steps.',
          buttonText: 'Inquire',
          backgroundColor: 'palette:primary',
          showPattern: false,
        }),
      ],
      extra_pages: [
        {
          slug: 'portfolio',
          title: 'Portfolio',
          display_name: 'Portfolio',
          is_visible_in_nav: true,
          blocks: [
            block('gallery', {
              title: 'Portfolio archive',
              subtitle: 'Upload and arrange complete project sets here.',
              columns: 4,
              images: [
                image('photo-1492691527719-9d1e07e534b4'),
                image('photo-1516035069371-29a1b244cc32'),
                image('photo-1500530855697-b586d89ba3ee'),
                image('photo-1500534314209-a25ddb2bd429'),
              ],
            }),
          ],
        },
        {
          slug: 'inquire',
          title: 'Inquire',
          display_name: 'Inquire',
          is_visible_in_nav: true,
          blocks: [
            block('contact_form', {
              title: 'Project inquiry',
              description: 'Tell us what you are making, when you need it, and what kind of visual direction you have in mind.',
              submitText: 'Send Inquiry',
              successMessage: 'Thanks. We will respond with availability shortly.',
            }),
          ],
        },
      ],
    },
  },
];

export function isStructuralTemplateId(templateId: string): boolean {
  const id = templateId.toLowerCase().replace(/-/g, '_');
  return STRUCTURAL_TEMPLATE_STYLES.some((style) => id === style || id.startsWith(`${style}_`));
}

export function getStructuralTemplateMetadata(templateId: string): StructuralTemplateMetadata | null {
  const id = templateId.toLowerCase().replace(/-/g, '_');
  return (
    STRUCTURAL_TEMPLATE_METADATA.find((template) => template.template_id === id) ||
    STRUCTURAL_TEMPLATE_METADATA.find((template) => template.template_id.startsWith(`${id}_`)) ||
    null
  );
}

export function getStructuralTemplatesForSelection(): StructuralTemplateMetadata[] {
  return STRUCTURAL_TEMPLATE_METADATA;
}

export function getTemplateStyleTag(templateId: string): string {
  const id = templateId.toLowerCase().replace(/-/g, '_');
  for (const style of ALL_TEMPLATE_STYLES) {
    if (id.includes(style)) return style.charAt(0).toUpperCase() + style.slice(1);
  }
  if (id.includes('bold')) return 'Bold';
  if (id.includes('elegant')) return 'Elegant';
  if (id.includes('starter')) return 'Starter';
  return '';
}
