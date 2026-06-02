import { getTemplatePreviewImage } from '@/lib/template-preview-assets';
import { AI_ONBOARDING_TEMPLATE_ID } from '@/lib/templates/ai-template';
import { PRESET_TEMPLATE_DISPLAYS } from '@/lib/templates/preset-template-display';
import type { CardStyle } from '@/lib/block-style-options';

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

// ── Hero helpers (new schema: cards / transition / height) ─────────────────
type HAlign = 'left' | 'center' | 'right';
type HSide = 'left' | 'right';
type HHeightMode = 'fitContent' | 'fitScreen' | 'manual';
const hCard = (
  id: string,
  title: string,
  subtitle: string,
  ctaLabel: string,
  align: HAlign,
  background: Record<string, unknown>,
  opts: { ctaEnabled?: boolean; ctaLink?: unknown; image?: { url: string; side?: HSide } } = {},
) => ({
  id,
  content: {
    title: { enabled: true, value: title, align },
    subtitle: { enabled: true, value: subtitle, align },
    cta: { enabled: opts.ctaEnabled !== false, label: ctaLabel, link: opts.ctaLink, align },
    image: { enabled: !!opts.image, url: opts.image?.url || '', side: opts.image?.side || 'right' },
  },
  background,
});
const hBgGradient = (from: string, to: string, angle = 0, opacity = 0) => ({
  type: 'gradient',
  gradient: { from, to, angle },
  overlay: { color: '#000000', opacity },
});
const hBgImage = (url: string, opacity = 0.5) => ({
  type: 'image',
  image: { url },
  overlay: { color: '#000000', opacity },
});
const hHeight = (mode: HHeightMode = 'fitContent', valuePx = 600, revealNext = 0) => ({
  desktop: { mode, valuePx, revealNext },
  tablet: { mode, valuePx: Math.max(520, valuePx - 40), revealNext },
  mobile: {
    mode: mode === 'fitScreen' ? 'fitContent' : mode,
    valuePx: Math.max(480, valuePx - 80),
    revealNext: 0,
  },
});
const heroBlockData = (
  cards: unknown[],
  opts: { height?: HHeightMode; transition?: 'fade' | 'slide' | 'none'; intervalSec?: number; valuePx?: number; revealNext?: number } = {},
) => ({
  cards,
  transition: { type: opts.transition || 'fade', intervalSec: opts.intervalSec || 5, pauseOnHover: true },
  height: hHeight(opts.height || 'fitContent', opts.valuePx || 600, opts.revealNext || 0),
});

const navItem = (label: string, pageSlug: string) => ({
  label,
  linkType: 'page',
  pageSlug,
});

const customizables = {
  hero: ['title', 'subtitle', 'buttonText', 'variant', 'image', 'background'],
  cta: ['title', 'subtitle', 'buttonText'],
  servicesGrid: ['title', 'subtitle', 'items', 'ctaText', 'cardStyle', 'cardSettings', 'surfaceStyle', 'markerStyle', 'spacingDensity', 'textAlign'],
  testimonials: ['title', 'subtitle', 'variant', 'items', 'cardStyle', 'cardSettings', 'surfaceStyle', 'spacingDensity'],
  stats: ['title', 'variant', 'items', 'cardStyle', 'cardSettings', 'surfaceStyle', 'spacingDensity', 'textAlign'],
  aboutImageText: ['title', 'description', 'image', 'items', 'mediaTreatment', 'textAlign'],
  featuredQuote: ['variant', 'quote', 'personName', 'personTitle', 'people'],
  carousel: ['title', 'subtitle', 'variant', 'items', 'cardStyle', 'cardSettings', 'surfaceStyle', 'mediaAspect', 'mediaTreatment', 'iconStyle', 'spacingDensity', 'textAlign'],
  menu: ['menuTitle', 'menuSubtitle', 'variant'],
  booking: ['services', 'availability'],
  blog: ['title', 'subtitle', 'layout'],
  gallery: ['title', 'subtitle', 'images', 'columns', 'frameStyle', 'mediaAspect'],
  estimateForm: ['title', 'description', 'variant', 'fields'],
  contact: ['title', 'subtitle', 'phone', 'email', 'address', 'hours'],
};

const AI_ONBOARDING_TEMPLATE_METADATA: StructuralTemplateMetadata = {
  id: 'ai-onboarding-custom',
  template_id: AI_ONBOARDING_TEMPLATE_ID,
  name: 'Custom',
  description: 'A blank AI-generated starting point. Archie creates the page structure, content, styling, and settings from the onboarding prompt.',
  category: 'general',
  business_type: 'both',
  palettes: {
    Default: { primary: '#111827', secondary: '#ef4444', accent: '#f8fafc' },
    Warm: { primary: '#3f2a1d', secondary: '#d97706', accent: '#fff7ed' },
    Fresh: { primary: '#0f766e', secondary: '#2563eb', accent: '#ecfeff' },
    Editorial: { primary: '#18181b', secondary: '#be123c', accent: '#fafafa' },
  },
  customizables,
  thumbnail_url: '/templates/custom-ai.svg',
  multi_page: true,
  has_blog: true,
  has_gallery: true,
  created_at: CREATED_AT,
  updated_at: CREATED_AT,
  default_content: {
    siteTitle: 'Custom Site',
    titleFont: 'Inter',
    bodyFont: 'Inter',
    navButtonText: 'Contact',
    headerBgType: 'white',
    headerLogoPosition: 'left',
    headerNavPosition: 'right',
    headerDesktopMenuStyle: 'inline',
    headerRightSide: 'cta',
    headerSticky: 'always',
    __navItems: [
      navItem('Home', 'home'),
    ],
    blocks: [],
    extra_pages: [],
  },
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
  'builder',
  'commerce',
  'foundation',
  'wellness',
  'estate',
  'studio',
  'learn',
  'occasion',
] as const;

type StructuralTemplateStyle = typeof STRUCTURAL_TEMPLATE_STYLES[number];

type TemplatePresetPlan = {
  primary: CardStyle;
};

export const TEMPLATE_CARD_PRESET_PLANS: Record<StructuralTemplateStyle, TemplatePresetPlan> = {
  atlas: { primary: 'utility' },
  editorial: { primary: 'editorial' },
  booked: { primary: 'elevated' },
  menu: { primary: 'poster' },
  craft: { primary: 'splitMedia' },
  retro: { primary: 'offset' },
  proof: { primary: 'slab' },
  gallery: { primary: 'clipped' },
  builder: { primary: 'bordered' },
  commerce: { primary: 'gradient' },
  foundation: { primary: 'inset' },
  wellness: { primary: 'soft' },
  estate: { primary: 'luxe' },
  studio: { primary: 'outline' },
  learn: { primary: 'accent' },
  occasion: { primary: 'playful' },
};

const TEMPLATE_STYLE_ALIASES: Record<string, StructuralTemplateStyle> = {
  utility: 'atlas',
  editorial_rule: 'editorial',
  editorial: 'editorial',
  raised: 'booked',
  elevated: 'booked',
  poster: 'menu',
  showcase: 'craft',
  split_media: 'craft',
  splitmedia: 'craft',
  retro: 'retro',
  offset: 'retro',
  ledger: 'proof',
  slab: 'proof',
  clipped: 'gallery',
  bordered: 'builder',
  gradient_wash: 'commerce',
  gradient: 'commerce',
  inset: 'foundation',
  soft: 'wellness',
  luxe_hairline: 'estate',
  luxe: 'estate',
  outline: 'studio',
  accent_rail: 'learn',
  accent: 'learn',
  playful: 'occasion',
};

const CARD_PRESET_AWARE_BLOCK_TYPES = new Set([
  'carousel',
  'contact',
  'contact_form',
  'contactForm',
  'estimateForm',
  'faq',
  'featuresList',
  'pricing',
  'productGrid',
  'servicesGrid',
  'stats',
  'testimonials',
  'timeline',
]);
const CARD_PRESET_LEGACY_OVERRIDE_FIELDS = [
  'cardSettings',
  'surfaceStyle',
  'markerStyle',
  'spacingDensity',
  'textAlign',
  'iconStyle',
  'mediaAspect',
  'mediaTreatment',
  'mediaSize',
  'mediaSizePercent',
  'mediaRadiusPx',
] as const;

export const PUBLIC_TEMPLATE_STYLES = STRUCTURAL_TEMPLATE_STYLES;

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

const BASE_STRUCTURAL_TEMPLATE_METADATA: StructuralTemplateMetadata[] = [
  {
    id: 'structural-atlas-general',
    template_id: 'atlas_general',
    name: 'Utility',
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
      siteTitle: 'Utility',
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
        block('hero', heroBlockData([
          hCard(
            'atlas-hero-1',
            'Operational clarity for complex teams',
            'Strategy, systems, and reporting for companies that need cleaner decisions and faster execution.',
            'Book Strategy Call',
            'left',
            hBgGradient('palette:accent', '#ffffff', 180, 0),
            { ctaLink, image: { url: image('photo-1497366811353-6870744d04b2'), side: 'right' } },
          ),
        ], {
        })),
        block('logoCloud', {
          title: 'Trusted by growth-stage teams, operators, and boards',
          variant: 'marquee',
          backgroundColor: '#ffffff',
        }),
        block('stats', {
          title: 'Measured momentum',
          variant: 'cards',
          cardStyle: 'accent',
          surfaceStyle: 'white',
          spacingDensity: 'compact',
          textAlign: 'center',
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
          cardStyle: 'bordered',
          surfaceStyle: 'white',
          markerStyle: 'accentLine',
          spacingDensity: 'standard',
          textAlign: 'left',
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
          iconStyle: 'framed',
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
    name: 'Editorial Rule',
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
      siteTitle: 'Editorial Rule',
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
        block('hero', heroBlockData([
          hCard(
            'editorial-hero-1',
            'Ideas for people building what comes next',
            'Sharp essays, interviews, and field notes for founders, operators, and independent brands.',
            '',
            'left',
            hBgGradient('palette:accent', 'palette:accent', 0, 0),
            { ctaEnabled: false },
          ),
        ], {
        })),
        block('servicesGrid', {
          title: 'Sections readers can follow',
          subtitle: 'Turn a content brand into repeatable paths instead of a loose pile of posts.',
          backgroundColor: '#ffffff',
          markerStyle: 'plain',
          spacingDensity: 'compact',
          items: [
            { title: 'Essays', description: 'Longer opinion pieces with a clear editorial point of view.' },
            { title: 'Interviews', description: 'Conversations that bring expert perspective into the archive.' },
            { title: 'Field Notes', description: 'Short practical observations for readers who want signal fast.' },
          ],
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
    name: 'Raised',
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
      siteTitle: 'Raised',
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
        block('hero', heroBlockData([
          hCard(
            'booked-hero-1',
            'Book the right appointment in minutes',
            'A calm, practical layout for service providers who want visitors to schedule without friction.',
            'Book Now',
            'center',
            hBgGradient('palette:accent', 'palette:accent', 0, 0),
            { ctaLink: bookingLink },
          ),
        ], {
        })),
        block('booking', {}),
        block('servicesGrid', {
          title: 'Choose your visit',
          subtitle: 'Clear service paths help visitors know exactly what to book.',
          cardStyle: 'elevated',
          surfaceStyle: 'accent',
          markerStyle: 'badge',
          spacingDensity: 'spacious',
          textAlign: 'center',
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
          iconStyle: 'plain',
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
    name: 'Poster',
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
      siteTitle: 'Poster',
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
        block('hero', heroBlockData([
          hCard(
            'menu-hero-1',
            'A neighborhood table with a seasonal menu',
            'Small plates, fresh pasta, and a dining room built for unhurried evenings.',
            'View Menu',
            'center',
            hBgImage(image('photo-1517248135467-4c7edcad34c4'), 0.5),
          ),
        ], {
          height: 'fitScreen',
        })),
        block('carousel', {
          title: "Tonight's highlights",
          subtitle: 'Use poster-style cards for signature dishes, chef picks, catering packages, or seasonal specials.',
          variant: 'cards',
          mediaTreatment: 'fullBleed',
          mediaAspect: 'landscape',
          backgroundColor: '#ffffff',
          items: [
            { mediaType: 'image', image: image('photo-1504674900247-0877df9cc836'), title: 'Seasonal plate', text: 'Lead with one dish that carries the menu mood.' },
            { mediaType: 'image', image: image('photo-1473093295043-cdd812d0e601'), title: 'House pasta', text: 'Show a signature item with a short appetite-building note.' },
            { mediaType: 'image', image: image('photo-1488477181946-6428a0291777'), title: 'Weekend table', text: 'Point visitors toward reservations, brunch, or private dining.' },
          ],
        }),
        block('menu', {
          menuTitle: 'Menu highlights',
          menuSubtitle: 'Browse brunch, dinner, and drinks by section.',
          variant: 'cards',
          showPrices: true,
          showDescriptions: true,
          showImages: true,
          showFeaturedImages: true,
          showMenuTabs: true,
          showMenuIcons: true,
          categoryStyle: 'badge',
          backgroundColor: 'palette:accent',
          showMenuIconLegend: true,
          menuIconLegendPosition: 'bottom',
          menuIconLegendMode: 'used',
          itemDetailEnabled: true,
          itemDetailShowPhoto: true,
          itemDetailPhotoVisibility: 'menu',
          itemDetailShowName: true,
          itemDetailShowDescription: true,
          itemDetailShowPrice: true,
          itemDetailShowCategory: false,
          itemDetailShowIcons: true,
          itemDetailImageFit: 'cover',
        }),
        block('gallery', {
          title: 'From the kitchen',
          subtitle: 'Food, light, and a little Friday-night energy.',
          columns: 4,
          frameStyle: 'rounded',
          mediaAspect: 'landscape',
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
              showImages: false,
              showFeaturedImages: true,
              showMenuTabs: true,
              showMenuIcons: true,
              categoryStyle: 'divider',
              showMenuIconLegend: true,
              menuIconLegendPosition: 'bottom',
              menuIconLegendMode: 'used',
              itemDetailEnabled: true,
              itemDetailShowPhoto: true,
              itemDetailPhotoVisibility: 'menu',
              itemDetailShowName: true,
              itemDetailShowDescription: true,
              itemDetailShowPrice: true,
              itemDetailShowCategory: true,
              itemDetailShowIcons: true,
              itemDetailImageFit: 'contain',
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
    name: 'Showcase',
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
      siteTitle: 'Showcase',
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
        block('hero', heroBlockData([
          hCard(
            'craft-hero-1',
            'Small-batch goods with a human hand',
            'Warm, tactile, locally made pieces for homes that prefer character over sameness.',
            'Shop Local',
            'left',
            hBgGradient('palette:accent', 'palette:accent', 0, 0),
            { image: { url: image('photo-1452860606245-08befc0ff44b'), side: 'right' } },
          ),
        ], {
        })),
        block('carousel', {
          title: 'Made in small runs',
          subtitle: 'A showcase that feels closer to a market table than a product grid.',
          variant: 'slides',
          cardStyle: 'poster',
          mediaTreatment: 'fullBleed',
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
          mediaTreatment: 'framed',
          image: image('photo-1528756514091-dee5ecaa3278'),
          backgroundColor: 'palette:accent',
          items: ['Made locally', 'Limited batches', 'Natural materials', 'Custom orders welcome'],
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
        }),
        block('gallery', {
          title: 'Studio fragments',
          subtitle: 'Materials, shelves, finished work, and market days.',
          columns: 3,
          frameStyle: 'rounded',
          mediaAspect: 'square',
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
          cardStyle: 'soft',
          surfaceStyle: 'white',
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
      siteTitle: 'Retro',
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
        block('hero', heroBlockData([
          hCard(
            'retro-hero-1',
            'Make the internet fun again',
            'A bold starter layout for pop-ups, creators, youth brands, events, and playful campaigns.',
            'Start Something',
            'center',
            hBgGradient('palette:accent', 'palette:accent', 0, 0),
          ),
        ], {
        })),
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
          cardStyle: 'offset',
          surfaceStyle: 'accent',
          mediaAspect: 'square',
          iconStyle: 'numbered',
          spacingDensity: 'compact',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          items: [
            { mediaType: 'icon', icon: 'Zap', title: 'Launch pages', text: 'Fast, loud pages for launches, drops, and campaigns.' },
            { mediaType: 'icon', icon: 'Music', title: 'Event energy', text: 'Sections for schedules, guests, recaps, and ticket pushes.' },
            { mediaType: 'icon', icon: 'Palette', title: 'Brand play', text: 'A visual system that feels expressive while staying usable.' },
            { mediaType: 'icon', icon: 'Heart', title: 'Community hooks', text: 'Badges, quotes, and CTAs that invite people in.' },
          ],
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
              frameStyle: 'poster',
              mediaAspect: 'square',
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
    name: 'Ledger',
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
      siteTitle: 'Ledger',
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
        block('hero', heroBlockData([
          hCard(
            'proof-hero-1',
            'Trust is the first conversion',
            'A credibility-led layout for businesses where proof, reviews, and risk reversal matter.',
            'Request Review',
            'center',
            hBgImage(image('photo-1450101499163-c8848c66ca85'), 0.5),
          ),
        ], {
          height: 'fitScreen',
        })),
        block('logoCloud', {
          title: 'Certifications, partners, and local recognition',
          variant: 'grid',
          backgroundColor: 'palette:accent',
        }),
        block('stats', {
          title: 'Results visitors can scan',
          variant: 'banner',
          cardStyle: 'solid',
          surfaceStyle: 'primary',
          spacingDensity: 'compact',
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
          mediaTreatment: 'contained',
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
    name: 'Clipped',
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
      siteTitle: 'Clipped',
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
        block('hero', heroBlockData([
          hCard(
            'gallery-hero-1',
            'A portfolio that lets the work breathe',
            'Large images, lean copy, and direct project pathways for photographers, designers, makers, and studios.',
            'View Portfolio',
            'left',
            hBgImage(image('photo-1492691527719-9d1e07e534b4'), 0.5),
            { ctaEnabled: false },
          ),
          hCard(
            'gallery-hero-2',
            'A portfolio that lets the work breathe',
            'Large images, lean copy, and direct project pathways for photographers, designers, makers, and studios.',
            'View Portfolio',
            'left',
            hBgImage(image('photo-1516035069371-29a1b244cc32'), 0.5),
            { ctaEnabled: false },
          ),
          hCard(
            'gallery-hero-3',
            'A portfolio that lets the work breathe',
            'Large images, lean copy, and direct project pathways for photographers, designers, makers, and studios.',
            'View Portfolio',
            'left',
            hBgImage(image('photo-1500530855697-b586d89ba3ee'), 0.5),
            { ctaEnabled: false },
          ),
        ], {
          height: 'fitScreen',
          intervalSec: 6,
        })),
        block('image', {
          image: image('photo-1516035069371-29a1b244cc32'),
          image__settings: { altText: 'Large featured portfolio image' },
        }),
        block('gallery', {
          title: 'Selected work',
          subtitle: 'A visual index for recent projects.',
          columns: 4,
          frameStyle: 'gapless',
          mediaAspect: 'square',
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
        }),
        block('carousel', {
          title: 'Project spotlights',
          variant: 'slides',
          cardStyle: 'poster',
          mediaTreatment: 'fullBleed',
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
              frameStyle: 'gapless',
              mediaAspect: 'square',
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

const DERIVED_STRUCTURAL_TEMPLATE_SOURCES: Array<{
  style: typeof STRUCTURAL_TEMPLATE_STYLES[number];
  sourceStyle: typeof STRUCTURAL_TEMPLATE_STYLES[number];
  name: string;
  description: string;
  businessType: string;
  category?: string;
  siteTitle: string;
  titleFont: string;
  bodyFont: string;
  navButtonText: string;
  palettes: Record<string, Record<string, string>>;
}> = [
  {
    style: 'builder',
    sourceStyle: 'proof',
    name: 'Bordered',
    description: 'A sturdy field-service layout for trades, contractors, service areas, proof, and estimates.',
    businessType: 'services',
    siteTitle: 'Bordered',
    titleFont: 'Merriweather',
    bodyFont: 'Inter',
    navButtonText: 'Request Estimate',
    palettes: {
      Worksite: { primary: '#1f2937', secondary: '#f59e0b', accent: '#f8fafc' },
      Blueprint: { primary: '#14365d', secondary: '#2563eb', accent: '#eff6ff' },
      Utility: { primary: '#172033', secondary: '#16a34a', accent: '#f3f6f4' },
    },
  },
  {
    style: 'commerce',
    sourceStyle: 'craft',
    name: 'Gradient Wash',
    description: 'A product-first shop layout for catalogs, featured items, subscriptions, and conversion sections.',
    businessType: 'products',
    siteTitle: 'Gradient Wash',
    titleFont: 'Space Grotesk',
    bodyFont: 'Inter',
    navButtonText: 'Shop Now',
    palettes: {
      Market: { primary: '#111827', secondary: '#2563eb', accent: '#eff6ff' },
      Drop: { primary: '#261447', secondary: '#f97316', accent: '#fff7ed' },
      Clean: { primary: '#172033', secondary: '#0f766e', accent: '#ecfeff' },
    },
  },
  {
    style: 'foundation',
    sourceStyle: 'craft',
    name: 'Inset',
    description: 'A community-minded layout for nonprofits, churches, charities, associations, and missions.',
    businessType: 'both',
    siteTitle: 'Inset',
    titleFont: 'Fraunces',
    bodyFont: 'Karla',
    navButtonText: 'Get Involved',
    palettes: {
      Mission: { primary: '#26413c', secondary: '#c2410c', accent: '#f7f4ed' },
      Hope: { primary: '#1f3a5f', secondary: '#0f766e', accent: '#ecfeff' },
      Grounded: { primary: '#3f3a2f', secondary: '#7c3aed', accent: '#faf7ed' },
    },
  },
  {
    style: 'wellness',
    sourceStyle: 'booked',
    name: 'Soft',
    description: 'A calm care-centered layout for health, therapy, spa, fitness, and coaching businesses.',
    businessType: 'services',
    siteTitle: 'Soft',
    titleFont: 'Nunito',
    bodyFont: 'Inter',
    navButtonText: 'Book Visit',
    palettes: {
      Calm: { primary: '#243b3b', secondary: '#0f766e', accent: '#ecfdf5' },
      Rose: { primary: '#3f2a3d', secondary: '#be123c', accent: '#fff1f2' },
      Fresh: { primary: '#1f2937', secondary: '#65a30d', accent: '#f7fee7' },
    },
  },
  {
    style: 'estate',
    sourceStyle: 'gallery',
    name: 'Luxe Hairline',
    description: 'A visual, premium layout for real estate, properties, interiors, and spaces.',
    businessType: 'both',
    siteTitle: 'Luxe Hairline',
    titleFont: 'Sora',
    bodyFont: 'Inter',
    navButtonText: 'View Listings',
    palettes: {
      Gallery: { primary: '#171717', secondary: '#a16207', accent: '#fafaf9' },
      Slate: { primary: '#1e293b', secondary: '#0f766e', accent: '#f8fafc' },
      Stone: { primary: '#292524', secondary: '#57534e', accent: '#f5f5f4' },
    },
  },
  {
    style: 'studio',
    sourceStyle: 'gallery',
    name: 'Outline',
    description: 'A portfolio-meets-services layout for agencies, studios, freelancers, and brand teams.',
    businessType: 'both',
    siteTitle: 'Outline',
    titleFont: 'Space Grotesk',
    bodyFont: 'Inter',
    navButtonText: 'Start Project',
    palettes: {
      Ink: { primary: '#111827', secondary: '#db2777', accent: '#fdf2f8' },
      Signal: { primary: '#18181b', secondary: '#2563eb', accent: '#eff6ff' },
      Mono: { primary: '#171717', secondary: '#737373', accent: '#fafafa' },
    },
  },
  {
    style: 'learn',
    sourceStyle: 'editorial',
    name: 'Accent Rail',
    description: 'A structured education layout for courses, tutoring, workshops, and learning programs.',
    businessType: 'both',
    siteTitle: 'Accent Rail',
    titleFont: 'Libre Baskerville',
    bodyFont: 'Source Sans 3',
    navButtonText: 'Start Learning',
    palettes: {
      Notebook: { primary: '#1f2937', secondary: '#2563eb', accent: '#eff6ff' },
      Campus: { primary: '#1e3a5f', secondary: '#16a34a', accent: '#f0fdf4' },
      Chalk: { primary: '#27272a', secondary: '#ca8a04', accent: '#fefce8' },
    },
  },
  {
    style: 'occasion',
    sourceStyle: 'retro',
    name: 'Playful',
    description: 'A celebratory layout for events, weddings, venues, pop-ups, planners, and special moments.',
    businessType: 'both',
    siteTitle: 'Playful',
    titleFont: 'Space Grotesk',
    bodyFont: 'DM Sans',
    navButtonText: 'Plan Event',
    palettes: {
      Confetti: { primary: '#261447', secondary: '#f97316', accent: '#fff7ed' },
      Toast: { primary: '#3b2434', secondary: '#db2777', accent: '#fdf2f8' },
      Night: { primary: '#111827', secondary: '#a855f7', accent: '#faf5ff' },
    },
  },
];

function deriveStructuralTemplate(definition: typeof DERIVED_STRUCTURAL_TEMPLATE_SOURCES[number]): StructuralTemplateMetadata {
  const source = BASE_STRUCTURAL_TEMPLATE_METADATA.find((template) => template.template_id === `${definition.sourceStyle}_general`)
    || BASE_STRUCTURAL_TEMPLATE_METADATA.find((template) => template.template_id.startsWith(`${definition.sourceStyle}_`));
  if (!source) {
    throw new Error(`Missing source structural template for ${definition.style}`);
  }
  const defaultContent = customizeDerivedStructuralContent(definition.style, cloneRecord(source.default_content));
  return {
    ...source,
    id: `structural-${definition.style}-general`,
    template_id: `${definition.style}_general`,
    name: definition.name,
    description: definition.description,
    category: definition.category || 'general',
    business_type: definition.businessType,
    palettes: definition.palettes,
    thumbnail_url: thumb(definition.style),
    default_content: {
      ...defaultContent,
      siteTitle: definition.siteTitle,
      titleFont: definition.titleFont,
      bodyFont: definition.bodyFont,
      navButtonText: definition.navButtonText,
    },
  };
}

function customizeDerivedStructuralContent(style: StructuralTemplateStyle, content: Record<string, unknown>): Record<string, unknown> {
  switch (style) {
    case 'builder':
      setNav(content, [
        navItem('Home', 'home'),
        navItem('Projects', 'results'),
        navItem('Estimate', 'estimate'),
      ]);
      setHero(content, 'builder-hero-1', 'Built for the jobs people need priced fast', 'A sturdy field-service layout for service areas, proof, warranties, and estimate intake.', 'Request Estimate', 'left', hBgGradient('palette:accent', '#ffffff', 180, 0), {
        ctaLink,
        image: { url: image('photo-1504307651254-35680f356dfd'), side: 'right' },
      });
      mergeBlockData(content, 'stats', {
        title: 'Field-ready proof',
        items: [
          { value: '18 mi', label: 'Service radius' },
          { value: '24 hr', label: 'Estimate window' },
          { value: '1,200+', label: 'Jobs completed' },
          { value: '5 yr', label: 'Workmanship warranty' },
        ],
      });
      mergeBlockData(content, 'featuredQuote', {
        title: 'Show the crew, the work, and the follow-through',
        people: [
          { name: 'Homeowner', title: 'Kitchen repair', quote: 'The scope was clear, the schedule was honest, and the finish matched the estimate.' },
          { name: 'Facility Manager', title: 'Recurring service', quote: 'They make maintenance easy to approve because every step is documented.' },
          { name: 'Builder Client', title: 'Renovation support', quote: 'The proof sections make the team feel credible before anyone fills out the form.' },
        ],
      });
      mergeBlockData(content, 'aboutImageText', {
        title: 'Local work needs local confidence',
        description: 'Use this section for service areas, licensing, insurance, before-and-after proof, and what customers can expect on site.',
        items: ['Service-area coverage', 'Licensed and insured', 'Photo-documented jobs', 'Clear estimate follow-up'],
      });
      mergeBlockData(content, 'estimateForm', {
        title: 'Request a scoped estimate',
        description: 'Collect project type, location, urgency, photos, and the details a field team needs before calling back.',
        submitText: 'Request Estimate',
        fields: [
          { id: 'builder-field-service', label: 'Project type', type: 'select', required: true, options: ['Repair', 'Installation', 'Maintenance', 'Inspection'] },
          { id: 'builder-field-property', label: 'Property type', type: 'select', required: true, options: ['Home', 'Business', 'Multi-unit', 'Other'] },
          { id: 'builder-field-timeline', label: 'Timeline', type: 'select', required: false, options: ['Flexible', 'This month', 'This week', 'Emergency'] },
        ],
      });
      mergeBlockData(content, 'cta', {
        title: 'Turn the next job into a clear estimate',
        subtitle: 'Invite visitors to share scope, timing, and photos before the first call.',
        buttonText: 'Request Estimate',
      });
      break;

    case 'commerce':
      setNav(content, [
        navItem('Home', 'home'),
        navItem('Shop', 'shop'),
        navItem('Offers', 'offers'),
      ]);
      setHero(content, 'commerce-hero-1', 'A storefront built around the product', 'Feature collections, explain the offer, and move shoppers from story to checkout without extra friction.', 'Shop Now', 'left', hBgGradient('palette:accent', '#ffffff', 135, 0), {
        ctaLink,
        image: { url: image('photo-1441986300917-64674bd600d8'), side: 'right' },
      });
      mergeBlockData(content, 'carousel', {
        title: 'Featured collections',
        subtitle: 'Use image-led cards for best sellers, drops, bundles, and subscription offers.',
        items: [
          { mediaType: 'image', image: image('photo-1523275335684-37898b6baf30'), title: 'Best sellers', text: 'Lead with the products customers already understand.' },
          { mediaType: 'image', image: image('photo-1515886657613-9f3515b0c78f'), title: 'Seasonal drop', text: 'Create urgency around a focused batch or launch.' },
          { mediaType: 'image', image: image('photo-1472851294608-062f824d29cc'), title: 'Bundles', text: 'Group products into easier buying decisions.' },
        ],
      });
      mergeBlockData(content, 'aboutImageText', {
        title: 'Merchandising with enough story to sell',
        description: 'Commerce keeps the shop path visible while giving products room for benefits, details, and trust.',
        items: ['Featured collections', 'Offer-led sections', 'Flexible product grid', 'Conversion-focused CTA'],
      });
      mergeBlockData(content, 'featuredQuote', {
        eyebrow: 'Shop Note',
        title: 'A clean path from browsing to buying',
        quote: 'The best product pages do not make shoppers decode the catalog. They show the offer, explain the fit, and make the next action obvious.',
        personName: 'Commerce Shop',
        personTitle: 'Merchandising system',
      });
      mergeBlockData(content, 'testimonials', {
        title: 'Buyer confidence',
        subtitle: 'Use reviews to answer quality, fit, shipping, and support questions.',
      });
      mergeBlockData(content, 'cta', {
        title: 'Make the product path obvious',
        subtitle: 'Push the collection, subscription, or offer that matters most.',
        buttonText: 'Shop Now',
      });
      content.extra_pages = [
        {
          slug: 'shop',
          title: 'Shop',
          display_name: 'Shop',
          is_visible_in_nav: true,
          blocks: [block('productGrid', { variant: 'gridWithSidebar' })],
        },
        {
          slug: 'offers',
          title: 'Offers',
          display_name: 'Offers',
          is_visible_in_nav: true,
          blocks: [
            block('pricing', {
              title: 'Featured offers',
              subtitle: 'Use pricing cards for bundles, subscriptions, service packages, or launch offers.',
              variant: 'cards',
              tiers: [
                { name: 'Starter Bundle', price: '$49', period: '', description: 'A simple first purchase.', features: ['Core item', 'Care guide', 'Fast shipping'], highlighted: false, buttonText: 'Shop Bundle' },
                { name: 'Monthly Box', price: '$29', period: '/mo', description: 'Recurring value for loyal buyers.', features: ['Curated items', 'Member pricing', 'Cancel anytime'], highlighted: true, buttonText: 'Subscribe' },
              ],
            }),
          ],
        },
      ];
      break;

    case 'foundation':
      setNav(content, [
        navItem('Home', 'home'),
        navItem('Mission', 'mission'),
        navItem('Get Involved', 'involved'),
      ]);
      content.blocks = [
        block('hero', heroBlockData([
          hCard('foundation-hero-1', 'Move people from belief to action', 'A community-first structure for missions, programs, impact stories, events, and participation.', 'Get Involved', 'left', hBgGradient('palette:accent', '#ffffff', 160, 0), {
            ctaLink,
            image: { url: image('photo-1529333166437-7750a6dd5a70'), side: 'right' },
          }),
        ])),
        block('stats', {
          title: 'Impact at a glance',
          variant: 'cards',
          backgroundColor: 'palette:accent',
          items: [
            { value: '12k', label: 'Neighbors reached' },
            { value: '48', label: 'Community partners' },
            { value: '320', label: 'Volunteer hours monthly' },
            { value: '92%', label: 'Funds toward programs' },
          ],
        }),
        block('servicesGrid', {
          title: 'Ways to participate',
          subtitle: 'Give visitors clear paths based on how they want to help.',
          backgroundColor: '#ffffff',
          markerStyle: 'framed',
          items: [
            { title: 'Volunteer', description: 'Make the next event, pantry, class, or outreach program easier to run.' },
            { title: 'Donate', description: 'Connect contributions to visible outcomes and ongoing community needs.' },
            { title: 'Partner', description: 'Invite local organizations, sponsors, and teams into shared programs.' },
          ],
        }),
        block('featuredQuote', {
          variant: 'essay',
          eyebrow: 'Mission Story',
          title: 'The mission is clearer when the people stay visible',
          quote: 'Foundation is designed to put impact, participation, and human stories close together so visitors understand both the need and the next step.',
          personName: 'Foundation Community',
          personTitle: 'Program team',
          backgroundColor: 'palette:primary',
        }),
        block('events', {
          title: 'Upcoming community moments',
          subtitle: 'Use events for fundraisers, volunteer days, classes, services, and meetings.',
          backgroundColor: 'palette:accent',
        }),
        block('cta', {
          title: 'Invite people into the work',
          subtitle: 'Use one clear next step for volunteers, donors, partners, or members.',
          buttonText: 'Get Involved',
          backgroundColor: 'palette:secondary',
          showPattern: true,
        }),
      ];
      content.extra_pages = [
        {
          slug: 'mission',
          title: 'Mission',
          display_name: 'Mission',
          is_visible_in_nav: true,
          blocks: [
            block('aboutImageText', {
              title: 'Why this work matters',
              description: 'Explain who you serve, what is changing, and how your programs are accountable to the community.',
              imagePosition: 'right',
              variant: 'tall',
              image: image('photo-1488521787991-ed7bbaae773c'),
              items: ['Clear mission', 'Program transparency', 'Community partnerships', 'Impact reporting'],
            }),
            block('resources', {
              title: 'Reports and resources',
              subtitle: 'Share annual reports, program notes, partner links, and volunteer guides.',
              variant: 'grid',
              items: [
                { id: 'foundation-r1', type: 'text', title: 'Impact Report', description: 'A short summary of current programs.', body: 'Use this resource to explain outcomes, needs, and how contributions are used.' },
                { id: 'foundation-r2', type: 'link', title: 'Volunteer Guide', description: 'A practical starting point for new helpers.', url: 'https://example.com', openInNewTab: true },
              ],
            }),
          ],
        },
        {
          slug: 'involved',
          title: 'Get Involved',
          display_name: 'Get Involved',
          is_visible_in_nav: true,
          blocks: [
            block('contact_form', {
              title: 'Raise your hand',
              description: 'Tell us how you would like to participate.',
              submitText: 'Get Involved',
              successMessage: 'Thanks. We will follow up with next steps.',
            }),
          ],
        },
      ];
      break;

    case 'wellness':
      setHero(content, 'wellness-hero-1', 'Care that feels calm before the first visit', 'A gentle appointment-ready structure for therapy, spa, health, coaching, and wellness services.', 'Book Visit', 'left', hBgGradient('palette:accent', '#ffffff', 180, 0), {
        ctaLink: bookingLink,
        image: { url: image('photo-1544161515-4ab6ce6db874'), side: 'right' },
      });
      mergeBlockData(content, 'servicesGrid', {
        title: 'Support paths',
        subtitle: 'Help visitors choose the kind of care, pace, or session that fits them.',
        textAlign: 'left',
        items: [
          { title: 'First Visit', description: 'A welcoming intake to understand goals, comfort, and next steps.' },
          { title: 'Ongoing Care', description: 'Consistent sessions with a clear plan and flexible pacing.' },
          { title: 'Restorative Session', description: 'Focused support for reset, recovery, or a specific wellness goal.' },
        ],
      });
      mergeBlockData(content, 'carousel', {
        title: 'A softer process',
        items: [
          { mediaType: 'icon', icon: 'Heart', title: 'Feel oriented', text: 'Visitors understand what happens before they book.' },
          { mediaType: 'icon', icon: 'Calendar', title: 'Choose a time', text: 'Booking stays close to service details and reassurance.' },
          { mediaType: 'icon', icon: 'Sparkles', title: 'Arrive supported', text: 'Use FAQs and notes to reduce uncertainty before the visit.' },
        ],
      });
      mergeBlockData(content, 'testimonials', {
        title: 'Clients feel grounded',
        items: [
          { name: 'Maya L.', role: 'Client', quote: 'The experience felt calm, organized, and personal from the first booking.', rating: 5 },
        ],
      });
      mergeBlockData(content, 'cta', {
        title: 'Make the next visit feel simple',
        subtitle: 'Invite visitors to book with clarity and confidence.',
        buttonText: 'Book Visit',
      });
      break;

    case 'estate':
      setNav(content, [
        navItem('Home', 'home'),
        navItem('Listings', 'portfolio'),
        navItem('Inquire', 'inquire'),
      ]);
      setHero(content, 'estate-hero-1', 'Spaces that sell the feeling first', 'A premium visual structure for listings, interiors, staging, property tours, and qualified inquiries.', 'View Listings', 'left', hBgImage(image('photo-1600607687939-ce8a6c25118c'), 0.45));
      insertBlockAfter(content, 'gallery', block('stats', {
        title: 'Market-ready presentation',
        variant: 'cards',
        backgroundColor: '#ffffff',
        items: [
          { value: '42', label: 'Active listings styled' },
          { value: '18%', label: 'Avg. faster inquiry rate' },
          { value: '$86M', label: 'Properties represented' },
          { value: '4.9/5', label: 'Client confidence' },
        ],
      }));
      mergeBlockData(content, 'gallery', {
        title: 'Featured spaces',
        subtitle: 'Lead with rooms, views, textures, and details that make inquiry feel natural.',
        frameStyle: 'poster',
      });
      mergeBlockData(content, 'carousel', {
        title: 'Listing spotlights',
        items: [
          { mediaType: 'image', image: image('photo-1600607687939-ce8a6c25118c'), title: 'Light-filled residence', text: 'A visual path for premium homes, rentals, and interiors.' },
          { mediaType: 'image', image: image('photo-1600566753190-17f0baa2a6c3'), title: 'Staged living spaces', text: 'Show layout, lifestyle, and buyer-ready details.' },
          { mediaType: 'image', image: image('photo-1600585154340-be6161a56a0c'), title: 'Exterior presence', text: 'Balance curb appeal with property facts and inquiry flow.' },
        ],
      });
      mergeBlockData(content, 'cta', {
        title: 'Ready to present a property beautifully?',
        subtitle: 'Send a listing, space, or project brief and get a polished inquiry path.',
        buttonText: 'View Listings',
      });
      break;

    case 'studio':
      setHero(content, 'studio-hero-1', 'Creative work with a sharper project path', 'A portfolio-meets-services template for agencies, freelancers, designers, and brand teams.', 'Start Project', 'left', hBgImage(image('photo-1497366754035-f200968a6e72'), 0.42), { ctaLink });
      insertBlockAfter(content, 'image', block('servicesGrid', {
        title: 'Studio lanes',
        subtitle: 'Make capabilities scannable before visitors dive into the work.',
        backgroundColor: '#ffffff',
        markerStyle: 'plain',
        items: [
          { title: 'Brand Systems', description: 'Identity, messaging, and reusable design language.' },
          { title: 'Campaign Sites', description: 'Fast launch pages, conversion sections, and visual storytelling.' },
          { title: 'Creative Direction', description: 'A sharper point of view for launches, teams, and content systems.' },
        ],
      }));
      mergeBlockData(content, 'gallery', {
        title: 'Selected studio work',
        subtitle: 'Show the range without burying the offer.',
        frameStyle: 'editorial',
      });
      mergeBlockData(content, 'carousel', {
        title: 'Project notes',
        items: [
          { mediaType: 'image', image: image('photo-1497366754035-f200968a6e72'), title: 'Identity refresh', text: 'A crisp system for a service brand with several audiences.' },
          { mediaType: 'image', image: image('photo-1518005020951-eccb494ad742'), title: 'Launch campaign', text: 'A visual path for a short-run product release.' },
          { mediaType: 'image', image: image('photo-1519389950473-47ba0277781c'), title: 'Team toolkit', text: 'Reusable components, editorial rules, and handoff assets.' },
        ],
      });
      mergeBlockData(content, 'cta', {
        title: 'Have a project that needs shape?',
        subtitle: 'Send the brief and start with a clear creative direction.',
        buttonText: 'Start Project',
      });
      break;

    case 'learn':
      setNav(content, [
        navItem('Home', 'home'),
        navItem('Courses', 'courses'),
        navItem('Contact', 'contact'),
      ]);
      content.headerBannerText = 'New cohorts open monthly';
      content.blocks = [
        block('hero', heroBlockData([
          hCard('learn-hero-1', 'Learning paths with structure and momentum', 'A course-ready layout for outcomes, modules, resources, pricing, testimonials, and enrollment.', 'Start Learning', 'left', hBgGradient('palette:accent', '#ffffff', 180, 0), {
            ctaLink,
            image: { url: image('photo-1522202176988-66273c2fd55f'), side: 'right' },
          }),
        ])),
        block('servicesGrid', {
          title: 'What students work through',
          subtitle: 'Use module cards to make the program feel concrete before enrollment.',
          backgroundColor: '#ffffff',
          markerStyle: 'badge',
          items: [
            { title: 'Foundations', description: 'The core concepts, tools, and vocabulary students need first.' },
            { title: 'Guided Practice', description: 'Exercises, workshops, and assignments that build real confidence.' },
            { title: 'Launch Review', description: 'Feedback, next steps, and resources for applying the work.' },
          ],
        }),
        block('pricing', {
          title: 'Program options',
          subtitle: 'Clear choices for courses, tutoring, workshops, or cohort access.',
          variant: 'cards',
          tiers: [
            { name: 'Workshop', price: '$149', period: '', description: 'A focused live session.', features: ['2 hours', 'Workbook', 'Replay'], highlighted: false, buttonText: 'Join Workshop' },
            { name: 'Cohort', price: '$799', period: '', description: 'A complete guided program.', features: ['6 weeks', 'Assignments', 'Office hours'], highlighted: true, buttonText: 'Enroll' },
            { name: 'Private Coaching', price: 'Custom', period: '', description: 'One-to-one support.', features: ['Custom plan', 'Live feedback', 'Flexible schedule'], highlighted: false, buttonText: 'Ask About Coaching' },
          ],
        }),
        block('resources', {
          title: 'Learning resources',
          subtitle: 'Share guides, reading lists, prep notes, or downloadable materials.',
          variant: 'grid',
          backgroundColor: 'palette:accent',
          items: [
            { id: 'learn-r1', type: 'text', title: 'Course Roadmap', description: 'A simple view of the path from first lesson to final review.', body: 'Use this space to preview lessons, milestones, assignments, and expected outcomes.' },
            { id: 'learn-r2', type: 'link', title: 'Student FAQ', description: 'Help students decide whether the program fits.', url: 'https://example.com', openInNewTab: true },
          ],
        }),
        block('faq', {
          title: 'Before you enroll',
          items: [
            { question: 'Who is this for?', answer: 'Explain the ideal student, skill level, or team.' },
            { question: 'How much time is required?', answer: 'Share the weekly commitment and format.' },
            { question: 'Are recordings available?', answer: 'Clarify live, replay, and resource access.' },
          ],
        }),
        block('cta', {
          title: 'Give learners a clear next step',
          subtitle: 'Use the template to explain the outcome and make enrollment feel simple.',
          buttonText: 'Start Learning',
          backgroundColor: 'palette:secondary',
        }),
      ];
      content.extra_pages = [
        {
          slug: 'courses',
          title: 'Courses',
          display_name: 'Courses',
          is_visible_in_nav: true,
          blocks: [
            block('pricing', {
              title: 'All learning paths',
              subtitle: 'List courses, tutoring packages, workshops, or cohorts.',
              variant: 'simple',
              tiers: [
                { name: 'Starter Course', price: '$99', period: '', description: 'Self-paced intro.', features: ['Lessons', 'Resources', 'Checklist'], highlighted: false, buttonText: 'Start' },
                { name: 'Live Cohort', price: '$799', period: '', description: 'Guided group learning.', features: ['Live sessions', 'Feedback', 'Community'], highlighted: true, buttonText: 'Enroll' },
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
              title: 'Ask about the program',
              description: 'Tell us what you want to learn and what format fits.',
              submitText: 'Ask a Question',
              successMessage: 'Thanks. We will reply with program details.',
            }),
          ],
        },
      ];
      break;

    case 'occasion':
      setNav(content, [
        navItem('Home', 'home'),
        navItem('Events', 'drops'),
        navItem('Plan', 'contact'),
      ]);
      content.headerBannerText = 'Dates, venues, and moments worth remembering.';
      setHero(content, 'occasion-hero-1', 'Plan the moment people will talk about', 'A celebratory layout for events, weddings, venues, planners, pop-ups, and special gatherings.', 'Plan Event', 'center', hBgImage(image('photo-1519225421980-715cb0215aed'), 0.45), { ctaLink });
      mergeBlockData(content, 'tabBar', {
        items: [
          { id: 'occasion-tab-1', label: 'Weddings', linkType: 'section', href: '#weddings' },
          { id: 'occasion-tab-2', label: 'Venues', linkType: 'section', href: '#venues' },
          { id: 'occasion-tab-3', label: 'Pop-ups', linkType: 'section', href: '#popups' },
        ],
      });
      mergeBlockData(content, 'carousel', {
        title: 'Event formats',
        subtitle: 'Use lively cards for packages, spaces, vendors, timelines, or celebration ideas.',
        items: [
          { mediaType: 'icon', icon: 'Sparkles', title: 'Weddings', text: 'A polished path for couples, planners, venues, and vendors.' },
          { mediaType: 'icon', icon: 'Calendar', title: 'Pop-ups', text: 'Promote date, location, RSVP, and limited-time offers.' },
          { mediaType: 'icon', icon: 'Music', title: 'Venue nights', text: 'Show recurring events, packages, and booking inquiries.' },
        ],
      });
      mergeBlockData(content, 'featuredQuote', {
        title: 'Guest-list proof',
        people: [
          { name: 'Ari', title: 'Planner', quote: 'The page made the event feel coordinated before the first call.' },
          { name: 'Lena', title: 'Venue manager', quote: 'Photos, dates, and inquiry paths finally lived in one place.' },
          { name: 'Theo', title: 'Pop-up host', quote: 'It felt festive without getting hard to navigate.' },
        ],
      });
      mergeBlockData(content, 'cta', {
        title: 'Turn the date into an invitation',
        subtitle: 'Use one bright CTA for bookings, RSVPs, inquiries, or vendor conversations.',
        buttonText: 'Plan Event',
      });
      break;

    default:
      break;
  }

  return content;
}

function applyTemplatePresetPlan(template: StructuralTemplateMetadata): StructuralTemplateMetadata {
  const style = getStructuralStyleFromTemplateId(template.template_id);
  if (!style) return template;

  const defaultContent = cloneRecord(template.default_content);
  applyStructuralTemplatePresetPlanToContent(defaultContent, template.template_id);

  return {
    ...template,
    name: PRESET_TEMPLATE_DISPLAYS[style].name,
    description: PRESET_TEMPLATE_DISPLAYS[style].description,
    thumbnail_url: thumb(style),
    default_content: {
      ...defaultContent,
      siteTitle: PRESET_TEMPLATE_DISPLAYS[style].siteTitle,
    },
  };
}

export function applyStructuralTemplatePresetPlanToContent(
  content: Record<string, unknown>,
  templateId: string | null | undefined,
): Record<string, unknown> {
  if (!templateId) return content;
  const style = getStructuralStyleFromTemplateId(templateId);
  if (!style) return content;
  applyPresetPlanToContent(content, TEMPLATE_CARD_PRESET_PLANS[style]);
  return content;
}

export function applyStructuralTemplatePresetPlanToNewBlockData(
  blockType: string,
  data: Record<string, unknown>,
  templateId: string | null | undefined,
): Record<string, unknown> {
  if (!templateId) return { ...data };
  const style = getStructuralStyleFromTemplateId(templateId);
  if (!style) return { ...data };

  const nextData = { ...data };
  const entry: MutableBlock = { type: blockType, data: nextData };
  if (!shouldApplyCardPresetToBlock(entry)) return nextData;

  nextData.cardStyle = TEMPLATE_CARD_PRESET_PLANS[style].primary;
  for (const field of CARD_PRESET_LEGACY_OVERRIDE_FIELDS) {
    delete nextData[field];
  }
  return nextData;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function getStructuralStyleFromTemplateId(templateId: string): StructuralTemplateStyle | null {
  const normalized = templateId.toLowerCase().replace(/[\s-]+/g, '_');
  const directStyle = STRUCTURAL_TEMPLATE_STYLES.find((style) => normalized === style || normalized.startsWith(`${style}_`));
  if (directStyle) return directStyle;

  const alias = Object.entries(TEMPLATE_STYLE_ALIASES).find(([key]) => normalized === key || normalized.startsWith(`${key}_`));
  return alias ? alias[1] : null;
}

function setNav(content: Record<string, unknown>, items: Array<ReturnType<typeof navItem>>) {
  content.__navItems = items;
}

function setHero(
  content: Record<string, unknown>,
  id: string,
  title: string,
  subtitle: string,
  ctaLabel: string,
  align: HAlign,
  background: Record<string, unknown>,
  opts: { ctaEnabled?: boolean; ctaLink?: unknown; image?: { url: string; side?: HSide } } = {},
) {
  const hero = firstBlock(content, 'hero');
  if (!hero) return;
  hero.data = heroBlockData([
    hCard(id, title, subtitle, ctaLabel, align, background, opts),
  ], {
    height: background.type === 'image' ? 'fitScreen' : 'fitContent',
    intervalSec: 6,
  });
}

function firstBlock(content: Record<string, unknown>, type: string): MutableBlock | null {
  return mutableBlocks(content.blocks).find((candidate) => candidate.type === type) || null;
}

function mergeBlockData(content: Record<string, unknown>, type: string, patch: Record<string, unknown>) {
  const target = firstBlock(content, type);
  if (!target) return;
  target.data = { ...target.data, ...patch };
}

function insertBlockAfter(content: Record<string, unknown>, afterType: string, nextBlock: ReturnType<typeof block>) {
  const blocks = mutableBlocks(content.blocks);
  if (blocks.some((candidate) => candidate.type === nextBlock.type && candidate.data?.title === nextBlock.data?.title)) return;
  const index = blocks.findIndex((candidate) => candidate.type === afterType);
  if (index < 0) {
    content.blocks = [...blocks, nextBlock];
    return;
  }
  blocks.splice(index + 1, 0, nextBlock);
}

type MutableBlock = { type: string; data: Record<string, unknown> };

function mutableBlocks(value: unknown): MutableBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter((candidate): candidate is MutableBlock => (
    Boolean(candidate)
    && typeof candidate === 'object'
    && typeof (candidate as MutableBlock).type === 'string'
    && Boolean((candidate as MutableBlock).data)
    && typeof (candidate as MutableBlock).data === 'object'
    && !Array.isArray((candidate as MutableBlock).data)
  ));
}

function applyPresetPlanToContent(content: Record<string, unknown>, plan: TemplatePresetPlan) {
  for (const entry of allContentBlocks(content)) {
    if (!shouldApplyCardPresetToBlock(entry)) continue;
    entry.data.cardStyle = plan.primary;
    for (const field of CARD_PRESET_LEGACY_OVERRIDE_FIELDS) {
      delete entry.data[field];
    }
  }
}

function shouldApplyCardPresetToBlock(entry: MutableBlock): boolean {
  return (
    CARD_PRESET_AWARE_BLOCK_TYPES.has(entry.type)
    || Object.prototype.hasOwnProperty.call(entry.data, 'cardStyle')
    || Object.prototype.hasOwnProperty.call(entry.data, 'cardSettings')
  );
}

function allContentBlocks(content: Record<string, unknown>): MutableBlock[] {
  const blocks = [...mutableBlocks(content.blocks)];
  if (Array.isArray(content.extra_pages)) {
    for (const page of content.extra_pages) {
      if (page && typeof page === 'object') {
        blocks.push(...mutableBlocks((page as Record<string, unknown>).blocks));
      }
    }
  }
  return blocks;
}

const RAW_STRUCTURAL_TEMPLATE_METADATA: StructuralTemplateMetadata[] = [
  ...BASE_STRUCTURAL_TEMPLATE_METADATA,
  ...DERIVED_STRUCTURAL_TEMPLATE_SOURCES.map(deriveStructuralTemplate),
];

export const STRUCTURAL_TEMPLATE_METADATA: StructuralTemplateMetadata[] = RAW_STRUCTURAL_TEMPLATE_METADATA.map(applyTemplatePresetPlan);

export function isStructuralTemplateId(templateId: string): boolean {
  const id = templateId.toLowerCase().replace(/-/g, '_');
  if (id === AI_ONBOARDING_TEMPLATE_ID) return true;
  return STRUCTURAL_TEMPLATE_STYLES.some((style) => id === style || id.startsWith(`${style}_`));
}

export function getStructuralTemplateMetadata(templateId: string): StructuralTemplateMetadata | null {
  const id = templateId.toLowerCase().replace(/-/g, '_');
  if (id === AI_ONBOARDING_TEMPLATE_ID) return AI_ONBOARDING_TEMPLATE_METADATA;
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
  const structuralStyle = getStructuralStyleFromTemplateId(id);
  if (structuralStyle) return PRESET_TEMPLATE_DISPLAYS[structuralStyle].name;

  for (const style of ALL_TEMPLATE_STYLES) {
    if (id.includes(style)) return style.charAt(0).toUpperCase() + style.slice(1);
  }
  if (id.includes('bold')) return 'Bold';
  if (id.includes('elegant')) return 'Elegant';
  if (id.includes('starter')) return 'Starter';
  if (id === AI_ONBOARDING_TEMPLATE_ID) return 'Custom';
  return '';
}
