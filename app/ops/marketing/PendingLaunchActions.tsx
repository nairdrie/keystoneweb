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

  const googleAdsBillingUrl = googleAdsCustomerId
    ? `https://ads.google.com/aw/billing/summary?ocid=${googleAdsCustomerId.replace(/-/g, '')}`
    : null;

  async function launch() {
    if (!confirm('Launch this campaign in Google? Make sure billing is set up on the sub-account first.')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}/launch`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Launch failed');
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error');
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      {googleAdsBillingUrl && (
        <a
          href={googleAdsBillingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-sky-700 bg-sky-900/40 px-3 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-900/70 transition-colors"
        >
          Open billing →
        </a>
      )}
      <button
        type="button"
        onClick={launch}
        disabled={loading}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
        title={billingReady ? 'Billing previously confirmed — should launch immediately' : 'Make sure billing is configured on the sub-account first'}
      >
        {loading ? 'Launching…' : 'Launch in Google'}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
