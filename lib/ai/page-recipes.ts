/**
 * Last-ditch page recipes used by the orchestrator when a page-build call
 * fails or returns no usable blocks. The orchestrator's per-page Claude call
 * should produce tailored copy; recipes only ensure the user is never left
 * staring at a blank page.
 *
 * Recipes use clean-but-generic copy with the site title slotted in. Users
 * can still personalize — these are just non-empty starting points.
 */

export interface RecipeBlock {
  blockType: string;
  data: Record<string, unknown>;
}

type RecipeFactory = (siteTitle: string) => RecipeBlock[];

const RECIPES: Record<string, RecipeFactory> = {
  shop: (title) => [
    { blockType: 'productGrid', data: {} },
    { blockType: 'cta', data: {
      title: 'Questions about a product?',
      subtitle: `Reach out and the ${title} team will get back to you.`,
      buttonText: 'Get in touch',
      buttonTextLink: { linkType: 'page', pageSlug: 'contact' },
    } },
  ],

  services: (title) => [
    { blockType: 'servicesGrid', data: {
      title: 'What we do',
      subtitle: `The services ${title} offers, with the details that matter.`,
      items: [
        { title: 'Service one', description: 'A clear description of the first service. Replace this with what you actually offer.' },
        { title: 'Service two', description: 'A clear description of the second service.' },
        { title: 'Service three', description: 'A clear description of the third service.' },
      ],
    } },
    { blockType: 'pricing', data: {
      title: 'Plans and pricing',
      subtitle: 'Simple options so you can pick what fits.',
      variant: 'simple',
      tiers: [
        { name: 'Starter', price: '$—', period: '', description: 'Best for small projects.', features: ['Initial consult', 'Single deliverable', 'Email support'], highlighted: false, buttonText: 'Get started' },
        { name: 'Standard', price: '$—', period: '', description: 'Most popular.', features: ['Multi-step engagement', 'Priority response', 'Dedicated contact'], highlighted: true, buttonText: 'Choose plan' },
        { name: 'Custom', price: 'Talk to us', period: '', description: 'Larger or unusual scope.', features: ['Tailored scope', 'Flexible timeline', 'Account lead'], highlighted: false, buttonText: 'Request quote' },
      ],
    } },
    { blockType: 'faq', data: {
      title: 'Frequently asked',
      subtitle: '',
      items: [
        { question: 'How do we get started?', answer: 'Reach out via the contact page and we will reply with next steps.' },
        { question: 'What does timeline look like?', answer: 'Most engagements kick off within a week of agreement.' },
        { question: 'Do you offer custom work?', answer: 'Yes — talk to us about scope and we will put together a plan.' },
      ],
    } },
    { blockType: 'cta', data: {
      title: 'Ready to talk?',
      subtitle: 'Pick a service and we will take it from there.',
      buttonText: 'Contact us',
      buttonTextLink: { linkType: 'page', pageSlug: 'contact' },
    } },
  ],

  about: (title) => [
    { blockType: 'aboutImageText', data: {
      title: `About ${title}`,
      description: `Replace this paragraph with the story of ${title} — what you do, who you serve, and why.`,
      imagePosition: 'right',
      items: ['Founded with intention', 'Built around our customers', 'Always learning'],
    } },
    { blockType: 'featuredQuote', data: {
      variant: 'essay',
      quote: 'Replace this with a quote that captures what your team stands for.',
      personName: 'Your name',
      personTitle: 'Founder',
    } },
    { blockType: 'cta', data: {
      title: 'Want to work together?',
      subtitle: 'Send us a note — we read every message.',
      buttonText: 'Get in touch',
      buttonTextLink: { linkType: 'page', pageSlug: 'contact' },
    } },
  ],

  contact: (title) => [
    { blockType: 'contact_form', data: {
      title: 'Send us a message',
      description: `Tell us how we can help. The ${title} team replies within one business day.`,
      submitText: 'Send message',
      successMessage: 'Thanks — we will be in touch shortly.',
    } },
    { blockType: 'contact', data: {
      title: 'Other ways to reach us',
      subtitle: '',
      phone: '',
      email: '',
      address: '',
      hours: '',
    } },
    { blockType: 'map', data: { title: 'Find us', address: '' } },
  ],

  booking: (title) => [
    { blockType: 'booking', data: {} },
    { blockType: 'servicesGrid', data: {
      title: 'What you can book',
      subtitle: '',
      items: [
        { title: 'Initial consult', description: 'A first conversation to understand your goals and fit.' },
        { title: 'Follow-up session', description: 'Continued support with the same provider.' },
        { title: 'Specialty appointment', description: 'A focused session for a specific need.' },
      ],
    } },
    { blockType: 'faq', data: {
      title: 'Before you book',
      subtitle: '',
      items: [
        { question: 'Can I reschedule?', answer: `Yes — manage rescheduling through your ${title} confirmation email.` },
        { question: 'What should I bring?', answer: 'Replace this with what visitors should prepare or bring.' },
        { question: 'Do you offer virtual sessions?', answer: 'Update this answer with whether you offer virtual or in-person.' },
      ],
    } },
  ],

  menu: (title) => [
    { blockType: 'menu', data: {
      menuTitle: 'Our menu',
      menuSubtitle: `What ${title} is serving today.`,
      variant: 'list',
      showPrices: true,
      showDescriptions: true,
      categoryStyle: 'heading',
    } },
    { blockType: 'deliveryLinks', data: {
      title: 'Order online',
      subtitle: 'Pickup or delivery, your call.',
      links: [
        { id: 'order-1', platform: 'custom', label: 'Order online', url: '', enabled: true },
      ],
    } },
    { blockType: 'contact', data: {
      title: 'Visit us',
      subtitle: '',
      phone: '',
      email: '',
      address: '',
      hours: '',
    } },
  ],

  gallery: (title) => [
    { blockType: 'gallery', data: {
      title: `${title} gallery`,
      subtitle: 'A look at recent work.',
      columns: 3,
    } },
    { blockType: 'featuredQuote', data: {
      variant: 'minimal',
      quote: 'Replace this with a quote about your work or process.',
      personName: title,
      personTitle: '',
    } },
    { blockType: 'cta', data: {
      title: 'Have a project in mind?',
      subtitle: 'Send a few details and we will reply with availability.',
      buttonText: 'Get in touch',
      buttonTextLink: { linkType: 'page', pageSlug: 'contact' },
    } },
  ],

  portfolio: (title) => [
    { blockType: 'gallery', data: {
      title: 'Selected work',
      subtitle: `Recent projects from ${title}.`,
      columns: 4,
    } },
    { blockType: 'featuredQuote', data: {
      variant: 'minimal',
      quote: 'Replace this with a quote that captures your point of view.',
      personName: title,
      personTitle: '',
    } },
    { blockType: 'cta', data: {
      title: 'Have a project in mind?',
      subtitle: '',
      buttonText: 'Inquire',
      buttonTextLink: { linkType: 'page', pageSlug: 'contact' },
    } },
  ],

  blog: (title) => [
    { blockType: 'blog', data: {
      title: `${title} blog`,
      subtitle: 'Thoughts, updates, and notes.',
      layout: 'grid',
    } },
    { blockType: 'cta', data: {
      title: 'Want more?',
      subtitle: 'Get future posts delivered to your inbox.',
      buttonText: 'Subscribe',
    } },
  ],

  articles: (title) => [
    { blockType: 'blog', data: {
      title: 'Articles',
      subtitle: `The latest from ${title}.`,
      layout: 'magazine',
    } },
    { blockType: 'cta', data: {
      title: 'Stay in the loop',
      subtitle: '',
      buttonText: 'Subscribe',
    } },
  ],

  pricing: (title) => [
    { blockType: 'pricing', data: {
      title: 'Pricing',
      subtitle: `${title}'s plans, laid out clearly.`,
      variant: 'cards',
      tiers: [
        { name: 'Starter', price: '$—', period: 'mo', description: 'For getting started.', features: ['Feature one', 'Feature two', 'Feature three'], highlighted: false, buttonText: 'Choose Starter' },
        { name: 'Pro', price: '$—', period: 'mo', description: 'Most popular.', features: ['Everything in Starter', 'Feature four', 'Feature five'], highlighted: true, buttonText: 'Choose Pro' },
        { name: 'Custom', price: 'Talk to us', period: '', description: 'For larger needs.', features: ['Custom scope', 'Account lead', 'Priority support'], highlighted: false, buttonText: 'Contact us' },
      ],
    } },
    { blockType: 'faq', data: {
      title: 'Pricing questions',
      subtitle: '',
      items: [
        { question: 'Can I change plans later?', answer: 'Yes — you can upgrade or downgrade at any time.' },
        { question: 'Is there a free trial?', answer: 'Replace this with whether you offer a trial period.' },
      ],
    } },
    { blockType: 'cta', data: {
      title: 'Ready to choose a plan?',
      subtitle: '',
      buttonText: 'Get started',
      buttonTextLink: { linkType: 'page', pageSlug: 'contact' },
    } },
  ],

  faq: (title) => [
    { blockType: 'faq', data: {
      title: 'Frequently asked',
      subtitle: `Common questions about ${title}.`,
      items: [
        { question: 'Replace with question one', answer: 'Replace with a clear answer.' },
        { question: 'Replace with question two', answer: 'Replace with a clear answer.' },
        { question: 'Replace with question three', answer: 'Replace with a clear answer.' },
      ],
    } },
    { blockType: 'cta', data: {
      title: 'Still have questions?',
      subtitle: '',
      buttonText: 'Contact us',
      buttonTextLink: { linkType: 'page', pageSlug: 'contact' },
    } },
  ],

  team: (title) => [
    { blockType: 'team', data: {
      title: `The ${title} team`,
      variant: 'grid',
      members: [
        { name: 'Team member one', role: 'Role', bio: 'Replace with a short bio.' },
        { name: 'Team member two', role: 'Role', bio: 'Replace with a short bio.' },
        { name: 'Team member three', role: 'Role', bio: 'Replace with a short bio.' },
      ],
    } },
    { blockType: 'cta', data: {
      title: `Want to work with ${title}?`,
      subtitle: '',
      buttonText: 'Get in touch',
      buttonTextLink: { linkType: 'page', pageSlug: 'contact' },
    } },
  ],
};

/**
 * Returns a non-empty block list for the given slug. Falls back to a minimal
 * text + cta recipe for unknown slugs so the page is never blank.
 */
export function getRecipeBlocks(slug: string, siteTitle: string): RecipeBlock[] {
  const key = slug.toLowerCase();
  const factory = RECIPES[key];
  if (factory) return factory(siteTitle);

  return [
    { blockType: 'text', data: {
      html: `<h2>${escapeHtml(siteTitle)} — ${escapeHtml(prettify(slug))}</h2><p>Replace this paragraph with what should appear on this page.</p>`,
    } },
    { blockType: 'cta', data: {
      title: 'Get in touch',
      subtitle: '',
      buttonText: 'Contact us',
      buttonTextLink: { linkType: 'page', pageSlug: 'contact' },
    } },
  ];
}

function prettify(slug: string): string {
  return slug.split(/[-_]/g).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
