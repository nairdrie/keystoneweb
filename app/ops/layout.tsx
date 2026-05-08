import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { APP_URL, parseHost } from '@/lib/env/domain';
import { getOpsAccessContext } from '@/lib/ops/access';
import OpsHeader from './OpsHeader';
import '../(app)/globals.css';

export const metadata = { title: 'Keystone Ops' };

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') || '';
  const usePathPrefix = parseHost(host).kind !== 'ops';

  const access = await getOpsAccessContext();

  if (!access) {
    redirect(APP_URL);
  }

  const { userEmail, isAdmin, isAgent, agentContactEmail } = access;

  if (!isAdmin && !isAgent) {
    redirect(APP_URL);
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

  // Fetch pending moderation count
  const { count: moderationCount } = await db
    .from('moderation_events')
    .select('id', { count: 'exact', head: true })
    .is('reviewed_at', null);

  // Fetch new launch request count (admin-only nav item)
  let newLaunchCount = 0;
  if (isAdmin) {
    const { count: launchNew } = await db
      .from('launch_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new');
    newLaunchCount = launchNew ?? 0;
  }

  // Fetch new leads count
  const { count: newLeadsCount } = await db
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new');

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen bg-gray-950 text-gray-100">
          <OpsHeader
            userEmail={userEmail ?? undefined}
            openSupportCount={count ?? 0}
            isAdmin={isAdmin}
            pendingModerationCount={moderationCount ?? 0}
            newLaunchCount={newLaunchCount}
            newLeadsCount={newLeadsCount ?? 0}
            usePathPrefix={usePathPrefix}
          />

          <main className="w-full px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
