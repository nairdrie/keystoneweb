'use client';

import { useState } from 'react';
import type { AccountingCategory, TaxType } from '@/lib/ops/accounting';
import { TAX_RATES, FREQUENCIES } from '@/lib/ops/accounting';

export default function EntryForm({
  categories,
  onClose,
  onSaved,
}: {
  categories: AccountingCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<'revenue' | 'expense'>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [taxType, setTaxType] = useState<TaxType | ''>('');
  const [customTax, setCustomTax] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Also create as recurring?
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [endDate, setEndDate] = useState('');
  const [requiresInvoice, setRequiresInvoice] = useState(true);

  const computeTaxCents = () => {
    const amountCents = Math.round(parseFloat(amount || '0') * 100);
    if (taxType && taxType !== 'none' && !customTax) {
      const rate = TAX_RATES[taxType]?.rate ?? 0;
      return Math.round(amountCents * rate);
    }
    if (customTax) {
      return Math.round(parseFloat(customTax) * 100);
    }
    return 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    const amountCents = Math.round(parseFloat(amount || '0') * 100);
    if (amountCents <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    setSaving(true);
    try {
      const taxCents = computeTaxCents();

      // Create the entry
      const res = await fetch('/api/ops/accounting/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim() || null,
          amount_cents: amountCents,
          tax_cents: taxCents,
          tax_type: taxType || null,
          category: category || null,
          date,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create entry');
      }

      // Also create recurring entry if requested
      if (makeRecurring) {
        await fetch('/api/ops/accounting/recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            title: title.trim(),
            description: description.trim() || null,
            amount_cents: amountCents,
            tax_cents: taxCents,
            tax_type: taxType || null,
            category: category || null,
            frequency,
            start_date: date,
            end_date: endDate || null,
            requires_invoice: requiresInvoice,
            notes: notes.trim() || null,
          }),
        });
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Add Entry</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                type === 'expense' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType('revenue')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                type === 'revenue' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              Revenue
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Google Workspace monthly"
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Amount + Tax type row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Amount (CAD) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tax Type</label>
              <select
                value={taxType}
                onChange={(e) => setTaxType(e.target.value as TaxType | '')}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Select...</option>
                {Object.entries(TAX_RATES).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom tax override */}
          {taxType && taxType !== 'none' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Tax Amount Override (CAD) — auto-calculated: {formatCalcTax(amount, taxType)}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={customTax}
                onChange={(e) => setCustomTax(e.target.value)}
                placeholder="Leave blank to auto-calculate"
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          )}

          {/* Category + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none"
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details"
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes..."
              rows={2}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>

          {/* Make recurring toggle */}
          <div className="border-t border-gray-800 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={makeRecurring}
                onChange={(e) => setMakeRecurring(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-300">Make this recurring</span>
            </label>
          </div>

          {makeRecurring && (
            <div className="grid grid-cols-2 gap-3 pl-6">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">End Date (optional)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300"
                />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresInvoice}
                    onChange={(e) => setRequiresInvoice(e.target.checked)}
                    className="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-300">Require invoice each period (for GST refund)</span>
                </label>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatCalcTax(amount: string, taxType: TaxType | '') {
  if (!taxType || taxType === 'none') return '$0.00';
  const amountVal = parseFloat(amount || '0');
  const rate = TAX_RATES[taxType]?.rate ?? 0;
  return `$${(amountVal * rate).toFixed(2)}`;
}
