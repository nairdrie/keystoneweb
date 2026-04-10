'use client';

import { useEffect, useState, useCallback } from 'react';
import type { RecurringEntry, AccountingCategory } from '@/lib/ops/accounting';
import { formatCents, FREQUENCIES, getMonthlyEquivalent, type Frequency } from '@/lib/ops/accounting';

export default function RecurringManager({
  categories,
  refreshKey,
  onRefresh,
}: {
  categories: AccountingCategory[];
  refreshKey: number;
  onRefresh: () => void;
}) {
  const [recurring, setRecurring] = useState<RecurringEntry[]>([]);
  const [invoiceAlerts, setInvoiceAlerts] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formType, setFormType] = useState<'revenue' | 'expense'>('expense');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formFrequency, setFormFrequency] = useState('monthly');
  const [formCategory, setFormCategory] = useState('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [formEndDate, setFormEndDate] = useState('');
  const [formRequiresInvoice, setFormRequiresInvoice] = useState(true);
  const [formNotes, setFormNotes] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const loadRecurring = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ops/accounting/recurring');
      const data = await res.json();
      setRecurring(data.recurring ?? []);
      setInvoiceAlerts(data.invoiceAlerts ?? {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecurring();
  }, [loadRecurring, refreshKey]);

  const handleToggleActive = async (id: string, currentlyActive: boolean) => {
    await fetch('/api/ops/accounting/recurring', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !currentlyActive }),
    });
    loadRecurring();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recurring entry? Existing entries will remain.')) return;
    await fetch(`/api/ops/accounting/recurring?id=${id}`, { method: 'DELETE' });
    loadRecurring();
    onRefresh();
  };

  const handleCreateRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(formAmount || '0') * 100);
    if (!formTitle.trim() || amountCents <= 0) return;

    setFormSaving(true);
    try {
      await fetch('/api/ops/accounting/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formType,
          title: formTitle.trim(),
          amount_cents: amountCents,
          frequency: formFrequency,
          category: formCategory || null,
          start_date: formStartDate,
          end_date: formEndDate || null,
          requires_invoice: formRequiresInvoice,
          notes: formNotes.trim() || null,
        }),
      });
      setShowForm(false);
      setFormTitle('');
      setFormAmount('');
      loadRecurring();
      onRefresh();
    } finally {
      setFormSaving(false);
    }
  };

  const getCategoryColor = (name: string | null) => {
    if (!name) return '#6b7280';
    return categories.find((c) => c.name === name)?.color ?? '#6b7280';
  };

  const activeRecurring = recurring.filter((r) => r.is_active);
  const inactiveRecurring = recurring.filter((r) => !r.is_active);

  // Calculate total monthly impact
  const totalRecurringRevenue = activeRecurring
    .filter((r) => r.type === 'revenue')
    .reduce((sum, r) => sum + getMonthlyEquivalent(r.amount_cents, r.frequency as Frequency), 0);
  const totalRecurringExpenses = activeRecurring
    .filter((r) => r.type === 'expense')
    .reduce((sum, r) => sum + getMonthlyEquivalent(r.amount_cents, r.frequency as Frequency), 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 uppercase">Recurring Revenue /mo</p>
          <p className="mt-1 text-xl font-bold text-emerald-400">{formatCents(totalRecurringRevenue)}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 uppercase">Recurring Expenses /mo</p>
          <p className="mt-1 text-xl font-bold text-red-400">{formatCents(totalRecurringExpenses)}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500 uppercase">Net Recurring /mo</p>
          <p className={`mt-1 text-xl font-bold ${totalRecurringRevenue - totalRecurringExpenses >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCents(totalRecurringRevenue - totalRecurringExpenses)}
          </p>
        </div>
      </div>

      {/* Invoice alerts */}
      {Object.keys(invoiceAlerts).length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-amber-400">Missing Invoices</h3>
          {Object.entries(invoiceAlerts).map(([recurringId, months]) => {
            const entry = recurring.find((r) => r.id === recurringId);
            if (!entry) return null;
            return (
              <div key={recurringId} className="text-sm text-amber-300/80">
                <span className="font-medium text-white">{entry.title}</span>
                <span className="text-amber-400"> — missing invoices for: </span>
                {months.slice(0, 6).map((m) => (
                  <span key={m} className="inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-mono mr-1 mb-1">
                    {m}
                  </span>
                ))}
                {months.length > 6 && (
                  <span className="text-xs text-amber-500">+{months.length - 6} more</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add new button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Recurring Entries</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Recurring'}
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <form onSubmit={handleCreateRecurring} className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormType('expense')}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium ${
                formType === 'expense' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setFormType('revenue')}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium ${
                formType === 'revenue' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              Revenue
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Title *"
              required
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="Amount *"
              required
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none"
            />
            <select
              value={formFrequency}
              onChange={(e) => setFormFrequency(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300"
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300"
            >
              <option value="">Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <input
              type="date"
              value={formStartDate}
              onChange={(e) => setFormStartDate(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300"
            />
            <input
              type="date"
              value={formEndDate}
              onChange={(e) => setFormEndDate(e.target.value)}
              placeholder="End date"
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300"
            />
            <label className="flex items-center gap-2 text-sm text-gray-300 col-span-2">
              <input
                type="checkbox"
                checked={formRequiresInvoice}
                onChange={(e) => setFormRequiresInvoice(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-emerald-500"
              />
              Require invoice (GST refund)
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={formSaving}
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {formSaving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {/* Active entries list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-800 bg-gray-900 p-4 animate-pulse">
              <div className="h-4 w-48 bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {activeRecurring.length === 0 && (
            <p className="text-sm text-gray-500 py-4 text-center">No active recurring entries.</p>
          )}
          {activeRecurring.map((r) => {
            const freq = FREQUENCIES.find((f) => f.value === r.frequency);
            const monthlyEq = getMonthlyEquivalent(r.amount_cents, r.frequency as Frequency);
            const hasMissingInvoice = !!invoiceAlerts[r.id];

            return (
              <div
                key={r.id}
                className={`rounded-lg border bg-gray-900 p-4 flex items-center justify-between gap-4 ${
                  hasMissingInvoice ? 'border-amber-500/40' : 'border-gray-800'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${r.type === 'revenue' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {r.type === 'revenue' ? '+' : '-'}{formatCents(r.amount_cents)}
                    </span>
                    <span className="text-sm text-white font-medium">{r.title}</span>
                    {r.category && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: getCategoryColor(r.category) + '20',
                          color: getCategoryColor(r.category),
                        }}
                      >
                        {r.category}
                      </span>
                    )}
                    {hasMissingInvoice && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                        Invoice missing
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {freq?.label} &middot; ~{formatCents(monthlyEq)}/mo &middot; Since {r.start_date}
                    {r.end_date && ` until ${r.end_date}`}
                    {r.requires_invoice && ' &middot; Invoice required'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleActive(r.id, r.is_active)}
                    className="text-xs text-gray-400 hover:text-amber-400 transition-colors"
                  >
                    Pause
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}

          {/* Inactive entries */}
          {inactiveRecurring.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-gray-500 pt-4">Paused</h3>
              {inactiveRecurring.map((r) => (
                <div key={r.id} className="rounded-lg border border-gray-800/50 bg-gray-900/50 p-4 flex items-center justify-between gap-4 opacity-60">
                  <div>
                    <span className="text-sm text-gray-400">{r.title}</span>
                    <span className="text-xs text-gray-600 ml-2">{formatCents(r.amount_cents)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(r.id, r.is_active)}
                      className="text-xs text-gray-400 hover:text-emerald-400 transition-colors"
                    >
                      Resume
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
