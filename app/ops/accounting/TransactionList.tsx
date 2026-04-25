'use client';

import { useEffect, useState, useCallback } from 'react';
import type { AccountingEntry, AccountingCategory } from '@/lib/ops/accounting';
import { formatCents } from '@/lib/ops/accounting';

export default function TransactionList({
  categories,
  refreshKey,
  compact,
}: {
  categories: AccountingCategory[];
  refreshKey: number;
  compact?: boolean;
}) {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [search, setSearch] = useState('');
  const [invoiceUploading, setInvoiceUploading] = useState<string | null>(null);

  const limit = compact ? 10 : 25;

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('offset', String(offset));
    params.set('limit', String(limit));
    if (filterType) params.set('type', filterType);
    if (filterCategory) params.set('category', filterCategory);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);
    if (search) params.set('search', search);

    try {
      const res = await fetch(`/api/ops/accounting/entries?${params}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [offset, limit, filterType, filterCategory, filterFrom, filterTo, search]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries, refreshKey]);

  // Reset offset on filter change
  useEffect(() => {
    setOffset(0);
  }, [filterType, filterCategory, filterFrom, filterTo, search]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await fetch(`/api/ops/accounting/entries?id=${id}`, { method: 'DELETE' });
    loadEntries();
  };

  const handleInvoiceUpload = async (entryId: string, file: File) => {
    setInvoiceUploading(entryId);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('entryId', entryId);
      const res = await fetch('/api/ops/accounting/invoice', { method: 'POST', body: form });
      if (res.ok) loadEntries();
      else console.error('Upload failed');
    } finally {
      setInvoiceUploading(null);
    }
  };

  const handleDownloadInvoice = async (path: string) => {
    const res = await fetch(`/api/ops/accounting/invoice?path=${encodeURIComponent(path)}`);
    const { url } = await res.json();
    if (url) window.open(url, '_blank');
  };

  const getCategoryColor = (name: string | null) => {
    if (!name) return '#6b7280';
    return categories.find((c) => c.name === name)?.color ?? '#6b7280';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          {compact ? 'Recent Transactions' : 'All Transactions'}
        </h2>
        {!compact && (
          <span className="text-sm text-gray-500">{total} total</span>
        )}
      </div>

      {/* Filters (hidden in compact mode) */}
      {!compact && (
        <div className="flex flex-wrap gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300"
          >
            <option value="">All Types</option>
            <option value="revenue">Revenue</option>
            <option value="expense">Expense</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            placeholder="From"
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300"
          />
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            placeholder="To"
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300 w-48"
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tax</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Invoice</th>
              {!compact && (
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={compact ? 7 : 8} className="px-4 py-3">
                    <div className="h-4 bg-gray-800 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={compact ? 7 : 8} className="px-4 py-8 text-center text-gray-500">
                  No entries found. Click &quot;+ Add Entry&quot; to create one.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-900/30 transition-colors">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{entry.date}</td>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{entry.title}</div>
                    {entry.notes && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{entry.notes}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {entry.category && (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: getCategoryColor(entry.category) + '20',
                          color: getCategoryColor(entry.category),
                        }}
                      >
                        {entry.category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.type === 'revenue'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {entry.type === 'revenue' ? 'Revenue' : 'Expense'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
                    entry.type === 'revenue' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {entry.type === 'revenue' ? '+' : '-'}{formatCents(entry.amount_cents)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500 whitespace-nowrap">
                    {entry.tax_cents > 0 ? formatCents(entry.tax_cents) : '--'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {entry.invoice_storage_path ? (
                      <button
                        onClick={() => handleDownloadInvoice(entry.invoice_storage_path!)}
                        className="text-sky-400 hover:text-sky-300 text-xs underline"
                      >
                        {entry.invoice_filename ?? 'View'}
                      </button>
                    ) : (
                      <label className="cursor-pointer text-xs text-gray-500 hover:text-gray-300">
                        {invoiceUploading === entry.id ? (
                          <span className="animate-pulse">Uploading...</span>
                        ) : (
                          'Attach'
                        )}
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.png,.jpg,.jpeg,.webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleInvoiceUpload(entry.id, file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </td>
                  {!compact && (
                    <td className="px-4 py-3 text-center">
                      {!entry.is_auto && (
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!compact && total > limit && (
        <div className="flex items-center justify-between">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <button
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
            className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
