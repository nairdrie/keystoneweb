import { createAdminClient } from '@/lib/db/supabase-admin';
import Link from 'next/link';

const STATUS_STYLES: Record<string, string> = {
  open: 'text-amber-400 bg-amber-400/10',
  in_progress: 'text-sky-400 bg-sky-400/10',
  resolved: 'text-emerald-400 bg-emerald-400/10',
  closed: 'text-gray-500 bg-gray-800',
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'text-red-400',
  high: 'text-orange-400',
  normal: 'text-gray-400',
  low: 'text-gray-600',
};

export default async function OpsSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; q?: string; sort?: string }>;
}) {
  const { status = 'open', page: pageStr = '1', q: search = '', sort = 'newest' } = await searchParams;
  const page = Math.max(parseInt(pageStr, 10) || 1, 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const db = createAdminClient();

  // Only show root messages (not threaded replies)
  let query = db
    .from('support_requests')
    .select(
      'id, from_email, from_name, subject, body_text, status, priority, created_at, updated_at',
      { count: 'exact' }
    )
    .is('thread_id', null)
    .order('created_at', { ascending: sort === 'oldest' })
    .range(offset, offset + limit - 1);

  if (status && status !== 'all') query = query.eq('status', status);

  if (search) {
    const pattern = `%${search}%`;
    query = query.or(
      `subject.ilike.${pattern},from_email.ilike.${pattern},from_name.ilike.${pattern},body_text.ilike.${pattern}`
    );
  }

  const { data: requests, count } = await query;

  // Reply counts for each root thread
  const rootIds = (requests ?? []).map((r: any) => r.id);
  let replyCountMap: Record<string, number> = {};
  if (rootIds.length > 0) {
    const { data: replies } = await db
      .from('support_requests')
      .select('thread_id')
      .in('thread_id', rootIds);
    for (const r of replies ?? []) {
      replyCountMap[r.thread_id] = (replyCountMap[r.thread_id] ?? 0) + 1;
    }
  }

  // Counts per status for tabs (root messages only)
  const [openCount, inProgressCount, resolvedCount, closedCount] = await Promise.all([
    db.from('support_requests').select('id', { count: 'exact', head: true }).is('thread_id', null).eq('status', 'open'),
    db.from('support_requests').select('id', { count: 'exact', head: true }).is('thread_id', null).eq('status', 'in_progress'),
    db.from('support_requests').select('id', { count: 'exact', head: true }).is('thread_id', null).eq('status', 'resolved'),
    db.from('support_requests').select('id', { count: 'exact', head: true }).is('thread_id', null).eq('status', 'closed'),
  ]);

  const tabs = [
    { label: 'All', value: 'all', count: null },
    { label: 'Open', value: 'open', count: openCount.count ?? 0 },
    { label: 'In Progress', value: 'in_progress', count: inProgressCount.count ?? 0 },
    { label: 'Resolved', value: 'resolved', count: resolvedCount.count ?? 0 },
    { label: 'Closed', value: 'closed', count: closedCount.count ?? 0 },
  ];

  const totalPages = Math.ceil((count ?? 0) / limit);

  // Build URL helper preserving current params
  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    const merged = { status, q: search, sort, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== '1' || k === 'page' && v !== '1') {
        if (v) p.set(k, v);
      }
    }
    // Clean defaults
    if (p.get('page') === '1') p.delete('page');
    if (p.get('sort') === 'newest') p.delete('sort');
    const qs = p.toString();
    return `/support${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Support Requests</h1>
        <span className="text-sm text-gray-500">{count ?? 0} conversations</span>
      </div>

      {/* Search + sort bar */}
      <form action="/support" method="GET" className="flex gap-3">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          type="text"
          name="q"
          defaultValue={search}
          placeholder="Search by sender, subject, or content…"
          className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 transition-colors"
        >
          Search
        </button>
        {search && (
          <Link
            href={buildUrl({ q: '', page: '1' })}
            className="rounded-md bg-gray-800 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={buildUrl({ status: tab.value, page: '1' })}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              status === tab.value
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-800 px-1.5 py-0.5 text-xs">
                {tab.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Requests list */}
      <div className="space-y-2">
        {(requests ?? []).map((req: any) => {
          const replies = replyCountMap[req.id] ?? 0;
          return (
            <Link
              key={req.id}
              href={`/support/${req.id}`}
              className="block rounded-lg border border-gray-800 bg-gray-900 p-4 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[req.status] ?? STATUS_STYLES.open}`}
                    >
                      {req.status.replace('_', ' ')}
                    </span>
                    <span className={`text-xs ${PRIORITY_STYLES[req.priority] ?? ''}`}>
                      {req.priority !== 'normal' ? `● ${req.priority}` : ''}
                    </span>
                    <span className="text-sm font-medium text-white truncate">
                      {req.subject || '(no subject)'}
                    </span>
                    {replies > 0 && (
                      <span className="rounded-full bg-sky-900/40 px-2 py-0.5 text-xs text-sky-400">
                        {replies} {replies === 1 ? 'reply' : 'replies'}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    From{' '}
                    <span className="text-gray-400">
                      {req.from_name ? `${req.from_name} <${req.from_email}>` : req.from_email}
                    </span>
                  </p>
                  {req.body_text && (
                    <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">
                      {req.body_text.slice(0, 180)}
                    </p>
                  )}
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
            {search
              ? `No results for "${search}".`
              : status
                ? `No ${status.replace('_', ' ')} requests.`
                : 'No support requests yet.'}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildUrl({ page: String(page - 1) })}
                className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700 transition-colors"
              >
                Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildUrl({ page: String(page + 1) })}
                className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700 transition-colors"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
