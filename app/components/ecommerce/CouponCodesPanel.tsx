'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';

interface CouponCode {
  id: string;
  code: string;
  active: boolean;
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  expiresAt: string | null;
}

interface CouponCodesPanelProps {
  siteId: string;
}

export default function CouponCodesPanel({ siteId }: CouponCodesPanelProps) {
  const [codes, setCodes] = useState<CouponCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    discountType: 'percent' as 'percent' | 'amount',
    percentOff: '',
    amountOff: '',
    maxRedemptions: '',
    expiresAt: '',
  });

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/membership/promo-codes?siteId=${siteId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load coupon codes');
        setCodes([]);
        return;
      }
      setCodes(data.promoCodes || []);
    } catch {
      setError('Failed to load coupon codes');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const resetForm = () => setForm({
    code: '', discountType: 'percent', percentOff: '', amountOff: '', maxRedemptions: '', expiresAt: '',
  });

  const handleCreate = async () => {
    if (!form.code.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { siteId, code: form.code.trim() };
      if (form.discountType === 'percent') {
        payload.percentOff = parseFloat(form.percentOff);
      } else {
        payload.amountOff = Math.round(parseFloat(form.amountOff) * 100);
        payload.currency = 'CAD';
      }
      if (form.maxRedemptions) payload.maxRedemptions = parseInt(form.maxRedemptions, 10);
      if (form.expiresAt) payload.expiresAt = form.expiresAt;

      const res = await fetch('/api/membership/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create coupon code');
        return;
      }
      setShowForm(false);
      resetForm();
      fetchCodes();
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (promoCodeId: string) => {
    if (!confirm('Deactivate this coupon code?')) return;
    await fetch('/api/membership/promo-codes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, promoCodeId }),
    });
    fetchCodes();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Coupon codes are applied at checkout. Customers enter the code on the Stripe payment page.
        </p>
        <button
          onClick={() => setShowForm(f => !f)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-700 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          New Code
        </button>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {showForm && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Code</label>
              <input
                type="text"
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm uppercase"
                placeholder="WELCOME20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Discount Type</label>
              <select
                value={form.discountType}
                onChange={e => setForm(f => ({ ...f, discountType: e.target.value as 'percent' | 'amount' }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="percent">Percentage</option>
                <option value="amount">Fixed Amount (CAD)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {form.discountType === 'percent' ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Percent Off</label>
                <input
                  type="number"
                  value={form.percentOff}
                  onChange={e => setForm(f => ({ ...f, percentOff: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="20"
                  min="1"
                  max="100"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount Off ($)</label>
                <input
                  type="number"
                  value={form.amountOff}
                  onChange={e => setForm(f => ({ ...f, amountOff: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="10.00"
                  min="0.01"
                  step="0.01"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max Uses</label>
              <input
                type="number"
                value={form.maxRedemptions}
                onChange={e => setForm(f => ({ ...f, maxRedemptions: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="Unlimited"
                min="1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Expires</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !form.code.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create
            </button>
            <button
              onClick={() => { setShowForm(false); resetForm(); setError(null); }}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {codes.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400">No coupon codes yet</div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Discount</th>
                <th className="px-4 py-2.5">Used</th>
                <th className="px-4 py-2.5">Expires</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {codes.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{c.code}</td>
                  <td className="px-4 py-2.5">
                    {c.percentOff ? `${c.percentOff}% off` : c.amountOff ? `$${(c.amountOff / 100).toFixed(2)} off` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {c.timesRedeemed}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {c.active && (
                      <button
                        onClick={() => handleDeactivate(c.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
