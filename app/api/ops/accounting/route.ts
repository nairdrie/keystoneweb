import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { getPlanByName } from '@/lib/plans';
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
  if (!access || !access.isAdmin) {
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

  const latestPaymentMap = new Map<string, { amount_cents: number; billing_interval: string }>();

  if (subIds.length > 0) {
    const { data: payments } = await db
      .from('stripe_transactions')
      .select('stripe_subscription_id, amount_cents, billing_interval')
      .in('stripe_subscription_id', subIds)
      .eq('event_type', 'invoice.paid')
      .eq('status', 'succeeded')
      .order('created_at', { ascending: false });

    for (const p of payments ?? []) {
      // Only keep the most recent payment per subscription
      if (p.stripe_subscription_id && !latestPaymentMap.has(p.stripe_subscription_id)) {
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
      // Use confirmed payment amount (includes plan + any active addons)
      subscriptionMrr += payment.billing_interval === 'year'
        ? Math.round(payment.amount_cents / 12)
        : payment.amount_cents;
    } else {
      // Fallback for subscriptions without confirmed payment data yet
      const plan = getPlanByName(sub.subscription_plan);
      if (plan) {
        const interval = sub.billing_interval ?? 'month';
        subscriptionMrr += (interval === 'year' ? plan.yearlyPrice : plan.monthlyPrice) * 100;
      }
    }
  }

  // ── Confirmed Stripe revenue by period ──────────────────────────────────
  // Sum actual payments from stripe_transactions for revenue totals.

  const revenueTypes = ['subscription_payment', 'domain_purchase', 'domain_transfer', 'ecommerce_order', 'one_time_payment'];

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
  let domainRenewalMonthlyExpense = 0;

  for (const d of domains ?? []) {
    const created = d.created_at?.slice(0, 10) ?? '';
    const expense = d.vercel_cost_cents ?? 0;

    domainExpenseAllTime += expense;
    if (created >= yearStartDate) domainExpenseYear += expense;
    if (created >= monthStartDate) domainExpenseMonth += expense;

    // Estimate monthly renewal cost for auto-renewing domains
    if (d.auto_renew && expense > 0) {
      domainRenewalMonthlyExpense += Math.round(expense / 12);
    }
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
    .select('type, amount_cents, frequency, is_active')
    .eq('is_active', true);

  let recurringRevenueMrr = 0;
  let recurringExpenseMrr = 0;
  for (const r of recurring ?? []) {
    const monthly = getMonthlyEquivalent(r.amount_cents, r.frequency as Frequency);
    if (r.type === 'revenue') {
      recurringRevenueMrr += monthly;
    } else {
      recurringExpenseMrr += monthly;
    }
  }

  // ── Combine into totals ─────────────────────────────────────────────────

  const mrr = subscriptionMrr + recurringRevenueMrr;
  const totalExpenseMrr = domainRenewalMonthlyExpense + recurringExpenseMrr;

  const revenueMonth = stripeRevenueMonth + manualRevenueMonth;
  const revenueYear = stripeRevenueYear + manualRevenueYear;
  const revenueAllTime = stripeRevenueAllTime + manualRevenueAllTime;

  const expenseMonth = totalExpenseMrr + domainExpenseMonth + manualExpenseMonth;
  const expenseYear = totalExpenseMrr * now.getMonth() + domainExpenseYear + manualExpenseYear;
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

  return NextResponse.json(metrics);
}
