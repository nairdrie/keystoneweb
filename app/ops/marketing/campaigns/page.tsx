import { createAdminClient } from '@/lib/db/supabase-admin';
import Link from 'next/link';
import { STATUS_COLORS, STATUS_LABELS, CHANNEL_LABELS } from '@/lib/marketing/types';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export default async function OpsMarketingCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const channel = params.channel || '';
  const status = params.status || '';
  const page = parseInt(params.page || '1');
  const perPage = 25;
  const offset = (page - 1) * perPage;

  const db = createAdminClient();

  let query = db
    .from('marketing_campaigns')
    .select('*', { count: 'exact' })
    .is('site_id', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (channel) query = query.eq('channel', channel);
  if (status) query = query.eq('status', status);

  const { data: campaigns, count } = await query;
  const total = count ?? 0;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">All Campaigns</h1>
          <p className="mt-1 text-sm text-gray-500">{total} campaign{total !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/marketing/create"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          + Create Campaign
        </Link>
      </div>

      {/* Filters */}
      <form method="GET" className="flex gap-3 flex-wrap">
        <select
          name="channel"
          defaultValue={channel}
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">All Channels</option>
          <option value="google_ads">Google Ads</option>
          <option value="meta_ads">Meta / Instagram</option>
          <option value="email">Email</option>
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="suggested">Suggested</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
        >
          Filter
        </button>
        {(channel || status) && (
          <Link href="/marketing/campaigns" className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      {(campaigns ?? []).length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center text-gray-500">
          No campaigns match your filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Budget</th>
                <th className="px-4 py-3 text-right">Spent</th>
                <th className="px-4 py-3 text-right">Impr</th>
                <th className="px-4 py-3 text-right">Clicks</th>
                <th className="px-4 py-3 text-right">CTR</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {(campaigns ?? []).map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-900/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/marketing/campaigns/${c.id}`}
                      className="font-medium text-white hover:text-emerald-400 transition-colors"
                    >
                      {c.name}
                    </Link>
                    {c.ai_generated && (
                      <span className="ml-2 text-[10px] text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded">AI</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {CHANNEL_LABELS[c.channel as keyof typeof CHANNEL_LABELS] || c.channel}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.campaign_type}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status as keyof typeof STATUS_COLORS] || ''}`}>
                      {STATUS_LABELS[c.status as keyof typeof STATUS_LABELS] || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {c.total_budget_cents ? formatCents(c.total_budget_cents) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {c.spent_cents > 0 ? formatCents(c.spent_cents) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {c.impressions > 0 ? formatNumber(c.impressions) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {c.clicks > 0 ? formatNumber(c.clicks) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {c.impressions > 0 ? `${((c.clicks / c.impressions) * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {new Date(c.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/marketing/campaigns?page=${page - 1}${channel ? `&channel=${channel}` : ''}${status ? `&status=${status}` : ''}`}
                className="rounded bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
              >
                Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/marketing/campaigns?page=${page + 1}${channel ? `&channel=${channel}` : ''}${status ? `&status=${status}` : ''}`}
                className="rounded bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
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
