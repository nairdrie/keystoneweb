/**
 * Marketing Pricing
 *
 * Customers pay Google's ad spend plus a fixed Keystone markup. The customer
 * sees one bundled number everywhere; the markup is internal accounting.
 */

export const MARKETING_MARKUP_RATE = 0.05; // 5% on top of raw ad spend

/** Apply markup to a raw ad-spend amount (in cents). Returns the customer-facing total. */
export function applyMarkup(rawAdSpendCents: number): number {
  if (rawAdSpendCents <= 0) return 0;
  return Math.round(rawAdSpendCents * (1 + MARKETING_MARKUP_RATE));
}

/** Calculate the markup portion only. */
export function calcMarkup(rawAdSpendCents: number): number {
  if (rawAdSpendCents <= 0) return 0;
  return applyMarkup(rawAdSpendCents) - rawAdSpendCents;
}

/**
 * Project the bundled daily wallet burn from a raw daily budget the customer
 * sets. The customer enters a daily-budget number that already includes the
 * markup; we round-trip to derive what we pass to Google.
 */
export function projectedDailyBurnCents(customerDailyBudgetCents: number): number {
  return Math.max(0, customerDailyBudgetCents);
}

/** Convert a customer-facing budget (bundled) to the raw ad-spend cap to send to Google. */
export function bundledToRawAdSpend(bundledCents: number): number {
  if (bundledCents <= 0) return 0;
  return Math.round(bundledCents / (1 + MARKETING_MARKUP_RATE));
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
