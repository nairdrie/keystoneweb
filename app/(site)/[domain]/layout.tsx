import { ReactNode } from 'react';
import { createClient } from '@/lib/db/supabase-server';
import type { Metadata } from 'next';
import SiteNotFound from '@/app/components/SiteNotFound';

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
    .select('published_data')
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

  const rawTitle = publishedData.seoTitle || publishedData.siteTitle || publishedData.title || cleanDomain;
  const title = rawTitle.replace(/\{\{(.*?)\}\}/g, '$1').replace(/\\n|\n/g, ' ');
  const description = publishedData.seoDescription || publishedData.tagline || publishedData.description || 'A site built with Keystone Web.';

  return { title, description };
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
    return (
      <SiteNotFound 
        message="The site for this domain is not public or does not exist. Are you the owner?"
        ctaText="Login to manage domain"
        domain={cleanDomain}
      />
    );
  }

  return <>{children}</>;
}
