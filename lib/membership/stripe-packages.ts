/**
 * Stripe objects for paid membership packages, created on the site's
 * connected Stripe account (the merchant). Shared by Admin → Users → Packages
 * and the MCP upsert_membership_packages tool.
 */

export type BillingInterval = 'month' | 'year' | 'one_time' | 'free';
export const BILLING_INTERVALS: BillingInterval[] = ['month', 'year', 'one_time', 'free'];

export function isPaidPackage(priceCents: number | null | undefined, interval: string | null | undefined): boolean {
  return (Number(priceCents) || 0) > 0 && interval !== 'free';
}

export class StripePackageError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Create the Stripe Product + Price for a paid package. Throws StripePackageError. */
export async function createStripePackagePrice(input: {
  stripeAccountId: string | null | undefined;
  name: string;
  description?: string | null;
  priceCents: number;
  currency?: string | null;
  billingInterval: string;
}): Promise<{ stripeProductId: string; stripePriceId: string }> {
  if (!input.stripeAccountId) {
    throw new StripePackageError('Please connect your Stripe account before creating paid packages');
  }
  if (!process.env.STRIPE_SECRET_KEY) throw new StripePackageError('Stripe is not configured', 500);
  try {
    const Stripe = (await import('stripe')).default;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pinned API version string
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' as any });
    const product = await stripe.products.create(
      { name: input.name, description: input.description || undefined },
      { stripeAccount: input.stripeAccountId },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe.PriceCreateParams
    const priceData: any = {
      product: product.id,
      unit_amount: input.priceCents,
      currency: (input.currency || 'CAD').toLowerCase(),
    };
    if (input.billingInterval === 'month' || input.billingInterval === 'year') {
      priceData.recurring = { interval: input.billingInterval };
    }
    const price = await stripe.prices.create(priceData, { stripeAccount: input.stripeAccountId });
    return { stripeProductId: product.id, stripePriceId: price.id };
  } catch (e) {
    console.error('Stripe product/price creation error:', e);
    throw new StripePackageError(`Stripe error: ${(e as Error).message}`, 500);
  }
}
