'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';

/**
 * Lets a customer move their plan between monthly and yearly billing without
 * leaving the app.
 *
 * The Stripe Customer Portal we link to from Settings only exposes invoices and
 * cancellation, so this is the only place the switch can be made. All the money
 * shown here comes from a live Stripe invoice preview — see
 * app/api/stripe/billing-interval/route.ts.
 */

type BillingInterval = 'month' | 'year';

interface IntervalPricing {
  interval: BillingInterval;
  perMonth: number;
  perTerm: number;
  termLabel: BillingInterval;
}

interface SwitchPreview {
  estimated: boolean;
  currency: string;
  amountDueCents: number;
  newTermCents: number;
  creditCents: number;
  nextRenewalAt: string | null;
}

interface BillingCycleInfo {
  available: true;
  planName: string;
  status: string;
  isLate: boolean;
  cancelAtPeriodEnd: boolean;
  currentInterval: BillingInterval;
  targetInterval: BillingInterval;
  currentPeriodEnd: string | null;
  pricing: { month: IntervalPricing; year: IntervalPricing };
  savingsPerYear: number;
  addonCount: number;
  strategy: { reason: 'prorated' | 'late_full_term'; chargesFullTerm: boolean };
  preview: SwitchPreview;
}

interface SwitchResult {
  interval: BillingInterval;
  chargedFullTerm: boolean;
  nextRenewalAt: string | null;
  invoice: {
    status: string;
    paid: boolean;
    amountDueCents: number;
    amountPaidCents: number;
    currency: string;
    hostedInvoiceUrl: string | null;
  } | null;
}

const INTERVAL_NOUN: Record<BillingInterval, string> = { month: 'Monthly', year: 'Yearly' };
const INTERVAL_ADVERB: Record<BillingInterval, string> = { month: 'monthly', year: 'yearly' };

function money(cents: number, currency: string): string {
  return `$${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function dollars(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

function ConfirmSwitchModal({
  info,
  onConfirm,
  onCancel,
  submitting,
  error,
}: {
  info: BillingCycleInfo;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const target = info.targetInterval;
  const targetPricing = info.pricing[target];
  const { preview } = info;
  const goingYearly = target === 'year';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-black text-slate-900 mb-2">
          Switch to {INTERVAL_ADVERB[target]} billing
        </h2>
        <p className="text-sm text-slate-600 mb-5 leading-relaxed">
          Your {info.planName} plan will be billed {dollars(targetPricing.perTerm)} every{' '}
          {targetPricing.termLabel}
          {goingYearly ? ` (${dollars(targetPricing.perMonth)}/mo)` : ''}. The change takes effect
          immediately and your billing date restarts today.
        </p>

        {info.strategy.chargesFullTerm ? (
          <div className="flex gap-3 p-3 mb-5 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-relaxed">
              Your account has an unpaid balance, so there is nothing to prorate. You&apos;ll be
              charged the <strong>full {targetPricing.termLabel}</strong> today, and that payment
              settles your outstanding invoice and starts a fresh term.
            </p>
          </div>
        ) : (
          <div className="flex gap-3 p-3 mb-5 bg-slate-50 border border-slate-200 rounded-xl">
            <Sparkles className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-600 leading-relaxed">
              You&apos;re credited for the unused part of the {INTERVAL_NOUN[info.currentInterval].toLowerCase()}{' '}
              period you already paid for. Only the difference is charged today.
            </p>
          </div>
        )}

        <dl className="space-y-2.5 mb-5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">New {targetPricing.termLabel}ly charge</dt>
            <dd className="font-semibold text-slate-900 tabular-nums">
              {money(preview.newTermCents, preview.currency)}
            </dd>
          </div>
          {preview.creditCents > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Credit for unused time</dt>
              <dd className="font-semibold text-green-700 tabular-nums">
                −{money(preview.creditCents, preview.currency)}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4 pt-2.5 border-t border-slate-100">
            <dt className="font-bold text-slate-900">Due today</dt>
            <dd className="font-bold text-slate-900 tabular-nums">
              {money(preview.amountDueCents, preview.currency)}
            </dd>
          </div>
          {preview.nextRenewalAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Next renewal</dt>
              <dd className="text-slate-700">{formatDate(preview.nextRenewalAt)}</dd>
            </div>
          )}
        </dl>

        {preview.estimated && (
          <p className="text-[11px] text-slate-500 mb-4">
            This is list pricing — we couldn&apos;t reach Stripe for an exact preview, so tax and
            any discounts will be applied on the real invoice.
          </p>
        )}

        {info.addonCount > 0 && (
          <p className="text-[11px] text-slate-500 mb-4">
            Your {info.addonCount} active add-on{info.addonCount === 1 ? '' : 's'} will move to{' '}
            {INTERVAL_ADVERB[target]} pricing too.
          </p>
        )}

        {!info.strategy.chargesFullTerm && target === 'month' && (
          <p className="text-[11px] text-slate-500 mb-4">
            If the credit for your unused time is larger than the first monthly charge, the
            remainder stays on your account as billing credit and is applied to future invoices.
          </p>
        )}

        {error && (
          <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 disabled:opacity-60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-70 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting
              ? 'Switching...'
              : preview.amountDueCents > 0
                ? `Confirm — pay ${money(preview.amountDueCents, preview.currency)}`
                : 'Confirm switch'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BillingCycleCard({ onChanged }: { onChanged?: () => void }) {
  const [info, setInfo] = useState<BillingCycleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SwitchResult | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/stripe/billing-interval', { credentials: 'include' });
      const data = await res.json();
      setInfo(res.ok && data?.available ? (data as BillingCycleInfo) : null);
    } catch (err) {
      console.error('Failed to load billing cycle options:', err);
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirm = async () => {
    if (!info) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/billing-interval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ interval: info.targetInterval }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to change billing cycle');

      setResult(data as SwitchResult);
      setConfirming(false);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="border border-slate-200 bg-white rounded-2xl shadow-sm p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!info) return null;

  const current = info.pricing[info.currentInterval];
  const target = info.pricing[info.targetInterval];
  const goingYearly = info.targetInterval === 'year';

  return (
    <div className="border border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden">
      {confirming && (
        <ConfirmSwitchModal
          info={info}
          submitting={submitting}
          error={error}
          onCancel={() => { setConfirming(false); setError(null); }}
          onConfirm={handleConfirm}
        />
      )}

      <div className="p-6 border-b border-slate-100">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
          <RefreshCw className="w-5 h-5 text-red-500" />
          Billing Cycle
        </h2>
        <p className="text-sm text-slate-500">
          Choose how often you&apos;re billed for {info.planName}. Changes apply immediately.
        </p>
      </div>

      <div className="p-6 bg-slate-50/50 space-y-4">
        {result && (
          <div className="flex gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-900">
              <p className="font-semibold">
                You&apos;re now billed {INTERVAL_ADVERB[result.interval]}.
              </p>
              {result.invoice && (
                <p className="mt-1 text-green-800">
                  {result.invoice.paid
                    ? result.invoice.amountPaidCents > 0
                      ? `Charged ${money(result.invoice.amountPaidCents, result.invoice.currency)} today.`
                      : 'Nothing to pay today — your credit covered it.'
                    : `An invoice for ${money(result.invoice.amountDueCents, result.invoice.currency)} is awaiting payment.`}
                  {result.nextRenewalAt ? ` Next renewal ${formatDate(result.nextRenewalAt)}.` : ''}
                </p>
              )}
              {result.invoice && !result.invoice.paid && result.invoice.hostedInvoiceUrl && (
                <a
                  href={result.invoice.hostedInvoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex mt-2 px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Complete payment
                </a>
              )}
            </div>
          </div>
        )}

        {info.isLate && !result && (
          <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Your last payment didn&apos;t go through. Switching cycle now charges the full{' '}
              {target.termLabel} up front and starts a fresh term — it won&apos;t be prorated.
            </p>
          </div>
        )}

        {error && !confirming && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
            {error}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          {/* Current cycle */}
          <div className="p-4 bg-white border-2 border-slate-900 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-900">{INTERVAL_NOUN[info.currentInterval]}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-900 text-white">
                Current
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900">
              {dollars(current.perMonth)}
              <span className="text-sm font-medium text-slate-500">/mo</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Billed {dollars(current.perTerm)} every {current.termLabel}
            </p>
            {info.currentPeriodEnd && (
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <CalendarClock className="w-3 h-3" />
                Renews {formatDate(info.currentPeriodEnd)}
              </p>
            )}
          </div>

          {/* Target cycle */}
          <div
            className={`p-4 bg-white border rounded-xl ${goingYearly ? 'border-red-300' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-900">{INTERVAL_NOUN[info.targetInterval]}</span>
              {goingYearly && info.savingsPerYear > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-800 border border-green-200">
                  Save {dollars(info.savingsPerYear)}/yr
                </span>
              )}
            </div>
            <p className="text-2xl font-black text-slate-900">
              {dollars(target.perMonth)}
              <span className="text-sm font-medium text-slate-500">/mo</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Billed {dollars(target.perTerm)} every {target.termLabel}
            </p>
            <button
              onClick={() => { setResult(null); setError(null); setConfirming(true); }}
              className="w-full mt-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors"
            >
              Switch to {INTERVAL_ADVERB[info.targetInterval]}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          {info.strategy.chargesFullTerm
            ? 'Because your account has an unpaid balance, the switch bills the whole new term today instead of prorating.'
            : "You'll see exactly what's owed today — including credit for time you've already paid for — before anything is charged."}
        </p>
      </div>
    </div>
  );
}
