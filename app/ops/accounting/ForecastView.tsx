'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatCents } from '@/lib/ops/accounting';

interface ForecastPoint {
  month: string;
  label: string;
  projectedRevenue: number;
  projectedExpenses: number;
  projectedNet: number;
  cumulativeNet: number;
}

interface Assumptions {
  subscriptionMrr: number;
  addonMrr: number;
  totalMrr: number;
  activeSubscriptions: number;
  activeAddons: number;
  autoRenewDomains: number;
}

export default function ForecastView({ refreshKey }: { refreshKey: number }) {
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/ops/accounting/forecast')
      .then((r) => r.json())
      .then((data) => {
        setForecast(data.forecast ?? []);
        setAssumptions(data.assumptions ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
        <div className="h-64 bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!forecast.length) {
    return <p className="text-gray-500">No forecast data available.</p>;
  }

  // Find max values for chart scaling
  const maxRevenue = Math.max(...forecast.map((f) => f.projectedRevenue), 1);
  const maxExpense = Math.max(...forecast.map((f) => f.projectedExpenses), 1);
  const maxValue = Math.max(maxRevenue, maxExpense);
  const minCumulative = Math.min(...forecast.map((f) => f.cumulativeNet), 0);
  const maxCumulative = Math.max(...forecast.map((f) => f.cumulativeNet), 1);
  const cumulativeRange = maxCumulative - minCumulative || 1;

  // Key milestones
  const month1 = forecast[0];
  const month3 = forecast[2];
  const month6 = forecast[5];
  const month12 = forecast[11];

  return (
    <div className="space-y-6">
      {/* Assumptions */}
      {assumptions && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Forecast Assumptions</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 text-sm">
            <div>
              <p className="text-xs text-gray-500">Subscription MRR</p>
              <p className="text-emerald-400 font-mono">{formatCents(assumptions.subscriptionMrr)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Add-on MRR</p>
              <p className="text-emerald-400 font-mono">{formatCents(assumptions.addonMrr)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total MRR</p>
              <p className="text-white font-bold font-mono">{formatCents(assumptions.totalMrr)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Active Subs</p>
              <p className="text-white font-mono">{assumptions.activeSubscriptions}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Auto-Renew Domains</p>
              <p className="text-white font-mono">{assumptions.autoRenewDomains}</p>
            </div>
          </div>
        </div>
      )}

      {/* Milestone cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: '1 Month', data: month1 },
          { label: '3 Months', data: month3 },
          { label: '6 Months', data: month6 },
          { label: '12 Months', data: month12 },
        ].map(({ label, data }) =>
          data ? (
            <div key={label} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <p className="text-xs text-gray-500 uppercase">{label}</p>
              <p className={`mt-1 text-xl font-bold ${data.cumulativeNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCents(data.cumulativeNet)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatCents(data.projectedRevenue)} in / {formatCents(data.projectedExpenses)} out
              </p>
            </div>
          ) : null
        )}
      </div>

      {/* Revenue vs Expenses bar chart */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Monthly Revenue vs Expenses (12-Month Forecast)</h3>
        <div className="flex items-end gap-1 h-48">
          {forecast.map((f) => {
            const revH = Math.max((f.projectedRevenue / maxValue) * 100, 1);
            const expH = Math.max((f.projectedExpenses / maxValue) * 100, 1);
            return (
              <div key={f.month} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                <div className="w-full flex gap-px justify-center" style={{ height: '192px', alignItems: 'flex-end' }}>
                  <div
                    className="w-[45%] bg-emerald-500/70 rounded-t-sm min-h-[2px]"
                    style={{ height: `${revH}%` }}
                  />
                  <div
                    className="w-[45%] bg-red-500/70 rounded-t-sm min-h-[2px]"
                    style={{ height: `${expH}%` }}
                  />
                </div>
                <span className="text-[9px] text-gray-600 mt-1">{f.label.split(' ')[0]}</span>

                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <p className="font-medium text-white">{f.label}</p>
                  <p className="text-emerald-400">Revenue: {formatCents(f.projectedRevenue)}</p>
                  <p className="text-red-400">Expenses: {formatCents(f.projectedExpenses)}</p>
                  <p className={f.projectedNet >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    Net: {formatCents(f.projectedNet)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-emerald-500/70" /> Revenue
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-red-500/70" /> Expenses
          </span>
        </div>
      </div>

      {/* Cumulative net chart */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Cumulative Net Cash Flow</h3>
        <svg viewBox="0 0 600 150" className="w-full" style={{ height: 150 }}>
          {/* Zero line */}
          {minCumulative < 0 && (
            <line
              x1="0"
              y1={150 - ((0 - minCumulative) / cumulativeRange) * 140 - 5}
              x2="600"
              y2={150 - ((0 - minCumulative) / cumulativeRange) * 140 - 5}
              stroke="#374151"
              strokeDasharray="4"
            />
          )}
          {/* Line */}
          <polyline
            fill="none"
            stroke={forecast[forecast.length - 1]?.cumulativeNet >= 0 ? '#10b981' : '#ef4444'}
            strokeWidth="2.5"
            strokeLinejoin="round"
            points={forecast
              .map((f, i) => {
                const x = (i / (forecast.length - 1)) * 580 + 10;
                const y = 150 - ((f.cumulativeNet - minCumulative) / cumulativeRange) * 140 - 5;
                return `${x},${y}`;
              })
              .join(' ')}
          />
          {/* Dots */}
          {forecast.map((f, i) => {
            const x = (i / (forecast.length - 1)) * 580 + 10;
            const y = 150 - ((f.cumulativeNet - minCumulative) / cumulativeRange) * 140 - 5;
            return (
              <circle
                key={f.month}
                cx={x}
                cy={y}
                r="4"
                fill={f.cumulativeNet >= 0 ? '#10b981' : '#ef4444'}
              />
            );
          })}
          {/* Labels */}
          {forecast.map((f, i) => {
            if (i % 2 !== 0 && i !== forecast.length - 1) return null;
            const x = (i / (forecast.length - 1)) * 580 + 10;
            return (
              <text
                key={f.month}
                x={x}
                y={148}
                textAnchor="middle"
                fill="#6b7280"
                fontSize="9"
              >
                {f.label.split(' ')[0]}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Detailed forecast table */}
      <div className="rounded-lg border border-gray-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Expenses</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cumulative</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {forecast.map((f) => (
              <tr key={f.month} className="hover:bg-gray-900/30">
                <td className="px-4 py-2 text-gray-300">{f.label}</td>
                <td className="px-4 py-2 text-right font-mono text-emerald-400">{formatCents(f.projectedRevenue)}</td>
                <td className="px-4 py-2 text-right font-mono text-red-400">{formatCents(f.projectedExpenses)}</td>
                <td className={`px-4 py-2 text-right font-mono ${f.projectedNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCents(f.projectedNet)}
                </td>
                <td className={`px-4 py-2 text-right font-mono font-bold ${f.cumulativeNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCents(f.cumulativeNet)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
