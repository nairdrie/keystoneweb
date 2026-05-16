import { ReactNode } from 'react';
import { createClient } from '@/lib/db/supabase-server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  buildSiteMetadata,
  cleanSeoTitle,
  cleanSeoDescription,
  buildCanonicalUrl,
  buildHreflangAlternates,
} from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

interface SiteLayoutProps {
  children: ReactNode;
  params: Promise<{
    domain: string;
  }>;
}

export async function generateMetadata({ params }: SiteLayoutProps): Promise<Metadata> {
  const { domain } = await params;
  const supabase = await createClient();

  const cleanDomain = domain.replace('www.', '');

  const { data: site } = await supabase
    .from('sites')
    .select('published_data, published_domain, business_profile, translations_config, site_slug')
    .eq('custom_domain', cleanDomain)
    .eq('is_published', true)
    .single();

  if (!site) {
    return {
      title: 'Keystone Web Design',
      description: 'This site is not public or does not exist.',
    };
  }

  const publishedData = (site.published_data as any) || {};
  const title = cleanSeoTitle(publishedData, site.site_slug || cleanDomain);
  const description = cleanSeoDescription(publishedData);
  // Canonical always points to custom domain when available
  const canonicalUrl = buildCanonicalUrl(site.published_domain, cleanDomain);
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

export default async function SiteLayout({
  children,
  params,
}: SiteLayoutProps) {
  const { domain } = await params;
  const supabase = await createClient();
  const cleanDomain = domain.replace('www.', '');

  const { data: site } = await supabase
    .from('sites')
    .select('id')
    .eq('custom_domain', cleanDomain)
    .eq('is_published', true)
    .single();

  if (!site) {
    notFound();
  }

  return <>{children}</>;
}
