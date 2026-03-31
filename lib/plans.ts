/**
 * Plan definitions: limits, pricing, and Stripe price IDs.
 *
 * Each plan has a single metered price for overage billing. The metered price
 * is set to $0.001/unit (Basic) or $0.0005/unit (Pro) where 1 unit = 1 visitor.
 * This means 1,000 overage visitors = $1.00 (Basic) or $0.50 (Pro).
 *
 * In Stripe Dashboard, create one metered price per product:
 *   - Usage-based, metered, per-unit
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
    metered: string;           // single metered price ID for overage (works for both billing intervals)
  };
  features: string[];
}

export const PLANS: Record<string, PlanConfig> = {
  basic: {
    name: 'Basic',
    monthlyPrice: 30,
    yearlyPrice: 15,
    visitorLimit: 10_000,
    storageLimitMb: 1024,
    overagePerThousand: 1.0,
    publishLimit: 1,
    stripe: {
      monthly: 'price_1TCZSU9e8C5naDN47tc8rB74',
      yearly: 'price_1TCZSm9e8C5naDN4d8Zctb6D',
      // Create in Stripe Dashboard: Usage-based, $0.001/unit, metered, "last value during period"
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
    monthlyPrice: 60,
    yearlyPrice: 30,
    visitorLimit: 50_000,
    storageLimitMb: 5120,
    overagePerThousand: 0.5,
    publishLimit: 5,
    stripe: {
      monthly: 'price_1TCZRk9e8C5naDN44O78PCfh',
      yearly: 'price_1TCZRS9e8C5naDN4LtllOW7G',
      // Create in Stripe Dashboard: Usage-based, $0.0005/unit, metered, "last value during period"
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
