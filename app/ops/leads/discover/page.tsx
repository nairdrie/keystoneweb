import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { parseHost } from '@/lib/env/domain';
import { requireOpsAccess } from '@/lib/ops/access';
import ProspectActions from './ProspectActions';

const REGION_LABELS: Record<string, string> = {
  toronto_core: 'Toronto core',
  york: 'York Region',
  peel: 'Peel Region',
  halton: 'Halton Region',
  durham: 'Durham Region',
};

const STATUS_TABS = [
  { label: 'Call list', value: 'ready' },     // no-website, not promoted/dismissed
  { label: 'No website', value: 'no_website' },
  { label: 'Pending audit', value: 'pending' },
  { label: 'Failed', value: 'failed' },
  { label: 'Promoted', value: 'promoted' },
  { label: 'Dismissed', value: 'dismissed' },
] as const;

type Prospect = {
  id: string;
  name: string;
  formatted_address: string | null;
  city: string | null;
  region: string | null;
  phone: string | null;
  website: string | null;
  business_types: string[] | null;
  rating: number | null;
  review_count: number | null;
  business_status: string | null;
  audit_status: string;
  perf_score: number | null;
  seo_score: number | null;
  best_practices_score: number | null;
  accessibility_score: number | null;
  mobile_load_seconds: number | null;
  uses_https: boolean | null;
  cms: string | null;
  cms_confidence: string | null;
  pitch_angles: string[];
  pitch_strength: number;
  dismissed_at: string | null;
  dismissed_reason: string | null;
  promoted_lead_id: string | null;
  promoted_at: string | null;
  discovered_at: string;
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; region?: string; page?: string }>;
}) {
  const access = await requireOpsAccess();
  if (!access) redirect('/');

  const requestHeaders = await headers();
  const host = requestHeaders.get('host') || '';
  const opsBasePath = parseHost(host).kind === 'ops' ? '' : '/ops';

  const sp = await searchParams;
  const tab = (sp.tab ?? 'ready') as (typeof STATUS_TABS)[number]['value'];
  const regionFilter = sp.region ?? 'all';
  const page = Math.max(parseInt(sp.page ?? '1', 10) || 1, 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const db = createAdminClient();
  // Server component runs per-request, so reading the clock here is fine.
  // eslint-disable-next-line react-hooks/purity
  const last24hCutoff = new Date(Date.now() - 86_400_000).toISOString();

  // Helper: every count query starts the same way; chain extra filters on top.
  const startCount = () => {
    const q = db.from('lead_prospects').select('id', { count: 'exact', head: true });
    return regionFilter !== 'all' ? q.eq('region', regionFilter) : q;
  };

  const [
    readyCount,
    noSiteCount,
    pendingCount,
    failedCount,
    promotedCount,
    dismissedCount,
    todayCount,
  ] = await Promise.all([
    startCount()
      .in('audit_status', ['audited', 'no_website'])
      .is('dismissed_at', null)
      .is('promoted_lead_id', null),
    startCount()
      .eq('audit_status', 'no_website')
      .is('dismissed_at', null)
      .is('promoted_lead_id', null),
    startCount().in('audit_status', ['pending', 'auditing']),
    startCount().eq('audit_status', 'failed'),
    startCount().not('promoted_lead_id', 'is', null),
    startCount().not('dismissed_at', 'is', null),
    startCount().gte('discovered_at', last24hCutoff),
  ]);

  // Build the main list query for the current tab.
  let listQuery = db
    .from('lead_prospects')
    .select(
      'id, name, formatted_address, city, region, phone, website, business_types, rating, review_count, business_status, audit_status, perf_score, seo_score, best_practices_score, accessibility_score, mobile_load_seconds, uses_https, cms, cms_confidence, pitch_angles, pitch_strength, dismissed_at, dismissed_reason, promoted_lead_id, promoted_at, discovered_at',
      { count: 'exact' },
    )
    // Call list is no-website only, so rank by how established the business is:
    // review volume first, then most recently discovered.
    .order('review_count', { ascending: false, nullsFirst: false })
    .order('discovered_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (regionFilter !== 'all') {
    listQuery = listQuery.eq('region', regionFilter);
  }

  switch (tab) {
    case 'ready':
      listQuery = listQuery
        .in('audit_status', ['audited', 'no_website'])
        .is('dismissed_at', null)
        .is('promoted_lead_id', null);
      break;
    case 'no_website':
      listQuery = listQuery
        .eq('audit_status', 'no_website')
        .is('dismissed_at', null)
        .is('promoted_lead_id', null);
      break;
    case 'pending':
      listQuery = listQuery.in('audit_status', ['pending', 'auditing']);
      break;
    case 'failed':
      listQuery = listQuery.eq('audit_status', 'failed');
      break;
    case 'promoted':
      listQuery = listQuery.not('promoted_lead_id', 'is', null);
      break;
    case 'dismissed':
      listQuery = listQuery.not('dismissed_at', 'is', null);
      break;
  }

  const { data: prospectsData, count: tabTotal } = await listQuery;
  const prospects = (prospectsData ?? []) as Prospect[];
  const totalPages = Math.ceil((tabTotal ?? 0) / limit);

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    const merged = { tab, region: regionFilter, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (!v) continue;
      if (k === 'page' && v === '1') continue;
      if (k === 'tab' && v === 'ready') continue;
      if (k === 'region' && v === 'all') continue;
      p.set(k, v);
    }
    const qs = p.toString();
    return `${opsBasePath}/leads/discover${qs ? `?${qs}` : ''}`;
  }

  const counts: Record<string, number> = {
    ready: readyCount.count ?? 0,
    no_website: noSiteCount.count ?? 0,
    pending: pendingCount.count ?? 0,
    failed: failedCount.count ?? 0,
    promoted: promotedCount.count ?? 0,
    dismissed: dismissedCount.count ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href={`${opsBasePath}/leads`} className="text-sm text-gray-400 hover:text-white">
            &larr; Back to leads
          </Link>
          <h1 className="text-2xl font-bold text-white mt-2">Discover prospects</h1>
          <p className="mt-1 text-sm text-gray-500">
            GTA businesses with a Google Business Profile but no website. Sorted by
            review volume — call the most established first, then promote.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{todayCount.count ?? 0}</p>
          <p className="text-[11px] uppercase tracking-wider text-gray-500">discovered last 24h</p>
        </div>
      </div>

      {/* Region filter row */}
      <div className="flex gap-2 flex-wrap">
        <RegionPill href={buildUrl({ region: 'all', page: '1' })} active={regionFilter === 'all'} label="All GTA" />
        {Object.entries(REGION_LABELS).map(([value, label]) => (
          <RegionPill
            key={value}
            href={buildUrl({ region: value, page: '1' })}
            active={regionFilter === value}
            label={label}
          />
        ))}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-gray-800 overflow-x-auto">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.value}
            href={buildUrl({ tab: t.value, page: '1' })}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.value
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
            {counts[t.value] > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-800 px-1.5 py-0.5 text-xs">
                {counts[t.value]}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {prospects.map((p) => (
          <ProspectCard key={p.id} prospect={p} opsBasePath={opsBasePath} />
        ))}

        {prospects.length === 0 && (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center text-gray-600">
            No prospects in this view. The discovery cron runs weekday mornings.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {totalPages}</span>
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

function RegionPill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs transition-colors ${
        active
          ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/30'
          : 'bg-gray-900 text-gray-400 border border-gray-800 hover:text-white'
      }`}
    >
      {label}
    </Link>
  );
}

function ProspectCard({ prospect, opsBasePath }: { prospect: Prospect; opsBasePath: string }) {
  const isPromoted = Boolean(prospect.promoted_lead_id);
  const isDismissed = Boolean(prospect.dismissed_at);
  const noWebsite = prospect.audit_status === 'no_website';
  const niche =
    prospect.business_types?.[0]?.replace(/_/g, ' ') ?? null;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">{prospect.name}</span>
            {prospect.region && (
              <span className="text-[11px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                {REGION_LABELS[prospect.region] ?? prospect.region}
              </span>
            )}
            {niche && (
              <span className="text-[11px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">
                {niche}
              </span>
            )}
            {prospect.review_count !== null && (
              <span className="text-[11px] text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded">
                {prospect.rating !== null ? `${prospect.rating}★ · ` : ''}
                {prospect.review_count} {prospect.review_count === 1 ? 'review' : 'reviews'}
              </span>
            )}
            {(prospect.review_count ?? 0) >= 20 && (
              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                established
              </span>
            )}
            {isPromoted && (
              <span className="text-[11px] text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded">
                promoted
              </span>
            )}
            {isDismissed && (
              <span className="text-[11px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                dismissed
              </span>
            )}
          </div>
          {prospect.formatted_address && (
            <p className="mt-1 text-xs text-gray-500">{prospect.formatted_address}</p>
          )}
          <p className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-3 items-center">
            {prospect.phone ? (
              <a
                href={`tel:${prospect.phone}`}
                className="text-emerald-300 font-medium hover:underline"
              >
                📞 {prospect.phone}
              </a>
            ) : (
              <span className="text-gray-600">no phone</span>
            )}
            {prospect.website ? (
              <a
                href={prospect.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline truncate max-w-md"
              >
                {prospect.website}
              </a>
            ) : (
              <span className="text-amber-400">no website</span>
            )}
          </p>
        </div>
        <ProspectActions
          prospectId={prospect.id}
          dismissed={isDismissed}
          promoted={isPromoted}
          promotedLeadId={prospect.promoted_lead_id}
          opsBasePath={opsBasePath}
        />
      </div>

      {/* Audit summary */}
      {!noWebsite && (
        <div className="flex flex-wrap gap-2 text-[11px]">
          <ScoreBadge label="Perf" value={prospect.perf_score} />
          <ScoreBadge label="SEO" value={prospect.seo_score} />
          <ScoreBadge label="A11y" value={prospect.accessibility_score} />
          <ScoreBadge label="BP" value={prospect.best_practices_score} />
          {prospect.mobile_load_seconds !== null && (
            <span className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-300">
              LCP {prospect.mobile_load_seconds}s
            </span>
          )}
          {prospect.uses_https === false && (
            <span className="rounded bg-red-400/10 text-red-400 px-1.5 py-0.5">no HTTPS</span>
          )}
          {prospect.cms && prospect.cms !== 'unknown' && (
            <span className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-300">
              CMS: {prospect.cms}
            </span>
          )}
        </div>
      )}

      {/* Pitch angles */}
      {prospect.pitch_angles.length > 0 && (
        <ul className="space-y-1">
          {prospect.pitch_angles.map((angle, i) => (
            <li key={i} className="text-xs text-gray-300 flex gap-2">
              <span className="text-emerald-400 shrink-0">→</span>
              <span>{angle}</span>
            </li>
          ))}
        </ul>
      )}

      {prospect.dismissed_reason && (
        <p className="text-[11px] text-gray-500 italic">
          Dismissed: {prospect.dismissed_reason}
        </p>
      )}
    </div>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return (
      <span className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-600">
        {label} —
      </span>
    );
  }
  const color =
    value >= 90
      ? 'text-emerald-400 bg-emerald-400/10'
      : value >= 50
        ? 'text-amber-400 bg-amber-400/10'
        : 'text-red-400 bg-red-400/10';
  return (
    <span className={`rounded px-1.5 py-0.5 ${color}`}>
      {label} {value}
    </span>
  );
}
