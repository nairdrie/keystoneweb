import { createClient } from '@/lib/db/supabase-server';
import type { Metadata } from 'next';

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
    .select('published_data')
    .eq('published_domain', subdomain)
    .eq('is_published', true)
    .single();

  if (!site) {
    return {
      title: 'Keystone Web Design',
      description: 'This site is not public or does not exist.',
    };
  }

  const publishedData = site.published_data || {};

  const rawTitle = publishedData.seoTitle || publishedData.siteTitle || publishedData.title || `${subdomain}.kswd.ca`;
  const title = rawTitle.replace(/\{\{(.*?)\}\}/g, '$1').replace(/\\n|\n/g, ' ');
  const description = publishedData.seoDescription || publishedData.tagline || publishedData.description || 'A site built with Keystone Web.';

  return { title, description };
}

export default function SubdomainLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
