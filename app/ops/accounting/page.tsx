import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import AccountingDashboard from './AccountingDashboard';

export default async function AccountingPage() {
  // Admin-only gate
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('https://keystoneweb.ca');

  const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!adminEmails.includes(user.email?.toLowerCase() ?? '')) {
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
