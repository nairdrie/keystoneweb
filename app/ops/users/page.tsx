import { createAdminClient } from '@/lib/db/supabase-admin';
import ImpersonateButton from './ImpersonateButton';

const PLAN_COLORS: Record<string, string> = {
  pro: 'text-emerald-400 bg-emerald-400/10',
  basic: 'text-sky-400 bg-sky-400/10',
  free: 'text-gray-400 bg-gray-700',
};

function planBadge(plan: string) {
  const key = plan.toLowerCase().includes('pro')
    ? 'pro'
    : plan.toLowerCase().includes('basic')
      ? 'basic'
      : 'free';
  const cls = PLAN_COLORS[key] ?? PLAN_COLORS.free;
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {key.toUpperCase()}
    </span>
  );
}

export default async function OpsUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; plan?: string; page?: string }>;
}) {
  const { search = '', plan = '', page: pageStr = '1' } = await searchParams;
  const page = Math.max(parseInt(pageStr, 10) || 1, 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const db = createAdminClient();

  let filteredUserIds: string[] | null = null;

  // If plan filter is active, fetch matching user IDs first
  if (plan) {
    const { data: subData } = await db
      .from('user_subscriptions')
      .select('user_id')
      .ilike('subscription_plan', `%${plan}%`);
    
    filteredUserIds = (subData ?? []).map(s => s.user_id);
  }

  let query = db
    .from('users')
    .select('id, email, business_name, is_admin, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) query = query.ilike('email', `%${search}%`);
  if (filteredUserIds) {
    // If we have a plan filter but no matches, ensure we return nothing
    if (filteredUserIds.length === 0) {
      query = query.eq('id', '00000000-0000-0000-0000-000000000000');
    } else {
      query = query.in('id', filteredUserIds);
    }
  }

  const { data: users, count, error } = await query;

  if (error) {
    console.error('[OpsUsers] Error fetching users:', error);
  }

  // Fetch subscriptions and site counts for the retrieved users
  const userIds = (users ?? []).map((u: any) => u.id);
  const totalSiteCounts: Record<string, number> = {};
  const publishedSiteCounts: Record<string, number> = {};
  const subscriptions: Record<string, any> = {};

  if (userIds.length) {
    const [sitesRes, subsRes] = await Promise.all([
      db.from('sites').select('user_id, is_published').in('user_id', userIds).not('user_id', 'is', null),
      db.from('user_subscriptions').select('*').in('user_id', userIds)
    ]);

    if (sitesRes.data) {
      for (const row of sitesRes.data) {
        totalSiteCounts[row.user_id] = (totalSiteCounts[row.user_id] ?? 0) + 1;
        if (row.is_published) {
          publishedSiteCounts[row.user_id] = (publishedSiteCounts[row.user_id] ?? 0) + 1;
        }
      }
    }

    if (subsRes.data) {
      for (const sub of subsRes.data) {
        subscriptions[sub.user_id] = sub;
      }
    }
  }

  const enriched = (users ?? []).map((u: any) => {
    const sub = subscriptions[u.id];
    return {
      id: u.id,
      email: u.email,
      businessName: u.business_name,
      isAdmin: u.is_admin,
      createdAt: u.created_at,
      plan: sub?.subscription_plan ?? 'free',
      subscriptionStatus: sub?.subscription_status ?? null,
      totalSites: totalSiteCounts[u.id] ?? 0,
      publishedSites: publishedSiteCounts[u.id] ?? 0,
    };
  });

  const totalPages = Math.ceil((count ?? 0) / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <span className="text-sm text-gray-500">
          {count ?? 0} {(search || plan) ? 'matching' : 'total'}
        </span>
      </div>

      {/* Filters */}
      <form method="GET" className="flex gap-3 flex-wrap">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search by email…"
          className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
        />
        <select
          name="plan"
          defaultValue={plan}
          className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-gray-500"
        >
          <option value="">All plans</option>
          <option value="pro">Pro</option>
          <option value="basic">Basic</option>
          <option value="free">Free</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-gray-700 px-4 py-1.5 text-sm text-white hover:bg-gray-600 transition-colors"
        >
          Filter
        </button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-xs text-gray-400 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Business</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-right">Sites</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 bg-gray-950">
            {enriched.map((u) => (
              <tr key={u.id} className="hover:bg-gray-900/50 transition-colors">
                <td className="px-4 py-3 text-gray-200">
                  {u.email}
                  {u.isAdmin && (
                    <span className="ml-2 rounded bg-emerald-900 px-1.5 py-0.5 text-xs text-emerald-300">
                      admin
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400">{u.businessName ?? '—'}</td>
                <td className="px-4 py-3">{planBadge(u.plan)}</td>
                <td className="px-4 py-3 text-right text-gray-300 font-mono">
                  {u.totalSites}
                  {u.publishedSites > 0 && (
                    <span className="ml-1 text-[10px] text-emerald-500 font-sans" title="Published sites">
                      ({u.publishedSites} pub)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(u.createdAt).toLocaleDateString('en-CA')}
                </td>
                <td className="px-4 py-3 text-right">
                  <ImpersonateButton userId={u.id} userEmail={u.email} />
                </td>
              </tr>
            ))}
            {enriched.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-600">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`?search=${search}&plan=${plan}&page=${page - 1}`}
                className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700 transition-colors"
              >
                ← Prev
              </a>
            )}
            {page < totalPages && (
              <a
                href={`?search=${search}&plan=${plan}&page=${page + 1}`}
                className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700 transition-colors"
              >
                Next →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
