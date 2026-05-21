import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';
import NewClientButton from './NewClientButton';

const STATUS_STYLES: Record<string, string> = {
  new: 'text-amber-400 bg-amber-400/10',
  contacted: 'text-sky-400 bg-sky-400/10',
  scheduled: 'text-sky-400 bg-sky-400/10',
  building: 'text-violet-400 bg-violet-400/10',
  preview_sent: 'text-violet-400 bg-violet-400/10',
  approved: 'text-emerald-400 bg-emerald-400/10',
  paid: 'text-emerald-400 bg-emerald-400/10',
  launched: 'text-emerald-400 bg-emerald-400/10',
  post_launch: 'text-gray-300 bg-gray-800',
  closed_won: 'text-gray-500 bg-gray-800',
  closed_lost: 'text-gray-500 bg-gray-800',
};

const STATUS_TABS: Array<{ label: string; value: string }> = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Building', value: 'building' },
  { label: 'Preview sent', value: 'preview_sent' },
  { label: 'Approved', value: 'approved' },
  { label: 'Paid', value: 'paid' },
  { label: 'Launched', value: 'launched' },
  { label: 'Post launch', value: 'post_launch' },
  { label: 'Won', value: 'closed_won' },
  { label: 'Lost', value: 'closed_lost' },
];

function formatLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ');
}

export default async function OpsLaunchRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const access = await getOpsAccessContext();
  if (!access || !access.isAdmin) {
    redirect('/');
  }

  const { status = 'all', q = '', page: pageStr = '1' } = await searchParams;
  const page = Math.max(parseInt(pageStr, 10) || 1, 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const db = createAdminClient();
  let query = db
    .from('launch_requests')
    .select(
      'id, created_at, name, email, business_name, business_type, launch_timing, budget_band, status, assignee_user_id',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (q) {
    const pattern = `%${q}%`;
    query = query.or(
      `name.ilike.${pattern},email.ilike.${pattern},business_name.ilike.${pattern}`,
    );
  }

  const { data: requests, count } = await query;

  // Per-status counts for tabs
  const statusCountsQueries = STATUS_TABS.filter((t) => t.value !== 'all').map((t) =>
    db.from('launch_requests').select('id', { count: 'exact', head: true }).eq('status', t.value),
  );
  const statusCountsResults = await Promise.all(statusCountsQueries);
  const statusCounts: Record<string, number> = {};
  STATUS_TABS.filter((t) => t.value !== 'all').forEach((t, i) => {
    statusCounts[t.value] = statusCountsResults[i].count ?? 0;
  });

  // Assignee lookup
  type RequestRow = {
    id: string;
    created_at: string;
    name: string;
    email: string;
    business_name: string | null;
    business_type: string | null;
    launch_timing: string | null;
    budget_band: string | null;
    status: string;
    assignee_user_id: string | null;
  };
  const rows: RequestRow[] = (requests ?? []) as RequestRow[];
  const assigneeIds = Array.from(
    new Set(rows.map((r) => r.assignee_user_id).filter((v): v is string => Boolean(v))),
  );
  const assigneeMap: Record<string, { email: string | null; business_name: string | null }> = {};
  if (assigneeIds.length > 0) {
    const { data: assignees } = await db
      .from('users')
      .select('id, email, business_name')
      .in('id', assigneeIds);
    for (const a of (assignees ?? []) as Array<{ id: string; email: string | null; business_name: string | null }>) {
      assigneeMap[a.id] = { email: a.email, business_name: a.business_name };
    }
  }

  const totalPages = Math.ceil((count ?? 0) / limit);

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    const merged = { status, q, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === 'page' && v === '1') && !(k === 'status' && v === 'all')) {
        p.set(k, v);
      }
    }
    const qs = p.toString();
    return `/launch${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Launch Service Requests</h1>
          <p className="mt-1 text-sm text-gray-500">
            Done-for-you setup consultations from <code className="text-gray-400">/setup</code>.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{count ?? 0} total</span>
          <NewClientButton />
        </div>
      </div>

      {/* Search bar */}
      <form action="/launch" method="GET" className="flex gap-3">
        {status && status !== 'all' && <input type="hidden" name="status" value={status} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name, email, or business…"
          className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
        <button
          type="submit"
          className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 transition-colors"
        >
          Search
        </button>
        {q && (
          <Link
            href={buildUrl({ q: '', page: '1' })}
            className="rounded-md bg-gray-800 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-gray-800 overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const tabCount = tab.value === 'all' ? count ?? 0 : statusCounts[tab.value] ?? 0;
          return (
            <Link
              key={tab.value}
              href={buildUrl({ status: tab.value, page: '1' })}
              className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                status === tab.value
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
              {tabCount > 0 && (
                <span className="ml-1.5 rounded-full bg-gray-800 px-1.5 py-0.5 text-xs">{tabCount}</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* List */}
      <div className="space-y-2">
        {rows.map((req) => {
          const assignee = req.assignee_user_id ? assigneeMap[req.assignee_user_id] : null;
          return (
            <Link
              key={req.id}
              href={`/launch/${req.id}`}
              className="block rounded-lg border border-gray-800 bg-gray-900 p-4 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[req.status] ?? STATUS_STYLES.new}`}
                    >
                      {formatLabel(req.status)}
                    </span>
                    <span className="text-sm font-medium text-white truncate">
                      {req.business_name || req.name}
                    </span>
                    {assignee && (
                      <span className="text-[11px] text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded">
                        {assignee.business_name || assignee.email}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    From <span className="text-gray-400">{req.name}</span>{' '}
                    <span className="text-gray-600">&lt;{req.email}&gt;</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    <span className="text-gray-400">Type:</span> {formatLabel(req.business_type)}{' '}
                    <span className="mx-1 text-gray-700">·</span>
                    <span className="text-gray-400">Timing:</span> {formatLabel(req.launch_timing)}{' '}
                    <span className="mx-1 text-gray-700">·</span>
                    <span className="text-gray-400">Budget:</span> {formatLabel(req.budget_band)}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-gray-600">
                  {new Date(req.created_at).toLocaleDateString('en-CA', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              </div>
            </Link>
          );
        })}

        {!(requests ?? []).length && (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center text-gray-600">
            {q
              ? `No results for "${q}".`
              : status !== 'all'
                ? `No ${formatLabel(status)} requests.`
                : 'No launch requests yet. Point workshop attendees at /setup.'}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildUrl({ page: String(page - 1) })} className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700 transition-colors">
                Prev
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildUrl({ page: String(page + 1) })} className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700 transition-colors">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
