import { headers } from 'next/headers';
import SiteNotFound from '@/app/components/SiteNotFound';

export default async function CustomDomainNotFound() {
  const h = await headers();
  const host = h.get('host') ?? '';

  return (
    <SiteNotFound
      title="Page Not Found"
      message="The page you're looking for doesn't exist on"
      ctaText="Visit Keystone Web Design"
      ctaHref="https://keystoneweb.ca"
      domain={host}
    />
  );
}
