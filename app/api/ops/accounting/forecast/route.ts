import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { getPlanByName } from '@/lib/plans';
import { ADDON_PRICES, type AddonType } from '@/lib/addons';
import {
  getMonthlyEquivalent,
  countOccurrencesInRange,
  type ForecastPoint,
  type Frequency,
} from '@/lib/ops/accounting';

/**
 * GET /api/ops/accounting/forecast
 * Project revenue, expenses, and net for the next 12 months.
 * Based on: current subscribers, their billing schedules, active add-ons,
 * domain renewal costs, and manual recurring entries.
 */
export async function GET() {
  const access = await requireOpsAccess();
  if (!access || !access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();

  // ── Subscription MRR ────────────────────────────────────────────────────
  const { data: subs } = await db
    .from('user_subscriptions')
    .select('subscription_plan, subscription_status')
    .eq('subscription_status', 'active');

  let subscriptionMrr = 0;
  for (const sub of subs ?? []) {
    const plan = getPlanByName(sub.subscription_plan);
    if (plan) subscriptionMrr += plan.monthlyPrice * 100;
  }

  // ── Add-on MRR ──────────────────────────────────────────────────────────
  const { data: addons } = await db
    .from('user_addons')
    .select('addon_type, quantity, monthly_price')
    .eq('status', 'active');

  let addonMrr = 0;
  for (const addon of addons ?? []) {
    const price = addon.monthly_price ?? ADDON_PRICES[addon.addon_type as AddonType]?.monthly ?? 0;
    addonMrr += price * addon.quantity * 100;
  }

  // ── Domain renewals ─────────────────────────────────────────────────────
  const { data: domains } = await db
    .from('domain_purchases')
    .select('vercel_cost_cents, auto_renew, expires_at')
    .eq('auto_renew', true)
    .in('status', ['active', 'completed']);

  // Build a map of month -> domain renewal cost
  const domainRenewalsByMonth = new Map<string, number>();
  for (const d of domains ?? []) {
    if (!d.expires_at || !d.vercel_cost_cents) continue;
    const expires = new Date(d.expires_at);
    const monthKey = `${expires.getFullYear()}-${String(expires.getMonth() + 1).padStart(2, '0')}`;
    domainRenewalsByMonth.set(monthKey, (domainRenewalsByMonth.get(monthKey) ?? 0) + d.vercel_cost_cents);
  }

  // ── Manual recurring entries ────────────────────────────────────────────
  const { data: recurring } = await db
    .from('accounting_recurring')
    .select('type, amount_cents, frequency, start_date, end_date, is_active')
    .eq('is_active', true);

  // ── Build 12-month forecast ─────────────────────────────────────────────
  const now = new Date();
  const forecast: ForecastPoint[] = [];
  let cumulative = 0;

  // Start from the beginning of the current month
  const startBalance = 0; // Could integrate with a "current balance" field later

  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const rangeStart = monthDate.toISOString().slice(0, 10);
    const rangeEnd = monthEnd.toISOString().slice(0, 10);

    const label = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    // Base recurring revenue from subs + addons
    let projectedRevenue = subscriptionMrr + addonMrr;

    // Base expenses from domain renewals
    let projectedExpenses = domainRenewalsByMonth.get(monthKey) ?? 0;

    // Manual recurring entries
    for (const r of recurring ?? []) {
      const occurrences = countOccurrencesInRange(
        r.start_date,
        r.frequency as Frequency,
        rangeStart,
        rangeEnd,
        r.end_date,
      );
      const amount = r.amount_cents * occurrences;
      if (r.type === 'revenue') {
        projectedRevenue += amount;
      } else {
        projectedExpenses += amount;
      }
    }

    const net = projectedRevenue - projectedExpenses;
    cumulative += net;

    forecast.push({
      month: monthKey,
      label,
      projectedRevenue,
      projectedExpenses,
      projectedNet: net,
      cumulativeNet: cumulative,
    });
  }

  return NextResponse.json({
    forecast,
    assumptions: {
      subscriptionMrr,
      addonMrr,
      totalMrr: subscriptionMrr + addonMrr,
      activeSubscriptions: (subs ?? []).length,
      activeAddons: (addons ?? []).length,
      autoRenewDomains: (domains ?? []).length,
    },
  });
}
