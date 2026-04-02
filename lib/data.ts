import { createClient } from './db/supabase-server';

export interface SiteData {
  id: string;
  domain: string;
  siteName: string;
  template: string;
  theme: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
  };
  content: {
    title: string;
    subtitle: string;
    pages: Record<string, PageContent>;
  };
}

export interface PageContent {
  title: string;
  sections: Section[];
}

export interface Section {
  type: 'hero' | 'features' | 'contact' | 'about' | 'gallery';
  title?: string;
  content?: string;
  items?: { title: string; description: string }[];
}

/**
 * Get site data by domain from Supabase
 */
export async function getSiteData(domain: string): Promise<SiteData | null> {
  const supabase = await createClient();
  
  // Clean domain
  const cleanDomain = domain.replace('.local', '').replace(':3000', '').replace('www.', '');
  console.log(`[Data] getSiteData domain=${domain} cleanDomain=${cleanDomain}`);

  // Query by custom_domain
  const { data: site, error } = await supabase
    .from('sites')
    .select('*, pages(*)')
    .eq('custom_domain', cleanDomain)
    .eq('is_published', true)
    .single();

  if (error || !site) {
    console.log(`[Data] Site not found in DB for custom_domain: ${cleanDomain}. Error:`, error?.message);
    return null;
  }

  console.log(`[Data] Found site ID=${site.id} in DB for domain=${cleanDomain}`);

  // Map Supabase site data to the SiteData interface expected by the layout
  const publishedData = site.published_data || {};
  
  // Extract theme colors from published_data or use defaults
  const theme = {
    primaryColor: publishedData.__customPalette_primary || '#000000',
    accentColor: publishedData.__customPalette_accent || '#cccccc',
    backgroundColor: publishedData.__customPalette_bg || '#ffffff',
  };

  return {
    id: site.id,
    domain: cleanDomain,
    siteName: publishedData.siteTitle || site.site_slug || 'My Site',
    template: site.selected_template_id,
    theme,
    content: {
      title: publishedData.siteTitle || '',
      subtitle: '', // Not explicitly in schema, can be mapped from hero block if needed
      pages: {}, // Placeholder for now, specific pages are fetched by getPageContent
    },
  };
}

/**
 * Get page content for a site
 */
export async function getPageContent(
  domain: string,
  path: string
): Promise<PageContent | null> {
  // This function is currently a placeholder for the custom domain layout/page
  // The actual block rendering happens in the [domain]/page.tsx using EditorContent
  return null;
}
