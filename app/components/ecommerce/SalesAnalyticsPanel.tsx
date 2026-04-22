'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, DollarSign, Loader2, Package, ShoppingBag, TrendingUp } from 'lucide-react';

interface AnalyticsData {
    window: { days: number };
    revenue: { currentCents: number; previousCents: number; changePct: number | null };
    orders: { current: number; previous: number; changePct: number | null };
    aovCents: number;
    daily: { date: string; revenueCents: number; orders: number }[];
    topProducts: { productId: string; name: string; revenueCents: number; qty: number }[];
    statusCounts: Record<string, number>;
}

function formatMoney(cents: number): string {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Trend({ pct }: { pct: number | null }) {
    if (pct === null) return <span className="text-xs text-slate-400">— no prior data</span>;
    const up = pct >= 0;
    return (
        <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-green-600' : 'text-red-600'}`}>
            {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(pct)}% vs prior 30d
        </span>
    );
}

function Sparkline({ series }: { series: number[] }) {
    const max = Math.max(1, ...series);
    const width = 100;
    const height = 30;
    const step = series.length > 1 ? width / (series.length - 1) : width;
    const points = series.map((v, i) => `${(i * step).toFixed(2)},${(height - (v / max) * height).toFixed(2)}`).join(' ');
    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8" preserveAspectRatio="none">
            <polyline
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}

export default function SalesAnalyticsPanel({ siteId }: { siteId: string }) {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch(`/api/products/analytics?siteId=${siteId}`);
                if (!res.ok) throw new Error('Failed to load');
                const json = await res.json();
                if (mounted) setData(json);
            } catch (e: any) {
                if (mounted) setError(e.message || 'Failed to load analytics');
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [siteId]);

    if (loading) {
        return (
            <div className="py-16 text-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="py-16 text-center text-slate-500 text-sm">{error || 'No data'}</div>
        );
    }

    const revenueSeries = data.daily.map(d => d.revenueCents);
    const ordersSeries = data.daily.map(d => d.orders);

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <DollarSign className="w-3.5 h-3.5" />
                        Revenue (30d)
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(data.revenue.currentCents)}</div>
                    <div className="mt-1"><Trend pct={data.revenue.changePct} /></div>
                    <div className="text-blue-600 mt-2"><Sparkline series={revenueSeries} /></div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        Orders (30d)
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{data.orders.current}</div>
                    <div className="mt-1"><Trend pct={data.orders.changePct} /></div>
                    <div className="text-emerald-600 mt-2"><Sparkline series={ordersSeries} /></div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Avg. order value
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(data.aovCents)}</div>
                    <div className="text-xs text-slate-500 mt-1">based on {data.orders.current} orders</div>
                </div>
            </div>

            {/* Top products */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-500" />
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Top products (revenue, 30d)</h3>
                </div>
                {data.topProducts.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">No sales in the last 30 days yet.</p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {data.topProducts.map((p, i) => (
                            <li key={p.productId} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="text-xs font-bold text-slate-400 w-5 text-right">{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                                    <p className="text-xs text-slate-500">{p.qty} sold</p>
                                </div>
                                <span className="text-sm font-semibold text-slate-900">{formatMoney(p.revenueCents)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Status breakdown */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Order pipeline</h3>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                    {['pending', 'confirmed', 'shipped', 'completed', 'cancelled'].map(s => (
                        <div key={s} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="text-xs text-slate-500 capitalize">{s}</span>
                            <span className="text-sm font-bold text-slate-900">{data.statusCounts[s] || 0}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
