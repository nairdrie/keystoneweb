import { redirect } from 'next/navigation';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import OpsHeader from './OpsHeader';
import '../(app)/globals.css';

export const metadata = { title: 'Keystone Ops' };

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  // Verify authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('https://keystoneweb.ca');
  }

  const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

  const isAdmin = adminEmails.includes(user.email?.toLowerCase() ?? '');

  // If not a hardcoded admin, check for agent role
  let isAgent = false;
  let agentContactEmail: string | null = null;
  if (!isAdmin) {
    const db = createAdminClient();
    const { data: profile } = await db
      .from('users')
      .select('is_agent, agent_contact_email')
      .eq('id', user.id)
      .single();
    isAgent = profile?.is_agent ?? false;
    agentContactEmail = profile?.agent_contact_email ?? null;
  }

  if (!isAdmin && !isAgent) {
    redirect('https://keystoneweb.ca');
  }

  // Fetch open support count (scoped by contact email for agents)
  const db = createAdminClient();
  let countQuery = db
    .from('support_requests')
    .select('id', { count: 'exact', head: true })
    .is('thread_id', null)
    .eq('status', 'open');

  if (!isAdmin && agentContactEmail) {
    countQuery = countQuery.eq('from_email', agentContactEmail);
  }

  const { count } = await countQuery;

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen bg-gray-950 text-gray-100">
          <OpsHeader
            userEmail={user.email}
            openSupportCount={count ?? 0}
            isAdmin={isAdmin}
          />

          <main className="w-full px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
