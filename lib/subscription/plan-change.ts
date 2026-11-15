/**
 * Plan changes (Basic ↔ Pro) on an existing subscription.
 *
 * We used to hand these to the Stripe Customer Portal's
 * `subscription_update_confirm` flow, but the portal refuses to touch any
 * subscription with more than one item — and every Keystone subscription has at
 * least two (the base plan plus the always-monthly metered overage item, added
 * by the webhook after checkout), so every upgrade failed. Plan changes are now
 * previewed and confirmed in-app and applied with the Stripe API directly; the
 * Stripe calls live in `app/api/stripe/plan-change/route.ts`.
 *
 * ── How a change is billed ─────────────────────────────────────────────────
 *   • Upgrade (Basic → Pro) — immediate. `proration_behavior: 'always_invoice'`
 *     credits the unused Basic time and charges the Pro difference today, and
 *     `payment_behavior: 'error_if_incomplete'` means the change is only made if
 *     that invoice is actually paid. Only offered to customers who are paid up;
 *     a late customer has to settle their balance first.
 *
 *   • Downgrade (Pro → Basic) — at the end of the current billing period, via a
 *     subscription schedule. The customer keeps Pro for the time they paid for
 *     and nothing is charged or credited today.
 *
 * In both directions the metered overage item moves to the new plan's metered
 * price (Pro overage is cheaper than Basic), and add-on items stay on the
 * subscription — moved to the new interval if the billing cycle changes too.
 */

import type Stripe from 'stripe';
import { PLANS, type PlanConfig } from '../plans';
import { isMeteredItem, planKeyFor, type BillingInterval } from './billing-interval';

export type PlanChangeDirection = 'upgrade' | 'downgrade';

/** Higher rank = more expensive plan. Anything not listed can't be changed to. */
const PLAN_RANK: Record<string, number> = { basic: 1, pro: 2 };

/** Metadata tag on schedules we create, so we only ever manage our own. */
export const PLAN_CHANGE_SCHEDULE_KEY = 'keystone_plan_change';
export const PLAN_CHANGE_SCHEDULE_DOWNGRADE = 'downgrade';

/** How long a preview's proration timestamp stays valid for the confirm call. */
export const PRORATION_DATE_MAX_AGE_SECONDS = 15 * 60;

export interface PriceTarget {
  plan: PlanConfig;
  planKey: string;
  interval: BillingInterval;
  priceId: string;
}

/** Map a base-plan Stripe price ID (from /pricing) to its plan and interval. */
export function resolvePriceTarget(priceId: string | null | undefined): PriceTarget | null {
  if (!priceId) return null;
  for (const [planKey, plan] of Object.entries(PLANS)) {
    if (plan.stripe.monthly && plan.stripe.monthly === priceId) {
      return { plan, planKey, interval: 'month', priceId };
    }
    if (plan.stripe.yearly && plan.stripe.yearly === priceId) {
      return { plan, planKey, interval: 'year', priceId };
    }
  }
  return null;
}

export function planPriceId(plan: PlanConfig, interval: BillingInterval): string {
  return interval === 'year' ? plan.stripe.yearly : plan.stripe.monthly;
}

/**
 * Upgrade, downgrade, or null when the plan isn't changing (a same-plan cycle
 * switch belongs to the billing-cycle card in Settings, not here).
 */
export function resolvePlanChangeDirection(
  current: PlanConfig,
  target: PlanConfig,
): PlanChangeDirection | null {
  const currentRank = PLAN_RANK[planKeyFor(current) ?? ''];
  const targetRank = PLAN_RANK[planKeyFor(target) ?? ''];
  if (!currentRank || !targetRank || currentRank === targetRank) return null;
  return targetRank > currentRank ? 'upgrade' : 'downgrade';
}

/** Statuses that may upgrade now. Late customers settle their balance first. */
const UPGRADE_STATUSES = new Set(['active', 'trialing']);

/** Statuses that may schedule a downgrade: anything with a live subscription. */
const DOWNGRADE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid']);

export function canChangePlan(direction: PlanChangeDirection, status: string | null | undefined): boolean {
  if (!status) return false;
  return direction === 'upgrade' ? UPGRADE_STATUSES.has(status) : DOWNGRADE_STATUSES.has(status);
}

/**
 * Accept the proration timestamp a preview was priced at, so the customer is
 * charged exactly what they confirmed — but only if it's recent and not in the
 * future. Anything else falls back to "now".
 */
export function acceptProrationDate(value: unknown, nowSeconds: number): number {
  const n = typeof value === 'number' ? Math.floor(value) : Number.NaN;
  if (!Number.isFinite(n)) return nowSeconds;
  if (n > nowSeconds) return nowSeconds;
  if (nowSeconds - n > PRORATION_DATE_MAX_AGE_SECONDS) return nowSeconds;
  return n;
}

// ── Item payloads ───────────────────────────────────────────────────────────

/**
 * Items for the base plan and metered overage on the target plan, as a
 * `subscriptions.update` / invoice-preview `items` payload.
 *
 *   • the base plan item swaps to the target plan's price;
 *   • every metered item swaps to the target plan's metered price;
 *   • if there's no metered item yet (the webhook failed to attach one), the
 *     target plan's metered price is added.
 *
 * Add-on items aren't included — the caller adds those when the interval
 * changes, and leaves them untouched otherwise.
 */
export function buildPlanItemUpdates(
  subscription: Stripe.Subscription,
  planItem: Stripe.SubscriptionItem,
  target: PriceTarget,
): { items: Stripe.SubscriptionUpdateParams.Item[]; meteredMissing: boolean } {
  const items: Stripe.SubscriptionUpdateParams.Item[] = [
    { id: planItem.id, price: target.priceId, quantity: planItem.quantity ?? 1 },
  ];

  const targetMetered = target.plan.stripe.metered;
  const meteredItems = (subscription.items?.data ?? []).filter(
    (item) => item.id !== planItem.id && isMeteredItem(item),
  );

  // No metered price configured for the target plan: leave whatever's there
  // rather than strip overage billing entirely. The caller logs this.
  if (!targetMetered) {
    return { items, meteredMissing: true };
  }

  if (meteredItems.length === 0) {
    items.push({ price: targetMetered });
    return { items, meteredMissing: false };
  }

  for (const item of meteredItems) {
    if (item.price?.id === targetMetered) continue;
    // Metered prices don't take a quantity.
    items.push({ id: item.id, price: targetMetered });
  }

  return { items, meteredMissing: false };
}

/** A price ID off a subscription item or schedule phase item. */
function priceIdOf(price: string | { id: string } | null | undefined): string | null {
  if (!price) return null;
  return typeof price === 'string' ? price : price.id;
}

/**
 * Items for the downgrade phase of a subscription schedule: the target plan's
 * price, the target plan's metered price, and the add-ons at whatever price
 * `addonPriceFor` says (their current price, or the new-interval price when the
 * cycle is changing too).
 *
 * Phase items carry prices, not subscription item IDs, so this is rebuilt from
 * the live subscription rather than patched.
 */
export function buildDowngradePhaseItems(
  subscription: Stripe.Subscription,
  planItem: Stripe.SubscriptionItem,
  target: PriceTarget,
  addonPriceFor: (item: Stripe.SubscriptionItem) => string | null,
): Stripe.SubscriptionScheduleUpdateParams.Phase.Item[] {
  const phaseItems: Stripe.SubscriptionScheduleUpdateParams.Phase.Item[] = [
    { price: target.priceId, quantity: planItem.quantity ?? 1 },
  ];

  let meteredAdded = false;
  for (const item of subscription.items?.data ?? []) {
    if (item.id === planItem.id) continue;

    if (isMeteredItem(item)) {
      const metered = target.plan.stripe.metered || priceIdOf(item.price);
      if (metered && !meteredAdded) {
        phaseItems.push({ price: metered });
        meteredAdded = true;
      }
      continue;
    }

    const price = addonPriceFor(item) ?? priceIdOf(item.price);
    if (price) phaseItems.push({ price, quantity: item.quantity ?? 1 });
  }

  if (!meteredAdded && target.plan.stripe.metered) {
    phaseItems.push({ price: target.plan.stripe.metered });
  }

  return phaseItems;
}

/**
 * Rebuild a schedule phase as update params, unchanged. Updating a schedule
 * replaces its phases wholesale, so the current phase has to be sent back with
 * everything that matters on it (items, dates, discounts, tax) or it's lost.
 */
export function phaseToUpdateParams(
  phase: Stripe.SubscriptionSchedule.Phase,
): Stripe.SubscriptionScheduleUpdateParams.Phase {
  const items: Stripe.SubscriptionScheduleUpdateParams.Phase.Item[] = phase.items.map((item) => {
    const price = priceIdOf(item.price as string | { id: string });
    const out: Stripe.SubscriptionScheduleUpdateParams.Phase.Item = { price: price ?? undefined };
    if (typeof item.quantity === 'number') out.quantity = item.quantity;
    const discounts = discountsToParams(item.discounts);
    if (discounts.length) out.discounts = discounts;
    return out;
  });

  const params: Stripe.SubscriptionScheduleUpdateParams.Phase = {
    items,
    start_date: phase.start_date,
    end_date: phase.end_date,
  };

  const discounts = discountsToParams(phase.discounts);
  if (discounts.length) params.discounts = discounts;
  if (phase.automatic_tax?.enabled) params.automatic_tax = { enabled: true };
  if (phase.metadata && Object.keys(phase.metadata).length) params.metadata = phase.metadata;
  if (phase.default_payment_method) {
    params.default_payment_method = priceIdOf(phase.default_payment_method as string | { id: string }) ?? undefined;
  }

  return params;
}

type PhaseDiscountLike = {
  coupon?: string | { id: string } | null;
  discount?: string | { id: string } | null;
  promotion_code?: string | { id: string } | null;
};

function discountsToParams(
  discounts: ReadonlyArray<PhaseDiscountLike> | null | undefined,
): Array<{ coupon?: string; discount?: string; promotion_code?: string }> {
  return (discounts ?? [])
    .map((d) => {
      // An existing discount object carries its coupon/promo with it; pass the
      // discount itself so it isn't re-redeemed.
      const discount = priceIdOf(d.discount);
      if (discount) return { discount };
      const coupon = priceIdOf(d.coupon);
      if (coupon) return { coupon };
      const promotion = priceIdOf(d.promotion_code);
      if (promotion) return { promotion_code: promotion };
      return null;
    })
    .filter((d): d is { discount: string } | { coupon: string } | { promotion_code: string } => d !== null);
}

/** Is this schedule one of our scheduled downgrades? */
export function isKeystoneDowngradeSchedule(
  schedule: Pick<Stripe.SubscriptionSchedule, 'metadata'> | null | undefined,
): boolean {
  return schedule?.metadata?.[PLAN_CHANGE_SCHEDULE_KEY] === PLAN_CHANGE_SCHEDULE_DOWNGRADE;
}

/**
 * Has our scheduled downgrade already taken effect? Once the schedule is in its
 * last phase there's nothing left for it to do, and keeping it attached would
 * stop other changes (billing-cycle switches) being made to the subscription.
 */
export function downgradeScheduleHasTakenEffect(
  schedule: Pick<Stripe.SubscriptionSchedule, 'metadata' | 'phases' | 'current_phase' | 'status'>,
): boolean {
  if (!isKeystoneDowngradeSchedule(schedule)) return false;
  if (schedule.status !== 'active') return false;
  const last = schedule.phases[schedule.phases.length - 1];
  if (!last || !schedule.current_phase) return false;
  return schedule.current_phase.start_date >= last.start_date;
}
