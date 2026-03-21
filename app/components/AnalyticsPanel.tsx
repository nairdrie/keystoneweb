'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, ExternalLink, Crown } from 'lucide-react';
import AnalyticsModal from './AnalyticsModal';

interface AnalyticsPanelProps {
  siteId?: string;
  isPublished?: boolean;
  isProUser?: boolean;
}

interface AnalyticsSummary {
  todayVisitors: number;
  weekVisitors: number;
  prevWeekVisitors: number;
  trend: 'up' | 'down' | 'flat';
  totalViews: number;
}

export default function AnalyticsPanel({ siteId, isPublished, isProUser }: AnalyticsPanelProps) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!siteId || !isPublished) return;

    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/sites/analytics?siteId=${siteId}&days=14`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setSummary({
            todayVisitors: data.todayVisitors,
            weekVisitors: data.weekVisitors,
            prevWeekVisitors: data.prevWeekVisitors,
            trend: data.trend,
            totalViews: data.totalViews,
          });
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [siteId, isPublished]);

  // Not published state
  if (!isPublished) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-600">No analytics yet</p>
            <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
              Publish your site to start tracking visitor analytics.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && !summary) {
    return (
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-lg p-3 animate-pulse">
            <div className="h-3 w-12 bg-slate-200 rounded mb-2" />
            <div className="h-6 w-8 bg-slate-200 rounded" />
          </div>
          <div className="bg-slate-50 rounded-lg p-3 animate-pulse">
            <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
            <div className="h-6 w-8 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  const trendIcon =
    summary?.trend === 'up' ? (
      <TrendingUp className="w-3.5 h-3.5 text-green-600" />
    ) : summary?.trend === 'down' ? (
      <TrendingDown className="w-3.5 h-3.5 text-red-500" />
    ) : (
      <Minus className="w-3.5 h-3.5 text-slate-400" />
    );

  const trendLabel =
    summary?.trend === 'up'
      ? 'Trending up'
      : summary?.trend === 'down'
        ? 'Trending down'
        : 'No change';

  const trendColor =
    summary?.trend === 'up'
      ? 'text-green-600'
      : summary?.trend === 'down'
        ? 'text-red-500'
        : 'text-slate-500';

  const weekChange =
    summary && summary.prevWeekVisitors > 0
      ? Math.round(
          ((summary.weekVisitors - summary.prevWeekVisitors) /
            summary.prevWeekVisitors) *
            100
        )
      : null;

  return (
    <>
      <div className="p-4 space-y-3">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200/60 rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase text-sky-600/80 tracking-wide">Today</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5 leading-none">
              {summary?.todayVisitors ?? 0}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">unique visitors</p>
          </div>
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200/60 rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase text-violet-600/80 tracking-wide">This week</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5 leading-none">
              {summary?.weekVisitors ?? 0}
            </p>
            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
              {trendIcon}
              <span className={trendColor}>
                {weekChange !== null && weekChange !== 0
                  ? `${weekChange > 0 ? '+' : ''}${weekChange}%`
                  : trendLabel}
              </span>
            </p>
          </div>
        </div>

        {/* View Detailed Analytics button */}
        <button
          onClick={() => setShowModal(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition-all group"
        >
          <BarChart3 className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-700 transition-colors" />
          View Detailed Analytics
          {!isProUser && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-gradient-to-r from-amber-400 to-amber-500 text-white px-1.5 py-0.5 rounded-full">
              <Crown className="w-2.5 h-2.5" />
              PRO
            </span>
          )}
          <ExternalLink className="w-3 h-3 text-slate-400 ml-auto" />
        </button>
      </div>

      {/* Detailed Analytics Modal */}
      <AnalyticsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        siteId={siteId}
        isProUser={isProUser}
      />
    </>
  );
}
