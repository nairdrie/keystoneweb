'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3, Users, Eye, Clock, ArrowUpRight,
  Monitor, Smartphone, Tablet, Globe,
  MousePointerClick, LogOut, Crown, Lock,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { useAdminContext } from '../admin-context';

interface AnalyticsData {
  todayVisitors: number;
  weekVisitors: number;
  prevWeekVisitors: number;
  trend: 'up' | 'down' | 'flat';
  totalViews: number;
  totalUniqueVisitors: number;
  topPages: Array<{ path: string; views: number }>;
  trafficSources: Array<{ source: string; count: number }>;
  devices: Record<string, number>;
  browsers: Record<string, number>;
  operatingSystems: Record<string, number>;
  bounceRate: number;
  avgDuration: number;
  dailyChart: Array<{ date: string; visitors: number; views: number }>;
  exitPages: Array<{ path: string; exits: number; rate: number }>;
}

function StatCard({ label, value, icon, subtitle, subtitleColor }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  subtitleColor?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
      {subtitle && (
        <p className={`text-xs mt-1.5 font-medium ${subtitleColor || 'text-slate-500'}`}>{subtitle}</p>
      )}
    </div>
  );
}

const sourceIcon = (source: string) => {
  switch (source) {
    case 'organic': return <Globe className="w-3.5 h-3.5 text-emerald-500" />;
    case 'social': return <Users className="w-3.5 h-3.5 text-blue-500" />;
    case 'referral': return <ArrowUpRight className="w-3.5 h-3.5 text-violet-500" />;
    default: return <MousePointerClick className="w-3.5 h-3.5 text-slate-400" />;
  }
};

const sourceLabel = (source: string) => {
  switch (source) {
    case 'organic': return 'Organic Search';
    case 'social': return 'Social Media';
    case 'referral': return 'Referral';
    default: return 'Direct';
  }
};

const deviceIcon = (device: string) => {
  switch (device) {
    case 'mobile': return <Smartphone className="w-3.5 h-3.5" />;
    case 'tablet': return <Tablet className="w-3.5 h-3.5" />;
    default: return <Monitor className="w-3.5 h-3.5" />;
  }
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return '< 1s';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
};

export default function AdminAnalyticsPage() {
  const { siteId, site, isProUser } = useAdminContext();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    if (!siteId || !site?.isPublished || !isProUser) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/sites/analytics?siteId=${siteId}&days=${period}`, { credentials: 'include' });
        if (res.ok) setData(await res.json());
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [siteId, site?.isPublished, isProUser, period]);

  // Not published
  if (!site?.isPublished) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center gap-4 p-6 bg-white border border-slate-200 border-dashed rounded-xl">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <BarChart3 className="w-6 h-6 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">No analytics yet</p>
            <p className="text-xs text-slate-400 mt-0.5">Publish your site to start tracking visitor analytics.</p>
          </div>
        </div>
      </div>
    );
  }

  // Pro paywall
  if (!isProUser) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="relative h-40 bg-linear-to-br from-sky-100 via-violet-100 to-purple-100 overflow-hidden">
            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-around px-8 pb-4 gap-1 opacity-25">
              {[35, 50, 45, 70, 60, 80, 55, 90, 75, 65, 85, 95].map((h, i) => (
                <div key={i} className="flex-1 bg-violet-400 rounded-t" style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]" />
            <div className="relative flex flex-col items-center justify-center h-full gap-2">
              <div className="w-14 h-14 rounded-full bg-linear-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Detailed Analytics</h2>
            </div>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-600 mb-4">Upgrade to <strong>Pro</strong> to unlock full analytics:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
              {['Traffic sources & trends', 'Top pages & content', 'Bounce rate & engagement', 'Device & browser stats', 'Daily visitor charts', 'Exit page analysis'].map(f => (
                <div key={f} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <button
              onClick={() => router.push('/pricing')}
              className="px-6 py-2.5 rounded-xl bg-linear-to-r from-violet-600 to-purple-600 text-white font-bold text-sm hover:brightness-110 transition-all shadow-md"
            >
              Upgrade to Pro
            </button>
          </div>
        </div>
      </div>
    );
  }

  const maxViews = data ? Math.max(...data.dailyChart.map(d => d.views), 1) : 1;

  const trendIcon = data?.trend === 'up'
    ? <TrendingUp className="w-4 h-4 text-green-500" />
    : data?.trend === 'down'
      ? <TrendingDown className="w-4 h-4 text-red-500" />
      : <Minus className="w-4 h-4 text-slate-400" />;

  const weekChange = data && data.prevWeekVisitors > 0
    ? Math.round(((data.weekVisitors - data.prevWeekVisitors) / data.prevWeekVisitors) * 100)
    : null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Analytics</h2>
        <select
          value={period}
          onChange={e => setPeriod(Number(e.target.value))}
          className="text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
              <div className="h-3 w-16 bg-slate-200 rounded mb-3" />
              <div className="h-7 w-12 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : !data ? (
        <div className="text-center py-16 text-slate-500 text-sm bg-white border border-slate-200 rounded-xl">
          No analytics data available yet.
        </div>
      ) : (
        <>
          {/* Overview stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Today" value={data.todayVisitors} icon={<Users className="w-4 h-4 text-sky-500" />} subtitle="unique visitors" />
            <StatCard label="This week" value={data.weekVisitors} icon={<BarChart3 className="w-4 h-4 text-violet-500" />}
              subtitle={weekChange !== null && weekChange !== 0 ? `${weekChange > 0 ? '+' : ''}${weekChange}% vs last week` : 'vs last week'}
              subtitleColor={weekChange !== null && weekChange > 0 ? 'text-green-600' : weekChange !== null && weekChange < 0 ? 'text-red-500' : 'text-slate-500'}
            />
            <StatCard label="Total Visitors" value={data.totalUniqueVisitors} icon={<Users className="w-4 h-4 text-emerald-500" />} />
            <StatCard label="Total Page Views" value={data.totalViews} icon={<Eye className="w-4 h-4 text-indigo-500" />} />
          </div>

          {/* Engagement stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Bounce Rate" value={`${data.bounceRate}%`} icon={<LogOut className="w-4 h-4 text-amber-500" />}
              subtitle={data.bounceRate > 70 ? 'High — may need attention' : data.bounceRate > 40 ? 'Average' : 'Good'}
              subtitleColor={data.bounceRate > 70 ? 'text-red-500' : data.bounceRate > 40 ? 'text-amber-500' : 'text-green-600'}
            />
            <StatCard label="Avg. Time on Page" value={formatDuration(data.avgDuration)} icon={<Clock className="w-4 h-4 text-emerald-500" />} />
          </div>

          {/* Trend banner */}
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-100 rounded-xl px-4 py-3">
            {trendIcon}
            <span>
              <strong>{data.weekVisitors}</strong> visitors this week
              {data.prevWeekVisitors > 0 && (
                <> vs <strong>{data.prevWeekVisitors}</strong> last week
                  {weekChange !== null && weekChange !== 0 && (
                    <span className={weekChange > 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                      {' '}{weekChange > 0 ? `+${weekChange}` : weekChange}%
                    </span>
                  )}
                </>
              )}
            </span>
          </div>

          {/* Daily chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Daily Traffic</h3>
            <div className="flex items-end gap-0.5 h-36">
              {data.dailyChart.map(day => {
                const height = Math.max((day.views / maxViews) * 100, 2);
                return (
                  <div key={day.date} className="flex-1 group relative">
                    <div
                      className="w-full bg-linear-to-t from-violet-500 to-sky-400 rounded-t transition-all hover:brightness-110 cursor-default"
                      style={{ height: `${height}%` }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 pointer-events-none">
                      <div className="bg-slate-900 text-white text-[10px] rounded-lg px-2 py-1 whitespace-nowrap shadow-lg">
                        <div className="font-bold">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                        <div>{day.visitors} visitors · {day.views} views</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-medium">
              <span>{data.dailyChart[0] ? new Date(data.dailyChart[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
              <span>{data.dailyChart.length > 0 ? new Date(data.dailyChart[data.dailyChart.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
            </div>
          </div>

          {/* Top pages + Traffic sources */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Top Pages</h3>
              <div className="space-y-1.5">
                {data.topPages.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No page data yet</p>
                ) : data.topPages.map((page, i) => {
                  const pct = Math.round((page.views / (data.topPages[0]?.views || 1)) * 100);
                  return (
                    <div key={i} className="relative">
                      <div className="absolute inset-y-0 left-0 bg-sky-50 rounded" style={{ width: `${pct}%` }} />
                      <div className="relative flex items-center justify-between px-3 py-2 text-xs">
                        <span className="font-medium text-slate-700 truncate mr-2">{page.path === '/' ? 'Homepage' : page.path}</span>
                        <span className="font-bold text-slate-900 tabular-nums">{page.views}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Traffic Sources</h3>
              <div className="space-y-2.5">
                {data.trafficSources.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No traffic data yet</p>
                ) : data.trafficSources.map((src, i) => {
                  const total = data.trafficSources.reduce((a, b) => a + b.count, 0);
                  const pct = total > 0 ? Math.round((src.count / total) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {sourceIcon(src.source)}
                      <span className="font-medium text-slate-700 flex-1">{sourceLabel(src.source)}</span>
                      <span className="text-slate-400 tabular-nums">{pct}%</span>
                      <span className="font-bold text-slate-900 tabular-nums w-8 text-right">{src.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Devices, Browsers, OS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { title: 'Devices', entries: data.devices, icon: (k: string) => deviceIcon(k) },
              { title: 'Browsers', entries: data.browsers, icon: () => <Globe className="w-3.5 h-3.5 text-slate-400" /> },
              { title: 'Operating Systems', entries: data.operatingSystems, icon: () => <Monitor className="w-3.5 h-3.5 text-slate-400" /> },
            ].map(({ title, entries, icon }) => (
              <div key={title} className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-4">{title}</h3>
                <div className="space-y-2.5">
                  {Object.entries(entries).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No data</p>
                  ) : Object.entries(entries).sort((a, b) => b[1] - a[1]).map(([key, count]) => {
                    const total = Object.values(entries).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        {icon(key)}
                        <span className="capitalize text-slate-700 flex-1">{key}</span>
                        <span className="text-slate-400 tabular-nums">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Exit pages */}
          {data.exitPages.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Exit Pages</h3>
              <p className="text-xs text-slate-500 mb-4">The last page visitors see before leaving. High exit rates may indicate issues.</p>
              <div className="space-y-1.5">
                {data.exitPages.map((page, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2.5 text-xs bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <LogOut className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-medium text-slate-700">{page.path === '/' ? 'Homepage' : page.path}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-500">{page.exits} exits</span>
                      <span className={`font-bold tabular-nums ${page.rate > 70 ? 'text-red-500' : page.rate > 40 ? 'text-amber-500' : 'text-green-600'}`}>
                        {page.rate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
