import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import {
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_STYLES,
  formatLabel,
  type LeadSource,
  type LeadStatus,
} from '@/lib/ops/leads';
import NewLeadButton from './NewLeadButton';

const STATUS_TABS: Array<{ label: string; value: 'all' | LeadStatus }> = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Researching', value: 'researching' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Qualified', value: 'qualified' },
  { label: 'Proposal sent', value: 'proposal_sent' },
  { label: 'Negotiating', value: 'negotiating' },
  { label: 'Converted', value: 'converted' },
  { label: 'Lost', value: 'lost' },
  { label: 'Unresponsive', value: 'unresponsive' },
  { label: 'Do not contact', value: 'do_not_contact' },
];

type LeadRow = {
  id: string;
  created_at: string;
  contact_name: string | null;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  source: LeadSource;
  source_detail: string | null;
  status: LeadStatus;
  assignee_user_id: string | null;
  converted_user_id: string | null;
  onboarding_amount_cents: number | null;
};

export default async function OpsLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string; q?: string; page?: string }>;
}) {
  const access = await requireOpsAccess();
  if (!access) redirect('/');

  const sp = await searchParams;
  const status = sp.status ?? 'all';
  const source = sp.source ?? 'all';
  const q = sp.q ?? '';
  const page = Math.max(parseInt(sp.page ?? '1', 10) || 1, 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const db = createAdminClient();

  let query = db
    .from('leads')
    .select(
      'id, created_at, contact_name, business_name, email, phone, website, source, source_detail, status, assignee_user_id, converted_user_id, onboarding_amount_cents',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== 'all') query = query.eq('status', status);
  if (source !== 'all') query = query.eq('source', source);

  if (q) {
    const pattern = `%${q}%`;
    query = query.or(
      `contact_name.ilike.${pattern},business_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`,
    );
  }

  const { data: leadsData, count } = await query;
  const rows = (leadsData ?? []) as LeadRow[];

  // Summary rollups (analytics strip)
  const { data: allLeadsForSummary } = await db
    .from('leads')
    .select('status, source, onboarding_amount_cents');

  const summary = computeSummary(allLeadsForSummary ?? []);

  // Per-status counts for tabs
  const statusCountsQueries = STATUS_TABS.filter((t) => t.value !== 'all').map((t) =>
    db.from('leads').select('id', { count: 'exact', head: true }).eq('status', t.value),
  );
  const statusCountsResults = await Promise.all(statusCountsQueries);
  const statusCounts: Record<string, number> = {};
  STATUS_TABS.filter((t) => t.value !== 'all').forEach((t, i) => {
    statusCounts[t.value] = statusCountsResults[i].count ?? 0;
  });

  // Assignee + converted-user enrichment
  const userIds = new Set<string>();
  for (const r of rows) {
    if (r.assignee_user_id) userIds.add(r.assignee_user_id);
    if (r.converted_user_id) userIds.add(r.converted_user_id);
  }
  const userMap: Record<string, { email: string | null; business_name: string | null }> = {};
  if (userIds.size > 0) {
    const { data: users } = await db
      .from('users')
      .select('id, email, business_name')
      .in('id', Array.from(userIds));
    for (const u of users ?? []) {
      userMap[u.id] = { email: u.email, business_name: u.business_name };
    }
  }

  // Subscription plan for converted leads
  const convertedIds = rows.map((r) => r.converted_user_id).filter((v): v is string => Boolean(v));
  const planMap: Record<string, string | null> = {};
  if (convertedIds.length > 0) {
    const { data: subs } = await db
      .from('user_subscriptions')
      .select('user_id, subscription_plan')
      .in('user_id', convertedIds);
    for (const s of subs ?? []) {
      planMap[s.user_id] = s.subscription_plan ?? null;
    }
  }

  const totalPages = Math.ceil((count ?? 0) / limit);

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    const merged = { status, source, q, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (!v) continue;
      if (k === 'page' && v === '1') continue;
      if ((k === 'status' || k === 'source') && v === 'all') continue;
      p.set(k, v);
    }
    const qs = p.toString();
    return `/leads${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="mt-1 text-sm text-gray-500">
            Outbound prospecting pipeline. {count ?? 0} matching{q || status !== 'all' || source !== 'all' ? ` of ${summary.totalLeads} total` : ' total'}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/leads/discover"
            className="rounded-md bg-gray-800 hover:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Discover prospects
          </Link>
          <NewLeadButton />
        </div>
      </div>

      {/* Analytics strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total leads" value={summary.totalLeads.toLocaleString('en-CA')} />
        <SummaryCard
          label="Conversion rate"
          value={summary.totalLeads > 0 ? `${((summary.converted / summary.totalLeads) * 100).toFixed(1)}%` : '—'}
          sub={`${summary.converted} converted`}
        />
        <SummaryCard
          label="$ onboarded"
          value={`$${(summary.onboardingCents / 100).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`}
          sub={summary.converted > 0 ? `avg $${Math.round(summary.onboardingCents / 100 / summary.converted).toLocaleString('en-CA')}` : null}
        />
        <SourceMixCard breakdown={summary.bySource} />
      </div>

      {/* Search + filter form */}
      <form action="/leads" method="GET" className="flex gap-3 flex-wrap">
        {status !== 'all' && <input type="hidden" name="status" value={status} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name, business, email, phone…"
          className="flex-1 min-w-[240px] rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
        <select
          name="source"
          defaultValue={source}
          className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
        >
          <option value="all">All sources</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>
              {LEAD_SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600 transition-colors"
        >
          Search
        </button>
        {(q || source !== 'all') && (
          <Link
            href={buildUrl({ q: '', source: 'all', page: '1' })}
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
        {rows.map((lead) => {
          const assignee = lead.assignee_user_id ? userMap[lead.assignee_user_id] : null;
          const converted = lead.converted_user_id ? userMap[lead.converted_user_id] : null;
          const plan = lead.converted_user_id ? planMap[lead.converted_user_id] : null;
          const headline = lead.business_name || lead.contact_name || lead.email || lead.phone || 'Unnamed lead';
          return (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}`}
              className="block rounded-lg border border-gray-800 bg-gray-900 p-4 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
                        LEAD_STATUS_STYLES[lead.status] ?? LEAD_STATUS_STYLES.new
                      }`}
                    >
                      {formatLabel(lead.status)}
                    </span>
                    <span className="text-sm font-medium text-white truncate">{headline}</span>
                    <span className="text-[11px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                      {LEAD_SOURCE_LABELS[lead.source]}
                    </span>
                    {assignee && (
                      <span className="text-[11px] text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded">
                        {assignee.business_name || assignee.email}
                      </span>
                    )}
                    {converted && plan && (
                      <span className="text-[11px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded uppercase">
                        {plan}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    {lead.contact_name && <span className="text-gray-400">{lead.contact_name}</span>}
                    {lead.email && (
                      <>
                        {lead.contact_name && <span className="mx-1 text-gray-700">·</span>}
                        <span className="text-gray-600">&lt;{lead.email}&gt;</span>
                      </>
                    )}
                    {lead.phone && (
                      <>
                        <span className="mx-1 text-gray-700">·</span>
                        <span className="text-gray-500">{lead.phone}</span>
                      </>
                    )}
                  </p>
                  {lead.source_detail && (
                    <p className="mt-1 text-xs text-gray-600">via {lead.source_detail}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {lead.onboarding_amount_cents !== null && (
                    <p className="text-xs font-medium text-emerald-400">
                      ${(lead.onboarding_amount_cents / 100).toLocaleString('en-CA')}
                    </p>
                  )}
                  <time className="text-xs text-gray-600">
                    {new Date(lead.created_at).toLocaleDateString('en-CA', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                </div>
              </div>
            </Link>
          );
        })}

        {rows.length === 0 && (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center text-gray-600">
            {q
              ? `No results for "${q}".`
              : status !== 'all'
                ? `No ${formatLabel(status)} leads.`
                : 'No leads yet. Click "+ New lead" to add one.'}
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

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function SourceMixCard({
  breakdown,
}: {
  breakdown: Array<{ source: LeadSource; total: number; converted: number; cents: number }>;
}) {
  const top = breakdown.slice(0, 4);
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <p className="text-[11px] uppercase tracking-wider text-gray-500">By source · top sources</p>
      {top.length === 0 ? (
        <p className="mt-1 text-sm text-gray-600">No leads yet</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {top.map((row) => {
            const rate = row.total > 0 ? (row.converted / row.total) * 100 : 0;
            return (
              <li key={row.source} className="flex items-center justify-between text-xs">
                <span className="text-gray-300 truncate">{LEAD_SOURCE_LABELS[row.source]}</span>
                <span className="text-gray-500 font-mono shrink-0 ml-2">
                  {row.total} · {rate.toFixed(0)}% · ${Math.round(row.cents / 100).toLocaleString('en-CA')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function computeSummary(
  data: Array<{ status: string; source: string; onboarding_amount_cents: number | null }>,
) {
  const totalLeads = data.length;
  let converted = 0;
  let onboardingCents = 0;
  const sourceMap = new Map<LeadSource, { total: number; converted: number; cents: number }>();

  for (const row of data) {
    const src = row.source as LeadSource;
    const bucket = sourceMap.get(src) ?? { total: 0, converted: 0, cents: 0 };
    bucket.total += 1;
    if (row.status === 'converted') {
      bucket.converted += 1;
      converted += 1;
      const cents = row.onboarding_amount_cents ?? 0;
      bucket.cents += cents;
      onboardingCents += cents;
    }
    sourceMap.set(src, bucket);
  }

  const bySource = Array.from(sourceMap.entries())
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.total - a.total);

  return { totalLeads, converted, onboardingCents, bySource };
}
