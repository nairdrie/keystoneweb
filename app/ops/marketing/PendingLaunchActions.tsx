'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PendingLaunchActions({
  campaignId,
  googleAdsCustomerId,
  billingReady,
}: {
  campaignId: string;
  googleAdsCustomerId: string | null;
  billingReady: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [customerId, setCustomerId] = useState(googleAdsCustomerId || '');

  const cleaned = customerId.replace(/[^0-9]/g, '');
  const billingUrl = cleaned
    ? `https://ads.google.com/aw/billing/summary?ocid=${cleaned}`
    : null;

  async function launch() {
    if (!cleaned) {
      setError('Enter the linked + funded Google Ads account ID first.');
      return;
    }
    if (!confirm('Launch this campaign in Google? Make sure the account is linked to the MCC and funded.')) return;
    setLoading(true);
    setError(null);
    setWarnings([]);
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ customerId: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Launch failed');
        setLoading(false);
        return;
      }
      // Non-blocking calibration notes (bid ceiling applied, thin-budget flags).
      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        setWarnings(data.warnings);
        setLoading(false);
        return; // keep the notes visible; ops can refresh manually
      }
      router.refresh();
    } catch {
      setError('Network error');
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 items-end">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customerId}
          onChange={e => setCustomerId(e.target.value)}
          placeholder="Account ID (123-456-7890)"
          className="w-40 rounded-md border border-gray-700 bg-gray-950 px-2 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-emerald-500 focus:outline-none"
        />
        {billingUrl && (
          <a
            href={billingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-sky-700 bg-sky-900/40 px-3 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-900/70 transition-colors whitespace-nowrap"
          >
            Billing →
          </a>
        )}
        <button
          type="button"
          onClick={launch}
          disabled={loading}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {loading ? 'Launching…' : 'Launch'}
        </button>
      </div>
      {billingReady && <span className="text-[10px] text-emerald-400">Billing previously confirmed for this site</span>}
      {error && <span className="text-xs text-red-400 max-w-xs text-right">{error}</span>}
      {warnings.length > 0 && (
        <div className="mt-1 max-w-sm rounded-md border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-left">
          <p className="text-[11px] font-bold text-amber-300">Launched — deployment notes</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-amber-200/90">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-2 rounded-md border border-amber-700 bg-amber-900/40 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-900/70 transition-colors"
          >
            Dismiss &amp; refresh
          </button>
        </div>
      )}
    </div>
  );
}
