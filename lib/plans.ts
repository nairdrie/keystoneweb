/**
 * Plan definitions: limits, pricing, and Stripe price IDs.
 *
 * Each plan has a single metered price for overage billing (monthly interval).
 * Basic: $0.001/unit, Pro: $0.0005/unit where 1 unit = 1 visitor.
 * This means 1,000 overage visitors = $1.00 (Basic) or $0.50 (Pro).
 *
 * The metered price is NOT included in the checkout session (Stripe doesn't
 * allow mixed billing intervals in Checkout). Instead, it's added to the
 * subscription after checkout via the webhook. This keeps overage billing
 * monthly regardless of whether the base plan is monthly or yearly.
 *
 * In Stripe Dashboard, create one metered price per product:
 *   - Usage-based, metered, per-unit, monthly interval
 *   - Aggregate usage: "Last value during period" (we use action: 'set')
 *   - Basic: $0.001/unit, Pro: $0.0005/unit
 */

export interface PlanConfig {
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;         // per month when billed yearly
  visitorLimit: number;        // monthly unique visitors included
  storageLimitMb: number;      // media storage in MB
  overagePerThousand: number;  // $ per 1,000 extra visitors
  publishLimit: number;        // max simultaneously published sites
  stripe: {
    monthly: string;
    yearly: string;
    metered: string;           // metered price ID for overage (always monthly interval)
  };
  features: string[];
}

export const PLANS: Record<string, PlanConfig> = {
  basic: {
    name: 'Basic',
    monthlyPrice: 25,
    yearlyPrice: 15,
    visitorLimit: 10_000,
    storageLimitMb: 1024,
    overagePerThousand: 1.0,
    publishLimit: 1,
    stripe: {
      monthly: 'price_1TH93Y9e8C5naDN4tlQtEYaM',
      yearly: 'price_1TCZSm9e8C5naDN4d8Zctb6D',
      metered: process.env.STRIPE_BASIC_METERED_PRICE || '',
    },
    features: [
      'Unlimited Site Pages',
      'AI Site Builder (Limited Use)',
      'Drag-and-Drop Visual Editor',
      'Access to all Premium Templates',
      'Up to 10,000 monthly visitors',
      '1 GB media storage',
      'Email Support',
      'Keystone Subdomain (yoursite.kswd.ca)',
    ],
  },
  pro: {
    name: 'Pro',
    monthlyPrice: 50,
    yearlyPrice: 30,
    visitorLimit: 50_000,
    storageLimitMb: 5120,
    overagePerThousand: 0.5,
    publishLimit: 5,
    stripe: {
      monthly: 'price_1TH92v9e8C5naDN4lr3kV5P3',
      yearly: 'price_1TCZRS9e8C5naDN4LtllOW7G',
      metered: process.env.STRIPE_PRO_METERED_PRICE || '',
    },
    features: [
      'Everything in Basic',
      'Increased AI Builder Limits',
      'Build & Publish up to 5 Sites*',
      'Custom Domain Support + Free Domain Included*',
      'Up to 50,000 monthly visitors',
      '5 GB media storage',
      '24/7 Priority Email Support',
      'Custom HTML Content & CSS',
    ],
  },
};

/**
 * Look up the plan config by plan name (case-insensitive partial match).
 */
export function getPlanByName(planName: string | null | undefined): PlanConfig | null {
  if (!planName) return null;
  const lower = planName.toLowerCase();
  if (lower.includes('pro')) return PLANS.pro;
  if (lower.includes('basic')) return PLANS.basic;
  return null;
}

/**
 * Calculate overage cost in dollars.
 */
export function calculateOverageCost(plan: PlanConfig, totalVisitors: number): number {
  const overage = Math.max(0, totalVisitors - plan.visitorLimit);
  if (overage === 0) return 0;
  return (overage / 1000) * plan.overagePerThousand;
}

/**
 * Format a number with commas (e.g. 10000 -> "10,000").
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}
