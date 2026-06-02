'use client';

import { useState } from 'react';
import type { OnboardingState } from '../page';

interface Props {
  state: OnboardingState;
  token: string;
  onRefresh: () => void;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PaymentStep({ state, token }: Props) {
  const cfg = state.launchConfig ?? {};
  const planTier = cfg.planTier ?? (cfg.domain?.mode === 'subdomain' ? 'basic' : 'pro');
  const launchServiceCents = state.launchServicePriceCents ?? cfg.launchServicePriceCents ?? 39900;
  const domainCents = cfg.billDomainCents ?? 0;

  const [submitting, setSubmitting] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dnsBlocked, setDnsBlocked] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>(
    cfg.billingInterval ?? 'yearly',
  );

  // Display-only plan pricing — Stripe is the source of truth at checkout.
  const planMonthly = planTier === 'pro' ? 5000 : 2500;
  const planYearlyAnnual = planTier === 'pro' ? 36000 : 18000;
  const planTodayCents = billingInterval === 'monthly' ? planMonthly : planYearlyAnnual;

  const totalCents = launchServiceCents + planTodayCents + domainCents;
  const planLabel =
    planTier === 'pro'
      ? billingInterval === 'monthly'
        ? 'Pro (monthly)'
        : 'Pro (yearly)'
      : billingInterval === 'monthly'
        ? 'Basic (monthly)'
        : 'Basic (yearly)';

  const renewalCents = billingInterval === 'monthly' ? planMonthly : planYearlyAnnual;
  const renewalLabel = billingInterval === 'monthly' ? '/mo' : '/yr';

  async function pay() {
    setError(null);
    setDnsBlocked(false);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/onboarding/launch/${token}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingInterval }),
      });
      const data = await res.json();
      if (res.status === 409 && data.retryable) {
        setDnsBlocked(true);
        setError(data.error);
        setSubmitting(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Could not start checkout');
      if (!data.url) throw new Error('No checkout URL returned');
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="inline-block bg-emerald-100 rounded-full px-3 py-1 text-xs font-semibold text-emerald-700 mb-2">
          Last step
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Ready to launch.</h1>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center justify-center gap-3 mb-6">
          <span
            className={`text-xs font-semibold ${
              billingInterval === 'monthly' ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            Monthly
          </span>
          <button
            type="button"
            onClick={() =>
              setBillingInterval((prev) => (prev === 'yearly' ? 'monthly' : 'yearly'))
            }
            aria-label="Toggle billing interval"
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
              billingInterval === 'yearly' ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                billingInterval === 'yearly' ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
          <span
            className={`text-xs font-semibold ${
              billingInterval === 'yearly' ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            Yearly
          </span>
          {billingInterval === 'yearly' && (
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Save 40%
            </span>
          )}
        </div>

        <div className="text-center">
          <div className="text-4xl font-bold text-slate-900">{formatCents(totalCents)}</div>
          <div className="text-sm text-slate-500 mt-1">today</div>
          <div className="text-xs text-slate-500 mt-3">
            Then {formatCents(renewalCents)}
            {renewalLabel} for {planLabel.toLowerCase().includes('pro') ? 'Pro' : 'Basic'} starting{' '}
            {new Date(
              Date.now() + (billingInterval === 'monthly' ? 30 : 365) * 86400 * 1000,
            ).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {dnsBlocked && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-900">
            <div className="font-semibold mb-1">Your domain isn&apos;t ready yet</div>
            <p className="leading-relaxed">
              {error}
            </p>
            <p className="mt-2 text-[12px] text-amber-800">
              Already added the records? They can take a few minutes to take effect — try again in 5 minutes.
            </p>
          </div>
        )}

        {error && !dnsBlocked && (
          <p className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          onClick={pay}
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-3.5 text-base font-semibold text-white transition-colors"
        >
          {submitting ? 'Opening checkout…' : `Pay & launch — ${formatCents(totalCents)}`}
        </button>

        <button
          onClick={() => setShowBreakdown((v) => !v)}
          className="mt-3 w-full text-center text-xs text-slate-500 hover:text-slate-700"
        >
          {showBreakdown ? 'Hide details' : 'See what’s included'}
        </button>

        {showBreakdown && (
          <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm space-y-2">
            <Row label="Launch service (one-time)" value={formatCents(launchServiceCents)} />
            <Row label={planLabel} value={formatCents(planTodayCents)} />
            {domainCents > 0 && cfg.domain?.domainName && (
              <Row
                label={`Custom domain: ${cfg.domain.domainName} (one-time)`}
                value={formatCents(domainCents)}
              />
            )}
            <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold">
              <span>Today’s total</span>
              <span>{formatCents(totalCents)}</span>
            </div>
          </div>
        )}
      </div>

      <p className="text-center mt-6 text-[11px] text-slate-500">
        Powered by Stripe. Have a promo code? You can add it at checkout. Cancel anytime from your Keystone account.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-900 font-medium">{value}</span>
    </div>
  );
}
