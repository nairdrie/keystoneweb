import type { BusinessProfile } from '@/lib/types/sites';
import type { Block, SocialLinks } from './jsonld';

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip';

export type CheckCategory =
  | 'titles'
  | 'descriptions'
  | 'business'
  | 'social'
  | 'schema'
  | 'indexability'
  | 'content'
  | 'discoverability'
  | 'aeo';

export interface AuditCheck {
  id: string;
  category: CheckCategory;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Subject of the check — site-wide, or a particular page */
  pageId?: string;
  pageSlug?: string;
  /** Short hint for the AI fix endpoint, used as part of the prompt */
  fixHint?: string;
}

export interface AuditInput {
  siteUrl: string;
  isPublished: boolean;
  publishedAt?: string | null;
  hasCustomDomain: boolean;
  businessProfile: BusinessProfile | null;
  socialLinks: SocialLinks | null;
  pages: Array<{
    id: string;
    slug: string;
    title: string;
    displayName?: string | null;
    seoTitle?: string;
    seoDescription?: string;
    robotsNoindex?: boolean;
    blocks: Block[];
    isVisibleInNav?: boolean;
  }>;
  unresolvedLogs?: Array<{ path: string; hit_count: number }>;
  hasBlogPosts?: boolean;
  hasLlmsTxt?: boolean;
  language?: string | null;
}

export interface AuditResult {
  checks: AuditCheck[];
  score: number;
  totals: { pass: number; warn: number; fail: number; skip: number };
  pageScores: Record<string, { pass: number; warn: number; fail: number; total: number; score: number }>;
}

const MIN_TITLE = 25;
const MAX_TITLE = 60;
const MIN_DESC = 50;
const MAX_DESC = 160;

export function runAudit(input: AuditInput): AuditResult {
  const checks: AuditCheck[] = [];
  const { businessProfile, socialLinks, pages, unresolvedLogs = [] } = input;

  // ── Discoverability ───────────────────────────────────────
  checks.push({
    id: 'site-published',
    category: 'discoverability',
    label: 'Site is published',
    status: input.isPublished ? 'pass' : 'fail',
    detail: input.isPublished ? 'Site is currently live.' : 'Site is not yet published. Publish to make it indexable.',
  });

  checks.push({
    id: 'site-custom-domain',
    category: 'discoverability',
    label: 'Custom domain connected',
    status: input.hasCustomDomain ? 'pass' : 'warn',
    detail: input.hasCustomDomain
      ? 'Custom domain is set — best for branding and SEO authority.'
      : 'Only the kswd.ca subdomain is connected. A custom domain gives you full SEO authority and better trust.',
    fixHint: 'Recommend the user buys/connects a custom domain via /admin/domains for stronger SEO authority.',
  });

  if (input.publishedAt) {
    const days = Math.floor((Date.now() - new Date(input.publishedAt).getTime()) / (1000 * 60 * 60 * 24));
    checks.push({
      id: 'site-fresh',
      category: 'discoverability',
      label: 'Recently published',
      status: days <= 90 ? 'pass' : 'warn',
      detail: days <= 90
        ? `Site was published or republished ${days} days ago — Google likes freshness.`
        : `Site was last published ${days} days ago. Republish with recent content updates so Google sees the site as active.`,
      fixHint: 'Suggest specific content updates the business could publish (a recent blog post, updated hours, new service, etc.).',
    });
  }

  // ── Business profile / Local SEO ──────────────────────────
  checks.push({
    id: 'business-name',
    category: 'business',
    label: 'Business name set',
    status: businessProfile?.legalName ? 'pass' : 'fail',
    detail: businessProfile?.legalName
      ? `Set to "${businessProfile.legalName}".`
      : 'Without a legal business name we cannot emit LocalBusiness JSON-LD. Fill in the Site tab.',
    fixHint: 'Walk the user through opening /admin/seo and filling in the legal business name in the Site tab.',
  });

  checks.push({
    id: 'business-phone',
    category: 'business',
    label: 'Phone number set',
    status: businessProfile?.telephone ? 'pass' : 'warn',
    detail: businessProfile?.telephone
      ? `Phone listed as ${businessProfile.telephone}.`
      : 'No phone number set. Phone is a strong local-SEO signal and appears in Knowledge Panels.',
  });

  checks.push({
    id: 'business-address',
    category: 'business',
    label: 'Address fully set',
    status: businessProfile?.streetAddress && businessProfile?.addressLocality && businessProfile?.addressRegion
      ? 'pass'
      : 'fail',
    detail: businessProfile?.streetAddress
      ? `${businessProfile.streetAddress}, ${businessProfile.addressLocality}, ${businessProfile.addressRegion}.`
      : 'Address is incomplete or missing. Without an address you cannot rank in Google\'s Local Pack.',
    fixHint: 'Tell the user to fill in their street, city, and region in the Site tab.',
  });

  checks.push({
    id: 'business-geocoded',
    category: 'business',
    label: 'Verified Google Places location',
    status: businessProfile?.placeId && businessProfile?.latitude != null ? 'pass' : 'warn',
    detail: businessProfile?.placeId
      ? 'Connected to a verified Google Places listing.'
      : 'No Google Places connection. Use the "Find on Google" search to attach your business — improves the LocalBusiness schema and Knowledge Panel.',
    fixHint: 'Direct the user to /admin/seo Site tab → "Find on Google" search.',
  });

  checks.push({
    id: 'business-hours',
    category: 'business',
    label: 'Opening hours listed',
    status: businessProfile?.openingHours?.length ? 'pass' : 'warn',
    detail: businessProfile?.openingHours?.length
      ? `${businessProfile.openingHours.length} opening hour entries set.`
      : 'No opening hours set. Visitors and Google both expect these for local businesses.',
  });

  checks.push({
    id: 'business-image',
    category: 'business',
    label: 'Business image set',
    status: businessProfile?.image ? 'pass' : 'warn',
    detail: businessProfile?.image
      ? 'Business image set — used in link unfurls and Knowledge Panel.'
      : 'No business image. This shows up in social link previews, Google Knowledge Panel, and rich results.',
  });

  // ── Social ────────────────────────────────────────────────
  const socialLinkCount = socialLinks ? Object.values(socialLinks).filter(v => !!v).length : 0;
  checks.push({
    id: 'social-presence',
    category: 'social',
    label: 'Social profiles linked',
    status: socialLinkCount >= 2 ? 'pass' : socialLinkCount === 1 ? 'warn' : 'fail',
    detail: `${socialLinkCount} social profile${socialLinkCount === 1 ? '' : 's'} linked. Adds sameAs entries to LocalBusiness schema so Google connects them to this business.`,
    fixHint: 'Suggest 2-3 social profiles the user should add based on their business type (Facebook + Instagram for restaurants, LinkedIn for B2B, etc).',
  });

  // ── Per-page checks ───────────────────────────────────────
  const titles = new Map<string, string[]>();
  const descs = new Map<string, string[]>();

  for (const page of pages) {
    const slugLabel = page.slug === 'home' ? '/' : `/${page.slug}`;
    const pageName = page.displayName || page.title || page.slug;

    // Title
    const title = (page.seoTitle || '').trim();
    if (!title) {
      checks.push({
        id: `title-missing-${page.id}`,
        category: 'titles',
        pageId: page.id,
        pageSlug: page.slug,
        label: `Title set on ${slugLabel}`,
        status: 'fail',
        detail: `${pageName} has no SEO title. Browsers and search results will fall back to the site title.`,
        fixHint: `Generate a 50-character SEO title for the page "${pageName}" at ${slugLabel}. Use the business context provided.`,
      });
    } else {
      const lengthStatus = title.length < MIN_TITLE ? 'warn' : title.length > MAX_TITLE ? 'warn' : 'pass';
      checks.push({
        id: `title-length-${page.id}`,
        category: 'titles',
        pageId: page.id,
        pageSlug: page.slug,
        label: `Title length on ${slugLabel}`,
        status: lengthStatus,
        detail: `${title.length} characters. Recommended ${MIN_TITLE}–${MAX_TITLE}.`,
        fixHint: lengthStatus === 'pass'
          ? undefined
          : `Rewrite the SEO title "${title}" for the page "${pageName}" to be ${MIN_TITLE}–${MAX_TITLE} characters and keyword-rich.`,
      });
    }
    if (title) titles.set(title.toLowerCase(), [...(titles.get(title.toLowerCase()) ?? []), slugLabel]);

    // Description
    const desc = (page.seoDescription || '').trim();
    if (!desc) {
      checks.push({
        id: `desc-missing-${page.id}`,
        category: 'descriptions',
        pageId: page.id,
        pageSlug: page.slug,
        label: `Description set on ${slugLabel}`,
        status: 'fail',
        detail: `${pageName} has no meta description. Google may auto-generate one, often poorly.`,
        fixHint: `Generate a 150-character meta description for "${pageName}" at ${slugLabel}.`,
      });
    } else {
      const lengthStatus = desc.length < MIN_DESC ? 'warn' : desc.length > MAX_DESC ? 'warn' : 'pass';
      checks.push({
        id: `desc-length-${page.id}`,
        category: 'descriptions',
        pageId: page.id,
        pageSlug: page.slug,
        label: `Description length on ${slugLabel}`,
        status: lengthStatus,
        detail: `${desc.length} characters. Recommended ${MIN_DESC}–${MAX_DESC}.`,
        fixHint: lengthStatus === 'pass'
          ? undefined
          : `Rewrite the meta description "${desc}" for "${pageName}" to be ${MIN_DESC}–${MAX_DESC} characters.`,
      });
    }
    if (desc) descs.set(desc.toLowerCase(), [...(descs.get(desc.toLowerCase()) ?? []), slugLabel]);

    // Indexability
    if (page.robotsNoindex && page.slug === 'home') {
      checks.push({
        id: `home-noindex-${page.id}`,
        category: 'indexability',
        pageId: page.id,
        pageSlug: page.slug,
        label: 'Home page is indexable',
        status: 'fail',
        detail: 'The home page is set to noindex. Google will not show it in search results.',
        fixHint: 'Turn off the noindex toggle on the home page in /admin/seo Pages.',
      });
    }

    // Content
    const hasBlocks = page.blocks && page.blocks.length > 0;
    checks.push({
      id: `has-content-${page.id}`,
      category: 'content',
      pageId: page.id,
      pageSlug: page.slug,
      label: `${slugLabel} has content`,
      status: hasBlocks ? 'pass' : 'fail',
      detail: hasBlocks
        ? `${page.blocks.length} content block${page.blocks.length === 1 ? '' : 's'}.`
        : 'Page has no content blocks. Add a Hero, Text, or other block to give Google something to index.',
    });
  }

  // Duplicates
  for (const [title, locs] of titles.entries()) {
    if (locs.length > 1) {
      checks.push({
        id: `dup-title-${title.slice(0, 30)}`,
        category: 'titles',
        label: `Duplicate title across ${locs.length} pages`,
        status: 'fail',
        detail: `"${title}" is used on ${locs.join(', ')}. Each page should have a unique title.`,
        fixHint: `Suggest unique alternative titles for the pages ${locs.join(', ')} that currently all share the title "${title}".`,
      });
    }
  }
  for (const [desc, locs] of descs.entries()) {
    if (locs.length > 1) {
      checks.push({
        id: `dup-desc-${desc.slice(0, 30)}`,
        category: 'descriptions',
        label: `Duplicate description across ${locs.length} pages`,
        status: 'warn',
        detail: `Same meta description used on ${locs.join(', ')}.`,
        fixHint: `Suggest unique alternative meta descriptions for ${locs.join(', ')}.`,
      });
    }
  }

  // ── Schema completeness ──────────────────────────────────
  const homePage = pages.find(p => p.slug === 'home');
  const allBlocks = pages.flatMap(p => p.blocks);
  const hasFaqBlock = allBlocks.some(b => b.type === 'faq');
  const hasServicesBlock = allBlocks.some(b => b.type === 'servicesGrid');
  const hasTestimonialsBlock = allBlocks.some(b => b.type === 'testimonials');
  const hasCtaBlock = allBlocks.some(b => b.type === 'cta');

  checks.push({
    id: 'schema-localbusiness',
    category: 'schema',
    label: 'LocalBusiness schema emitted',
    status: businessProfile?.legalName ? 'pass' : 'fail',
    detail: businessProfile?.legalName
      ? 'LocalBusiness JSON-LD is emitted on every page.'
      : 'Without a business name, LocalBusiness schema cannot be emitted. Fill in the Site tab.',
  });

  checks.push({
    id: 'schema-organization',
    category: 'schema',
    label: 'Organization/Publisher schema',
    status: businessProfile?.legalName && businessProfile?.image ? 'pass' : businessProfile?.legalName ? 'warn' : 'fail',
    detail: businessProfile?.legalName && businessProfile?.image
      ? 'Organization schema is emitted as publisher on every page with logo.'
      : businessProfile?.legalName
        ? 'Organization publisher is emitted but missing logo. Add a business image in the Site tab.'
        : 'No publisher info. Fill in business name and image to emit Organization schema.',
    fixHint: 'Upload a business logo/image in /admin/seo Site tab to complete the Organization schema.',
  });

  checks.push({
    id: 'schema-website-searchaction',
    category: 'schema',
    label: 'WebSite with SearchAction',
    status: 'pass',
    detail: 'WebSite schema with potentialAction (SearchAction) is auto-emitted on the home page for sitelinks searchbox eligibility.',
  });

  checks.push({
    id: 'schema-faq',
    category: 'schema',
    label: 'FAQPage schema present',
    status: hasFaqBlock ? 'pass' : 'warn',
    detail: hasFaqBlock
      ? 'FAQPage JSON-LD is auto-emitted from your FAQ blocks. Good for "People also ask" rich results.'
      : 'No FAQ block found. FAQPage schema is one of the easiest ways to get rich snippet eligibility.',
    fixHint: 'Suggest 4-6 likely FAQ questions and short answers for this business that the user can paste into an FAQ block.',
  });

  checks.push({
    id: 'schema-services',
    category: 'schema',
    label: 'Service schema present',
    status: hasServicesBlock ? 'pass' : 'warn',
    detail: hasServicesBlock
      ? 'Service JSON-LD is auto-emitted from your Services Grid block(s).'
      : 'No Services Grid block. Adding one lets us emit Service schema and helps clients find specific offerings.',
  });

  checks.push({
    id: 'schema-reviews',
    category: 'schema',
    label: 'Reviews / AggregateRating present',
    status: hasTestimonialsBlock ? 'pass' : 'warn',
    detail: hasTestimonialsBlock
      ? 'AggregateRating + Review JSON-LD is auto-emitted from your testimonials.'
      : 'No testimonials block found. Add one to get star ratings in Google results.',
  });

  checks.push({
    id: 'schema-blog-article',
    category: 'schema',
    label: 'BlogPosting schema on articles',
    status: input.hasBlogPosts ? 'pass' : 'skip',
    detail: input.hasBlogPosts
      ? 'BlogPosting JSON-LD with author, publisher, datePublished, and speakable is auto-emitted on blog posts.'
      : 'No blog posts published yet. When you publish one, BlogPosting schema is automatically emitted.',
  });

  // ── AEO (Answer Engine Optimization) ─────────────────────
  checks.push({
    id: 'aeo-speakable',
    category: 'aeo',
    label: 'Speakable specification',
    status: 'pass',
    detail: 'SpeakableSpecification is auto-emitted on all pages with descriptions, enabling voice assistants (Google Assistant, Alexa, Siri) to read your content aloud.',
  });

  checks.push({
    id: 'aeo-llms-txt',
    category: 'aeo',
    label: 'llms.txt for AI crawlers',
    status: input.hasLlmsTxt !== false ? 'pass' : 'warn',
    detail: input.hasLlmsTxt !== false
      ? 'llms.txt is auto-served at /llms.txt — AI assistants (ChatGPT, Perplexity, Claude) can discover your business info and pages.'
      : 'llms.txt is not available. Ensure the site is published.',
    fixHint: 'Publish the site to auto-generate llms.txt for AI assistant discoverability.',
  });

  checks.push({
    id: 'aeo-structured-dates',
    category: 'aeo',
    label: 'Date metadata on pages',
    status: input.publishedAt ? 'pass' : 'warn',
    detail: input.publishedAt
      ? 'datePublished and dateModified are emitted in WebPage/BlogPosting schemas. AI engines use these to prioritize fresh content.'
      : 'No publish date recorded. Publish the site to add date metadata to schemas.',
  });

  checks.push({
    id: 'aeo-language',
    category: 'aeo',
    label: 'Language declared in schema',
    status: input.language ? 'pass' : 'warn',
    detail: input.language
      ? `inLanguage "${input.language}" is declared in all page schemas. AI engines use this to match queries to the correct language.`
      : 'No language configured. Set a default language in site settings for proper inLanguage schema output.',
  });

  checks.push({
    id: 'aeo-site-hierarchy',
    category: 'aeo',
    label: 'Page → Site hierarchy linked',
    status: 'pass',
    detail: 'All WebPage schemas include isPartOf linking back to the WebSite, and BreadcrumbList schemas are emitted on subpages. This helps AI engines understand your site structure.',
  });

  checks.push({
    id: 'aeo-contact-point',
    category: 'aeo',
    label: 'ContactPoint in schema',
    status: businessProfile?.telephone ? 'pass' : 'warn',
    detail: businessProfile?.telephone
      ? 'ContactPoint with phone number is emitted in LocalBusiness and Organization schemas. AI assistants can surface this directly in answers.'
      : 'No phone number means no ContactPoint schema. AI assistants won\'t be able to answer "how do I contact this business?"',
    fixHint: 'Add a phone number in the Site tab to enable ContactPoint schema for AI assistant answers.',
  });

  // ── Content / engagement ─────────────────────────────────
  checks.push({
    id: 'has-cta',
    category: 'content',
    label: 'Has at least one Call-to-Action block',
    status: hasCtaBlock ? 'pass' : 'warn',
    detail: hasCtaBlock
      ? 'CTA blocks present.'
      : 'No CTA blocks anywhere on the site. Conversions and dwell time both drop without one.',
  });

  // Home page hero check
  const homeHasHero = !!homePage && homePage.blocks.some(b => b.type === 'hero');
  checks.push({
    id: 'home-has-hero',
    category: 'content',
    label: 'Home page has a Hero block',
    status: homeHasHero ? 'pass' : 'warn',
    detail: homeHasHero
      ? 'Hero block on home — gives Google a clear H1 and an OG image to crawl.'
      : 'Add a Hero block to the home page so it has a clear H1, value proposition, and crawlable image.',
  });

  // 404 tracking
  const heavy404s = unresolvedLogs.filter(l => l.hit_count >= 3);
  checks.push({
    id: 'unresolved-404s',
    category: 'indexability',
    label: 'No high-traffic 404s',
    status: heavy404s.length === 0 ? 'pass' : heavy404s.length < 3 ? 'warn' : 'fail',
    detail: heavy404s.length === 0
      ? 'No URLs are repeatedly 404ing.'
      : `${heavy404s.length} URL${heavy404s.length === 1 ? ' is' : 's are'} 404ing repeatedly. Create redirects in the Redirects tab.`,
    fixHint: `Suggest where each of these paths should redirect: ${heavy404s.slice(0, 5).map(l => l.path).join(', ')}.`,
  });

  // ── Aggregate ────────────────────────────────────────────
  const totals = { pass: 0, warn: 0, fail: 0, skip: 0 };
  for (const c of checks) totals[c.status]++;
  const scorable = totals.pass + totals.warn + totals.fail;
  const score = scorable === 0 ? 0 : Math.round(((totals.pass + 0.5 * totals.warn) / scorable) * 100);

  // Per-page scores
  const pageScores: AuditResult['pageScores'] = {};
  for (const page of pages) {
    const pageChecks = checks.filter(c => c.pageId === page.id);
    const p = pageChecks.filter(c => c.status === 'pass').length;
    const w = pageChecks.filter(c => c.status === 'warn').length;
    const f = pageChecks.filter(c => c.status === 'fail').length;
    const total = p + w + f;
    pageScores[page.id] = {
      pass: p,
      warn: w,
      fail: f,
      total,
      score: total === 0 ? 100 : Math.round(((p + 0.5 * w) / total) * 100),
    };
  }

  return { checks, score, totals, pageScores };
}
