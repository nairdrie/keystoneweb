import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { PLANS, getPlanByName } from '@/lib/plans';
import { ADDON_PRICES, type AddonType } from '@/lib/addons';
import { getMonthlyEquivalent, type AccountingMetrics, type Frequency } from '@/lib/ops/accounting';

/**
 * GET /api/ops/accounting
 * Returns aggregate accounting metrics: revenue, expenses, net, tax, MRR/ARR.
 * Combines auto-tracked data from subscriptions/addons/domains with manual entries.
 */
export async function GET() {
  const access = await requireOpsAccess();
  if (!access || !access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const yearStart = `${now.getFullYear()}-01-01`;

  // ── Auto-tracked: active subscriptions ──────────────────────────────────
  const { data: subs } = await db
    .from('user_subscriptions')
    .select('user_id, subscription_plan, subscription_status, stripe_subscription_id')
    .eq('subscription_status', 'active');

  let subscriptionMrr = 0;
  const activeSubs = subs ?? [];
  for (const sub of activeSubs) {
    const plan = getPlanByName(sub.subscription_plan);
    if (!plan) continue;
    // We can't easily tell monthly vs yearly from DB alone, so use monthly price as baseline.
    // Stripe subscription ID format doesn't indicate interval.
    // For accuracy, use the plan's monthly price as the MRR contribution.
    subscriptionMrr += plan.monthlyPrice * 100; // cents
  }

  // ── Auto-tracked: active add-ons ────────────────────────────────────────
  const { data: addons } = await db
    .from('user_addons')
    .select('addon_type, quantity, monthly_price, yearly_price, status')
    .eq('status', 'active');

  let addonMrr = 0;
  const activeAddons = addons ?? [];
  for (const addon of activeAddons) {
    const price = addon.monthly_price ?? ADDON_PRICES[addon.addon_type as AddonType]?.monthly ?? 0;
    addonMrr += price * addon.quantity * 100; // cents
  }

  // ── Auto-tracked: domain purchases (revenue = amount_cents, expense = vercel_cost_cents) ──
  const { data: domains } = await db
    .from('domain_purchases')
    .select('amount_cents, vercel_cost_cents, is_free_with_pro, auto_renew, expires_at, created_at, status')
    .in('status', ['active', 'completed']);

  let domainRevenueAllTime = 0;
  let domainExpenseAllTime = 0;
  let domainRevenueYear = 0;
  let domainExpenseYear = 0;
  let domainRevenueMonth = 0;
  let domainExpenseMonth = 0;
  let domainRenewalMonthlyExpense = 0; // estimated monthly cost for auto-renewing domains

  for (const d of domains ?? []) {
    const created = d.created_at?.slice(0, 10) ?? '';
    const revenue = d.amount_cents ?? 0;
    const expense = d.vercel_cost_cents ?? 0;

    domainRevenueAllTime += revenue;
    domainExpenseAllTime += expense;

    if (created >= yearStart) {
      domainRevenueYear += revenue;
      domainExpenseYear += expense;
    }
    if (created >= monthStart) {
      domainRevenueMonth += revenue;
      domainExpenseMonth += expense;
    }

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
      if (date >= yearStart) {
        manualRevenueYear += e.amount_cents;
        taxCollectedYear += e.tax_cents ?? 0;
      }
      if (date >= monthStart) {
        manualRevenueMonth += e.amount_cents;
        taxCollectedMonth += e.tax_cents ?? 0;
      }
    } else {
      manualExpenseAllTime += e.amount_cents;
      if (date >= yearStart) {
        manualExpenseYear += e.amount_cents;
        taxPaidYear += e.tax_cents ?? 0;
      }
      if (date >= monthStart) {
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
  // For month/year metrics, auto revenue = subscription + addon MRR * months elapsed
  // Simplified: use MRR for current month, accumulated for year/all-time from manual
  const mrr = subscriptionMrr + addonMrr + recurringRevenueMrr;
  const totalExpenseMrr = domainRenewalMonthlyExpense + recurringExpenseMrr;

  const revenueMonth = mrr + domainRevenueMonth + manualRevenueMonth;
  const revenueYear = mrr * now.getMonth() + domainRevenueYear + manualRevenueYear;
  const revenueAllTime = domainRevenueAllTime + manualRevenueAllTime;
  // All-time auto revenue can't be precisely computed without historical data,
  // so we report domain + manual all-time and show MRR separately.

  const expenseMonth = totalExpenseMrr + domainExpenseMonth + manualExpenseMonth;
  const expenseYear = totalExpenseMrr * now.getMonth() + domainExpenseYear + manualExpenseYear;
  const expenseAllTime = domainExpenseAllTime + manualExpenseAllTime;

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
    activeAddons: activeAddons.length,
  };

  return NextResponse.json(metrics);
}
