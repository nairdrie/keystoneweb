'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

/**
 * Confirmation step for changing plan on an existing subscription (Basic ↔ Pro).
 *
 * Upgrades show a live Stripe proration preview — credit for unused time, the
 * new charges, tax and the total due today — and nothing is charged until the
 * customer confirms. Downgrades show the date they take effect (end of the
 * current period) and what changes on Basic.
 *
 * Backed by app/api/stripe/plan-change/route.ts.
 */

type BillingInterval = 'month' | 'year';

interface UpgradePreview {
  currency: string;
  amountDueCents: number;
  chargesCents: number;
  creditCents: number;
  taxCents: number;
  nextRenewalAt: string | null;
}

interface PlanChangeInfo {
  direction: 'upgrade' | 'downgrade';
  currentPlan: string;
  currentInterval: BillingInterval;
  targetPlan: string;
  targetInterval: BillingInterval;
  targetPricing: { perMonth: number; perTerm: number; termLabel: BillingInterval };
  intervalChanges: boolean;
  addonCount: number;
  currentPeriodEnd: string | null;
  scheduledChange: { toPlan: string | null; toInterval: BillingInterval | null; effectiveAt: string | null } | null;
  // upgrade
  prorationDate?: number;
  preview?: UpgradePreview;
  // downgrade
  effectiveAt?: string | null;
}

interface PlanChangeResult {
  direction: 'upgrade' | 'downgrade';
  planName: string;
  interval: BillingInterval;
  effectiveAt?: string | null;
  nextRenewalAt?: string | null;
  invoice?: {
    paid: boolean;
    amountPaidCents: number;
    amountDueCents: number;
    currency: string;
    hostedInvoiceUrl: string | null;
  } | null;
}

interface ApiError {
  reason?: string;
  error: string;
}

const INTERVAL_ADVERB: Record<BillingInterval, string> = { month: 'monthly', year: 'yearly' };

function money(cents: number, currency: string): string {
  return `$${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function dollars(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'the end of your billing period';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Reasons where updating the card in the Stripe portal is the way forward. */
const PAYMENT_REASONS = new Set(['payment_required', 'payment_failed']);

export default function PlanChangeModal({
  priceId,
  onClose,
  onChanged,
  continueUrl,
  downgradeContext,
}: {
  /** Base-plan Stripe price the customer picked. */
  priceId: string;
  onClose: () => void;
  /** Called after a successful change so the page can refresh its plan state. */
  onChanged?: (result: PlanChangeResult) => void;
  /** Where "Continue" goes once done (e.g. the publish flow). Without it the modal just closes. */
  continueUrl?: string;
  /** Shown on downgrades so the customer knows what they lose on Basic. */
  downgradeContext?: { publishedSiteCount: number; hasCustomDomain: boolean };
}) {
  const [info, setInfo] = useState<PlanChangeInfo | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<PlanChangeResult | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/stripe/plan-change?priceId=${encodeURIComponent(priceId)}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setLoadError({ reason: data?.reason, error: data?.error || 'Could not load this plan change.' });
        setInfo(null);
      } else {
        setInfo(data as PlanChangeInfo);
      }
    } catch {
      setLoadError({ error: 'Could not load this plan change. Please try again.' });
    } finally {
      setLoading(false);
    }
  }, [priceId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirm = async () => {
    if (!info) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/stripe/plan-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceId, prorationDate: info.prorationDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError({ reason: data?.reason, error: data?.error || 'Failed to change plan.' });
        return;
      }
      setResult(data as PlanChangeResult);
      onChanged?.(data as PlanChangeResult);
    } catch {
      setSubmitError({ error: 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const openBillingPortal = async () => {
    setOpeningPortal(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      setSubmitError({ error: data?.error || 'Could not open billing settings.' });
    } catch {
      setSubmitError({ error: 'Could not open billing settings.' });
    } finally {
      setOpeningPortal(false);
    }
  };

  const finish = () => {
    if (continueUrl) {
      window.location.href = continueUrl;
      return;
    }
    onClose();
  };

  const error = submitError ?? loadError;
  const showPortalButton = !!error?.reason && PAYMENT_REASONS.has(error.reason);
  const busy = submitting || openingPortal;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Calculating your price…</p>
          </div>
        ) : result ? (
          <SuccessView result={result} onDone={finish} continueLabel={continueUrl ? 'Continue' : 'Done'} />
        ) : !info ? (
          <>
            <h2 className="text-xl font-black text-slate-900 mb-3">
              {loadError?.reason === 'same_plan' ? 'You’re already on this plan' : 'Can’t change plan right now'}
            </h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {loadError?.error}
              {loadError?.reason === 'same_plan' && !continueUrl
                ? ' To switch between monthly and yearly billing, use the Billing Cycle section in Settings.'
                : ''}
            </p>
            <div className="flex gap-3">
              <button
                onClick={loadError?.reason === 'same_plan' ? finish : onClose}
                disabled={busy}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                {loadError?.reason === 'same_plan' && continueUrl ? 'Continue' : 'Close'}
              </button>
              {showPortalButton && (
                <PortalButton onClick={openBillingPortal} loading={openingPortal} />
              )}
              {loadError?.reason === 'preview_failed' && (
                <button
                  onClick={load}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-colors"
                >
                  Try again
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {info.direction === 'upgrade' ? (
              <UpgradeDetails info={info} />
            ) : (
              <DowngradeDetails info={info} context={downgradeContext} />
            )}

            {submitError && (
              <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                {submitError.error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={busy}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                {info.direction === 'downgrade' ? `Keep ${info.currentPlan}` : 'Cancel'}
              </button>
              {showPortalButton ? (
                <PortalButton onClick={openBillingPortal} loading={openingPortal} />
              ) : (
                <button
                  onClick={handleConfirm}
                  disabled={busy}
                  className={`flex-1 py-3 px-4 rounded-xl disabled:opacity-70 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                    info.direction === 'upgrade' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {confirmLabel(info, submitting)}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function confirmLabel(info: PlanChangeInfo, submitting: boolean): string {
  if (info.direction === 'downgrade') {
    return submitting ? 'Scheduling…' : `Downgrade to ${info.targetPlan}`;
  }
  if (submitting) return 'Upgrading…';
  const due = info.preview?.amountDueCents ?? 0;
  return due > 0 ? `Confirm — pay ${money(due, info.preview!.currency)}` : `Upgrade to ${info.targetPlan}`;
}

function PortalButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-70 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      Update payment method
    </button>
  );
}

function UpgradeDetails({ info }: { info: PlanChangeInfo }) {
  const preview = info.preview!;
  const pricing = info.targetPricing;

  return (
    <>
      <h2 className="text-xl font-black text-slate-900 mb-2">Upgrade to {info.targetPlan}</h2>
      <p className="text-sm text-slate-600 mb-5 leading-relaxed">
        {info.targetPlan} is {dollars(pricing.perTerm)} every {pricing.termLabel}
        {info.targetInterval === 'year' ? ` (${dollars(pricing.perMonth)}/mo)` : ''}. Your upgrade starts
        right away
        {info.intervalChanges
          ? `, and because you're switching to ${INTERVAL_ADVERB[info.targetInterval]} billing your billing date restarts today.`
          : ' and your renewal date stays the same.'}
      </p>

      <div className="flex gap-3 p-3 mb-5 bg-slate-50 border border-slate-200 rounded-xl">
        <Sparkles className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-slate-600 leading-relaxed">
          You get credit for the unused part of your {info.currentPlan} plan, so today you only pay the
          difference.
        </p>
      </div>

      <dl className="space-y-2.5 mb-5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">{info.targetPlan} charges</dt>
          <dd className="font-semibold text-slate-900 tabular-nums">{money(preview.chargesCents, preview.currency)}</dd>
        </div>
        {preview.creditCents > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Credit for unused {info.currentPlan} time</dt>
            <dd className="font-semibold text-green-700 tabular-nums">−{money(preview.creditCents, preview.currency)}</dd>
          </div>
        )}
        {preview.taxCents > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Tax</dt>
            <dd className="font-semibold text-slate-900 tabular-nums">{money(preview.taxCents, preview.currency)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4 pt-2.5 border-t border-slate-100">
          <dt className="font-bold text-slate-900">Due today</dt>
          <dd className="font-bold text-slate-900 tabular-nums">{money(preview.amountDueCents, preview.currency)}</dd>
        </div>
        {preview.nextRenewalAt && (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Next renewal</dt>
            <dd className="text-slate-700">{formatDate(preview.nextRenewalAt)}</dd>
          </div>
        )}
      </dl>

      <p className="text-[11px] text-slate-500 mb-4">
        Overage moves to the {info.targetPlan} rate too.
        {info.intervalChanges && info.addonCount > 0
          ? ` Your ${info.addonCount} active add-on${info.addonCount === 1 ? '' : 's'} will move to ${INTERVAL_ADVERB[info.targetInterval]} pricing.`
          : ''}{' '}
        Your card on file is charged when you confirm. If the payment doesn’t go through, your plan stays
        as it is.
      </p>
    </>
  );
}

function DowngradeDetails({
  info,
  context,
}: {
  info: PlanChangeInfo;
  context?: { publishedSiteCount: number; hasCustomDomain: boolean };
}) {
  const pricing = info.targetPricing;
  const when = formatDate(info.effectiveAt);

  return (
    <>
      <h2 className="text-xl font-black text-slate-900 mb-2">Before you downgrade</h2>
      <p className="text-sm text-slate-600 mb-5 leading-relaxed">
        You&apos;ll keep {info.currentPlan} until <strong>{when}</strong>. Then your plan switches to{' '}
        {info.targetPlan} at {dollars(pricing.perTerm)} every {pricing.termLabel}
        {info.targetInterval === 'year' ? ` (${dollars(pricing.perMonth)}/mo)` : ''}. Nothing is charged
        today.
      </p>

      {info.scheduledChange && (
        <div className="flex gap-3 p-3 mb-5 bg-slate-50 border border-slate-200 rounded-xl">
          <CalendarClock className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600 leading-relaxed">
            You already have a downgrade scheduled. Confirming replaces it with this one.
          </p>
        </div>
      )}

      <p className="text-sm font-semibold text-slate-900 mb-3">What changes on {when}:</p>
      <ul className="space-y-3 mb-6">
        <li className="flex gap-3 text-sm">
          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">!</span>
          <span className="text-slate-700">
            <strong>Published site limit drops to 1.</strong>{' '}
            {context && context.publishedSiteCount > 1
              ? `You currently have ${context.publishedSiteCount} published sites. We'll keep your most recently published site live and unpublish the rest.`
              : context
                ? 'You currently have 1 published site, so nothing changes there.'
                : ''}
          </span>
        </li>
        {context?.hasCustomDomain && (
          <li className="flex gap-3 text-sm">
            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">!</span>
            <span className="text-slate-700">
              <strong>Your custom domain will be disconnected.</strong> It stays yours and parked until its
              renewal date. Custom domains need a Pro plan.
            </span>
          </li>
        )}
        <li className="flex gap-3 text-sm">
          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">i</span>
          <span className="text-slate-500">All your site drafts and content are kept. Nothing is deleted.</span>
        </li>
      </ul>

      <p className="text-[11px] text-slate-500 mb-4">
        You can cancel this downgrade from the Pricing page any time before {when}.
      </p>
    </>
  );
}

function SuccessView({
  result,
  onDone,
  continueLabel,
}: {
  result: PlanChangeResult;
  onDone: () => void;
  continueLabel: string;
}) {
  const invoice = result.invoice;
  const awaitingPayment = !!invoice && !invoice.paid && invoice.amountDueCents > 0;

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        {awaitingPayment ? (
          <AlertCircle className="w-6 h-6 text-amber-600" />
        ) : (
          <CheckCircle2 className="w-6 h-6 text-green-600" />
        )}
        <h2 className="text-xl font-black text-slate-900">
          {result.direction === 'upgrade'
            ? `You're on ${result.planName}`
            : `Downgrade scheduled`}
        </h2>
      </div>

      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
        {result.direction === 'upgrade' ? (
          <>
            {invoice
              ? invoice.paid
                ? invoice.amountPaidCents > 0
                  ? `We charged ${money(invoice.amountPaidCents, invoice.currency)}. `
                  : 'Your credit covered it, so there was nothing to pay today. '
                : awaitingPayment
                  ? `An invoice for ${money(invoice.amountDueCents, invoice.currency)} is awaiting payment. `
                  : ''
              : ''}
            Your {result.planName} features are ready to use now
            {result.nextRenewalAt ? `, and your next renewal is ${formatDate(result.nextRenewalAt)}` : ''}.
          </>
        ) : (
          <>
            You&apos;ll stay on your current plan until <strong>{formatDate(result.effectiveAt)}</strong>, then
            switch to {result.planName} billed {INTERVAL_ADVERB[result.interval]}.
          </>
        )}
      </p>

      <div className="flex gap-3">
        {awaitingPayment && invoice?.hostedInvoiceUrl && (
          <a
            href={invoice.hostedInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm text-center transition-colors"
          >
            Complete payment
          </a>
        )}
        <button
          onClick={onDone}
          className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-colors"
        >
          {continueLabel}
        </button>
      </div>
    </>
  );
}
