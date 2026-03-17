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
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status = '', page: pageStr = '1' } = await searchParams;
  const page = Math.max(parseInt(pageStr, 10) || 1, 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const db = createAdminClient();

  let query = db
    .from('support_requests')
    .select(
      'id, from_email, from_name, subject, body_text, status, priority, created_at, updated_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);

  const { data: requests, count } = await query;

  // Counts per status for tabs
  const [openCount, inProgressCount, resolvedCount, closedCount] = await Promise.all([
    db.from('support_requests').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    db.from('support_requests').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
    db.from('support_requests').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
    db.from('support_requests').select('id', { count: 'exact', head: true }).eq('status', 'closed'),
  ]);

  const tabs = [
    { label: 'All', value: '', count: null },
    { label: 'Open', value: 'open', count: openCount.count ?? 0 },
    { label: 'In Progress', value: 'in_progress', count: inProgressCount.count ?? 0 },
    { label: 'Resolved', value: 'resolved', count: resolvedCount.count ?? 0 },
    { label: 'Closed', value: 'closed', count: closedCount.count ?? 0 },
  ];

  const totalPages = Math.ceil((count ?? 0) / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Support Requests</h1>
        <span className="text-sm text-gray-500">{count ?? 0} matching</span>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/ops/support${tab.value ? `?status=${tab.value}` : ''}`}
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
        {(requests ?? []).map((req: any) => (
          <Link
            key={req.id}
            href={`/ops/support/${req.id}`}
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
        ))}

        {!(requests ?? []).length && (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center text-gray-600">
            {status ? `No ${status.replace('_', ' ')} requests.` : 'No support requests yet.'}
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
              <a
                href={`/ops/support?status=${status}&page=${page - 1}`}
                className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700 transition-colors"
              >
                ← Prev
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/ops/support?status=${status}&page=${page + 1}`}
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
