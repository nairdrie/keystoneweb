import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { getMonthlyEquivalent, type AccountingMetrics, type Frequency } from '@/lib/ops/accounting';

/**
 * GET /api/ops/accounting
 * Returns aggregate accounting metrics: revenue, expenses, net, tax, MRR/ARR.
 *
 * Revenue is based entirely on confirmed Stripe payments cached in
 * stripe_transactions (no live Stripe API calls). Manual entries and
 * recurring entries are layered on top.
 */
export async function GET() {
  const access = await requireOpsAccess();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = `${now.getFullYear()}-01-01T00:00:00.000Z`;

  // ── MRR from confirmed payments ─────────────────────────────────────────
  // For each active subscription, use the latest confirmed invoice payment.
  // Falls back to plan price only for subs created before transaction tracking.

  const { data: subs } = await db
    .from('user_subscriptions')
    .select('user_id, subscription_plan, subscription_status, stripe_subscription_id, billing_interval')
    .eq('subscription_status', 'active');

  const activeSubs = subs ?? [];

  // Fetch latest confirmed payment per subscription from our local cache
  const subIds = activeSubs
    .map((s: any) => s.stripe_subscription_id)
    .filter(Boolean);

  const latestPaymentMap = new Map<string, { amount_cents: number; billing_interval: string; event_type: string }>();

  if (subIds.length > 0) {
    const { data: payments } = await db
      .from('stripe_transactions')
      .select('stripe_subscription_id, amount_cents, billing_interval, event_type')
      .in('stripe_subscription_id', subIds)
      .in('event_type', ['invoice.paid', 'checkout.session.completed'])
      .eq('status', 'succeeded')
      .order('created_at', { ascending: false });

    for (const p of payments ?? []) {
      if (!p.stripe_subscription_id) continue;
      const existing = latestPaymentMap.get(p.stripe_subscription_id);
      // Prefer invoice.paid over checkout.session.completed; otherwise keep most recent
      if (!existing || (existing.event_type !== 'invoice.paid' && p.event_type === 'invoice.paid')) {
        latestPaymentMap.set(p.stripe_subscription_id, p);
      }
    }
  }

  let subscriptionMrr = 0;
  for (const sub of activeSubs) {
    const payment = sub.stripe_subscription_id
      ? latestPaymentMap.get(sub.stripe_subscription_id)
      : null;

    if (payment) {
      // Use confirmed payment amount; fall back to sub's billing_interval
      // when the transaction doesn't have one (e.g. checkout.session.completed)
      const interval = payment.billing_interval || sub.billing_interval || 'month';
      subscriptionMrr += interval === 'year'
        ? Math.round(payment.amount_cents / 12)
        : payment.amount_cents;
    }
    // No confirmed payment = $0 MRR contribution (e.g. 100% coupon)
  }

  // ── Confirmed Stripe revenue by period ──────────────────────────────────
  // Sum actual payments from stripe_transactions for revenue totals.

  const revenueTypes = ['subscription_payment', 'subscription_created', 'domain_purchase', 'domain_transfer', 'ecommerce_order', 'one_time_payment'];

  const [
    { data: txMonth },
    { data: txYear },
    { data: txAll },
  ] = await Promise.all([
    db.from('stripe_transactions')
      .select('amount_cents')
      .eq('status', 'succeeded')
      .in('transaction_type', revenueTypes)
      .gte('created_at', monthStart),
    db.from('stripe_transactions')
      .select('amount_cents')
      .eq('status', 'succeeded')
      .in('transaction_type', revenueTypes)
      .gte('created_at', yearStart),
    db.from('stripe_transactions')
      .select('amount_cents')
      .eq('status', 'succeeded')
      .in('transaction_type', revenueTypes),
  ]);

  const stripeRevenueMonth = (txMonth ?? []).reduce((sum: number, t: any) => sum + t.amount_cents, 0);
  const stripeRevenueYear = (txYear ?? []).reduce((sum: number, t: any) => sum + t.amount_cents, 0);
  const stripeRevenueAllTime = (txAll ?? []).reduce((sum: number, t: any) => sum + t.amount_cents, 0);

  // ── Auto-tracked: domain expenses (Vercel cost) ─────────────────────────

  const { data: domains } = await db
    .from('domain_purchases')
    .select('vercel_cost_cents, auto_renew, expires_at, created_at, status')
    .in('status', ['active', 'completed']);

  const monthStartDate = monthStart.slice(0, 10);
  const yearStartDate = yearStart.slice(0, 10);

  let domainExpenseAllTime = 0;
  let domainExpenseYear = 0;
  let domainExpenseMonth = 0;

  for (const d of domains ?? []) {
    const created = d.created_at?.slice(0, 10) ?? '';
    const expense = d.vercel_cost_cents ?? 0;

    domainExpenseAllTime += expense;
    if (created >= yearStartDate) domainExpenseYear += expense;
    if (created >= monthStartDate) domainExpenseMonth += expense;
  }

  // ── Manual entries aggregation ──────────────────────────────────────────

  const { data: manualEntries } = await db
    .from('accounting_entries')
    .select('type, amount_cents, tax_cents, date, source');

  let manualRevenueAllTime = 0;
  let manualExpenseAllTime = 0;
  let manualRevenueYear = 0;
  let manualExpenseYear = 0;
  let manualRevenueMonth = 0;
  let manualExpenseMonth = 0;
  let taxCollectedYear = 0;
  let taxCollectedMonth = 0;
  let taxPaidYear = 0;
  let taxPaidMonth = 0;

  for (const e of manualEntries ?? []) {
    const date = e.date ?? '';
    if (e.type === 'revenue') {
      manualRevenueAllTime += e.amount_cents;
      if (date >= yearStartDate) {
        manualRevenueYear += e.amount_cents;
        taxCollectedYear += e.tax_cents ?? 0;
      }
      if (date >= monthStartDate) {
        manualRevenueMonth += e.amount_cents;
        taxCollectedMonth += e.tax_cents ?? 0;
      }
    } else {
      manualExpenseAllTime += e.amount_cents;
      if (date >= yearStartDate) {
        manualExpenseYear += e.amount_cents;
        taxPaidYear += e.tax_cents ?? 0;
      }
      if (date >= monthStartDate) {
        manualExpenseMonth += e.amount_cents;
        taxPaidMonth += e.tax_cents ?? 0;
      }
    }
  }

  // ── Recurring entries — monthly equivalent for expenses/revenue ─────────

  const { data: recurring } = await db
    .from('accounting_recurring')
    .select('type, amount_cents, frequency, start_date, is_active')
    .eq('is_active', true);

  let recurringRevenueMrr = 0;
  let recurringExpenseMrr = 0;
  let recurringRevenueYtd = 0;
  let recurringExpenseYtd = 0;
  for (const r of recurring ?? []) {
    const monthly = getMonthlyEquivalent(r.amount_cents, r.frequency as Frequency);
    if (r.type === 'revenue') {
      recurringRevenueMrr += monthly;
    } else {
      recurringExpenseMrr += monthly;
    }

    // YTD: count months active this year (from max(start_date, Jan 1) to now)
    const startDate = new Date(r.start_date + 'T00:00:00');
    const ytdStart = new Date(now.getFullYear(), 0, 1);
    const activeFrom = startDate > ytdStart ? startDate : ytdStart;
    const monthsActive = Math.max(0,
      (now.getFullYear() - activeFrom.getFullYear()) * 12
      + now.getMonth() - activeFrom.getMonth()
    );
    const ytdAmount = monthly * monthsActive;
    if (r.type === 'revenue') {
      recurringRevenueYtd += ytdAmount;
    } else {
      recurringExpenseYtd += ytdAmount;
    }
  }

  // ── Combine into totals ─────────────────────────────────────────────────

  const mrr = subscriptionMrr + recurringRevenueMrr;

  const revenueMonth = stripeRevenueMonth + recurringRevenueMrr + manualRevenueMonth;
  const revenueYear = stripeRevenueYear + recurringRevenueYtd + manualRevenueYear;
  const revenueAllTime = stripeRevenueAllTime + manualRevenueAllTime;

  const expenseMonth = recurringExpenseMrr + domainExpenseMonth + manualExpenseMonth;
  const expenseYear = recurringExpenseYtd + domainExpenseYear + manualExpenseYear;
  const expenseAllTime = domainExpenseAllTime + manualExpenseAllTime;

  // ── Active addons count (for display) ───────────────────────────────────

  const { count: activeAddonCount } = await db
    .from('user_addons')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  const metrics: AccountingMetrics = {
    revenue: {
      month: revenueMonth,
      year: revenueYear,
      allTime: revenueAllTime,
    },
    expenses: {
      month: expenseMonth,
      year: expenseYear,
      allTime: expenseAllTime,
    },
    net: {
      month: revenueMonth - expenseMonth,
      year: revenueYear - expenseYear,
      allTime: revenueAllTime - expenseAllTime,
    },
    taxCollected: { month: taxCollectedMonth, year: taxCollectedYear },
    taxPaid: { month: taxPaidMonth, year: taxPaidYear },
    mrr,
    arr: mrr * 12,
    activeSubscriptions: activeSubs.length,
    activeAddons: activeAddonCount ?? 0,
  };

  return NextResponse.json({
    ...metrics,
    breakdown: {
      revenue: {
        month: {
          stripe: stripeRevenueMonth,
          recurringEntries: recurringRevenueMrr,
          manual: manualRevenueMonth,
        },
        year: {
          stripe: stripeRevenueYear,
          recurringEntries: recurringRevenueYtd,
          manual: manualRevenueYear,
        },
      },
      expenses: {
        month: {
          recurringEntries: recurringExpenseMrr,
          domainPurchases: domainExpenseMonth,
          manual: manualExpenseMonth,
        },
        year: {
          recurringEntries: recurringExpenseYtd,
          domainPurchases: domainExpenseYear,
          manual: manualExpenseYear,
        },
      },
      mrr: {
        subscriptions: subscriptionMrr,
        recurringManual: recurringRevenueMrr,
      },
    },
  });
}
