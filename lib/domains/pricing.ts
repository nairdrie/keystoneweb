/**
 * Maximum wholesale price (USD) Keystone will absorb for a free Pro domain.
 * Applies to both new registrations and transfers.
 */
export const FREE_DOMAIN_MAX_USD = 20;

/**
 * Calculate Keystone's selling price for a domain registration/transfer.
 * Takes Vercel's wholesale price, adds 10%, rounds up to the next .99.
 *
 * Examples:
 *   $12.00 → $12 * 1.1 = $13.20 → ceil = $14 → $13.99
 *   $8.50  → $8.5 * 1.1 = $9.35 → ceil = $10 → $9.99
 *   $20.00 → $20 * 1.1 = $22.00 → ceil = $22 → $21.99
 */
export function calculateDomainPrice(vercelPrice: number): number {
  const withMarkup = vercelPrice * 1.1;
  const ceiledDollar = Math.ceil(withMarkup);
  return ceiledDollar - 0.01;
}

/**
 * Calculate the one-time fee for switching a custom domain (Pro plan).
 * Uses a flat $5 markup over Vercel's wholesale price, rounded to the next .99.
 *
 * This applies when a Pro user changes their custom domain to a new one.
 * They pay the one-time registration cost (not an ongoing subscription).
 *
 * Examples:
 *   Vercel $12.00 → $12 + $5 = $17 → $16.99
 *   Vercel $8.50  → $8.50 + $5 = $13.50 → ceil = $14 → $13.99
 *   Vercel $7.00  → $7 + $5 = $12 → $11.99
 */
export function calculateDomainSwitchPrice(vercelPrice: number): number {
  const withMarkup = vercelPrice + 5;
  const ceiledDollar = Math.ceil(withMarkup);
  return ceiledDollar - 0.01;
}

/**
 * Convert dollar price to cents for Stripe.
 */
export function priceToCents(price: number): number {
  return Math.round(price * 100);
}
