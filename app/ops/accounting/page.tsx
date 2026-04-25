import { createAdminClient } from '@/lib/db/supabase-admin';
import { redirect } from 'next/navigation';
import { getOpsAccessContext } from '@/lib/ops/access';
import AccountingDashboard from './AccountingDashboard';

export default async function AccountingPage() {
  const access = await getOpsAccessContext();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    redirect('/ops');
  }

  // Pre-fetch categories for the form
  const db = createAdminClient();
  const { data: categories } = await db
    .from('accounting_categories')
    .select('*')
    .order('name', { ascending: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Accounting</h1>
      <AccountingDashboard categories={categories ?? []} />
    </div>
  );
}
