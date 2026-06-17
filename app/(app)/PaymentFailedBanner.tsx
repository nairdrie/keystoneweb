'use client';

import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Persistent banner shown when the logged-in user's subscription payment has
 * failed. During the grace window (`past_due`) we keep full Pro access and nudge
 * them to update their card; once lapsed to Free we nudge them to re-subscribe.
 * Mirrors the fixed-position pattern of ImpersonationBanner.
 */
export default function PaymentFailedBanner({
  variant,
  graceEndsAt,
}: {
  variant: 'past_due' | 'lapsed';
  graceEndsAt?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isLapsed = variant === 'lapsed';

  async function handleCta() {
    if (loading) return;
    setLoading(true);
    try {
      if (isLapsed) {
        router.push('/pricing');
        return;
      }
      // Open the Stripe billing portal so they can update the card + pay the
      // open invoice.
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      if (res.ok) {
        const { url } = await res.json();
        if (url) {
          window.location.href = url;
          return;
        }
      }
      // Fallback to the settings billing section.
      router.push('/settings');
    } catch (err) {
      console.error('Failed to open billing portal:', err);
      router.push('/settings');
    } finally {
      setLoading(false);
    }
  }

  const accent = isLapsed ? 'bg-red-600' : 'bg-amber-600';
  const message = isLapsed
    ? 'Your plan moved to Free after a payment issue. Your site is still online — re-subscribe to restore Pro.'
    : `Payment failed — update your card${graceEndsAt ? ` by ${graceEndsAt}` : ''} to keep Pro. Your site is still live.`;
  const ctaLabel = isLapsed ? 'Re-subscribe' : 'Update payment method';

  return (
    <div className={`fixed top-0 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-3 ${accent} text-white px-4 py-2 rounded-b-xl shadow-lg max-w-[95vw]`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="truncate sm:whitespace-normal">{message}</span>
      </div>
      <button
        onClick={handleCta}
        disabled={loading}
        className="shrink-0 flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-xs font-bold transition-colors disabled:opacity-70"
      >
        {loading ? 'Opening…' : ctaLabel}
      </button>
    </div>
  );
}
