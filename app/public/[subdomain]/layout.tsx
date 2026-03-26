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

  const publishedData = site?.published_data || {};

  const title = publishedData.siteTitle || publishedData.title || `${subdomain}.kswd.ca`;
  const description = publishedData.tagline || publishedData.description || 'A site built with Keystone Web.';

  return { title, description };
}

export default function SubdomainLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
