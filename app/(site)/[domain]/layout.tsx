import { ReactNode } from 'react';
import { getSiteData } from '@/lib/data';

interface SiteLayoutProps {
  children: ReactNode;
  params: Promise<{
    domain: string;
  }>;
}

export async function generateMetadata({ params }: SiteLayoutProps) {
  const { domain } = await params;
  const site = await getSiteData(domain);

  if (!site) {
    return {
      title: 'Site Not Found',
      description: 'This site does not exist',
    };
  }

  return {
    title: site.content.title,
    description: site.content.subtitle,
  };
}

export default async function SiteLayout({
  children,
  params,
}: SiteLayoutProps) {
  const { domain } = await params;
  const site = await getSiteData(domain);

  if (!site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Site Not Found</h1>
          <p className="text-gray-600">The site for {domain} does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: site.theme.backgroundColor }}
    >
      {/* Navigation */}
      <nav
        className="border-b"
        style={{ borderColor: site.theme.accentColor }}
      >
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <h1
            className="text-2xl font-bold"
            style={{ color: site.theme.primaryColor }}
          >
            {site.siteName}
          </h1>
        </div>
      </nav>

      {/* Page Content */}
      {children}
    </div>
  );
}
