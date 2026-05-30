import { getTemplateCategoryLabel } from './template-category-labels';
import {
  buildFallbackBlocksForArchitecture,
  buildSiteArchitecture,
  type ArchitectureBlock,
  type ArchitecturePage,
} from '@/lib/ai/site-architecture';

// Template payloads are intentionally loose JSON objects from DB/code metadata.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface CategoryCopy {
  siteTitle: string;
  heroTitle: string;
  heroSubtitle: string;
  primaryCta: string;
  secondaryCta?: string;
  bannerText?: string;
  servicesTitle: string;
  servicesSubtitle: string;
  services: Array<{ title: string; description: string }>;
  stats: Array<{ value: string; label: string }>;
  process: Array<{ title: string; text: string; icon?: string }>;
  aboutTitle: string;
  aboutDescription: string;
  aboutItems: string[];
  quote: string;
  testimonials: Array<{ name: string; role?: string; title?: string; quote: string; rating?: number }>;
  ctaTitle: string;
  ctaSubtitle: string;
  formTitle: string;
  formDescription: string;
  faq: Array<{ question: string; answer: string }>;
  pricingTiers: Array<{ name: string; price: string; description: string; features: string[]; highlighted?: boolean; buttonText?: string }>;
  estimateFields: Array<{ id: string; label: string; type: 'select' | 'text' | 'textarea' | 'number' | 'checkbox'; required?: boolean; options?: string[] }>;
  sampleImages: string[];
}

const image = (id: string, width = 1400, height = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&h=${height}&q=80`;

const CATEGORY_IMAGE_SETS: Record<string, string[]> = {
  agency: [
    image('photo-1556761175-b413da4baf72'),
    image('photo-1557804506-669a67965ba0'),
    image('photo-1517245386807-bb43f82c33c4'),
    image('photo-1497366754035-f200968a6e72'),
    image('photo-1521791136064-7986c2920216'),
    image('photo-1497366811353-6870744d04b2'),
  ],
  designer: [
    image('photo-1518005020951-eccb494ad742'),
    image('photo-1497366754035-f200968a6e72'),
    image('photo-1500534314209-a25ddb2bd429'),
    image('photo-1513519245088-0e12902e5a38'),
    image('photo-1516035069371-29a1b244cc32'),
    image('photo-1500530855697-b586d89ba3ee'),
  ],
  photographer: [
    image('photo-1492691527719-9d1e07e534b4'),
    image('photo-1516035069371-29a1b244cc32'),
    image('photo-1500530855697-b586d89ba3ee'),
    image('photo-1500534314209-a25ddb2bd429'),
    image('photo-1518005020951-eccb494ad742'),
    image('photo-1513519245088-0e12902e5a38'),
  ],
  artist: [
    image('photo-1452860606245-08befc0ff44b'),
    image('photo-1513364776144-60967b0f800f'),
    image('photo-1513519245088-0e12902e5a38'),
    image('photo-1492691527719-9d1e07e534b4'),
    image('photo-1516035069371-29a1b244cc32'),
    image('photo-1500534314209-a25ddb2bd429'),
  ],
  trades: [
    image('photo-1504307651254-35680f356dfd'),
    image('photo-1581090464777-f3220bbe1b8b'),
    image('photo-1581092918056-0c4c3acd3789'),
    image('photo-1581578731548-c64695cc6952'),
    image('photo-1590959651373-a3db0f38a961'),
    image('photo-1607472586893-edb57bdc0e39'),
  ],
  general: [
    image('photo-1497366754035-f200968a6e72'),
    image('photo-1500530855697-b586d89ba3ee'),
    image('photo-1518005020951-eccb494ad742'),
    image('photo-1524758631624-e2822e304c36'),
    image('photo-1492691527719-9d1e07e534b4'),
    image('photo-1500534314209-a25ddb2bd429'),
  ],
};

const COMMON_SERVICE_TESTIMONIALS = [
  { name: 'Alicia M.', role: 'Homeowner', title: 'Homeowner', quote: 'They explained the options clearly, arrived when promised, and left everything cleaner than they found it.', rating: 5 },
  { name: 'Grant L.', role: 'Property Manager', title: 'Property Manager', quote: 'Fast communication, clear estimates, and dependable follow-through on every visit.', rating: 5 },
  { name: 'Priya S.', role: 'Local Client', title: 'Local Client', quote: 'The work was handled professionally from the first call to the final walkthrough.', rating: 5 },
];

const CATEGORY_COPY: Record<string, Partial<CategoryCopy>> = {
  plumber: {
    siteTitle: 'Aqua Plumbing',
    heroTitle: 'Fast, Reliable Plumbing',
    heroSubtitle: 'Licensed plumbers ready for leaks, drains, fixtures, and urgent repairs. Emergency service available 24/7.',
    primaryCta: 'Get Quote',
    bannerText: 'Licensed, insured, and available for urgent plumbing repairs.',
    servicesTitle: 'Our Plumbing Services',
    servicesSubtitle: 'Repairs, installs, and maintenance for homes and small businesses.',
    services: [
      { title: 'Emergency Repairs', description: 'Rapid help for leaks, burst pipes, backups, and urgent plumbing issues.' },
      { title: 'Drain Cleaning', description: 'Clear slow drains, clogs, and sewer line problems with clean, careful work.' },
      { title: 'Water Heater Service', description: 'Repair, replacement, and maintenance for tank and tankless water heaters.' },
      { title: 'Fixture Installation', description: 'Install faucets, toilets, sinks, showers, and shutoff valves correctly.' },
    ],
    stats: [
      { value: '24/7', label: 'Emergency response' },
      { value: '4.9/5', label: 'Average rating' },
      { value: '1,200+', label: 'Jobs completed' },
      { value: '100%', label: 'Written estimates' },
    ],
    process: [
      { icon: 'PhoneCall', title: 'Call or request a quote', text: 'Tell us what is leaking, clogged, or due for replacement.' },
      { icon: 'ClipboardCheck', title: 'Get a clear diagnosis', text: 'We inspect the issue and explain the repair options before work begins.' },
      { icon: 'Wrench', title: 'Approve the repair', text: 'Your plumber completes the work and reviews the finished result with you.' },
    ],
    aboutTitle: 'Licensed plumbing without the runaround',
    aboutDescription: 'Aqua Plumbing helps homeowners and property managers solve plumbing issues with clear communication, clean workmanship, and practical repair options.',
    aboutItems: ['Licensed and insured plumbers', 'Emergency repairs available', 'Clear written estimates', 'Respectful service in your home'],
    quote: 'A plumbing issue is stressful enough. The right technician should make the next step simple, explain the options, and fix the problem cleanly.',
    ctaTitle: 'Need a plumber today?',
    ctaSubtitle: 'Request a quote and tell us what needs attention. We will follow up with next steps.',
    formTitle: 'Request a Plumbing Quote',
    formDescription: 'Share the issue, location, and urgency so we can respond with the right next step.',
    faq: [
      { question: 'Do you handle emergency plumbing?', answer: 'Yes. Use this section to list your emergency availability and fastest response window.' },
      { question: 'Can you provide a written estimate?', answer: 'Yes. Customers can approve the scope before work begins.' },
      { question: 'Do you repair water heaters?', answer: 'Yes. Add your supported water heater types, warranty details, and replacement process here.' },
    ],
    pricingTiers: [
      { name: 'Service Call', price: '$99+', description: 'Basic diagnosis and repair estimate.', features: ['Issue inspection', 'Repair options', 'Written quote'], highlighted: false, buttonText: 'Book Service' },
      { name: 'Repair Visit', price: '$249+', description: 'Common plumbing repair visit.', features: ['Licensed plumber', 'Parts guidance', 'Clean work area'], highlighted: true, buttonText: 'Get Quote' },
      { name: 'Installation', price: 'Custom', description: 'Fixture, water heater, or larger install.', features: ['Project scope', 'Material planning', 'Scheduled install'], highlighted: false, buttonText: 'Plan Install' },
    ],
    estimateFields: [
      { id: 'plumbing-service', label: 'Plumbing issue', type: 'select', required: true, options: ['Leak', 'Clogged drain', 'Water heater', 'Fixture install', 'Other'] },
      { id: 'plumbing-urgency', label: 'Urgency', type: 'select', required: true, options: ['Emergency', 'This week', 'Flexible'] },
      { id: 'plumbing-location', label: 'Where is the issue?', type: 'text', required: false },
    ],
  },
  electrical: {
    siteTitle: 'Brightline Electrical',
    heroTitle: 'Safe, Professional Electrical Work',
    heroSubtitle: 'Licensed electricians for repairs, panels, lighting, troubleshooting, and upgrades.',
    primaryCta: 'Get Quote',
    servicesTitle: 'Electrical Services',
    servicesSubtitle: 'Reliable electrical help for homes and businesses.',
    services: [
      { title: 'Troubleshooting & Repairs', description: 'Find and fix flickering lights, dead outlets, tripped breakers, and wiring issues.' },
      { title: 'Panel Upgrades', description: 'Modernize overloaded or outdated electrical panels with safe capacity planning.' },
      { title: 'Lighting Installation', description: 'Install fixtures, recessed lighting, exterior lighting, and smart controls.' },
      { title: 'EV & Appliance Circuits', description: 'Add dedicated circuits for chargers, appliances, and workshop equipment.' },
    ],
  },
  hvac: {
    siteTitle: 'ComfortPro Heating & Cooling',
    heroTitle: 'Heating and Cooling That Feels Right',
    heroSubtitle: 'HVAC repair, maintenance, and installation for dependable comfort in every season.',
    primaryCta: 'Book Service',
    servicesTitle: 'HVAC Services',
    servicesSubtitle: 'Repair, tune-up, and replacement support for your comfort systems.',
    services: [
      { title: 'Furnace Repair', description: 'Diagnose heating issues and restore safe, steady warmth.' },
      { title: 'AC Service', description: 'Repair cooling problems, airflow issues, and system performance concerns.' },
      { title: 'Seasonal Tune-Ups', description: 'Prepare your system before peak heating or cooling season.' },
      { title: 'System Replacement', description: 'Plan efficient equipment upgrades with clear recommendations.' },
    ],
  },
  handyman: {
    siteTitle: 'ReadyFix Handyman',
    heroTitle: 'Small Repairs Handled Properly',
    heroSubtitle: 'Reliable handyman help for repairs, maintenance, installs, and punch-list projects.',
    primaryCta: 'Request Help',
    servicesTitle: 'Handyman Services',
    servicesSubtitle: 'Practical help for the jobs that keep your property working.',
    services: [
      { title: 'Home Repairs', description: 'Fix doors, drywall, trim, fixtures, hardware, and everyday damage.' },
      { title: 'Installations', description: 'Mount shelves, assemble furniture, install hardware, and handle small upgrades.' },
      { title: 'Maintenance Visits', description: 'Bundle repairs into one organized visit with a clear checklist.' },
      { title: 'Rental Turnovers', description: 'Refresh units between tenants with fast punch-list support.' },
    ],
  },
  cleaning: {
    siteTitle: 'Spark & Shine Cleaning',
    heroTitle: 'Clean Spaces Without the Stress',
    heroSubtitle: 'Reliable residential and office cleaning with clear scheduling and consistent results.',
    primaryCta: 'Book Cleaning',
    servicesTitle: 'Cleaning Services',
    servicesSubtitle: 'Flexible cleaning options for homes, offices, and move-out needs.',
    services: [
      { title: 'Recurring Cleaning', description: 'Weekly, biweekly, or monthly cleaning plans for everyday upkeep.' },
      { title: 'Deep Cleaning', description: 'Detailed cleaning for kitchens, bathrooms, baseboards, and high-touch areas.' },
      { title: 'Move-In / Move-Out', description: 'Prepare a property for the next chapter with a focused clean.' },
      { title: 'Office Cleaning', description: 'Keep workspaces presentable, stocked, and ready for the day.' },
    ],
  },
  landscaping: {
    siteTitle: 'Greenline Landscaping',
    heroTitle: 'Outdoor Spaces Kept Beautiful',
    heroSubtitle: 'Lawn care, garden maintenance, seasonal cleanup, and landscape improvements.',
    primaryCta: 'Request Estimate',
    servicesTitle: 'Landscaping Services',
    servicesSubtitle: 'Care plans and one-time projects for healthier outdoor spaces.',
    services: [
      { title: 'Lawn Maintenance', description: 'Mowing, edging, trimming, and dependable seasonal care.' },
      { title: 'Garden Cleanup', description: 'Refresh beds, remove weeds, prune plants, and restore curb appeal.' },
      { title: 'Mulch & Planting', description: 'Install mulch, soil, shrubs, flowers, and simple planting plans.' },
      { title: 'Seasonal Cleanup', description: 'Spring and fall cleanup to keep properties ready for the season.' },
    ],
  },
  consulting: {
    siteTitle: 'ClearPath Consulting',
    heroTitle: 'Practical Strategy for Better Decisions',
    heroSubtitle: 'Consulting support for teams that need sharper plans, cleaner systems, and measurable progress.',
    primaryCta: 'Book Strategy Call',
    servicesTitle: 'Consulting Services',
    servicesSubtitle: 'Focused advisory support with clear outcomes.',
    services: [
      { title: 'Strategy Sessions', description: 'Clarify priorities, opportunities, risks, and next actions.' },
      { title: 'Operations Review', description: 'Improve handoffs, reporting, workflows, and team cadence.' },
      { title: 'Growth Planning', description: 'Turn goals into a practical roadmap with owners and metrics.' },
      { title: 'Implementation Support', description: 'Stay accountable as the plan moves from idea to execution.' },
    ],
  },
  salon: {
    siteTitle: 'Polish & Glow Studio',
    heroTitle: 'Beauty Appointments Made Easy',
    heroSubtitle: 'Hair, nails, skin, and self-care services in a calm, polished studio setting.',
    primaryCta: 'Book Appointment',
    servicesTitle: 'Salon & Spa Services',
    servicesSubtitle: 'Choose focused treatments or a full refresh.',
    services: [
      { title: 'Hair Services', description: 'Cuts, colour, styling, and maintenance appointments.' },
      { title: 'Nails', description: 'Manicures, pedicures, gel polish, and nail care.' },
      { title: 'Skin & Brows', description: 'Facials, brow shaping, and simple treatment add-ons.' },
      { title: 'Massage & Wellness', description: 'Relaxation-focused appointments for feeling restored.' },
    ],
  },
  fitness: {
    siteTitle: 'CoreFit Coaching',
    heroTitle: 'Training That Fits Real Life',
    heroSubtitle: 'Personal training, coaching, and fitness plans built around your goals and schedule.',
    primaryCta: 'Book Consultation',
    servicesTitle: 'Fitness & Coaching',
    servicesSubtitle: 'Training options for strength, confidence, and consistency.',
    services: [
      { title: 'Personal Training', description: 'One-on-one sessions tailored to your current fitness level.' },
      { title: 'Small Group Coaching', description: 'Focused training with accountability and community.' },
      { title: 'Nutrition Guidance', description: 'Simple habits and support to match your training goals.' },
      { title: 'Online Coaching', description: 'Programming, check-ins, and progress tracking from anywhere.' },
    ],
  },
  restaurant: {
    siteTitle: 'Corner Table',
    heroTitle: 'A Seasonal Menu Close to Home',
    heroSubtitle: 'Fresh plates, warm service, and a dining room built for easy evenings.',
    primaryCta: 'View Menu',
    bannerText: 'Now serving dine-in, pickup, and private event inquiries.',
    servicesTitle: 'Menu Highlights',
    servicesSubtitle: 'Showcase the dishes, drinks, and dining options guests ask about first.',
    services: [
      { title: 'Seasonal Plates', description: 'Fresh dishes built around market produce and familiar comfort.' },
      { title: 'Dinner Service', description: 'A relaxed dining room experience for weeknights and celebrations.' },
      { title: 'Drinks & Dessert', description: 'Cocktails, coffee, zero-proof options, and a sweet finish.' },
      { title: 'Private Events', description: 'Host small gatherings with a menu shaped around the occasion.' },
    ],
    stats: [
      { value: '5 nights', label: 'Dinner service' },
      { value: '4.8/5', label: 'Guest rating' },
      { value: 'Local', label: 'Seasonal sourcing' },
      { value: 'Pickup', label: 'Order options' },
    ],
    process: [
      { icon: 'Utensils', title: 'Browse the menu', text: 'Explore dishes by section before you visit.' },
      { icon: 'Calendar', title: 'Plan the visit', text: 'Check hours, location, and reservation details.' },
      { icon: 'ShoppingBag', title: 'Order or dine in', text: 'Choose the option that fits the evening.' },
    ],
    aboutTitle: 'Food with a sense of place',
    aboutDescription: 'Corner Table is built around seasonal ingredients, unfussy hospitality, and a menu that changes with what tastes best right now.',
    aboutItems: ['Seasonal menu sections', 'Pickup and dine-in options', 'Private event inquiries', 'Clear hours and location'],
    quote: 'A good restaurant site should get guests from craving to decision quickly: menu, hours, location, and the right next step.',
    ctaTitle: 'Ready to see what is serving?',
    ctaSubtitle: 'Browse the menu, plan your visit, or send a private event inquiry.',
    formTitle: 'Ask About a Table or Event',
    formDescription: 'Send a note about reservations, events, catering, or general questions.',
  },
  handmade: {
    siteTitle: 'Marlow Goods',
    heroTitle: 'Small-Batch Goods Made With Care',
    heroSubtitle: 'Handmade pieces, thoughtful materials, and simple product pages ready to shop.',
    primaryCta: 'Shop Now',
    servicesTitle: 'Featured Collections',
    servicesSubtitle: 'Organize products by collection, material, or use.',
    services: [
      { title: 'Everyday Pieces', description: 'Functional goods designed for repeated use.' },
      { title: 'Limited Drops', description: 'Small runs and seasonal releases.' },
      { title: 'Giftable Sets', description: 'Bundles that make choosing easier.' },
      { title: 'Custom Requests', description: 'A path for special orders and questions.' },
    ],
    aboutTitle: 'A product story customers can trust',
    aboutDescription: 'Marlow Goods turns handmade work into a clear shopping experience with product highlights, brand story, and customer support.',
    aboutItems: ['Editable product catalog', 'Collection storytelling', 'Gallery-ready visuals', 'Customer inquiry path'],
    quote: 'A product site should make the catalog easy to browse while keeping the maker story close enough to build trust.',
    ctaTitle: 'Browse the latest pieces',
    ctaSubtitle: 'Start with the featured collection or send a custom request.',
    formTitle: 'Ask About an Order',
    formDescription: 'Use this form for product questions, custom requests, or wholesale interest.',
  },
  ecommerce: {
    siteTitle: 'Northline Shop',
    heroTitle: 'Products Ready to Browse and Buy',
    heroSubtitle: 'A storefront structure with catalog pages, product highlights, and clear support paths.',
    primaryCta: 'Shop Now',
    servicesTitle: 'Shop by Category',
    servicesSubtitle: 'Use collections to help customers find the right product faster.',
    services: [
      { title: 'Featured Products', description: 'Highlight bestsellers and new arrivals.' },
      { title: 'Bundles', description: 'Group products around use cases or gifting.' },
      { title: 'Digital Offers', description: 'Present downloadable or virtual products clearly.' },
      { title: 'Customer Support', description: 'Give shoppers a clear path for questions.' },
    ],
    aboutTitle: 'A shop built for clarity',
    aboutDescription: 'Northline Shop helps customers browse products, compare options, and ask questions before they buy.',
    aboutItems: ['Managed product catalog', 'Category filters', 'Customer support form', 'Brand story sections'],
    quote: 'A strong shop page makes products easy to scan and keeps support close when a customer hesitates.',
    ctaTitle: 'Find the right product',
    ctaSubtitle: 'Browse the catalog or contact us with questions.',
    formTitle: 'Product Question',
    formDescription: 'Send a question about products, orders, shipping, or availability.',
  },
  nonprofit: {
    siteTitle: 'Community Roots',
    heroTitle: 'Local Action for Lasting Change',
    heroSubtitle: 'Programs, events, resources, and clear ways for supporters to get involved.',
    primaryCta: 'Get Involved',
    bannerText: 'Volunteer opportunities and community events are updated regularly.',
    servicesTitle: 'Programs and Initiatives',
    servicesSubtitle: 'Show the work your organization does and how people can participate.',
    services: [
      { title: 'Community Programs', description: 'Ongoing initiatives that support local needs.' },
      { title: 'Volunteer Days', description: 'Hands-on opportunities for individuals and groups.' },
      { title: 'Resource Sharing', description: 'Guides, links, and information for the community.' },
      { title: 'Partner Support', description: 'Collaborations with local organizations and sponsors.' },
    ],
    stats: [
      { value: '1,200+', label: 'Community members reached' },
      { value: '80+', label: 'Volunteer hours monthly' },
      { value: '12', label: 'Active partners' },
      { value: 'Year-round', label: 'Programs' },
    ],
    process: [
      { icon: 'HeartHandshake', title: 'Learn the mission', text: 'Understand the people and needs behind the work.' },
      { icon: 'Calendar', title: 'Join an event', text: 'Find an upcoming opportunity to participate.' },
      { icon: 'Mail', title: 'Get involved', text: 'Send interest and choose the best next step.' },
    ],
    aboutTitle: 'Mission, programs, and practical next steps',
    aboutDescription: 'Community Roots helps visitors understand the mission, explore programs, and take action using existing Keystone blocks.',
    aboutItems: ['Programs without fake donation blocks', 'Events and resources', 'Volunteer interest forms', 'Impact numbers'],
    quote: 'Supporters need to understand the mission, see the work, and find a real next step without hunting for it.',
    ctaTitle: 'Ready to help?',
    ctaSubtitle: 'Explore programs, join an event, or send a volunteer interest form.',
    formTitle: 'Get Involved',
    formDescription: 'Tell us how you would like to support, volunteer, partner, or learn more.',
  },
  photographer: {
    siteTitle: 'Northlight Studio',
    heroTitle: 'A Portfolio That Lets the Work Breathe',
    heroSubtitle: 'Selected projects, process notes, and an inquiry path for new commissions.',
    primaryCta: 'View Portfolio',
    servicesTitle: 'Creative Services',
    servicesSubtitle: 'Help visitors understand what kind of work they can book.',
    services: [
      { title: 'Portrait Sessions', description: 'Personal, editorial, or brand portraits.' },
      { title: 'Commercial Projects', description: 'Campaign, product, and launch imagery.' },
      { title: 'Event Coverage', description: 'Documented moments with a clear visual direction.' },
      { title: 'Creative Direction', description: 'Planning support for shoots and visual stories.' },
    ],
    aboutTitle: 'A point of view behind the images',
    aboutDescription: 'Northlight Studio presents selected work with enough story and structure for visitors to understand the process.',
    aboutItems: ['Image-forward portfolio', 'Project inquiry form', 'Testimonials and quotes', 'Optional service packages'],
    quote: 'A portfolio site should make the work easy to inspect and the inquiry path impossible to miss.',
    ctaTitle: 'Have a project in mind?',
    ctaSubtitle: 'Send a few details and we will follow up with availability.',
    formTitle: 'Start an Inquiry',
    formDescription: 'Tell us about the project, timeline, and kind of work you need.',
  },
  agency: {
    siteTitle: 'Signal Studio',
    heroTitle: 'Creative Work With a Clear Strategy',
    heroSubtitle: 'Brand, campaign, and digital creative shaped for teams that need sharper ideas and cleaner execution.',
    primaryCta: 'Start a Project',
    servicesTitle: 'Creative Agency Services',
    servicesSubtitle: 'Strategy, design, content, and launch support for brands with momentum.',
    services: [
      { title: 'Brand Strategy', description: 'Clarify positioning, audience, voice, and the ideas that guide the work.' },
      { title: 'Campaign Creative', description: 'Concept, copy, and art direction for launches, seasonal pushes, and promotions.' },
      { title: 'Web & Digital Design', description: 'Create polished digital touchpoints that connect the brand story to action.' },
      { title: 'Content Systems', description: 'Plan reusable creative assets for social, email, landing pages, and sales support.' },
    ],
    stats: [
      { value: '4+', label: 'Core creative services' },
      { value: '90 days', label: 'Typical launch window' },
      { value: '1 team', label: 'Strategy through execution' },
      { value: 'Clear', label: 'Project process' },
    ],
    process: [
      { icon: 'Search', title: 'Discover the opportunity', text: 'Start with goals, audience, constraints, and the moment the work needs to serve.' },
      { icon: 'Sparkles', title: 'Shape the creative direction', text: 'Develop concepts, messaging, and visuals that can carry across channels.' },
      { icon: 'Rocket', title: 'Build and launch', text: 'Turn the approved direction into the assets, pages, and content needed to go live.' },
    ],
    aboutTitle: 'A studio built for useful creative',
    aboutDescription: 'Signal Studio helps organizations turn strategy into visible, usable creative systems for launches, campaigns, and digital experiences.',
    aboutItems: ['Strategy-led creative', 'Campaign and launch support', 'Digital-first execution', 'Clear project rhythm'],
    quote: 'Strong creative should do more than look polished. It should make the audience understand the offer faster and trust the next step.',
    ctaTitle: 'Have a campaign or launch in motion?',
    ctaSubtitle: 'Share the goal, timing, and type of creative support you need.',
    formTitle: 'Start a Creative Inquiry',
    formDescription: 'Tell us about the project, timeline, and channels involved.',
  },
  artist: {
    siteTitle: 'Fieldmark Studio',
    heroTitle: 'Artwork, Process, and Recent Pieces',
    heroSubtitle: 'A portfolio structure for showing work, telling the studio story, and welcoming inquiries.',
    primaryCta: 'View Work',
    servicesTitle: 'Studio Work',
    servicesSubtitle: 'Describe commissions, originals, prints, workshops, or collaborations.',
    services: [
      { title: 'Original Work', description: 'Current pieces and available collections.' },
      { title: 'Commissions', description: 'Custom artwork shaped around a client brief.' },
      { title: 'Prints and Editions', description: 'Reproducible work for collectors and gift buyers.' },
      { title: 'Workshops', description: 'Hands-on sessions or community art events.' },
    ],
    aboutTitle: 'The story behind the studio',
    aboutDescription: 'Fieldmark Studio gives visitors a clear way to browse work, understand the practice, and make an inquiry.',
    aboutItems: ['Gallery-first portfolio', 'Artist statement sections', 'Inquiry form', 'Optional shop-ready blocks'],
    quote: 'Art needs room to be seen, but visitors still need simple paths to inquire, buy, or attend.',
    ctaTitle: 'Ask about a piece or project',
    ctaSubtitle: 'Send a note about commissions, availability, or collaborations.',
    formTitle: 'Studio Inquiry',
    formDescription: 'Tell us what caught your eye or what you would like to create.',
  },
};

export function personalizeTemplateContentForCategory(
  defaultContent: Record<string, unknown>,
  input: { category?: string | null; businessType?: string | null; templateId?: string | null },
): Record<string, unknown> {
  const copy = buildCategoryCopy(input.category, input.businessType);
  const content = cloneRecord(defaultContent);
  const architecture = buildSiteArchitecture({
    businessType: input.businessType,
    category: input.category,
    templateId: input.templateId,
    description: `${copy.siteTitle} ${copy.heroTitle}`,
  });
  const sourceBlocks = collectSourceBlocks(content);

  content.siteTitle = copy.siteTitle;
  content.navButtonText = copy.primaryCta;
  if (copy.bannerText && typeof content.headerBannerText === 'string') {
    content.headerBannerText = copy.bannerText;
  }

  content.blocks = buildArchitectureBlocks(architecture.home, sourceBlocks, copy);
  content.extra_pages = architecture.pages.map((page) => ({
    slug: page.slug,
    title: page.title,
    display_name: page.displayName,
    is_visible_in_nav: true,
    blocks: buildArchitectureBlocks(page, sourceBlocks, copy),
  }));
  content.__navItems = [
    { label: 'Home', href: '/', pageSlug: 'home', linkType: 'page' },
    ...architecture.pages.map((page) => ({
      label: page.displayName,
      href: `/${page.slug}`,
      pageSlug: page.slug,
      linkType: 'page',
    })),
  ];

  return content;
}

export const personalizeStructuralTemplateContent = personalizeTemplateContentForCategory;

function collectSourceBlocks(content: Record<string, unknown>): Map<string, AnyRecord[]> {
  const blocksByType = new Map<string, AnyRecord[]>();
  const addBlocks = (blocks: unknown) => {
    if (!Array.isArray(blocks)) return;
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue;
      const record = block as AnyRecord;
      if (typeof record.type !== 'string') continue;
      const existing = blocksByType.get(record.type) ?? [];
      existing.push(record);
      blocksByType.set(record.type, existing);
    }
  };

  addBlocks(content.blocks);
  if (Array.isArray(content.extra_pages)) {
    for (const page of content.extra_pages) {
      if (page && typeof page === 'object') {
        addBlocks((page as AnyRecord).blocks);
      }
    }
  }
  return blocksByType;
}

function buildArchitectureBlocks(page: ArchitecturePage, sourceBlocks: Map<string, AnyRecord[]>, copy: CategoryCopy) {
  return page.blocks.map((spec, index) => buildArchitectureBlock(spec, sourceBlocks, copy, page.slug, index));
}

function buildArchitectureBlock(
  spec: ArchitectureBlock,
  sourceBlocks: Map<string, AnyRecord[]>,
  copy: CategoryCopy,
  pageSlug: string,
  index: number,
) {
  const source = sourceBlocks.get(spec.blockType)?.[0];
  const styleData = pickTemplateStyleData(spec.blockType, source?.data || {}, copy);
  const fallback = buildFallbackBlocksForArchitecture([spec], copy.siteTitle, pageSlug)[0]?.data || {};
  const data = personalizeBlockData(spec.blockType, { ...fallback, ...styleData }, copy, pageSlug);

  return {
    id: `architecture-${pageSlug}-${spec.blockType}-${index + 1}`,
    type: spec.blockType,
    data,
  };
}

function buildCategoryCopy(category: string | null | undefined, businessType: string | null | undefined): CategoryCopy {
  const normalized = normalizeCategory(category);
  const label = getTemplateCategoryLabel(category) || 'Business';
  const base = CATEGORY_COPY[normalized] || {};
  const fallbackServices = [
    { title: `${label} Consultation`, description: `Help visitors understand the right ${label.toLowerCase()} service for their needs.` },
    { title: 'Service Visit', description: 'A clear, scheduled appointment with practical next steps.' },
    { title: 'Project Support', description: 'A more complete engagement for larger or ongoing needs.' },
    { title: 'Maintenance Plan', description: 'Recurring support for customers who want consistent service.' },
  ];

  const siteTitle = base.siteTitle || `${label} Co.`;
  const primaryCta = base.primaryCta || (businessType === 'products' ? 'Shop Now' : 'Get Quote');

  return {
    siteTitle,
    heroTitle: base.heroTitle || `${label} Services Made Simple`,
    heroSubtitle: base.heroSubtitle || `A polished starter website for a ${label.toLowerCase()} business, ready for services, proof, and contact details.`,
    primaryCta,
    secondaryCta: base.secondaryCta,
    bannerText: base.bannerText || `Now accepting new ${label.toLowerCase()} inquiries.`,
    servicesTitle: base.servicesTitle || `${label} Services`,
    servicesSubtitle: base.servicesSubtitle || 'Show visitors what you offer and how to get started.',
    services: base.services || fallbackServices,
    stats: base.stats || [
      { value: '4.9/5', label: 'Average rating' },
      { value: '500+', label: 'Clients helped' },
      { value: '24 hr', label: 'Response window' },
      { value: '100%', label: 'Clear estimates' },
    ],
    process: base.process || [
      { icon: 'PhoneCall', title: 'Start with a request', text: 'Share what you need and when you need it.' },
      { icon: 'ClipboardCheck', title: 'Get a clear plan', text: 'Review the scope, timeline, and next step before committing.' },
      { icon: 'CheckCircle', title: 'Complete the work', text: 'Move from inquiry to finished result with less back-and-forth.' },
    ],
    aboutTitle: base.aboutTitle || `Built for ${label.toLowerCase()} customers`,
    aboutDescription: base.aboutDescription || `${siteTitle} helps customers understand services, compare options, and request help with confidence.`,
    aboutItems: base.aboutItems || ['Clear communication', 'Practical recommendations', 'Reliable scheduling', 'Professional follow-through'],
    quote: base.quote || `A good ${label.toLowerCase()} website should quickly show what you do, why visitors can trust you, and how to take the next step.`,
    testimonials: base.testimonials || COMMON_SERVICE_TESTIMONIALS,
    ctaTitle: base.ctaTitle || `Ready to work with ${siteTitle}?`,
    ctaSubtitle: base.ctaSubtitle || 'Send a request and replace this copy with the next step you want visitors to take.',
    formTitle: base.formTitle || `Request ${label} Help`,
    formDescription: base.formDescription || 'Tell us what you need and we will follow up with the next step.',
    faq: base.faq || [
      { question: 'How quickly can you respond?', answer: 'Add your normal response window, emergency availability, or scheduling process here.' },
      { question: 'Do you provide estimates?', answer: 'Explain how visitors can request pricing, quotes, or consultations.' },
      { question: 'What areas do you serve?', answer: 'List your service area, travel radius, or appointment options.' },
    ],
    pricingTiers: base.pricingTiers || [
      { name: 'Consultation', price: '$99+', description: 'A focused first step.', features: ['Needs review', 'Recommended next steps', 'Clear estimate'], highlighted: false, buttonText: primaryCta },
      { name: 'Standard Service', price: '$249+', description: 'Common service visit.', features: ['Scheduled visit', 'Professional support', 'Follow-up notes'], highlighted: true, buttonText: primaryCta },
      { name: 'Custom Project', price: 'Custom', description: 'Larger or more complex work.', features: ['Defined scope', 'Timeline planning', 'Dedicated support'], highlighted: false, buttonText: 'Talk Details' },
    ],
    estimateFields: base.estimateFields || [
      { id: 'service-type', label: 'Service needed', type: 'select', required: true, options: fallbackServices.map((service) => service.title) },
      { id: 'timeline', label: 'Timeline', type: 'select', required: true, options: ['As soon as possible', 'This week', 'Flexible'] },
      { id: 'details', label: 'Project details', type: 'textarea', required: false },
    ],
    sampleImages: base.sampleImages || sampleImagesForCategory(normalized, businessType),
  };
}

const TEMPLATE_STYLE_FIELDS: Record<string, string[]> = {
  hero: ['transition', 'height', 'cards'],
  servicesGrid: ['variant', 'layout', 'columns', 'backgroundColor', 'foregroundColor', 'ctaEnabled', 'cardStyle', 'cardSettings', 'surfaceStyle', 'markerStyle', 'spacingDensity', 'textAlign'],
  featuresList: ['variant', 'layout', 'backgroundColor'],
  stats: ['variant', 'backgroundColor', 'foregroundColor', 'cardStyle', 'cardSettings', 'surfaceStyle', 'spacingDensity', 'textAlign'],
  testimonials: ['variant', 'backgroundColor', 'foregroundColor', 'cardStyle', 'cardSettings', 'surfaceStyle', 'spacingDensity'],
  aboutImageText: ['variant', 'imagePosition', 'splitRatio', 'mobileStackOrder', 'backgroundColor', 'foregroundColor', 'mediaTreatment', 'textAlign'],
  featuredQuote: ['variant', 'imagePosition', 'backgroundColor'],
  cta: ['showPattern', 'backgroundColor', 'buttonTextIcon'],
  gallery: ['columns', 'showLightboxNav', 'showLightboxThumbs', 'showSeeMore', 'seeMore', 'seeMoreLink', 'seeMoreIcon', 'autoScroll', 'autoScrollRows', 'backgroundColor', 'foregroundColor', 'frameStyle', 'mediaAspect'],
  carousel: ['variant', 'autoPlay', 'interval', 'backgroundColor', 'foregroundColor', 'cardStyle', 'cardSettings', 'surfaceStyle', 'mediaAspect', 'mediaTreatment', 'iconStyle', 'spacingDensity', 'textAlign'],
  pricing: ['variant', 'backgroundColor'],
  team: ['variant', 'columns', 'showBio', 'backgroundColor'],
  blog: ['layout', 'showAuthor', 'showDate', 'showTags', 'showExcerpt', 'postsPerPage'],
  resources: ['variant', 'backgroundColor'],
  productGrid: ['variant', 'featuredOnly', 'showSeeMore', 'showProductSearch', 'showCategoryFilter'],
  menu: ['mode', 'variant', 'showPrices', 'showDescriptions', 'showMenuTabs', 'showFeaturedImages', 'showImages', 'showMenuIcons', 'categoryStyle', 'backgroundColor', 'showMenuIconLegend', 'menuIconLegendPosition', 'menuIconLegendMode', 'menuIconLegendIds', 'itemDetailEnabled', 'itemDetailShowPhoto', 'itemDetailPhotoVisibility', 'itemDetailShowName', 'itemDetailShowDescription', 'itemDetailShowPrice', 'itemDetailShowCategory', 'itemDetailShowIcons', 'itemDetailImageFit', 'itemDetailCaptionBg', 'itemDetailTextColor'],
  events: ['sortOrder', 'showPast', 'backgroundColor'],
  pdf: ['showDownload'],
  video: ['variant'],
  socialFeed: ['variant', 'columns'],
  tabBar: ['tabStyle', 'tabAlign', 'activeColor', 'bgColor'],
  estimateForm: ['variant', 'pricingEnabled', 'pricingBasePrice', 'pricingCurrency', 'pricingRangeSpread', 'pricingDisclaimer', 'showName', 'showEmail', 'showPhone', 'showAddress', 'showPreferredDate', 'showMessage'],
};

function pickTemplateStyleData(blockType: string, source: unknown, copy: CategoryCopy): AnyRecord {
  if (!source || typeof source !== 'object') return {};
  const data = source as AnyRecord;
  const style: AnyRecord = {};
  const allowed = TEMPLATE_STYLE_FIELDS[blockType] || ['variant', 'layout', 'backgroundColor'];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      style[key] = cloneValue(data[key]);
    }
  }

  delete style.__customCss;

  if (blockType === 'hero' && Array.isArray(data.cards)) {
    style.cards = data.cards.slice(0, 3).map((card: unknown, index: number) => sanitizeHeroCardStyle(card, copy, index));
  }

  return style;
}

function sanitizeHeroCardStyle(card: unknown, copy: CategoryCopy, index: number): AnyRecord {
  const source = card && typeof card === 'object' ? card as AnyRecord : {};
  const imageUrl = copy.sampleImages[index % copy.sampleImages.length] || copy.sampleImages[0] || '';
  const align = getHeroAlign(source) || 'left';
  const background = cloneValue(source.background || {});

  if (background && typeof background === 'object') {
    if (background.type === 'image') {
      background.image = { ...(background.image || {}), url: imageUrl };
    } else if (background.type === 'video') {
      background.type = 'image';
      background.image = { url: imageUrl };
      delete background.video;
    }
  }

  return {
    id: typeof source.id === 'string' ? source.id : `template-hero-${index + 1}`,
    content: {
      title: { enabled: true, value: '', align },
      subtitle: { enabled: true, value: '', align },
      cta: { enabled: source.content?.cta?.enabled !== false, label: '', link: pageLink('contact'), align },
      image: {
        enabled: source.content?.image?.enabled === true,
        url: source.content?.image?.enabled === true ? imageUrl : '',
        side: source.content?.image?.side === 'left' ? 'left' : 'right',
      },
    },
    background: Object.keys(background || {}).length > 0 ? background : {
      type: 'gradient',
      gradient: { from: 'palette:accent', to: 'palette:primary', angle: 135 },
      overlay: { color: '#000000', opacity: 0 },
    },
  };
}

function personalizePages(value: unknown, copy: CategoryCopy, businessType: string | null | undefined, slugMap: Map<string, string>) {
  if (!Array.isArray(value)) return value;
  const existingSlugs = new Set(value.map((page) => String(page?.slug || '').toLowerCase()));
  let usedServicePage = existingSlugs.has('services');

  return value.map((page, index) => {
    if (!page || typeof page !== 'object') return page;
    const next = { ...(page as AnyRecord) };
    const oldSlug = String(next.slug || `page-${index + 1}`).toLowerCase();
    const role = inferPageRole(oldSlug, businessType, usedServicePage);

    if (role === 'services') {
      usedServicePage = true;
      next.slug = 'services';
      next.title = 'Services';
      next.display_name = 'Services';
    } else if (role === 'contact') {
      next.slug = 'contact';
      next.title = 'Contact';
      next.display_name = 'Contact';
    } else if (role === 'about') {
      next.slug = 'about';
      next.title = 'About';
      next.display_name = 'About';
    }

    slugMap.set(oldSlug, String(next.slug || oldSlug));
    next.blocks = personalizeBlocks(next.blocks, copy, String(next.slug || oldSlug));
    return next;
  });
}

function personalizeNavItems(value: unknown, copy: CategoryCopy, slugMap: Map<string, string>) {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const next = { ...(item as AnyRecord) };
    const oldSlug = typeof next.pageSlug === 'string' ? next.pageSlug.toLowerCase() : '';
    const newSlug = slugMap.get(oldSlug);
    if (newSlug) {
      next.pageSlug = newSlug;
      next.href = newSlug === 'home' ? '/' : `/${newSlug}`;
      if (newSlug === 'services') next.label = 'Services';
      if (newSlug === 'contact') next.label = 'Contact';
      if (newSlug === 'about') next.label = 'About';
    }
    if (String(next.label || '').toLowerCase().includes('subscribe')) next.label = copy.primaryCta;
    return next;
  });
}

function personalizeBlocks(value: unknown, copy: CategoryCopy, pageSlug: string) {
  if (!Array.isArray(value)) return value;
  return value.map((block) => {
    if (!block || typeof block !== 'object') return block;
    const next = { ...(block as AnyRecord) };
    next.data = personalizeBlockData(next.type, next.data || {}, copy, pageSlug);
    return next;
  });
}

function personalizeBlockData(type: string, data: AnyRecord, copy: CategoryCopy, pageSlug: string): AnyRecord {
  const next = { ...data };

  switch (type) {
    case 'hero':
      personalizeHero(next, copy);
      break;
    case 'servicesGrid':
      next.title = copy.servicesTitle;
      next.subtitle = copy.servicesSubtitle;
      next.ctaText = copy.primaryCta;
      next.ctaTextLink = pageLink('contact');
      next.items = copy.services;
      break;
    case 'stats':
      next.title = pageSlug === 'home' ? 'Plenty of proof at a glance' : 'Proof you can scan';
      next.items = copy.stats;
      break;
    case 'carousel':
      next.title = 'How it works';
      next.subtitle = 'A simple process from first request to finished work.';
      next.items = copy.process.map((item) => ({ mediaType: 'icon', icon: item.icon || 'CheckCircle', title: item.title, text: item.text }));
      break;
    case 'aboutImageText':
      next.title = copy.aboutTitle;
      next.description = copy.aboutDescription;
      next.items = copy.aboutItems;
      next.image = copy.sampleImages[1] || next.image;
      break;
    case 'featuredQuote':
      next.title = next.variant === 'multiGrid' ? 'What customers appreciate' : copy.aboutTitle;
      next.quote = copy.quote;
      next.personName = 'Local client';
      next.personTitle = 'Verified customer';
      next.personContext = copy.siteTitle;
      if (Array.isArray(next.people)) {
        next.people = copy.testimonials.map((item) => ({
          name: item.name,
          title: item.title || item.role || 'Customer',
          quote: item.quote,
        }));
      }
      break;
    case 'testimonials':
      next.title = 'What customers say';
      next.subtitle = 'Trust-building feedback for visitors comparing their options.';
      next.items = copy.testimonials;
      break;
    case 'cta':
      next.title = copy.ctaTitle;
      next.subtitle = copy.ctaSubtitle;
      next.buttonText = copy.primaryCta;
      next.buttonTextLink = pageLink('contact');
      break;
    case 'contact_form':
      next.title = copy.formTitle;
      next.description = copy.formDescription;
      next.submitText = copy.primaryCta;
      next.successMessage = 'Thanks. We will follow up with next steps shortly.';
      break;
    case 'contact':
      next.title = `Contact ${copy.siteTitle}`;
      next.subtitle = 'Replace these details with your real phone, email, address, and hours.';
      next.phone = '(555) 123-4567';
      next.email = 'hello@example.com';
      next.address = 'Your service area';
      next.hours = 'Mon-Fri 8:00 AM - 6:00 PM';
      break;
    case 'pricing':
      next.title = 'Service options';
      next.subtitle = 'Starter pricing examples that can be edited or replaced.';
      next.tiers = copy.pricingTiers;
      break;
    case 'estimateForm':
      next.title = copy.formTitle;
      next.description = copy.formDescription;
      next.submitText = copy.primaryCta;
      next.successMessage = 'Thanks. We will review your request and respond shortly.';
      next.fields = copy.estimateFields;
      break;
    case 'faq':
      next.title = 'Common questions';
      next.subtitle = 'Answer practical questions before visitors reach out.';
      next.items = copy.faq;
      break;
    case 'resources':
      next.title = pageSlug === 'services' ? 'Service details' : 'Helpful information';
      next.subtitle = 'Use these resources to explain your process and common customer questions.';
      next.items = copy.services.slice(0, 3).map((service, index) => ({
        id: `service-resource-${index + 1}`,
        type: 'text',
        title: service.title,
        description: service.description,
        body: `${service.title}: ${service.description}`,
      }));
      break;
    case 'productGrid':
      next.variant = next.variant || 'grid';
      next.showSeeMore = next.showSeeMore ?? false;
      next.featuredOnly = next.featuredOnly ?? false;
      break;
    case 'menu':
      next.menuTitle = copy.servicesTitle || 'Menu';
      next.menuSubtitle = copy.servicesSubtitle || 'Browse by section.';
      next.mode = 'items';
      next.variant = next.variant || 'list';
      next.showPrices = next.showPrices ?? true;
      next.showDescriptions = next.showDescriptions ?? true;
      next.showMenuTabs = next.showMenuTabs ?? true;
      next.categoryStyle = next.categoryStyle || 'heading';
      break;
    case 'deliveryLinks':
      next.title = 'Order online';
      next.subtitle = 'Add pickup, delivery, or ordering links when they are available.';
      next.links = Array.isArray(next.links) && next.links.length > 0 ? next.links : [
        { id: 'custom-order', platform: 'custom', label: 'Order online', url: '', enabled: true },
      ];
      break;
    case 'gallery':
      next.title = pageSlug === 'portfolio' ? 'Selected work' : 'Gallery';
      next.subtitle = 'Add images that show the work, product, space, or community.';
      next.columns = next.columns || 3;
      next.images = copy.sampleImages;
      break;
    case 'image':
      next.caption = next.caption || '';
      next.image = copy.sampleImages[0] || next.image;
      break;
    case 'blog':
      next.title = pageSlug === 'articles' ? 'Articles' : 'Latest updates';
      next.subtitle = 'Posts and news can be managed from the blog dashboard.';
      next.layout = next.layout || 'grid';
      break;
    case 'events':
      next.title = 'Upcoming events';
      next.subtitle = 'Add events from the admin dashboard.';
      next.sortOrder = next.sortOrder || 'asc';
      next.showPast = next.showPast ?? false;
      break;
    case 'team':
      next.title = 'People behind the work';
      next.subtitle = 'Replace these starter roles with your real team when ready.';
      next.members = [
        { name: 'Creative Lead', role: 'Direction and concepts', bio: 'Shapes the creative direction and keeps the work tied to the goal.' },
        { name: 'Strategy Lead', role: 'Brand and messaging', bio: 'Turns audience insight into clear positioning, content, and next steps.' },
        { name: 'Production Lead', role: 'Delivery and launch', bio: 'Coordinates assets, timelines, and handoff so campaigns move smoothly.' },
      ];
      break;
  }

  return next;
}

function personalizeHero(data: AnyRecord, copy: CategoryCopy) {
  data.title = copy.heroTitle;
  data.subtitle = copy.heroSubtitle;
  data.buttonText = copy.primaryCta;
  data.buttonTextLink = pageLink('contact');

  if (!Array.isArray(data.cards) || data.cards.length === 0) return;
  data.cards = data.cards.map((item: unknown, index: number) => {
    if (!item || typeof item !== 'object') return item;
    const card = item as AnyRecord;
    const content = heroCardContent(copy, index);
    card.content = { ...(card.content || {}) };
    card.content.title = { ...(card.content.title || {}), enabled: true, value: content.title };
    card.content.subtitle = { ...(card.content.subtitle || {}), enabled: true, value: content.subtitle };
    card.content.cta = {
      ...(card.content.cta || {}),
      enabled: true,
      label: content.cta,
      link: pageLink('contact'),
    };
    if (card.content.image?.enabled) {
      card.content.image = {
        ...card.content.image,
        url: copy.sampleImages[index % copy.sampleImages.length] || card.content.image.url || '',
      };
    }
    if (card.background?.type === 'image') {
      card.background = {
        ...card.background,
        image: {
          ...(card.background.image || {}),
          url: copy.sampleImages[index % copy.sampleImages.length] || card.background.image?.url || '',
        },
      };
    }
    return card;
  });
}

function heroCardContent(copy: CategoryCopy, index: number) {
  if (index === 1) {
    return {
      title: copy.servicesTitle,
      subtitle: copy.servicesSubtitle,
      cta: copy.primaryCta,
    };
  }
  if (index === 2) {
    return {
      title: copy.aboutTitle,
      subtitle: copy.aboutDescription,
      cta: copy.primaryCta,
    };
  }
  return {
    title: copy.heroTitle,
    subtitle: copy.heroSubtitle,
    cta: copy.primaryCta,
  };
}

function sampleImagesForCategory(category: string, businessType: string | null | undefined): string[] {
  if (CATEGORY_IMAGE_SETS[category]) return CATEGORY_IMAGE_SETS[category];
  if (['plumber', 'electrical', 'electrician', 'hvac', 'heating', 'handyman', 'mechanic', 'trades', 'cleaning', 'landscaping'].includes(category)) {
    return CATEGORY_IMAGE_SETS.trades;
  }
  if (['portfolio', 'photographer', 'videographer', 'architect'].includes(category)) {
    return CATEGORY_IMAGE_SETS.photographer;
  }
  if (businessType === 'portfolio') return CATEGORY_IMAGE_SETS.designer;
  return CATEGORY_IMAGE_SETS.general;
}

function getHeroAlign(card: AnyRecord): 'left' | 'center' | 'right' | null {
  const align = card.content?.title?.align || card.content?.subtitle?.align || card.content?.cta?.align;
  return align === 'left' || align === 'center' || align === 'right' ? align : null;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function inferPageRole(slug: string, businessType: string | null | undefined, usedServicePage: boolean): 'services' | 'contact' | 'about' | 'unchanged' {
  if (['contact', 'inquire', 'visit'].includes(slug)) return 'contact';
  if (['about', 'story', 'mission'].includes(slug)) return 'about';
  if (businessType === 'services' && !usedServicePage && ['drops', 'articles', 'portfolio', 'gallery', 'menu'].includes(slug)) return 'services';
  return 'unchanged';
}

function pageLink(pageSlug: string) {
  return { linkType: 'page', pageSlug };
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value || {}));
}

function normalizeCategory(category: string | null | undefined): string {
  return (category || '').trim().toLowerCase().replace(/-/g, '_');
}
