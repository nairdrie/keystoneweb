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

export interface BuildJsonLdInput {
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
  /** ISO-8601 date when page/site was first published */
  datePublished?: string | null;
  /** ISO-8601 date when page/site was last modified */
  dateModified?: string | null;
  /** Language code (e.g. "en", "fr") */
  language?: string | null;
}

export interface BuildBlogJsonLdInput {
  siteUrl: string;
  pageUrl: string;
  title: string;
  excerpt?: string | null;
  content?: string | null;
  coverImage?: string | null;
  author?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
  tags?: string[];
  businessProfile?: BusinessProfile | null;
  language?: string | null;
}

function organizationData(
  businessProfile: BusinessProfile,
  siteUrl: string,
  socialLinks?: SocialLinks | null,
): Record<string, unknown> {
  const org: Record<string, unknown> = {
    '@type': 'Organization',
    name: businessProfile.legalName,
    url: siteUrl,
  };
  if (businessProfile.image) org.logo = businessProfile.image;
  if (businessProfile.telephone) {
    org.contactPoint = {
      '@type': 'ContactPoint',
      telephone: businessProfile.telephone,
      contactType: 'customer service',
    };
  }
  if (socialLinks) {
    const sameAs = Object.values(socialLinks).filter((v): v is string => !!v && typeof v === 'string');
    if (sameAs.length) org.sameAs = sameAs;
  }
  return org;
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
  if (businessProfile.telephone) {
    data.telephone = businessProfile.telephone;
    data.contactPoint = {
      '@type': 'ContactPoint',
      telephone: businessProfile.telephone,
      contactType: 'customer service',
    };
  }
  if (businessProfile.latitude != null && businessProfile.longitude != null) {
    data.geo = {
      '@type': 'GeoCoordinates',
      latitude: businessProfile.latitude,
      longitude: businessProfile.longitude,
    };
  }
  if (businessProfile.priceRange) data.priceRange = businessProfile.priceRange;
  if (businessProfile.openingHours?.length) data.openingHours = businessProfile.openingHours;
  if (businessProfile.image) {
    data.image = businessProfile.image;
    data.logo = businessProfile.image;
  }

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

function webSite(
  siteUrl: string,
  title: string | undefined,
  description: string | undefined,
  businessProfile?: BusinessProfile | null,
  socialLinks?: SocialLinks | null,
  language?: string | null,
): SchemaEntry {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: siteUrl,
  };
  if (title) data.name = title;
  if (description) data.description = description;
  if (language) data.inLanguage = language;

  // SearchAction enables Google Sitelinks Searchbox
  data.potentialAction = {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${siteUrl}/?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  };

  if (businessProfile?.legalName) {
    data.publisher = organizationData(businessProfile, siteUrl, socialLinks);
  }

  return {
    key: 'website',
    type: 'WebSite',
    source: 'Auto-generated site wrapper with SearchAction',
    data,
  };
}

function webPage(
  pageUrl: string,
  siteUrl: string,
  title: string | undefined,
  description: string | undefined,
  datePublished?: string | null,
  dateModified?: string | null,
  businessProfile?: BusinessProfile | null,
  socialLinks?: SocialLinks | null,
  language?: string | null,
): SchemaEntry {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url: pageUrl,
    isPartOf: { '@type': 'WebSite', url: siteUrl },
  };
  if (title) data.name = title;
  if (description) data.description = description;
  if (language) data.inLanguage = language;
  if (datePublished) data.datePublished = datePublished;
  if (dateModified) data.dateModified = dateModified;

  if (description) {
    data.speakable = {
      '@type': 'SpeakableSpecification',
      cssSelector: ['[data-speakable="true"]', '.hero-heading', '.hero-subtitle', 'h1', 'meta[name="description"]'],
    };
  }

  if (businessProfile?.legalName) {
    data.publisher = organizationData(businessProfile, siteUrl, socialLinks);
  }

  return {
    key: 'webpage',
    type: 'WebPage',
    source: 'Auto-generated page wrapper with speakable + publisher',
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
    datePublished,
    dateModified,
    language,
  } = input;

  const entries: SchemaEntry[] = [];

  if (isHomePage) {
    entries.push(webSite(siteUrl, pageTitle, pageDescription, businessProfile, socialLinks, language));
  } else {
    entries.push(webPage(pageUrl, siteUrl, pageTitle, pageDescription, datePublished, dateModified, businessProfile, socialLinks, language));
  }

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

/**
 * Builds Article/BlogPosting JSON-LD for blog post pages.
 * AI answer engines heavily weight structured article metadata.
 */
export function buildBlogJsonLd(input: BuildBlogJsonLdInput): SchemaEntry[] {
  const {
    siteUrl,
    pageUrl,
    title,
    excerpt,
    content,
    coverImage,
    author,
    datePublished,
    dateModified,
    tags,
    businessProfile,
    language,
  } = input;

  const entries: SchemaEntry[] = [];

  const articleData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    url: pageUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
    isPartOf: { '@type': 'WebSite', url: siteUrl },
  };

  if (excerpt) articleData.description = excerpt;
  if (coverImage) articleData.image = coverImage;
  if (language) articleData.inLanguage = language;
  if (datePublished) articleData.datePublished = datePublished;
  if (dateModified) articleData.dateModified = dateModified;
  if (tags?.length) articleData.keywords = tags.join(', ');

  // Word count from content for engagement signals
  if (content) {
    const plainText = content.replace(/<[^>]+>/g, '').trim();
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;
    if (wordCount > 0) articleData.wordCount = wordCount;
  }

  articleData.author = {
    '@type': 'Person',
    name: author || businessProfile?.legalName || 'Staff Writer',
  };

  if (businessProfile?.legalName) {
    articleData.publisher = {
      '@type': 'Organization',
      name: businessProfile.legalName,
      url: siteUrl,
      ...(businessProfile.image ? { logo: { '@type': 'ImageObject', url: businessProfile.image } } : {}),
    };
  }

  if (excerpt || title) {
    articleData.speakable = {
      '@type': 'SpeakableSpecification',
      cssSelector: ['[data-speakable="true"]', '.blog-post-title', '.blog-post-excerpt', 'h1', 'article > p:first-of-type'],
    };
  }

  entries.push({
    key: 'blog-posting',
    type: 'BlogPosting',
    source: 'Auto-generated from blog post metadata',
    data: articleData,
  });

  // BreadcrumbList: Home > Blog > Post Title
  entries.push({
    key: 'blog-breadcrumbs',
    type: 'BreadcrumbList',
    source: 'Auto-generated blog breadcrumb trail',
    data: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog` },
        { '@type': 'ListItem', position: 3, name: title, item: pageUrl },
      ],
    },
  });

  return entries;
}
