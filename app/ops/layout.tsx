import { redirect } from 'next/navigation';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import OpsHeader from './OpsHeader';
import '../(app)/globals.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Keystone Ops' };

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const layoutStart = performance.now();

  // Verify authenticated
  console.time('[ops-layout] createClient');
  const supabase = await createClient();
  console.timeEnd('[ops-layout] createClient');

  console.time('[ops-layout] auth.getUser');
  const { data: { user } } = await supabase.auth.getUser();
  console.timeEnd('[ops-layout] auth.getUser');

  if (!user) {
    redirect('https://keystoneweb.ca');
  }

  const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

  const isAdmin = adminEmails.includes(user.email?.toLowerCase() ?? '');

  // If not a hardcoded admin, check for agent role
  const db = createAdminClient();
  let isAgent = false;
  let agentContactEmail: string | null = null;
  if (!isAdmin) {
    console.time('[ops-layout] agent check');
    const { data: profile } = await db
      .from('users')
      .select('is_agent, agent_contact_email')
      .eq('id', user.id)
      .single();
    isAgent = profile?.is_agent ?? false;
    agentContactEmail = profile?.agent_contact_email ?? null;
    console.timeEnd('[ops-layout] agent check');
  }

  if (!isAdmin && !isAgent) {
    redirect('https://keystoneweb.ca');
  }

  // Fetch badge counts in parallel instead of sequentially
  let countQuery = db
    .from('support_requests')
    .select('id', { count: 'exact', head: true })
    .is('thread_id', null)
    .eq('status', 'open');

  if (!isAdmin && agentContactEmail) {
    countQuery = countQuery.eq('from_email', agentContactEmail);
  }

  console.time('[ops-layout] badge counts');
  const [{ count }, { count: moderationCount }] = await Promise.all([
    countQuery,
    db
      .from('moderation_events')
      .select('id', { count: 'exact', head: true })
      .is('reviewed_at', null),
  ]);
  console.timeEnd('[ops-layout] badge counts');
  console.log(`[ops-layout] TOTAL: ${(performance.now() - layoutStart).toFixed(0)}ms`);

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen bg-gray-950 text-gray-100">
          <OpsHeader
            userEmail={user.email}
            openSupportCount={count ?? 0}
            isAdmin={isAdmin}
            pendingModerationCount={moderationCount ?? 0}
          />

          <main className="w-full px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
