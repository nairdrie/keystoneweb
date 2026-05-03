'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Clock3,
  CreditCard,
  Edit3,
  ExternalLink,
  Filter,
  Globe2,
  Layers3,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  bucketEvents,
  countEvents,
  getDateRange,
  getDelta,
  getPreviousRange,
  groupRecentActivity,
  percent,
  relativeTime,
  safeSiteName,
  safeUserName,
  toDateInputValue,
  type Bucket,
  type BucketSize,
  type DashboardEvent,
  type DateRange,
  type RangePreset,
} from './dashboard-helpers';

type UserLookup = {
  id: string;
  email: string | null;
  business_name: string | null;
};

type SiteLookup = {
  id: string;
  site_slug: string | null;
  is_published: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
};

type SupportItem = {
  id: string;
  subject: string | null;
  status: string | null;
  priority: string | null;
  created_at: string;
};

type LaunchItem = {
  id: string;
  name: string | null;
  email: string | null;
  business_name: string | null;
  status: string | null;
  created_at: string;
};

type DashboardStats = {
  totalUsers: number;
  activeSubscriptions: number;
  totalSites: number;
  publishedSites: number;
  openSupport: number;
  urgentSupport: number;
  newLaunchRequests: number;
  draftSites: number;
  staleDraftSites: number;
  subscriptionStatusCounts: Record<string, number>;
};

type Props = {
  stats: DashboardStats;
  events: DashboardEvent[];
  recentEvents: DashboardEvent[];
  users: Record<string, UserLookup>;
  sites: Record<string, SiteLookup>;
  supportItems: SupportItem[];
  launchItems: LaunchItem[];
  recentSites: SiteLookup[];
  refreshedAt: string;
  opsBasePath: string;
  canViewUsers: boolean;
  canViewLaunch: boolean;
};

type EventFilter = 'all' | 'signups' | 'site_activity' | 'subscriptions';
type SiteStatusFilter = 'all' | 'published' | 'draft';

type Series = {
  key: string;
  label: string;
  color: string;
};

const RANGE_OPTIONS: Array<{ value: RangePreset; label: string }> = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '365 days' },
  { value: 'custom', label: 'Custom' },
];

const GROUP_OPTIONS: Array<{ value: BucketSize; label: string }> = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

const EVENT_FILTERS: Array<{ value: EventFilter; label: string; keys: string[] | null }> = [
  { value: 'all', label: 'All events', keys: null },
  { value: 'signups', label: 'Signups', keys: ['user_signup'] },
  { value: 'site_activity', label: 'Site activity', keys: ['site_create', 'site_edit', 'site_publish'] },
  { value: 'subscriptions', label: 'Subscriptions', keys: ['subscription_upgrade', 'subscription_cancel'] },
];

const SITE_ACTIVITY_SERIES: Series[] = [
  { key: 'site_create', label: 'Creates', color: '#8b5cf6' },
  { key: 'site_edit', label: 'Edits', color: '#f59e0b' },
  { key: 'site_publish', label: 'Publishes', color: '#10b981' },
];

const SIGNUP_SERIES: Series[] = [
  { key: 'user_signup', label: 'Signups', color: '#38bdf8' },
];

const SUBSCRIPTION_SERIES: Series[] = [
  { key: 'subscription_upgrade', label: 'Upgrades', color: '#f59e0b' },
];

const EVENT_META: Record<string, { label: string; badge: string; Icon: typeof Activity }> = {
  user_signup: { label: 'Signup', badge: 'border-sky-400/30 bg-sky-400/10 text-sky-200', Icon: UserPlus },
  user_signin: { label: 'Signin', badge: 'border-gray-500/30 bg-gray-500/10 text-gray-300', Icon: Users },
  site_create: { label: 'Created', badge: 'border-violet-400/30 bg-violet-400/10 text-violet-200', Icon: Sparkles },
  site_edit: { label: 'Edited', badge: 'border-amber-400/30 bg-amber-400/10 text-amber-200', Icon: Edit3 },
  site_publish: { label: 'Published', badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200', Icon: Globe2 },
  subscription_upgrade: { label: 'Subscription', badge: 'border-amber-400/30 bg-amber-400/10 text-amber-200', Icon: CreditCard },
  subscription_cancel: { label: 'Subscription', badge: 'border-gray-500/30 bg-gray-500/10 text-gray-300', Icon: CreditCard },
  domain_purchase: { label: 'Domain', badge: 'border-blue-400/30 bg-blue-400/10 text-blue-200', Icon: Globe2 },
};

function normalizeRange(value: string | null): RangePreset {
  return RANGE_OPTIONS.some((option) => option.value === value) ? value as RangePreset : '30';
}

function normalizeGroup(value: string | null): BucketSize {
  return GROUP_OPTIONS.some((option) => option.value === value) ? value as BucketSize : 'day';
}

function normalizeEventFilter(value: string | null): EventFilter {
  return EVENT_FILTERS.some((option) => option.value === value) ? value as EventFilter : 'all';
}

function normalizeSiteStatus(value: string | null): SiteStatusFilter {
  return value === 'published' || value === 'draft' ? value : 'all';
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatAbsolute(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function eventMatchesSearch(event: DashboardEvent, users: Record<string, UserLookup>, sites: Record<string, SiteLookup>, search: string) {
  if (!search) return true;
  const needle = search.toLowerCase();
  const site = event.site_id ? sites[event.site_id] : null;
  const user = event.user_id ? users[event.user_id] : null;
  const haystack = [
    event.event_type,
    site?.site_slug,
    user?.email,
    user?.business_name,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(needle);
}

function eventMatchesFilters(
  event: DashboardEvent,
  eventFilter: EventFilter,
  siteStatus: SiteStatusFilter,
  users: Record<string, UserLookup>,
  sites: Record<string, SiteLookup>,
  search: string,
) {
  const filter = EVENT_FILTERS.find((option) => option.value === eventFilter);
  if (filter?.keys && !filter.keys.includes(event.event_type)) return false;

  if (siteStatus !== 'all' && event.site_id) {
    const site = sites[event.site_id];
    if (siteStatus === 'published' && !site?.is_published) return false;
    if (siteStatus === 'draft' && site?.is_published) return false;
  }

  return eventMatchesSearch(event, users, sites, search);
}

function pathFor(opsBasePath: string, href: string) {
  if (!opsBasePath) return href;
  if (href === '/') return opsBasePath;
  return `${opsBasePath}${href}`;
}

function mergeUrl(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-950/40 px-6 py-8 text-center">
      <div className="mb-3 rounded-full border border-gray-700 bg-gray-900 p-3 text-gray-400">
        {icon}
      </div>
      <p className="text-sm font-semibold text-gray-200">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{body}</p>
    </div>
  );
}

function DeltaPill({ delta }: { delta?: { label: string; tone: 'positive' | 'negative' | 'neutral' } }) {
  if (!delta) return null;
  const Icon = delta.tone === 'positive' ? ArrowUpRight : delta.tone === 'negative' ? ArrowDownRight : Clock3;
  const toneClass = delta.tone === 'positive'
    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
    : delta.tone === 'negative'
      ? 'border-red-400/25 bg-red-400/10 text-red-300'
      : 'border-gray-600 bg-gray-800 text-gray-300';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      <Icon className="h-3 w-3" />
      {delta.label}
    </span>
  );
}

function KpiCard({
  label,
  value,
  supporting,
  tone,
  href,
  icon,
  delta,
}: {
  label: string;
  value: number | string;
  supporting?: string;
  tone: 'neutral' | 'positive' | 'attention' | 'warning';
  href?: string;
  icon: ReactNode;
  delta?: { label: string; tone: 'positive' | 'negative' | 'neutral' };
}) {
  const toneClass = {
    neutral: 'border-gray-800 bg-gray-900',
    positive: 'border-emerald-400/20 bg-emerald-400/[0.04]',
    attention: 'border-amber-400/25 bg-amber-400/[0.06]',
    warning: 'border-red-400/25 bg-red-400/[0.06]',
  }[tone];
  const content = (
    <div className={`group h-full rounded-lg border p-5 transition-colors ${toneClass} ${href ? 'hover:border-gray-500' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">{typeof value === 'number' ? formatNumber(value) : value}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-2 text-gray-300">
          {icon}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {supporting && <p className="text-sm text-gray-400">{supporting}</p>}
        <DeltaPill delta={delta} />
      </div>
      {href && (
        <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition-colors group-hover:text-gray-300">
          Open <ExternalLink className="h-3 w-3" />
        </span>
      )}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function Controls({
  rangePreset,
  bucketSize,
  customStart,
  customEnd,
  compare,
  eventFilter,
  siteStatus,
  search,
  onSetParam,
  onSetSearch,
}: {
  rangePreset: RangePreset;
  bucketSize: BucketSize;
  customStart: string;
  customEnd: string;
  compare: boolean;
  eventFilter: EventFilter;
  siteStatus: SiteStatusFilter;
  search: string;
  onSetParam: (key: string, value: string | null) => void;
  onSetSearch: (value: string) => void;
}) {
  const [draftSearch, setDraftSearch] = useState(search);

  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-200">
        <Filter className="h-4 w-4 text-gray-400" />
        Dashboard Controls
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" aria-label="Date range">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onSetParam('range', option.value)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400/50 ${
                  rangePreset === option.value
                    ? 'border-white bg-white text-gray-950'
                    : 'border-gray-700 bg-gray-950 text-gray-300 hover:border-gray-500 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {rangePreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-medium text-gray-400">
                From
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => onSetParam('from', event.target.value)}
                  className="ml-2 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                />
              </label>
              <label className="text-xs font-medium text-gray-400">
                To
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => onSetParam('to', event.target.value)}
                  className="ml-2 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                />
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end" aria-label="Chart grouping">
          {GROUP_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSetParam('group', option.value)}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400/50 ${
                bucketSize === option.value
                  ? 'border-sky-300 bg-sky-300 text-gray-950'
                  : 'border-gray-700 bg-gray-950 text-gray-300 hover:border-gray-500 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSetParam('compare', compare ? null : '1')}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400/50 ${
              compare
                ? 'border-emerald-300 bg-emerald-300 text-gray-950'
                : 'border-gray-700 bg-gray-950 text-gray-300 hover:border-gray-500 hover:text-white'
            }`}
            aria-pressed={compare}
          >
            Compare period
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            onSetSearch(draftSearch.trim());
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search activity by site or user"
            className="w-full rounded-md border border-gray-700 bg-gray-950 py-2 pl-9 pr-24 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            Apply
          </button>
        </form>

        <select
          value={eventFilter}
          onChange={(event) => onSetParam('event', event.target.value)}
          className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          aria-label="Event type filter"
        >
          {EVENT_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select
          value={siteStatus}
          onChange={(event) => onSetParam('siteStatus', event.target.value)}
          className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          aria-label="Site status filter"
        >
          <option value="all">All site statuses</option>
          <option value="published">Published sites</option>
          <option value="draft">Draft sites</option>
        </select>
      </div>
    </section>
  );
}

function AttentionSection({
  stats,
  supportItems,
  launchItems,
  opsBasePath,
}: {
  stats: DashboardStats;
  supportItems: SupportItem[];
  launchItems: LaunchItem[];
  opsBasePath: string;
}) {
  const items = [
    stats.openSupport > 0
      ? {
          title: 'Open support queue',
          body: `${stats.openSupport} open or in-progress conversation${stats.openSupport === 1 ? '' : 's'} need attention.`,
          badge: stats.urgentSupport > 0 ? `${stats.urgentSupport} high priority` : 'Needs Review',
          tone: 'attention' as const,
          href: `${pathFor(opsBasePath, '/support')}?status=open`,
          Icon: AlertTriangle,
        }
      : null,
    stats.newLaunchRequests > 0
      ? {
          title: 'New launch requests',
          body: `${stats.newLaunchRequests} request${stats.newLaunchRequests === 1 ? '' : 's'} are waiting for triage.`,
          badge: 'Needs Review',
          tone: 'attention' as const,
          href: `${pathFor(opsBasePath, '/launch')}?status=new`,
          Icon: Rocket,
        }
      : null,
    stats.activeSubscriptions === 0
      ? {
          title: 'No active subscriptions',
          body: 'There are currently no active paid subscriptions.',
          badge: 'Warning',
          tone: 'warning' as const,
          href: undefined,
          Icon: CreditCard,
        }
      : null,
    stats.staleDraftSites > 0
      ? {
          title: 'Draft sites aging',
          body: `${stats.staleDraftSites} draft site${stats.staleDraftSites === 1 ? '' : 's'} appear older than 30 days.`,
          badge: 'Review',
          tone: 'attention' as const,
          href: undefined,
          Icon: Clock3,
        }
      : null,
  ].filter(Boolean);

  if (items.length === 0) {
    return (
      <section className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-emerald-400/10 p-2 text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Platform Health</h2>
            <p className="mt-1 text-sm text-emerald-100/80">No urgent platform issues for this period.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-w-0 rounded-lg border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Attention Needed</h2>
          <p className="mt-1 text-sm text-gray-400">Operational items that are most likely to need follow-up.</p>
        </div>
        <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
          {items.length} active
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          if (!item) return null;
          const Icon = item.Icon;
          const toneClass = item.tone === 'warning'
            ? 'border-red-400/25 bg-red-400/[0.05]'
            : 'border-amber-400/25 bg-amber-400/[0.05]';
          const content = (
            <div className={`h-full rounded-lg border p-4 ${toneClass} ${item.href ? 'transition-colors hover:border-gray-500' : ''}`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <Icon className="h-5 w-5 text-amber-300" />
                <span className="rounded-full bg-gray-950/60 px-2 py-0.5 text-xs font-semibold text-gray-200">{item.badge}</span>
              </div>
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="mt-1 text-sm text-gray-400">{item.body}</p>
            </div>
          );
          return item.href ? <Link key={item.title} href={item.href}>{content}</Link> : <div key={item.title}>{content}</div>;
        })}
      </div>
      {(supportItems.length > 0 || launchItems.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {supportItems.length > 0 && (
            <CompactQueue
              title="Open support queue"
              items={supportItems.slice(0, 3).map((item) => ({
                key: item.id,
                title: item.subject || 'No subject',
                meta: `${item.priority || 'normal'} priority - ${relativeTime(item.created_at)}`,
                href: pathFor(opsBasePath, `/support/${item.id}`),
              }))}
            />
          )}
          {launchItems.length > 0 && (
            <CompactQueue
              title="Launch requests"
              items={launchItems.slice(0, 3).map((item) => ({
                key: item.id,
                title: item.business_name || item.name || item.email || 'New launch request',
                meta: `${item.status || 'new'} - ${relativeTime(item.created_at)}`,
                href: pathFor(opsBasePath, `/launch/${item.id}`),
              }))}
            />
          )}
        </div>
      )}
    </section>
  );
}

function CompactQueue({ title, items }: { title: string; items: Array<{ key: string; title: string; meta: string; href?: string }> }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</p>
      <div className="space-y-2">
        {items.map((item) => {
          const row = (
            <div className="rounded-md px-2 py-2 transition-colors hover:bg-white/[0.03]">
              <p className="truncate text-sm font-medium text-gray-200">{item.title}</p>
              <p className="mt-0.5 text-xs capitalize text-gray-500">{item.meta}</p>
            </div>
          );
          return item.href ? <Link key={item.key} href={item.href}>{row}</Link> : <div key={item.key}>{row}</div>;
        })}
      </div>
    </div>
  );
}

function totalForSeries(buckets: Bucket[], series: Series[]) {
  return buckets.reduce((sum, bucket) => (
    sum + series.reduce((bucketSum, item) => bucketSum + (bucket.values[item.key] ?? 0), 0)
  ), 0);
}

function ChartCard({
  title,
  description,
  range,
  buckets,
  series,
  emptyTitle,
  emptyBody,
  compare,
  previousTotal,
  stacked = false,
}: {
  title: string;
  description: string;
  range: DateRange;
  buckets: Bucket[];
  series: Series[];
  emptyTitle: string;
  emptyBody: string;
  compare: boolean;
  previousTotal: number;
  stacked?: boolean;
}) {
  const total = totalForSeries(buckets, series);
  const delta = compare ? getDelta(total, previousTotal) : undefined;

  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-gray-400">{description}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{formatNumber(total)}</p>
          <p className="text-xs text-gray-500">total in period</p>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {series.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
        <DeltaPill delta={delta} />
      </div>
      {total === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title={emptyTitle}
          body={emptyBody}
        />
      ) : (
        <BarChart buckets={buckets} series={series} stacked={stacked} />
      )}
      <p className="mt-3 text-xs text-gray-500">{range.label}</p>
    </section>
  );
}

function BarChart({ buckets, series, stacked }: { buckets: Bucket[]; series: Series[]; stacked: boolean }) {
  const max = Math.max(
    ...buckets.map((bucket) => (
      stacked
        ? series.reduce((sum, item) => sum + (bucket.values[item.key] ?? 0), 0)
        : Math.max(...series.map((item) => bucket.values[item.key] ?? 0))
    )),
    1,
  );

  return (
    <div className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
      <div className="flex h-64 flex-col justify-between text-right text-[11px] text-gray-500">
        <span>{max}</span>
        <span>{Math.round(max / 2)}</span>
        <span>0</span>
      </div>
      <div className="relative min-w-0 rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-3" style={{ height: 256 }}>
        <div className="pointer-events-none absolute inset-x-3 top-3 border-t border-gray-800/70" />
        <div className="pointer-events-none absolute inset-x-3 top-1/2 border-t border-gray-800/70" />
        <div
          className="flex h-full min-w-0 items-end"
          style={{ gap: buckets.length > 180 ? 0 : buckets.length > 90 ? 1 : buckets.length > 45 ? 2 : 6 }}
        >
          {buckets.map((bucket) => {
            const bucketTotal = series.reduce((sum, item) => sum + (bucket.values[item.key] ?? 0), 0);
            return (
              <div key={bucket.key} className="group relative flex min-w-0 flex-1 items-end justify-center self-stretch">
                {stacked ? (
                  <div
                    className="flex min-w-0 w-full max-w-12 flex-col justify-end overflow-hidden rounded-t-sm"
                    style={{ height: bucketTotal > 0 ? `${Math.max((bucketTotal / max) * 100, 4)}%` : 0 }}
                  >
                    {series.map((item) => {
                      const value = bucket.values[item.key] ?? 0;
                      if (value === 0) return null;
                      return (
                        <div
                          key={item.key}
                          style={{ height: `${(value / bucketTotal) * 100}%`, backgroundColor: item.color }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-full min-w-0 w-full items-end justify-center gap-px">
                    {series.map((item) => {
                      const value = bucket.values[item.key] ?? 0;
                      return (
                        <div
                          key={item.key}
                          className="min-w-0 w-full max-w-10 rounded-t-sm transition-opacity group-hover:opacity-80"
                          style={{
                            height: value > 0 ? `${Math.max((value / max) * 100, 4)}%` : 0,
                            backgroundColor: item.color,
                          }}
                        />
                      );
                    })}
                  </div>
                )}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max max-w-60 -translate-x-1/2 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white shadow-xl group-hover:block">
                  <p className="font-semibold">{bucket.label}</p>
                  <div className="mt-1 space-y-0.5">
                    {series.map((item) => (
                      <p key={item.key} className="flex items-center justify-between gap-4 text-gray-300">
                        <span>{item.label}</span>
                        <span className="font-semibold text-white">{bucket.values[item.key] ?? 0}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActivityBadge({ eventType }: { eventType: string }) {
  const meta = EVENT_META[eventType] ?? { label: 'Activity', badge: 'border-gray-600 bg-gray-800 text-gray-300', Icon: Activity };
  const Icon = meta.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.badge}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function ActivityFeed({
  events,
  users,
  sites,
}: {
  events: DashboardEvent[];
  users: Record<string, UserLookup>;
  sites: Record<string, SiteLookup>;
}) {
  const groups = useMemo(() => groupRecentActivity(events).slice(0, 30), [events]);

  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Recent Activity</h2>
          <p className="mt-1 text-sm text-gray-400">{groups.length} grouped item{groups.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      {groups.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-5 w-5" />}
          title="No matching activity"
          body="Try clearing the search or expanding the selected date range."
        />
      ) : (
        <div className="divide-y divide-gray-800">
          {groups.map((group) => {
            const site = group.siteId ? sites[group.siteId] : null;
            const user = group.userId ? users[group.userId] : null;
            const siteName = site ? safeSiteName(site.site_slug) : group.eventType === 'user_signup' ? 'User activity' : 'Platform event';
            const userName = user ? safeUserName(user.email, user.business_name) : null;
            const meta = EVENT_META[group.eventType] ?? { label: group.eventType.replace(/_/g, ' '), badge: '', Icon: Activity };
            const actionText = group.count > 1
              ? `${meta.label.toLowerCase()} ${group.count} times`
              : meta.label.toLowerCase();

            return (
              <div key={group.key} className="flex items-start gap-3 py-3">
                <div className="mt-0.5 rounded-md border border-gray-800 bg-gray-950 p-2 text-gray-400">
                  <meta.Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-white">{siteName}</p>
                    <ActivityBadge eventType={group.eventType} />
                  </div>
                  <p className="mt-1 text-sm text-gray-400">
                    <span className="capitalize">{actionText}</span>
                    {userName && <span> by <span className="text-gray-300">{userName}</span></span>}
                  </p>
                </div>
                <time
                  className="shrink-0 text-xs text-gray-500"
                  dateTime={group.latestAt}
                  title={formatAbsolute(group.latestAt)}
                >
                  {relativeTime(group.latestAt)}
                </time>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OperationalLists({
  events,
  sites,
  recentSites,
}: {
  events: DashboardEvent[];
  sites: Record<string, SiteLookup>;
  recentSites: SiteLookup[];
}) {
  const topSites = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      if (!event.site_id) continue;
      counts.set(event.site_id, (counts.get(event.site_id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([siteId, count]) => ({ site: sites[siteId], count }));
  }, [events, sites]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-base font-semibold text-white">Top Active Sites</h2>
        <p className="mt-1 text-sm text-gray-400">Sites with the most tracked activity in the selected period.</p>
        <div className="mt-4 space-y-3">
          {topSites.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-800 bg-gray-950/40 p-4 text-sm text-gray-500">No site activity for this period.</p>
          ) : topSites.map(({ site, count }, index) => (
            <div key={`${site?.id ?? index}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-200">{safeSiteName(site?.site_slug)}</p>
                <p className="text-xs text-gray-500">{site?.is_published ? 'Published' : 'Draft'}</p>
              </div>
              <span className="rounded-full bg-gray-800 px-2 py-1 text-xs font-semibold text-gray-300">{count} events</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-base font-semibold text-white">Recently Created Sites</h2>
        <p className="mt-1 text-sm text-gray-400">Newest sites available from the current operations data.</p>
        <div className="mt-4 space-y-3">
          {recentSites.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-800 bg-gray-950/40 p-4 text-sm text-gray-500">No recent sites available.</p>
          ) : recentSites.slice(0, 5).map((site) => (
            <div key={site.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-200">{safeSiteName(site.site_slug)}</p>
                <p className="text-xs text-gray-500">{site.created_at ? relativeTime(site.created_at) : 'Unknown creation date'}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${site.is_published ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}>
                {site.is_published ? 'Published' : 'Draft'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function OpsOverviewDashboard({
  stats,
  events,
  recentEvents,
  users,
  sites,
  supportItems,
  launchItems,
  recentSites,
  refreshedAt,
  opsBasePath,
  canViewUsers,
  canViewLaunch,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRefreshing, startRefresh] = useTransition();

  const rangePreset = normalizeRange(searchParams.get('range'));
  const bucketSize = normalizeGroup(searchParams.get('group'));
  const compare = searchParams.get('compare') === '1';
  const eventFilter = normalizeEventFilter(searchParams.get('event'));
  const siteStatus = normalizeSiteStatus(searchParams.get('siteStatus'));
  const search = searchParams.get('q')?.trim() ?? '';

  const defaultRange = getDateRange('30', null, null);
  const customStart = searchParams.get('from') || toDateInputValue(defaultRange.start);
  const customEnd = searchParams.get('to') || toDateInputValue(defaultRange.end);
  const range = useMemo(
    () => getDateRange(rangePreset, customStart, customEnd),
    [rangePreset, customStart, customEnd],
  );
  const previousRange = useMemo(() => getPreviousRange(range), [range]);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    if (key === 'range' && value !== 'custom') {
      params.delete('from');
      params.delete('to');
    }
    router.replace(mergeUrl(pathname, params), { scroll: false });
  }

  function setSearch(value: string) {
    setParam('q', value || null);
  }

  const filteredEvents = useMemo(() => events.filter((event) => (
    eventMatchesFilters(event, eventFilter, siteStatus, users, sites, search)
  )), [events, eventFilter, siteStatus, users, sites, search]);

  const periodEvents = useMemo(() => filteredEvents.filter((event) => {
    const date = new Date(event.created_at);
    return !Number.isNaN(date.getTime()) && date >= range.start && date <= range.end;
  }), [filteredEvents, range]);

  const activityEvents = useMemo(() => recentEvents.filter((event) => (
    eventMatchesFilters(event, eventFilter, siteStatus, users, sites, search)
  )), [recentEvents, eventFilter, siteStatus, users, sites, search]);

  const buckets = useMemo(() => bucketEvents(filteredEvents, range, bucketSize), [filteredEvents, range, bucketSize]);
  const previousFilteredEvents = useMemo(() => filteredEvents, [filteredEvents]);
  const publishedPct = percent(stats.publishedSites, stats.totalSites);
  const currentSignups = countEvents(filteredEvents, ['user_signup'], range);
  const previousSignups = countEvents(previousFilteredEvents, ['user_signup'], previousRange);
  const currentCreates = countEvents(filteredEvents, ['site_create'], range);
  const currentPublishes = countEvents(filteredEvents, ['site_publish'], range);
  const previousPublishes = countEvents(previousFilteredEvents, ['site_publish'], previousRange);
  const currentSubscriptions = countEvents(filteredEvents, ['subscription_upgrade'], range);
  const previousSubscriptions = countEvents(previousFilteredEvents, ['subscription_upgrade'], previousRange);
  const previousSiteActivity = countEvents(previousFilteredEvents, ['site_create', 'site_edit', 'site_publish'], previousRange);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Platform Overview</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Operations summary for users, sites, subscriptions, launches, support, and platform activity.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Showing {range.label}
            </span>
            <span>Last refreshed {formatAbsolute(refreshedAt)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => startRefresh(() => router.refresh())}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-gray-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          aria-label="Refresh dashboard data"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      <Controls
        rangePreset={rangePreset}
        bucketSize={bucketSize}
        customStart={customStart}
        customEnd={customEnd}
        compare={compare}
        eventFilter={eventFilter}
        siteStatus={siteStatus}
        search={search}
        onSetParam={setParam}
        onSetSearch={setSearch}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <KpiCard
          label="Total Users"
          value={stats.totalUsers}
          supporting={`${formatNumber(currentSignups)} signup${currentSignups === 1 ? '' : 's'} in period`}
          icon={<Users className="h-5 w-5" />}
          tone="neutral"
          href={canViewUsers ? pathFor(opsBasePath, '/users') : undefined}
          delta={compare ? getDelta(currentSignups, previousSignups) : undefined}
        />
        <KpiCard
          label="Active Subscriptions"
          value={stats.activeSubscriptions}
          supporting={`${formatNumber(currentSubscriptions)} new in period`}
          icon={<CreditCard className="h-5 w-5" />}
          tone={stats.activeSubscriptions === 0 ? 'warning' : 'positive'}
          delta={compare ? getDelta(currentSubscriptions, previousSubscriptions) : undefined}
        />
        <KpiCard
          label="Total Sites"
          value={stats.totalSites}
          supporting={`${formatNumber(currentCreates)} created in period`}
          icon={<Layers3 className="h-5 w-5" />}
          tone="neutral"
          delta={compare ? getDelta(currentCreates, countEvents(filteredEvents, ['site_create'], previousRange)) : undefined}
        />
        <KpiCard
          label="Published Sites"
          value={stats.publishedSites}
          supporting={publishedPct === null ? 'No sites yet' : `${publishedPct}% published`}
          icon={<Globe2 className="h-5 w-5" />}
          tone={stats.publishedSites > 0 ? 'positive' : 'neutral'}
          delta={compare ? getDelta(currentPublishes, previousPublishes) : undefined}
        />
        <KpiCard
          label="New Signups"
          value={currentSignups}
          supporting="Selected period"
          icon={<UserPlus className="h-5 w-5" />}
          tone={currentSignups > 0 ? 'positive' : 'neutral'}
          delta={compare ? getDelta(currentSignups, previousSignups) : undefined}
        />
        <KpiCard
          label="Open Support"
          value={stats.openSupport}
          supporting={stats.urgentSupport > 0 ? `${stats.urgentSupport} high priority` : stats.openSupport > 0 ? 'Needs attention' : 'Queue clear'}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={stats.openSupport > 0 ? 'attention' : 'positive'}
          href={`${pathFor(opsBasePath, '/support')}?status=open`}
        />
        <KpiCard
          label="New Launch Requests"
          value={stats.newLaunchRequests}
          supporting={stats.newLaunchRequests > 0 ? 'Needs review' : 'No new requests'}
          icon={<Rocket className="h-5 w-5" />}
          tone={stats.newLaunchRequests > 0 ? 'attention' : 'positive'}
          href={canViewLaunch ? `${pathFor(opsBasePath, '/launch')}?status=new` : undefined}
        />
      </section>

      <AttentionSection stats={stats} supportItems={supportItems} launchItems={launchItems} opsBasePath={opsBasePath} />

      <section className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          title="Signups"
          description="New account creation over the selected period."
          range={range}
          buckets={buckets}
          series={SIGNUP_SERIES}
          emptyTitle="No signups in this period"
          emptyBody="Try expanding the date range or clearing activity filters."
          compare={compare}
          previousTotal={previousSignups}
        />
        <ChartCard
          title="Site Activity"
          description="Creates, edits, and publishes grouped into one operational view."
          range={range}
          buckets={buckets}
          series={SITE_ACTIVITY_SERIES}
          emptyTitle="No site activity in this period"
          emptyBody="Try a wider date range, or remove site status and event filters."
          compare={compare}
          previousTotal={previousSiteActivity}
          stacked
        />
        <ChartCard
          title="New Subscriptions"
          description="Subscription upgrade events captured by platform analytics."
          range={range}
          buckets={buckets}
          series={SUBSCRIPTION_SERIES}
          emptyTitle="No subscription upgrades in this period"
          emptyBody="No new subscriptions were recorded for the current filter set."
          compare={compare}
          previousTotal={previousSubscriptions}
        />
      </section>

      <OperationalLists events={periodEvents} sites={sites} recentSites={recentSites} />

      {Object.keys(stats.subscriptionStatusCounts).length > 0 && (
        <section className="rounded-lg border border-gray-800 bg-gray-900 p-5">
          <h2 className="text-base font-semibold text-white">Subscription Status</h2>
          <p className="mt-1 text-sm text-gray-400">Current subscription breakdown from existing subscription records.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(stats.subscriptionStatusCounts).map(([status, value]) => (
              <div key={status} className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{status.replace(/_/g, ' ')}</p>
                <p className="mt-2 text-2xl font-bold text-white">{formatNumber(value)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <ActivityFeed events={activityEvents} users={users} sites={sites} />
    </div>
  );
}
