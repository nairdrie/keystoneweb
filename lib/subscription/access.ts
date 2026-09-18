/**
 * Subscription access helpers.
 *
 * A failed payment puts a subscription into Stripe's `past_due` state while it
 * retries the card (Smart Retries, ~2-3 weeks). During that grace window we keep
 * the customer on their paid plan — they only lose access when the subscription
 * is fully `canceled` (or never existed → `inactive`). Centralizing the check
 * here keeps "grace = keep what you have" consistent across every gate.
 *
 * NOTE: this is deliberately about *keeping* access, not *acquiring* more.
 * Domain purchases/transfers and add-on activation stay gated on a strictly
 * `active` subscription at their own call sites.
 */

export type SubscriptionLike = {
  subscription_status?: string | null;
  subscription_plan?: string | null;
} | null | undefined;

/** Statuses that retain paid access (active subscription, or in the dunning grace window). */
export const PAID_STATUSES = new Set(['active', 'past_due']);

/**
 * Statuses where a Stripe subscription still exists on the customer.
 *
 * Wider than PAID_STATUSES: this is the "don't create a second subscription"
 * check. Anything in here must be *updated* (plan change, billing-cycle change)
 * rather than put through a fresh Checkout, or the customer ends up with two
 * subscriptions billing the same account.
 */
export const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid']);

/** Does this status mean there's still a Stripe subscription to update? */
export function hasLiveSubscription(status: string | null | undefined): boolean {
  return !!status && LIVE_STATUSES.has(status);
}

/** Does this subscription currently grant paid access (active or in grace)? */
export function hasPaidAccess(sub: SubscriptionLike): boolean {
  return !!sub?.subscription_status && PAID_STATUSES.has(sub.subscription_status);
}

/** Status-string form, for call sites that only have the raw status. */
export function statusHasPaidAccess(status: string | null | undefined): boolean {
  return !!status && PAID_STATUSES.has(status);
}

/** Is this owner entitled to Pro features (paid access + a Pro plan)? */
export function isProEntitled(sub: SubscriptionLike): boolean {
  return hasPaidAccess(sub) && !!sub?.subscription_plan?.toLowerCase().includes('pro');
}
