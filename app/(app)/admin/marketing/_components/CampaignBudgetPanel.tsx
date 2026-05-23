'use client';

import { useEffect, useState } from 'react';
import { Plus, Loader2, X } from 'lucide-react';
import { formatCents } from '@/lib/marketing/pricing';

interface Budget {
  prepaidCents: number;
  refundedCents: number;
  spentRawCents: number;
  spentBundledCents: number;
  remainingCents: number;
  depleted: boolean;
  pctUsed: number;
}

interface Payment {
  id: string;
  kind: 'prepay' | 'topup' | 'refund';
  amount_cents: number;
  status: string;
  description: string | null;
  created_at: string;
}

export default function CampaignBudgetPanel({
  campaignId,
  dailyBudgetCents,
  status,
  canTopUp,
  canCancel,
  onCancelled,
}: {
  campaignId: string;
  dailyBudgetCents: number;
  status: string;
  canTopUp: boolean;
  canCancel: boolean;
  onCancelled: () => void;
}) {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(5000); // $50 default
  const [acting, setActing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}/budget`, { credentials: 'include' });
      if (cancelled) return;
      if (res.ok) {
        const d = await res.json();
        setBudget(d.budget);
        setPayments(d.payments);
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  async function handleTopup() {
    setErr(null);
    setActing(true);
    const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rawAdSpendCents: topupAmount }),
    });
    const data = await res.json();
    if (!res.ok || !data.checkoutUrl) {
      setErr(data.error || 'Failed to start top-up');
      setActing(false);
      return;
    }
    window.location.href = data.checkoutUrl;
  }

  async function handleCancel() {
    if (!confirm('Cancel this campaign and refund any unused budget? This cannot be undone.')) return;
    setErr(null);
    setActing(true);
    const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}/cancel`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || 'Failed to cancel');
      setActing(false);
      return;
    }
    onCancelled();
  }

  if (!budget) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-400">Loading budget…</div>
    );
  }

  const dailyBundled = Math.round(dailyBudgetCents * 1.05);
  const daysLeft = dailyBundled > 0 ? Math.floor(budget.remainingCents / dailyBundled) : 0;
  const pctUsed = Math.round(budget.pctUsed * 100);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Campaign budget</h2>
        <div className="flex items-center gap-2">
          {canTopUp && (
            <button
              type="button"
              onClick={() => setShowTopup(v => !v)}
              className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-md text-xs font-bold border border-emerald-200"
            >
              <Plus className="w-3.5 h-3.5" /> Add budget
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={acting}
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-red-50 text-red-700 px-3 py-1.5 rounded-md text-xs font-bold border border-red-200 disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" /> Cancel &amp; refund
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-xs text-slate-500">Prepaid</div>
          <div className="font-black text-slate-900 mt-0.5">{formatCents(budget.prepaidCents)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Spent</div>
          <div className="font-black text-slate-900 mt-0.5">{formatCents(budget.spentBundledCents)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{formatCents(budget.spentRawCents)} ad + fee</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Remaining</div>
          <div className={`font-black mt-0.5 ${budget.depleted ? 'text-red-700' : 'text-emerald-700'}`}>
            {formatCents(budget.remainingCents)}
          </div>
          {!budget.depleted && daysLeft > 0 && (
            <div className="text-[11px] text-slate-400 mt-0.5">~{daysLeft} days at {formatCents(dailyBudgetCents)}/day</div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${budget.depleted ? 'bg-red-500' : pctUsed > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${Math.max(2, pctUsed)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-500">
          <span>{pctUsed}% used</span>
          {budget.depleted && status === 'paused' && (
            <span className="text-red-700 font-bold">Paused — add budget to resume</span>
          )}
        </div>
      </div>

      {/* Top-up form */}
      {showTopup && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3">
          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Add ad spend (CAD)</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
              <input
                type="number"
                min="10"
                step="1"
                value={(topupAmount / 100).toFixed(2)}
                onChange={e => setTopupAmount(Math.round(parseFloat(e.target.value || '0') * 100))}
                className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-white"
              />
            </div>
          </label>
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>+ 5% service fee</span>
            <span>You pay <strong>{formatCents(Math.round(topupAmount * 1.05))}</strong></span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTopup}
              disabled={acting || topupAmount < 1000}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-2 rounded-md text-sm font-bold"
            >
              {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Pay & add budget
            </button>
            <button
              type="button"
              onClick={() => setShowTopup(false)}
              className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{err}</div>
      )}

      {/* Payment history */}
      {payments.length > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">History</div>
          <div className="divide-y divide-slate-100 text-sm">
            {payments.slice(0, 6).map(p => (
              <div key={p.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-slate-900 font-medium">
                    {p.kind === 'prepay' && 'Prepay'}
                    {p.kind === 'topup' && 'Top-up'}
                    {p.kind === 'refund' && 'Refund'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {new Date(p.created_at).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
                <div className={`font-bold ${p.kind === 'refund' ? 'text-violet-700' : 'text-slate-900'}`}>
                  {p.kind === 'refund' ? '−' : '+'}{formatCents(p.amount_cents)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
