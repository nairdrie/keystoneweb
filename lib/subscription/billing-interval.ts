/**
 * Billing-cycle switching (monthly ↔ yearly) for the base plan subscription.
 *
 * The Stripe Customer Portal we link to from Settings is configured for invoices
 * + cancellation only, so customers had no way to move between the monthly and
 * yearly price of the plan they're already on. This module holds the rules; the
 * Stripe calls live in `app/api/stripe/billing-interval/route.ts`.
 *
 * ── How the switch is billed ────────────────────────────────────────────────
 * Switching a subscription item between billing intervals always resets the
 * billing date and invoices immediately (Stripe behaviour). What differs is
 * whether the customer is credited for the part of the cycle they already paid:
 *
 *   • Paid up (`active` / `trialing`) → `proration_behavior: 'always_invoice'`.
 *     The unused remainder of the current cycle is credited, the full new term
 *     is charged, and the customer pays the difference today.
 *
 *   • Late (`past_due` / `unpaid`) → `proration_behavior: 'none'`.
 *     There is nothing to prorate: the current cycle was never paid for, so we
 *     don't hand out a credit for it. Stripe bills the whole new term from
 *     today — i.e. a late customer moving to yearly is charged the full year.
 *
 * Add-on items ride along with the base plan so the customer isn't left paying
 * monthly add-on rates on a yearly plan. The metered overage item is always
 * monthly by design (see lib/plans.ts) and is deliberately left alone.
 */

import type Stripe from 'stripe';
import { PLANS, getPlanByName, type PlanConfig } from '../plans';
import { ADDON_PRICES, ADDON_STRIPE_PRICES, type AddonType } from '../addons';
import { hasLiveSubscription } from './access';

export type BillingInterval = 'month' | 'year';

/** Statuses meaning the customer is behind on payment for the current cycle. */
export const LATE_STATUSES = new Set(['past_due', 'unpaid']);

/**
 * When a late customer switches cycle we bill the whole new term starting today,
 * which means the new term overlaps the period their failed invoice covers.
 * Voiding that stale invoice stops us billing twice for the same days — the
 * annual charge squares them up instead.
 *
 * Flip this to `false` if you would rather keep dunning the old invoice; the
 * customer then pays both it and the new full term.
 */
export const VOID_STALE_INVOICE_ON_LATE_SWITCH = true;

export function isLateStatus(status: string | null | undefined): boolean {
  return !!status && LATE_STATUSES.has(status);
}

/**
 * The cycle can be changed whenever the Stripe subscription is still live — a
 * lapsed or never-started customer goes through Checkout on /pricing instead.
 */
export function canSwitchInterval(status: string | null | undefined): boolean {
  return hasLiveSubscription(status);
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === 'month' || value === 'year';
}

/** The cycle a customer is offered when they're on `interval`. */
export function oppositeInterval(interval: BillingInterval): BillingInterval {
  return interval === 'year' ? 'month' : 'year';
}

// ── Pricing ─────────────────────────────────────────────────────────────────

export interface IntervalPricing {
  interval: BillingInterval;
  /** Effective cost per month, in dollars. */
  perMonth: number;
  /** What the customer is charged on each renewal, in dollars. */
  perTerm: number;
  /** 'month' | 'year' — the unit `perTerm` is charged over. */
  termLabel: BillingInterval;
}

export function intervalPricing(plan: PlanConfig, interval: BillingInterval): IntervalPricing {
  return interval === 'year'
    ? { interval, perMonth: plan.yearlyPrice, perTerm: plan.yearlyPrice * 12, termLabel: 'year' }
    : { interval, perMonth: plan.monthlyPrice, perTerm: plan.monthlyPrice, termLabel: 'month' };
}

/** Dollars saved over a year by paying yearly instead of monthly. */
export function yearlySavings(plan: PlanConfig): number {
  return (plan.monthlyPrice - plan.yearlyPrice) * 12;
}

// ── Strategy ────────────────────────────────────────────────────────────────

export interface IntervalChangeStrategy {
  /** Passed straight to Stripe on the subscription update / invoice preview. */
  prorationBehavior: 'always_invoice' | 'none';
  /** True when the customer is billed for the whole new term with no credit for unused time. */
  chargesFullTerm: boolean;
  /** True when the leftover unpaid invoice from the failed cycle should be voided. */
  voidStaleInvoices: boolean;
  reason: 'prorated' | 'late_full_term';
}

export function resolveIntervalChangeStrategy(status: string | null | undefined): IntervalChangeStrategy {
  if (isLateStatus(status)) {
    return {
      prorationBehavior: 'none',
      chargesFullTerm: true,
      voidStaleInvoices: VOID_STALE_INVOICE_ON_LATE_SWITCH,
      reason: 'late_full_term',
    };
  }
  return {
    prorationBehavior: 'always_invoice',
    chargesFullTerm: false,
    voidStaleInvoices: false,
    reason: 'prorated',
  };
}

// ── Subscription item resolution ────────────────────────────────────────────

/**
 * Overage is billed through a metered price that stays monthly whatever the base
 * plan does, so it must never be swept up in an interval switch.
 */
export function isMeteredItem(item: Stripe.SubscriptionItem): boolean {
  const recurring = item.price?.recurring as
    | (Stripe.Price.Recurring & { meter?: string | null })
    | null
    | undefined;
  return recurring?.usage_type === 'metered' || !!recurring?.meter;
}

export function intervalOfItem(item: Stripe.SubscriptionItem | null | undefined): BillingInterval | null {
  const interval = item?.price?.recurring?.interval;
  return interval === 'month' || interval === 'year' ? interval : null;
}

/** Look up the plan key ('basic' | 'pro') for a plan config. */
export function planKeyFor(plan: PlanConfig): string | null {
  return Object.keys(PLANS).find((key) => PLANS[key] === plan) ?? null;
}

/**
 * Resolve the plan from the prices actually on the subscription, falling back to
 * the plan name we stored. Price IDs are authoritative — a renamed Stripe
 * product shouldn't change which plan we think someone is on.
 */
export function resolvePlanFromSubscription(
  subscription: Stripe.Subscription,
  planNameHint?: string | null,
): PlanConfig | null {
  const priceIds = new Set(
    (subscription.items?.data ?? []).map((item) => item.price?.id).filter(Boolean) as string[],
  );
  for (const plan of Object.values(PLANS)) {
    if (priceIds.has(plan.stripe.monthly) || priceIds.has(plan.stripe.yearly)) return plan;
  }
  return getPlanByName(planNameHint);
}

/**
 * Find the base plan item — the one whose price we swap.
 *
 * Matching on the plan's known price IDs is exact. The fallback (first licensed
 * item that isn't a known add-on) covers subscriptions created against prices
 * that have since been replaced in lib/plans.ts.
 */
export function findPlanItem(
  subscription: Stripe.Subscription,
  plan: PlanConfig | null,
  excludeItemIds: ReadonlySet<string> = new Set(),
): Stripe.SubscriptionItem | null {
  const items = subscription.items?.data ?? [];

  if (plan) {
    const knownPrices = new Set([plan.stripe.monthly, plan.stripe.yearly].filter(Boolean));
    const exact = items.find((item) => item.price?.id && knownPrices.has(item.price.id));
    if (exact) return exact;
  }

  return items.find((item) => !isMeteredItem(item) && !excludeItemIds.has(item.id)) ?? null;
}

// ── Add-on items ────────────────────────────────────────────────────────────

export interface AddonPriceTarget {
  /** Shared Stripe price for this add-on at the target interval, when one applies. */
  priceId: string | null;
  /** True when the admin overrode pricing, so a per-user Stripe price is needed. */
  needsCustomPrice: boolean;
  /** Amount the custom price should carry, in cents. */
  unitAmountCents: number;
}

/**
 * Work out which price an add-on item should move to.
 *
 * Mirrors the rule in `app/api/stripe/addons/activate/route.ts`: standard pricing
 * uses the shared price for that interval, anything else needs a per-user price.
 */
export function resolveAddonTargetPrice(
  addon: { addon_type: string; monthly_price: number; yearly_price: number },
  interval: BillingInterval,
): AddonPriceTarget | null {
  const addonType = addon.addon_type as AddonType;
  const defaults = ADDON_PRICES[addonType];
  if (!defaults) return null;

  const isYearly = interval === 'year';
  const actual = isYearly ? addon.yearly_price : addon.monthly_price;
  const expected = isYearly ? defaults.yearly : defaults.monthly;
  const shared = ADDON_STRIPE_PRICES[addonType]?.[isYearly ? 'yearly' : 'monthly'] || '';

  if (actual === expected && shared) {
    return { priceId: shared, needsCustomPrice: false, unitAmountCents: Math.round(actual * 100) };
  }
  return { priceId: null, needsCustomPrice: true, unitAmountCents: Math.round(actual * 100) };
}
