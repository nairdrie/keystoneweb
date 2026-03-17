import { createAdminClient } from '@/lib/db/supabase-admin';
import Link from 'next/link';

// ── Tiny SVG bar chart rendered server-side ──────────────────────────────────

function BarChart({
  data,
  label,
  color = '#10b981',
}: {
  data: number[];
  label: string;
  color?: string;
}) {
  const max = Math.max(...data, 1);
  const w = 600;
  const h = 80;
  const barW = Math.floor(w / data.length);
  const gap = Math.max(1, Math.floor(barW * 0.15));

  return (
    <div>
      <p className="mb-2 text-xs text-gray-400">{label}</p>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full"
        style={{ height: 80 }}
        aria-hidden
      >
        {data.map((val, i) => {
          const barH = Math.max(Math.round((val / max) * h), val > 0 ? 2 : 0);
          return (
            <rect
              key={i}
              x={i * barW + gap / 2}
              y={h - barH}
              width={barW - gap}
              height={barH}
              fill={color}
              rx={2}
            />
          );
        })}
      </svg>
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  href,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
  href?: string;
}) {
  const content = (
    <div className={`rounded-lg border border-gray-800 bg-gray-900 p-5 ${href ? 'hover:border-gray-600 transition-colors' : ''}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${accent ?? 'text-white'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function OpsOverviewPage() {
  const db = createAdminClient();
  const now = new Date();
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Aggregate stats
  const [
    { count: totalUsers },
    { count: activeSubs },
    { count: totalSites },
    { count: publishedSites },
    { count: openSupport },
    { count: signups7d },
    { count: signups30d },
    { count: siteCreates30d },
    { count: sitePublishes30d },
    { count: upgrades30d },
  ] = await Promise.all([
    db.from('users').select('id', { count: 'exact', head: true }),
    db.from('user_subscriptions').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    db.from('sites').select('id', { count: 'exact', head: true }).not('user_id', 'is', null),
    db.from('sites').select('id', { count: 'exact', head: true }).eq('is_published', true),
    db.from('support_requests').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
    db.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'user_signup').gte('created_at', day7),
    db.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'user_signup').gte('created_at', day30),
    db.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'site_create').gte('created_at', day30),
    db.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'site_publish').gte('created_at', day30),
    db.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'subscription_upgrade').gte('created_at', day30),
  ]);

  // Build 30-day daily buckets for charts
  const dates: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dates.push(d.toISOString().slice(0, 10));
  }

  const { data: chartRows } = await db
    .from('analytics_events')
    .select('event_type, created_at')
    .in('event_type', ['user_signup', 'site_create', 'site_publish', 'subscription_upgrade'])
    .gte('created_at', day30)
    .order('created_at', { ascending: true });

  const signupSeries = new Array(30).fill(0);
  const createSeries = new Array(30).fill(0);
  const publishSeries = new Array(30).fill(0);
  const upgradeSeries = new Array(30).fill(0);

  for (const row of chartRows ?? []) {
    const dk = (row.created_at as string).slice(0, 10);
    const idx = dates.indexOf(dk);
    if (idx === -1) continue;
    if (row.event_type === 'user_signup') signupSeries[idx]++;
    if (row.event_type === 'site_create') createSeries[idx]++;
    if (row.event_type === 'site_publish') publishSeries[idx]++;
    if (row.event_type === 'subscription_upgrade') upgradeSeries[idx]++;
  }

  // Recent activity (last 25 events)
  const { data: recentEvents } = await db
    .from('analytics_events')
    .select('id, event_type, user_id, site_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(25);

  const eventLabels: Record<string, string> = {
    user_signup: '👤 Signup',
    user_signin: '🔑 Sign-in',
    site_create: '🏗 Site created',
    site_edit: '✏️ Site edited',
    site_publish: '🚀 Site published',
    subscription_upgrade: '⬆️ Subscribed',
    subscription_cancel: '↩️ Cancelled',
    domain_purchase: '🌐 Domain bought',
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Platform Overview</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Users" value={totalUsers ?? 0} href="/ops/users" />
        <StatCard
          label="Active Subs"
          value={activeSubs ?? 0}
          accent="text-emerald-400"
          sub={`${upgrades30d ?? 0} new in 30d`}
        />
        <StatCard
          label="Total Sites"
          value={totalSites ?? 0}
          sub={`${publishedSites ?? 0} published`}
        />
        <StatCard
          label="New Signups"
          value={signups7d ?? 0}
          sub="last 7 days"
          accent="text-sky-400"
        />
        <StatCard
          label="Open Support"
          value={openSupport ?? 0}
          accent={(openSupport ?? 0) > 0 ? 'text-amber-400' : 'text-white'}
          href="/ops/support"
        />
      </div>

      {/* 30-day charts */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-300">
            Signups — last 30 days ({signups30d ?? 0} total)
          </h2>
          <BarChart data={signupSeries} label="" color="#38bdf8" />
          <p className="mt-2 text-right text-xs text-gray-600">
            {dates[0]} → {dates[dates.length - 1]}
          </p>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-300">
            Site Activity — last 30 days
          </h2>
          <BarChart data={createSeries} label={`Creates (${siteCreates30d ?? 0})`} color="#a78bfa" />
          <div className="mt-3">
            <BarChart data={publishSeries} label={`Publishes (${sitePublishes30d ?? 0})`} color="#10b981" />
          </div>
          <p className="mt-2 text-right text-xs text-gray-600">
            {dates[0]} → {dates[dates.length - 1]}
          </p>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-300">
            New Subscriptions — last 30 days ({upgrades30d ?? 0} total)
          </h2>
          <BarChart data={upgradeSeries} label="" color="#f59e0b" />
          <p className="mt-2 text-right text-xs text-gray-600">
            {dates[0]} → {dates[dates.length - 1]}
          </p>
        </div>

        {/* Recent events */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-300">Recent Activity</h2>
          <ul className="space-y-2 text-sm">
            {(recentEvents ?? []).map((ev: any) => (
              <li key={ev.id} className="flex items-center justify-between gap-2 text-gray-300">
                <span>{eventLabels[ev.event_type] ?? ev.event_type}</span>
                <span className="text-xs text-gray-600 shrink-0">
                  {new Date(ev.created_at).toLocaleString('en-CA', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
            {!recentEvents?.length && (
              <li className="text-gray-600 text-xs">No events yet — events are recorded as users sign up, create sites, and subscribe.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
