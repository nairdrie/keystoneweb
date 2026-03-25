import { redirect } from 'next/navigation';

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ siteId?: string }> }) {
  const { siteId } = await searchParams;
  redirect(`/admin/analytics${siteId ? `?siteId=${siteId}` : ''}`);
}
