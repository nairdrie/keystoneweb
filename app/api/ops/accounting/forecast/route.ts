import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import {
  countOccurrencesInRange,
  type ForecastPoint,
  type Frequency,
} from '@/lib/ops/accounting';

/**
 * GET /api/ops/accounting/forecast
 * Project revenue, expenses, and net for the next 12 months.
 *
 * MRR is based on confirmed Stripe payments cached in stripe_transactions.
 * Falls back to plan price for subs without confirmed payment data.
 * Domain renewals and manual recurring entries are layered on top.
 */
export async function GET() {
  const access = await requireOpsAccess();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();

  // ── Subscription MRR from confirmed payments ───────────────────────────
  const { data: subs } = await db
    .from('user_subscriptions')
    .select('subscription_plan, subscription_status, stripe_subscription_id, billing_interval')
    .eq('subscription_status', 'active');

  const activeSubs = subs ?? [];

  // Fetch latest confirmed payment per subscription
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
      subscriptionMrr += payment.billing_interval === 'year'
        ? Math.round(payment.amount_cents / 12)
        : payment.amount_cents;
    }
    // No confirmed payment = $0 MRR contribution (e.g. 100% coupon)
  }

  // ── Domain renewals ─────────────────────────────────────────────────────
  const { data: domains } = await db
    .from('domain_purchases')
    .select('vercel_cost_cents, auto_renew, expires_at')
    .eq('auto_renew', true)
    .in('status', ['active', 'completed']);

  // Build a map of month -> domain renewal cost.
  // Domains renew annually — advance the expiry date forward until it falls
  // within the 12-month forecast window so past-due renewals aren't missed.
  const now = new Date();
  const forecastStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const forecastEnd = new Date(now.getFullYear(), now.getMonth() + 12, 0);
  const domainRenewalsByMonth = new Map<string, number>();

  for (const d of domains ?? []) {
    if (!d.expires_at || !d.vercel_cost_cents) continue;
    const renewalDate = new Date(d.expires_at);

    // Advance past renewals forward by years until within the forecast window
    while (renewalDate < forecastStart) {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    }

    // Add all renewals that fall within the 12-month window
    while (renewalDate <= forecastEnd) {
      const monthKey = `${renewalDate.getFullYear()}-${String(renewalDate.getMonth() + 1).padStart(2, '0')}`;
      domainRenewalsByMonth.set(monthKey, (domainRenewalsByMonth.get(monthKey) ?? 0) + d.vercel_cost_cents);
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    }
  }

  // ── Manual recurring entries ────────────────────────────────────────────
  const { data: recurring } = await db
    .from('accounting_recurring')
    .select('type, amount_cents, frequency, start_date, end_date, is_active')
    .eq('is_active', true);

  // ── Build 12-month forecast ─────────────────────────────────────────────
  const forecast: ForecastPoint[] = [];
  let cumulative = 0;

  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const rangeStart = monthDate.toISOString().slice(0, 10);
    const rangeEnd = monthEnd.toISOString().slice(0, 10);

    const label = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    // Base recurring revenue from confirmed subscription MRR
    let projectedRevenue = subscriptionMrr;

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
      totalMrr: subscriptionMrr,
      activeSubscriptions: activeSubs.length,
      autoRenewDomains: (domains ?? []).length,
    },
  });
}
