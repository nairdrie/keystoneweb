'use client';

import { useEffect, useState } from 'react';
import { formatCents } from '@/lib/ops/accounting';

interface Metrics {
  revenue: { month: number; year: number; allTime: number };
  expenses: { month: number; year: number; allTime: number };
  net: { month: number; year: number; allTime: number };
  taxCollected: { month: number; year: number };
  taxPaid: { month: number; year: number };
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  activeAddons: number;
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export default function MetricsCards({ refreshKey }: { refreshKey: number }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/ops/accounting')
      .then((r) => r.json())
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-800 bg-gray-900 p-4 animate-pulse">
            <div className="h-3 w-20 bg-gray-800 rounded mb-2" />
            <div className="h-7 w-24 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const netAccent = (v: number) => (v >= 0 ? 'text-emerald-400' : 'text-red-400');

  return (
    <div className="space-y-4">
      {/* Primary metrics row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="MRR"
          value={formatCents(metrics.mrr)}
          accent="text-emerald-400"
          sub={`ARR: ${formatCents(metrics.arr)}`}
        />
        <MetricCard
          label="Revenue (Month)"
          value={formatCents(metrics.revenue.month)}
          accent="text-emerald-400"
        />
        <MetricCard
          label="Expenses (Month)"
          value={formatCents(metrics.expenses.month)}
          accent="text-red-400"
        />
        <MetricCard
          label="Net (Month)"
          value={formatCents(metrics.net.month)}
          accent={netAccent(metrics.net.month)}
        />
        <MetricCard
          label="Active Subs"
          value={String(metrics.activeSubscriptions)}
          sub={`${metrics.activeAddons} add-ons`}
        />
      </div>

      {/* Year / all-time row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="Revenue (YTD)"
          value={formatCents(metrics.revenue.year)}
          accent="text-emerald-400"
        />
        <MetricCard
          label="Expenses (YTD)"
          value={formatCents(metrics.expenses.year)}
          accent="text-red-400"
        />
        <MetricCard
          label="Net (YTD)"
          value={formatCents(metrics.net.year)}
          accent={netAccent(metrics.net.year)}
        />
        <MetricCard
          label="Tax Collected (YTD)"
          value={formatCents(metrics.taxCollected.year)}
          accent="text-amber-400"
          sub={`This month: ${formatCents(metrics.taxCollected.month)}`}
        />
        <MetricCard
          label="Tax Paid (YTD)"
          value={formatCents(metrics.taxPaid.year)}
          accent="text-sky-400"
          sub={`GST refund eligible: ${formatCents(metrics.taxPaid.year)}`}
        />
      </div>
    </div>
  );
}
