'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  X,
  BarChart3,
  Users,
  Eye,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  MousePointerClick,
  LogOut,
  Crown,
  Lock,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId?: string;
  isProUser?: boolean;
}

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
  days: number;
}

export default function AnalyticsModal({
  isOpen,
  onClose,
  siteId,
  isProUser = false,
}: AnalyticsModalProps) {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    if (!isOpen || !siteId) return;

    // If not pro, don't fetch detailed data
    if (!isProUser) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/sites/analytics?siteId=${siteId}&days=${period}`,
          { credentials: 'include' }
        );
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, siteId, period, isProUser]);

  if (!isOpen) return null;

  // ── Pro paywall ─────────────────────────────────────────────────────
  if (!isProUser) {
    const paywall = (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10001] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Blurred preview background */}
          <div className="relative h-48 bg-gradient-to-br from-sky-100 via-violet-100 to-purple-100 p-6 overflow-hidden">
            {/* Fake chart bars for visual effect */}
            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-around px-8 pb-4 gap-1 opacity-30">
              {[35, 50, 45, 70, 60, 80, 55, 90, 75, 65, 85, 95].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-violet-400 rounded-t"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]" />
            <div className="relative flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg mb-3">
                <Lock className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-black text-slate-900">Detailed Analytics</h2>
            </div>
          </div>

          <div className="p-6 text-center">
            <p className="text-sm text-slate-600 leading-relaxed mb-2">
              Unlock detailed analytics with a <strong>Pro subscription</strong> to see:
            </p>
            <div className="grid grid-cols-2 gap-2 text-left mb-6">
              {[
                'Traffic sources & trends',
                'Top pages & content',
                'Bounce rate & engagement',
                'Device & browser stats',
                'Daily visitor charts',
                'Exit page analysis',
              ].map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-1.5 text-xs text-slate-600"
                >
                  <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                onClose();
                router.push('/pricing');
              }}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm hover:brightness-110 transition-all shadow-lg mb-3"
            >
              Upgrade to Pro
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    );

    return createPortal(paywall, document.body);
  }

  // ── Full analytics modal (Pro users) ────────────────────────────────
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return '< 1s';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}m ${remaining}s`;
  };

  const sourceIcon = (source: string) => {
    switch (source) {
      case 'organic':
        return <Globe className="w-3.5 h-3.5 text-emerald-500" />;
      case 'social':
        return <Users className="w-3.5 h-3.5 text-blue-500" />;
      case 'referral':
        return <ArrowUpRight className="w-3.5 h-3.5 text-violet-500" />;
      default:
        return <MousePointerClick className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const sourceLabel = (source: string) => {
    switch (source) {
      case 'organic':
        return 'Organic Search';
      case 'social':
        return 'Social Media';
      case 'referral':
        return 'Referral';
      default:
        return 'Direct';
    }
  };

  const deviceIcon = (device: string) => {
    switch (device) {
      case 'mobile':
        return <Smartphone className="w-3.5 h-3.5" />;
      case 'tablet':
        return <Tablet className="w-3.5 h-3.5" />;
      default:
        return <Monitor className="w-3.5 h-3.5" />;
    }
  };

  // Chart: simple bar visualization
  const maxViews = data
    ? Math.max(...data.dailyChart.map((d) => d.views), 1)
    : 1;

  const trendIcon =
    data?.trend === 'up' ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : data?.trend === 'down' ? (
      <TrendingDown className="w-4 h-4 text-red-500" />
    ) : (
      <Minus className="w-4 h-4 text-slate-400" />
    );

  const modal = (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10001] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Site Analytics</h2>
              <p className="text-xs text-slate-500">
                Visitor insights for the last {period} days
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Period selector */}
            <select
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
              className="text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && !data ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
            </div>
          ) : !data ? (
            <div className="text-center py-20 text-slate-500 text-sm">
              No analytics data available yet.
            </div>
          ) : (
            <div className="space-y-6">
              {/* ── Overview Cards ──────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Total Visitors"
                  value={data.totalUniqueVisitors}
                  icon={<Users className="w-4 h-4 text-sky-500" />}
                />
                <StatCard
                  label="Total Page Views"
                  value={data.totalViews}
                  icon={<Eye className="w-4 h-4 text-violet-500" />}
                />
                <StatCard
                  label="Bounce Rate"
                  value={`${data.bounceRate}%`}
                  icon={<LogOut className="w-4 h-4 text-amber-500" />}
                  subtitle={data.bounceRate > 70 ? 'High' : data.bounceRate > 40 ? 'Average' : 'Good'}
                  subtitleColor={data.bounceRate > 70 ? 'text-red-500' : data.bounceRate > 40 ? 'text-amber-500' : 'text-green-500'}
                />
                <StatCard
                  label="Avg. Time on Page"
                  value={formatDuration(data.avgDuration)}
                  icon={<Clock className="w-4 h-4 text-emerald-500" />}
                />
              </div>

              {/* ── Trend indicator ─────────────────────────────── */}
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-4 py-2.5 border border-slate-100">
                {trendIcon}
                <span>
                  <strong>{data.weekVisitors}</strong> visitors this week
                  {data.prevWeekVisitors > 0 && (
                    <>
                      {' '}vs <strong>{data.prevWeekVisitors}</strong> last week
                      {data.trend === 'up' && (
                        <span className="text-green-600 font-semibold">
                          {' '}(+{Math.round(((data.weekVisitors - data.prevWeekVisitors) / data.prevWeekVisitors) * 100)}%)
                        </span>
                      )}
                      {data.trend === 'down' && (
                        <span className="text-red-500 font-semibold">
                          {' '}({Math.round(((data.weekVisitors - data.prevWeekVisitors) / data.prevWeekVisitors) * 100)}%)
                        </span>
                      )}
                    </>
                  )}
                </span>
              </div>

              {/* ── Daily Chart ─────────────────────────────────── */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3">
                  Daily Traffic
                </h3>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <div className="flex items-end gap-[2px] h-32">
                    {data.dailyChart.map((day) => {
                      const height = Math.max(
                        (day.views / maxViews) * 100,
                        2
                      );
                      return (
                        <div
                          key={day.date}
                          className="flex-1 group relative"
                        >
                          <div
                            className="w-full bg-gradient-to-t from-violet-500 to-sky-400 rounded-t transition-all hover:brightness-110 cursor-default"
                            style={{ height: `${height}%` }}
                          />
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                            <div className="bg-slate-900 text-white text-[10px] rounded-lg px-2 py-1 whitespace-nowrap shadow-lg">
                              <div className="font-bold">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                              <div>{day.visitors} visitors &middot; {day.views} views</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 text-[9px] text-slate-400 font-medium">
                    <span>
                      {data.dailyChart.length > 0
                        ? new Date(data.dailyChart[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : ''}
                    </span>
                    <span>
                      {data.dailyChart.length > 0
                        ? new Date(data.dailyChart[data.dailyChart.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Two-column: Top Pages + Traffic Sources ───── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Top Pages */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3">
                    Top Pages
                  </h3>
                  <div className="space-y-1.5">
                    {data.topPages.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No page data yet</p>
                    ) : (
                      data.topPages.map((page, i) => {
                        const maxPageViews = data.topPages[0]?.views || 1;
                        const pct = Math.round((page.views / maxPageViews) * 100);
                        return (
                          <div key={i} className="relative">
                            <div
                              className="absolute inset-y-0 left-0 bg-sky-50 rounded"
                              style={{ width: `${pct}%` }}
                            />
                            <div className="relative flex items-center justify-between px-3 py-2 text-xs">
                              <span className="font-medium text-slate-700 truncate mr-2">
                                {page.path === '/' ? 'Homepage' : page.path}
                              </span>
                              <span className="font-bold text-slate-900 tabular-nums">
                                {page.views}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Traffic Sources */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3">
                    Traffic Sources
                  </h3>
                  <div className="space-y-2">
                    {data.trafficSources.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No traffic data yet</p>
                    ) : (
                      data.trafficSources.map((src, i) => {
                        const totalSrc = data.trafficSources.reduce(
                          (a, b) => a + b.count,
                          0
                        );
                        const pct =
                          totalSrc > 0
                            ? Math.round((src.count / totalSrc) * 100)
                            : 0;
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-xs"
                          >
                            {sourceIcon(src.source)}
                            <span className="font-medium text-slate-700 flex-1">
                              {sourceLabel(src.source)}
                            </span>
                            <span className="text-slate-500 tabular-nums">
                              {pct}%
                            </span>
                            <span className="font-bold text-slate-900 tabular-nums w-8 text-right">
                              {src.count}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* ── Devices, Browsers, OS ─────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Devices */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Devices</h3>
                  <div className="space-y-2">
                    {Object.entries(data.devices).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No data</p>
                    ) : (
                      Object.entries(data.devices)
                        .sort((a, b) => b[1] - a[1])
                        .map(([device, count]) => {
                          const total = Object.values(data.devices).reduce((a, b) => a + b, 0);
                          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                          return (
                            <div key={device} className="flex items-center gap-2 text-xs">
                              {deviceIcon(device)}
                              <span className="capitalize text-slate-700 flex-1">{device}</span>
                              <span className="text-slate-500 tabular-nums">{pct}%</span>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Browsers */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Browsers</h3>
                  <div className="space-y-2">
                    {Object.entries(data.browsers).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No data</p>
                    ) : (
                      Object.entries(data.browsers)
                        .sort((a, b) => b[1] - a[1])
                        .map(([browser, count]) => {
                          const total = Object.values(data.browsers).reduce((a, b) => a + b, 0);
                          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                          return (
                            <div key={browser} className="flex items-center gap-2 text-xs">
                              <Globe className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-slate-700 flex-1">{browser}</span>
                              <span className="text-slate-500 tabular-nums">{pct}%</span>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Operating Systems */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Operating Systems</h3>
                  <div className="space-y-2">
                    {Object.entries(data.operatingSystems).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No data</p>
                    ) : (
                      Object.entries(data.operatingSystems)
                        .sort((a, b) => b[1] - a[1])
                        .map(([os, count]) => {
                          const total = Object.values(data.operatingSystems).reduce((a, b) => a + b, 0);
                          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                          return (
                            <div key={os} className="flex items-center gap-2 text-xs">
                              <Monitor className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-slate-700 flex-1">{os}</span>
                              <span className="text-slate-500 tabular-nums">{pct}%</span>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>

              {/* ── Exit Pages ────────────────────────────────── */}
              {data.exitPages.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Exit Pages</h3>
                  <p className="text-[10px] text-slate-500 mb-2">
                    The last page visitors see before leaving your site. High exit rates may indicate issues.
                  </p>
                  <div className="space-y-1.5">
                    {data.exitPages.map((page, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 text-xs bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <LogOut className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-700">
                            {page.path === '/' ? 'Homepage' : page.path}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{page.exits} exits</span>
                          <span
                            className={`font-bold tabular-nums ${
                              page.rate > 70
                                ? 'text-red-500'
                                : page.rate > 40
                                  ? 'text-amber-500'
                                  : 'text-green-600'
                            }`}
                          >
                            {page.rate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Stat Card sub-component ───────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  subtitle,
  subtitleColor,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  subtitleColor?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-xl font-black text-slate-900 leading-none">{value}</p>
      {subtitle && (
        <p className={`text-[10px] mt-1 font-medium ${subtitleColor || 'text-slate-500'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
