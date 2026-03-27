/**
 * Plan definitions: limits, pricing, and Stripe price IDs.
 *
 * Metered prices are usage-based prices attached alongside the base recurring
 * price on each Stripe subscription. They track overage visitors.
 */

export interface PlanConfig {
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;         // per month when billed yearly
  visitorLimit: number;        // monthly unique visitors included
  storageLimitMb: number;      // media storage in MB
  overagePerThousand: number;  // $ per 1,000 extra visitors
  stripe: {
    monthly: string;
    yearly: string;
    meteredMonthly: string;    // metered price ID for overage (monthly sub)
    meteredYearly: string;     // metered price ID for overage (yearly sub)
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
    stripe: {
      monthly: 'price_1TCZSU9e8C5naDN47tc8rB74',
      yearly: 'price_1TCZSm9e8C5naDN4d8Zctb6D',
      // TODO: Replace with real Stripe metered price IDs after creating them in dashboard
      meteredMonthly: process.env.STRIPE_BASIC_METERED_MONTHLY || '',
      meteredYearly: process.env.STRIPE_BASIC_METERED_YEARLY || '',
    },
    features: [
      'Unlimited Site Pages',
      'Access to all Premium Templates',
      'Drag-and-Drop Visual Editor',
      'AI Builder (3 prompts/day)',
      'Up to 10,000 monthly visitors',
      '1 GB media storage',
      'Email Support',
    ],
  },
  pro: {
    name: 'Pro',
    monthlyPrice: 60,
    yearlyPrice: 30,
    visitorLimit: 50_000,
    storageLimitMb: 5120,
    overagePerThousand: 0.5,
    stripe: {
      monthly: 'price_1TCZRk9e8C5naDN44O78PCfh',
      yearly: 'price_1TCZRS9e8C5naDN4LtllOW7G',
      meteredMonthly: process.env.STRIPE_PRO_METERED_MONTHLY || '',
      meteredYearly: process.env.STRIPE_PRO_METERED_YEARLY || '',
    },
    features: [
      'Everything in Basic',
      'Increased AI Builder Limits',
      'Unlimited Sites',
      'Free Custom Domain Included',
      'Up to 50,000 monthly visitors',
      '5 GB media storage',
      '24/7 Priority Email Support',
      'Advanced Analytics',
      'Custom CSS Injection',
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
