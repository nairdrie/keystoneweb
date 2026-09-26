import type { Metadata } from 'next';
import PublicDocPage from '@/app/components/shop/public/PublicDocPage';

// Customer estimate / invoice page from the Shop tab. The token in the URL is
// the only key, so keep it out of search engines.
export const metadata: Metadata = {
  title: 'Your estimate or invoice',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ShopDocPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicDocPage token={token} />;
}
