/**
 * Calculate Keystone's selling price for a domain.
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
 * Convert dollar price to cents for Stripe.
 */
export function priceToCents(price: number): number {
  return Math.round(price * 100);
}
