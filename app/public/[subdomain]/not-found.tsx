import { headers } from 'next/headers';
import SiteNotFound from '@/app/components/SiteNotFound';
import Log404OnMount from '@/app/components/Log404OnMount';

export default async function SubdomainNotFound() {
  const h = await headers();
  const host = h.get('host') ?? '';

  return (
    <>
      <Log404OnMount />
      <SiteNotFound
        title="Page Not Found"
        message="The page you're looking for doesn't exist on"
        ctaText="Visit Keystone Web Design"
        ctaHref="https://keystoneweb.ca"
        domain={host}
      />
    </>
  );
}
