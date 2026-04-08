import { createClient } from '@/lib/db/supabase-server';
import type { Metadata } from 'next';
import {
  buildSiteMetadata,
  cleanSeoTitle,
  cleanSeoDescription,
  buildCanonicalUrl,
  buildHreflangAlternates,
} from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  const supabase = await createClient();

  const { data: site } = await supabase
    .from('sites')
    .select('published_data, custom_domain, business_profile, translations_config, site_slug')
    .eq('published_domain', subdomain)
    .eq('is_published', true)
    .single();

  if (!site) {
    return {
      title: 'Keystone Web Design',
      description: 'This site is not public or does not exist.',
    };
  }

  const publishedData = (site.published_data as any) || {};
  const title = cleanSeoTitle(publishedData, site.site_slug || subdomain);
  const description = cleanSeoDescription(publishedData);
  const canonicalUrl = buildCanonicalUrl(subdomain, site.custom_domain);
  const alternateLanguages = buildHreflangAlternates(
    canonicalUrl,
    site.translations_config,
  );

  return buildSiteMetadata({
    siteTitle: title,
    description,
    canonicalUrl,
    publishedData,
    businessProfile: site.business_profile,
    alternateLanguages,
  });
}

export default function SubdomainLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
