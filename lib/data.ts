/**
 * Mock Database - In production, this would be Supabase/PostgreSQL
 * For now, we have in-memory mock data
 */

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

// Mock database of sites
const MOCK_SITES: Record<string, SiteData> = {
  'cool-barber': {
    id: '1',
    domain: 'cool-barber',
    siteName: "Cool Barber's",
    template: 'barber',
    theme: {
      primaryColor: '#1e40af',
      accentColor: '#60a5fa',
      backgroundColor: '#0f172a',
    },
    content: {
      title: "Cool Barber's",
      subtitle: 'Premium Haircuts & Styling',
      pages: {
        '/': {
          title: 'Home',
          sections: [
            {
              type: 'hero',
              title: "Cool Barber's",
              content: 'Premium Haircuts & Styling Since 2010',
            },
            {
              type: 'features',
              title: 'Our Services',
              items: [
                { title: 'Haircuts', description: 'Classic and modern styles' },
                { title: 'Beard Trim', description: 'Expert beard grooming' },
                { title: 'Styling', description: 'Special occasion styling' },
              ],
            },
            {
              type: 'contact',
              title: 'Contact Us',
              content: 'Open Mon-Sat, 9am-6pm | Call: (555) 123-4567',
            },
          ],
        },
        '/about': {
          title: 'About',
          sections: [
            {
              type: 'about',
              title: 'About Us',
              content: 'With over 10 years of experience, we pride ourselves on quality service and customer satisfaction.',
            },
          ],
        },
      },
    },
  },
  'demo-pizza': {
    id: '2',
    domain: 'demo-pizza',
    siteName: 'Demo Pizza Co',
    template: 'restaurant',
    theme: {
      primaryColor: '#dc2626',
      accentColor: '#f87171',
      backgroundColor: '#1f2937',
    },
    content: {
      title: 'Demo Pizza Co',
      subtitle: 'Authentic Italian Pizza',
      pages: {
        '/': {
          title: 'Home',
          sections: [
            {
              type: 'hero',
              title: 'Demo Pizza Co',
              content: 'Authentic Italian Pizza Made Fresh Daily',
            },
            {
              type: 'features',
              title: 'Our Menu',
              items: [
                { title: 'Margherita', description: 'Fresh mozzarella and basil' },
                { title: 'Pepperoni', description: 'Classic with premium pepperoni' },
                { title: 'Vegetarian', description: 'Fresh seasonal vegetables' },
              ],
            },
          ],
        },
      },
    },
  },
};

/**
 * Get site data by domain
 * In production, this would query the database
 */
export async function getSiteData(domain: string): Promise<SiteData | null> {
  // Simulate database query delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Remove .local suffix if present
  const cleanDomain = domain.replace('.local', '').replace(':3000', '');

  // Check mock database
  const site = MOCK_SITES[cleanDomain];

  if (!site) {
    console.log(`[Data] Site not found for domain: ${domain}`);
    return null;
  }

  console.log(`[Data] Found site: ${site.siteName} (${cleanDomain})`);
  return site;
}

/**
 * Get page content for a site
 */
export async function getPageContent(
  domain: string,
  path: string
): Promise<PageContent | null> {
  const site = await getSiteData(domain);

  if (!site) return null;

  const normalizedPath = path === '' || path === '/' ? '/' : path;
  const content = site.content.pages[normalizedPath];

  if (!content) {
    // Return home page as fallback
    return site.content.pages['/'];
  }

  return content;
}
