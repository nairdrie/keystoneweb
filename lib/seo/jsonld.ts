import type { BusinessProfile } from '@/lib/types/sites';

export type Block = { type?: string; data?: Record<string, unknown> | null };
export type Breadcrumb = { name: string; url: string };
export type Testimonial = { name?: string; quote?: string; rating?: number };
export type SocialLinks = {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
};

export type SchemaEntry = {
  /** Stable id used by the admin "Schema" tab to group entries */
  key: string;
  /** schema.org @type */
  type: string;
  /** Source explanation for the admin preview ("Auto-detected from FAQ block #2") */
  source: string;
  /** The actual JSON-LD object */
  data: Record<string, unknown>;
};

interface BuildJsonLdInput {
  businessProfile?: BusinessProfile | null;
  socialLinks?: SocialLinks | null;
  testimonials?: Testimonial[];
  blocks?: Block[];
  breadcrumbs?: Breadcrumb[];
  siteUrl: string;
  pageUrl: string;
  pageTitle?: string;
  pageDescription?: string;
  isHomePage?: boolean;
}

function localBusiness(
  businessProfile: BusinessProfile,
  siteUrl: string,
  socialLinks?: SocialLinks | null,
  testimonials?: Testimonial[],
): SchemaEntry | null {
  if (!businessProfile?.legalName) return null;

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: businessProfile.legalName,
    url: siteUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: businessProfile.streetAddress,
      addressLocality: businessProfile.addressLocality,
      addressRegion: businessProfile.addressRegion,
      postalCode: businessProfile.postalCode,
      addressCountry: businessProfile.addressCountry,
    },
  };
  if (businessProfile.telephone) data.telephone = businessProfile.telephone;
  if (businessProfile.latitude != null && businessProfile.longitude != null) {
    data.geo = {
      '@type': 'GeoCoordinates',
      latitude: businessProfile.latitude,
      longitude: businessProfile.longitude,
    };
  }
  if (businessProfile.priceRange) data.priceRange = businessProfile.priceRange;
  if (businessProfile.openingHours?.length) data.openingHours = businessProfile.openingHours;
  if (businessProfile.image) data.image = businessProfile.image;

  if (testimonials?.length) {
    const ratings = testimonials.map(t => t.rating ?? 5);
    const sum = ratings.reduce((a, b) => a + b, 0);
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: (sum / ratings.length).toFixed(1),
      bestRating: '5',
      worstRating: '1',
      ratingCount: ratings.length,
    };
    data.review = testimonials.slice(0, 5).map(t => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: t.name || 'Anonymous' },
      reviewBody: t.quote || '',
      reviewRating: { '@type': 'Rating', ratingValue: String(t.rating ?? 5), bestRating: '5', worstRating: '1' },
    }));
  }

  if (socialLinks) {
    const sameAs = Object.values(socialLinks).filter((v): v is string => !!v && typeof v === 'string');
    if (sameAs.length) data.sameAs = sameAs;
  }

  return { key: 'local-business', type: 'LocalBusiness', source: 'Site business profile', data };
}

function breadcrumbList(crumbs: Breadcrumb[]): SchemaEntry | null {
  if (!crumbs?.length || crumbs.length < 2) return null;
  return {
    key: 'breadcrumbs',
    type: 'BreadcrumbList',
    source: 'Auto-generated from page path',
    data: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: c.url,
      })),
    },
  };
}

function faqFromBlocks(blocks: Block[]): SchemaEntry[] {
  const out: SchemaEntry[] = [];
  blocks.forEach((block, idx) => {
    if (block.type !== 'faq') return;
    const items = Array.isArray((block.data as { items?: unknown[] } | null)?.items)
      ? ((block.data as { items?: unknown[] }).items as Array<{ question?: string; answer?: string }>)
      : [];
    const validItems = items.filter(i => i.question && i.answer);
    if (validItems.length === 0) return;

    out.push({
      key: `faq-${idx}`,
      type: 'FAQPage',
      source: `Auto-detected from FAQ block #${idx + 1} (${validItems.length} questions)`,
      data: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: validItems.map(item => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    });
  });
  return out;
}

function serviceFromBlocks(blocks: Block[], businessName?: string, businessUrl?: string): SchemaEntry[] {
  const out: SchemaEntry[] = [];
  blocks.forEach((block, idx) => {
    if (block.type !== 'servicesGrid') return;
    const items = Array.isArray((block.data as { items?: unknown[] } | null)?.items)
      ? ((block.data as { items?: unknown[] }).items as Array<{ title?: string; description?: string }>)
      : [];
    const validItems = items.filter(i => i.title);
    if (validItems.length === 0) return;

    validItems.forEach((item, i) => {
      const data: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: item.title,
      };
      if (item.description) data.description = item.description;
      if (businessName) {
        data.provider = {
          '@type': 'LocalBusiness',
          name: businessName,
          ...(businessUrl ? { url: businessUrl } : {}),
        };
      }
      out.push({
        key: `service-${idx}-${i}`,
        type: 'Service',
        source: `Auto-detected from Services Grid block #${idx + 1}, item "${item.title}"`,
        data,
      });
    });
  });
  return out;
}

function webPage(
  pageUrl: string,
  title: string | undefined,
  description: string | undefined,
  isHomePage: boolean,
): SchemaEntry {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': isHomePage ? 'WebSite' : 'WebPage',
    url: pageUrl,
  };
  if (title) data.name = title;
  if (description) data.description = description;
  return {
    key: isHomePage ? 'website' : 'webpage',
    type: isHomePage ? 'WebSite' : 'WebPage',
    source: 'Auto-generated page wrapper',
    data,
  };
}

/**
 * Builds the full set of JSON-LD entries for a single page. Each entry is
 * rendered as a separate <script type="application/ld+json"> tag, which
 * Google explicitly recommends over a single @graph blob.
 */
export function buildJsonLd(input: BuildJsonLdInput): SchemaEntry[] {
  const {
    businessProfile,
    socialLinks,
    testimonials,
    blocks = [],
    breadcrumbs = [],
    siteUrl,
    pageUrl,
    pageTitle,
    pageDescription,
    isHomePage = false,
  } = input;

  const entries: SchemaEntry[] = [];

  entries.push(webPage(pageUrl, pageTitle, pageDescription, isHomePage));

  if (businessProfile) {
    const lb = localBusiness(businessProfile, siteUrl, socialLinks, testimonials);
    if (lb) entries.push(lb);
  }

  const crumbs = breadcrumbList(breadcrumbs);
  if (crumbs) entries.push(crumbs);

  entries.push(...faqFromBlocks(blocks));
  entries.push(...serviceFromBlocks(blocks, businessProfile?.legalName, siteUrl));

  return entries;
}
