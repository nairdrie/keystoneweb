'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAdminContext } from '../../admin-context';

function defaultStartTime(): string {
  // Default to tomorrow at 7pm local, formatted for <input type="datetime-local">
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewAuctionPage() {
  const { siteId } = useAdminContext();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledStart, setScheduledStart] = useState(defaultStartTime());
  const [softCloseSeconds, setSoftCloseSeconds] = useState(20);
  const [initialLotSeconds, setInitialLotSeconds] = useState(60);
  const [autoApprove, setAutoApprove] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!siteId || saving) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/auctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteId,
          title,
          description: description || null,
          scheduledStart: new Date(scheduledStart).toISOString(),
          softCloseSeconds,
          initialLotSeconds,
          autoApproveRegistrations: autoApprove,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to create auction');
      router.push(`/admin/auctions/${j.auction.id}?siteId=${siteId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create auction');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={`/admin/auctions?siteId=${siteId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> All auctions
      </Link>

      <h1 className="text-2xl font-black text-slate-900 mb-1">New auction</h1>
      <p className="text-sm text-slate-500 mb-6">You can add lots after creating the auction.</p>

      <form onSubmit={submit} className="space-y-5">
        <Field label="Title" required>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            placeholder="Spring 2026 Charity Auction"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Shown to bidders on the registration and lobby pages."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </Field>

        <Field label="Scheduled start" required hint="The lobby opens immediately; bidding begins at this time.">
          <input
            type="datetime-local"
            value={scheduledStart}
            onChange={e => setScheduledStart(e.target.value)}
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Soft-close (seconds)" hint="Timer resets to this on every bid.">
            <input
              type="number"
              min={5}
              max={120}
              value={softCloseSeconds}
              onChange={e => setSoftCloseSeconds(parseInt(e.target.value || '20', 10))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </Field>
          <Field label="Initial lot timer (seconds)" hint="Time the first lot opens with.">
            <input
              type="number"
              min={15}
              max={600}
              value={initialLotSeconds}
              onChange={e => setInitialLotSeconds(parseInt(e.target.value || '60', 10))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </Field>
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={e => setAutoApprove(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <div className="text-sm font-medium text-slate-900">Auto-approve registrations</div>
            <div className="text-xs text-slate-500">
              When off, you&apos;ll manually approve each bidder before they can join.
            </div>
          </div>
        </label>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Link
            href={`/admin/auctions?siteId=${siteId}`}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create auction
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
