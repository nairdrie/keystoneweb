import { BusinessProfile } from '@/lib/types/sites';
import { buildJsonLd, type Block, type Breadcrumb, type SocialLinks, type Testimonial } from '@/lib/seo/jsonld';

interface JsonLdScriptProps {
  businessProfile?: BusinessProfile | null;
  siteUrl: string;
  pageUrl?: string;
  socialLinks?: SocialLinks | null;
  testimonials?: Testimonial[];
  /** Page-level published_data.blocks. Used to auto-detect FAQ and Service schemas. */
  blocks?: Block[];
  /** Breadcrumb trail from home → current page. Skips schema if 0–1 entries. */
  breadcrumbs?: Breadcrumb[];
  pageTitle?: string;
  pageDescription?: string;
  isHomePage?: boolean;
}

/**
 * Emits one <script type="application/ld+json"> per detected schema entry
 * (LocalBusiness, BreadcrumbList, FAQPage, Service, WebPage). Google's docs
 * explicitly recommend separate script tags over a single @graph blob.
 */
export default function JsonLdScript({
  businessProfile,
  siteUrl,
  pageUrl,
  socialLinks,
  testimonials,
  blocks,
  breadcrumbs,
  pageTitle,
  pageDescription,
  isHomePage,
}: JsonLdScriptProps) {
  const entries = buildJsonLd({
    businessProfile,
    socialLinks,
    testimonials,
    blocks,
    breadcrumbs,
    siteUrl,
    pageUrl: pageUrl || siteUrl,
    pageTitle,
    pageDescription,
    isHomePage,
  });

  if (entries.length === 0) return null;

  return (
    <>
      {entries.map(entry => (
        <script
          key={entry.key}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry.data) }}
        />
      ))}
    </>
  );
}
