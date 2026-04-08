import type { Metadata } from 'next';

/**
 * Resolves the best available OG image from published site data.
 * Priority: business profile image → hero bgImage → logo (skip base64).
 */
function resolveOgImage(publishedData: Record<string, any>, businessProfile?: any): string | null {
  // 1. Business profile image (usually a high-quality photo)
  if (businessProfile?.image) return businessProfile.image;

  // 2. Hero background image from first hero block or top-level hero
  const blocks = publishedData.blocks || [];
  for (const block of blocks) {
    if (block.type === 'hero' && block.data?.bgImage) {
      return block.data.bgImage;
    }
  }
  if (publishedData.hero?.backgroundImage) return publishedData.hero.backgroundImage;

  // 3. Logo (only if it's a URL, not base64)
  if (publishedData.logo && !publishedData.logo.startsWith('data:')) {
    return publishedData.logo;
  }

  return null;
}

/**
 * Build full Metadata object with OG + Twitter Card tags for a published site page.
 */
export function buildSiteMetadata({
  siteTitle,
  pageTitle,
  description,
  canonicalUrl,
  ogImage,
  publishedData,
  businessProfile,
  alternateLanguages,
}: {
  siteTitle: string;
  pageTitle?: string;
  description: string;
  canonicalUrl: string;
  ogImage?: string | null;
  publishedData?: Record<string, any>;
  businessProfile?: any;
  alternateLanguages?: Record<string, string>;
}): Metadata {
  const title = pageTitle || siteTitle;
  const image = ogImage ?? (publishedData ? resolveOgImage(publishedData, businessProfile) : null);

  const metadata: Metadata = {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      ...(alternateLanguages ? { languages: alternateLanguages } : {}),
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: siteTitle,
      type: 'website',
      locale: 'en_CA',
      ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: title }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };

  return metadata;
}

/**
 * Extract the SEO title, cleaning template markers and newlines.
 */
export function cleanSeoTitle(publishedData: Record<string, any>, fallback: string): string {
  const raw =
    (publishedData.seoTitle?.trim()) ||
    (publishedData.siteTitle?.trim()) ||
    (publishedData.title?.trim()) ||
    fallback;
  return raw.replace(/\{\{(.*?)\}\}/g, '$1').replace(/\\n|\n/g, ' ');
}

/**
 * Extract the SEO description.
 */
export function cleanSeoDescription(publishedData: Record<string, any>): string {
  return publishedData.seoDescription || publishedData.tagline || publishedData.description || 'A site built with Keystone Web.';
}

/**
 * Build the canonical URL for a site page.
 * Prefers custom domain over subdomain.
 */
export function buildCanonicalUrl(
  subdomain: string,
  customDomain: string | null,
  slug?: string,
): string {
  const base = customDomain ? `https://${customDomain}` : `https://${subdomain}.kswd.ca`;
  if (!slug || slug === 'home') return base;
  return `${base}/${slug}`;
}

/**
 * Build hreflang alternate links for bilingual sites.
 */
export function buildHreflangAlternates(
  baseUrl: string,
  translationsConfig: any,
  slug?: string,
): Record<string, string> | undefined {
  if (!translationsConfig?.enabled || !translationsConfig.languages?.length) return undefined;

  const languages: { code: string }[] = translationsConfig.languages;
  if (languages.length <= 1) return undefined;

  const defaultLang = translationsConfig.defaultLanguage || 'en';
  const alternates: Record<string, string> = {};

  for (const lang of languages) {
    const pagePath = slug && slug !== 'home' ? `/${slug}` : '';
    if (lang.code === defaultLang) {
      alternates[lang.code] = `${baseUrl}${pagePath}`;
    } else {
      alternates[lang.code] = `${baseUrl}/${lang.code}${pagePath}`;
    }
  }

  // x-default points to the default language version
  alternates['x-default'] = alternates[defaultLang] || baseUrl;

  return alternates;
}
