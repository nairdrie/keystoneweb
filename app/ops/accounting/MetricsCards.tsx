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
  breakdown?: {
    revenue: {
      month: { stripe: number; manual: number };
      year: { stripe: number; manual: number };
    };
    expenses: {
      month: { domainRenewalEstimate: number; recurringEntries: number; domainPurchases: number; manual: number };
      year: { domainRenewalEstimate: number; recurringEntries: number; domainPurchases: number; manual: number };
    };
    mrr: { subscriptions: number; recurringManual: number };
  };
}

function MetricCard({
  label,
  value,
  sub,
  accent,
  breakdownLines,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  breakdownLines?: { label: string; value: number }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasBreakdown = breakdownLines && breakdownLines.length > 0;

  return (
    <div
      className={`rounded-lg border border-gray-800 bg-gray-900 p-4 ${hasBreakdown ? 'cursor-pointer hover:border-gray-700' : ''}`}
      onClick={() => hasBreakdown && setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        {hasBreakdown && (
          <span className="text-[10px] text-gray-600">{expanded ? '▲' : '▼'}</span>
        )}
      </div>
      <p className={`mt-1 text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
      {expanded && breakdownLines && (
        <div className="mt-2 pt-2 border-t border-gray-800 space-y-1">
          {breakdownLines.map((line) => (
            <div key={line.label} className="flex justify-between text-xs">
              <span className="text-gray-500">{line.label}</span>
              <span className="text-gray-400">{formatCents(line.value)}</span>
            </div>
          ))}
        </div>
      )}
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

  const b = metrics.breakdown;
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
          breakdownLines={b ? [
            { label: 'Subscriptions', value: b.mrr.subscriptions },
            { label: 'Recurring (manual)', value: b.mrr.recurringManual },
          ] : undefined}
        />
        <MetricCard
          label="Revenue (Month)"
          value={formatCents(metrics.revenue.month)}
          accent="text-emerald-400"
          breakdownLines={b ? [
            { label: 'Stripe payments', value: b.revenue.month.stripe },
            { label: 'Manual entries', value: b.revenue.month.manual },
          ] : undefined}
        />
        <MetricCard
          label="Expenses (Month)"
          value={formatCents(metrics.expenses.month)}
          accent="text-red-400"
          breakdownLines={b ? [
            { label: 'Domain renewals (est.)', value: b.expenses.month.domainRenewalEstimate },
            { label: 'Recurring entries', value: b.expenses.month.recurringEntries },
            { label: 'Domain purchases', value: b.expenses.month.domainPurchases },
            { label: 'Manual entries', value: b.expenses.month.manual },
          ] : undefined}
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
          breakdownLines={b ? [
            { label: 'Stripe payments', value: b.revenue.year.stripe },
            { label: 'Manual entries', value: b.revenue.year.manual },
          ] : undefined}
        />
        <MetricCard
          label="Expenses (YTD)"
          value={formatCents(metrics.expenses.year)}
          accent="text-red-400"
          breakdownLines={b ? [
            { label: 'Domain renewals (est.)', value: b.expenses.year.domainRenewalEstimate },
            { label: 'Recurring entries', value: b.expenses.year.recurringEntries },
            { label: 'Domain purchases', value: b.expenses.year.domainPurchases },
            { label: 'Manual entries', value: b.expenses.year.manual },
          ] : undefined}
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
