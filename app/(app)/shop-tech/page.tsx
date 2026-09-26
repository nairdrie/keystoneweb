import type { Metadata } from 'next';
import TechApp from '@/app/components/shop/tech/TechApp';

// The Shop tab's bay view: a phone or tablet in the bay, signed in with the
// shop code + PIN (or by the site owner). Big buttons; techs talk instead of type.
export const metadata: Metadata = {
  title: 'Shop · Bay',
  robots: { index: false, follow: false },
};

export default async function ShopTechPage({ searchParams }: { searchParams: Promise<{ siteId?: string }> }) {
  const sp = await searchParams;
  return <TechApp siteIdParam={typeof sp.siteId === 'string' ? sp.siteId : null} />;
}
