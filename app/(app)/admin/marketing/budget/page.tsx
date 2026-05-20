'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Plus, History, CheckCircle2, XCircle } from 'lucide-react';
import { useAdminContext } from '../../admin-context';
import { formatCents } from '@/lib/marketing/pricing';

interface WalletRow {
  balance_cents: number;
  lifetime_credited_cents: number;
  lifetime_debited_cents: number;
}
interface Tx {
  id: string;
  kind: 'credit' | 'debit' | 'refund';
  amount_cents: number;
  balance_after_cents: number;
  description: string | null;
  spend_date: string | null;
  raw_ad_spend_cents: number | null;
  markup_cents: number | null;
  created_at: string;
}

const PRESETS = [2500, 5000, 10000, 25000]; // $25, $50, $100, $250

export default function MarketingBudgetPage() {
  const { siteId } = useAdminContext();
  const searchParams = useSearchParams();
  const topupStatus = searchParams.get('topup');

  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [txns, setTxns] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(5000); // $50 default
  const [customAmount, setCustomAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    fetch(`/api/admin/marketing/wallet?siteId=${siteId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) { setWallet(d.wallet); setTxns(d.transactions || []); }
      })
      .finally(() => setLoading(false));
  }, [siteId, topupStatus]);

  async function startTopup() {
    setErr(null);
    setSubmitting(true);
    const amountCents = customAmount ? Math.round(parseFloat(customAmount) * 100) : amount;
    try {
      const res = await fetch('/api/admin/marketing/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId, amountCents }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setErr(data.error || 'Failed to start top-up');
        setSubmitting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setErr('Network error');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link
          href={`/admin/marketing?siteId=${siteId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Marketing
        </Link>
        <h1 className="text-2xl font-black text-slate-900 mt-2">Marketing budget</h1>
        <p className="text-sm text-slate-500 mt-1">Prepaid wallet. We pay Google directly and bill you at cost plus a small management fee.</p>
      </div>

      {topupStatus === 'success' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-bold text-emerald-900">Top-up successful</p>
            <p className="text-emerald-800">Your balance has been updated.</p>
          </div>
        </div>
      )}
      {topupStatus === 'cancel' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-slate-500 flex-shrink-0" />
          <p className="text-sm text-slate-700">Top-up cancelled.</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <p className="text-[11px] font-bold uppercase text-slate-500 tracking-wide">Current balance</p>
        <p className="text-4xl font-black text-slate-900 mt-1">
          {loading ? '—' : formatCents(wallet?.balance_cents ?? 0)}
        </p>
        {wallet && (
          <p className="text-xs text-slate-500 mt-2">
            Lifetime credited {formatCents(wallet.lifetime_credited_cents)} · Spent {formatCents(wallet.lifetime_debited_cents)}
          </p>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-600" /> Top up balance
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRESETS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => { setAmount(p); setCustomAmount(''); }}
              className={`px-3 py-3 rounded-lg border text-sm font-bold transition-colors ${
                !customAmount && amount === p
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              {formatCents(p)}
            </button>
          ))}
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-slate-500 tracking-wide">Or custom amount</label>
          <div className="mt-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
            <input
              type="number"
              min="10"
              max="10000"
              step="1"
              placeholder="100"
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">Minimum $10, maximum $10,000.</p>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          onClick={startTopup}
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-3 rounded-lg text-sm font-bold transition-colors"
        >
          <CreditCard className="w-4 h-4" />
          {submitting ? 'Redirecting…' : `Pay ${formatCents(customAmount ? Math.round(parseFloat(customAmount) * 100) || 0 : amount)} with card`}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <h2 className="text-base font-bold text-slate-900">Transaction history</h2>
        </div>
        {txns.length === 0 ? (
          <p className="text-sm text-slate-400 px-6 py-8 text-center">No transactions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500 bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Description</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txns.map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">
                    {new Date(t.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{t.description || (t.kind === 'debit' ? `Ad spend ${t.spend_date}` : 'Top-up')}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${t.kind === 'credit' ? 'text-emerald-700' : t.kind === 'debit' ? 'text-slate-700' : 'text-violet-700'}`}>
                    {t.kind === 'credit' ? '+' : '−'}{formatCents(t.amount_cents)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500 font-mono text-xs">
                    {formatCents(t.balance_after_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
