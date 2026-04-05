/**
 * Plan add-on definitions, pricing, and effective-limit calculation.
 *
 * Add-ons are layered on top of the Pro plan to provide extra capacity
 * (sites, domains, storage, AI) or premium features (white-label).
 *
 * Stripe strategy: one shared Price per add-on type × interval (10 total).
 * If admin overrides pricing, a custom Stripe Price is created per-user.
 * Add-ons are attached as additional subscription items to the existing
 * Pro subscription — no new products needed per customer.
 */

import { getPlanByName, PLANS } from './plans';

// ── Add-on type catalogue ────────────────────────────────────────────────────

export type AddonType = 'extra_sites' | 'extra_domains' | 'extra_storage' | 'extra_ai' | 'white_label';

export const ADDON_TYPES: Record<AddonType, { label: string; unit: string; perUnit: number }> = {
  extra_sites:   { label: 'Extra Published Sites', unit: 'site',      perUnit: 1 },
  extra_domains: { label: 'Extra Custom Domains',  unit: 'domain',    perUnit: 1 },
  extra_storage: { label: 'Extra Storage',         unit: '5 GB block', perUnit: 5120 }, // MB
  extra_ai:      { label: 'Extra AI Prompts',      unit: 'tier',      perUnit: 1 },    // doubles limits per tier
  white_label:   { label: 'White-Label Branding',  unit: 'flat',      perUnit: 1 },
};

// ── Default pricing (admin can override per user) ────────────────────────────

export const ADDON_PRICES: Record<AddonType, { monthly: number; yearly: number }> = {
  extra_sites:   { monthly: 5, yearly: 3 },
  extra_domains: { monthly: 30, yearly: 18 },
  extra_storage: { monthly: 10, yearly: 6 },
  extra_ai:      { monthly: 10, yearly: 6 },
  white_label:   { monthly: 25, yearly: 15 },
};

// ── Stripe Price IDs (env vars) — shared prices for standard pricing ─────────

export const ADDON_STRIPE_PRICES: Record<AddonType, { monthly: string; yearly: string }> = {
  extra_sites:   { monthly: process.env.STRIPE_ADDON_SITES_MONTHLY   || '', yearly: process.env.STRIPE_ADDON_SITES_YEARLY   || '' },
  extra_domains: { monthly: process.env.STRIPE_ADDON_DOMAINS_MONTHLY || '', yearly: process.env.STRIPE_ADDON_DOMAINS_YEARLY || '' },
  extra_storage: { monthly: process.env.STRIPE_ADDON_STORAGE_MONTHLY || '', yearly: process.env.STRIPE_ADDON_STORAGE_YEARLY || '' },
  extra_ai:      { monthly: process.env.STRIPE_ADDON_AI_MONTHLY      || '', yearly: process.env.STRIPE_ADDON_AI_YEARLY      || '' },
  white_label:   { monthly: process.env.STRIPE_ADDON_WHITELABEL_MONTHLY || '', yearly: process.env.STRIPE_ADDON_WHITELABEL_YEARLY || '' },
};

// ── DB row shape (matches user_addons table) ─────────────────────────────────

export interface UserAddon {
  id: string;
  user_id: string;
  addon_type: AddonType;
  quantity: number;
  status: 'approved' | 'active' | 'cancelled';
  monthly_price: number;
  yearly_price: number;
  stripe_price_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  activated_at: string | null;
  cancelled_at: string | null;
  stripe_item_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Effective limits ─────────────────────────────────────────────────────────

export interface EffectiveLimits {
  publishLimit: number;
  customDomainLimit: number;
  storageLimitMb: number;
  aiMultiplier: number;
  whiteLabel: boolean;
}

/**
 * Calculate effective limits by combining plan defaults + active add-ons.
 * This is the single source of truth used by all enforcement points.
 */
export async function getUserEffectiveLimits(
  userId: string,
  supabase: any,
): Promise<EffectiveLimits> {
  // 1. Get plan config from subscription
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('subscription_plan, storage_limit_mb')
    .eq('user_id', userId)
    .single();

  const plan = getPlanByName(sub?.subscription_plan);
  const planPublishLimit = plan?.publishLimit ?? 1;
  const planStorageMb = plan?.storageLimitMb ?? sub?.storage_limit_mb ?? PLANS.basic.storageLimitMb;

  // 2. Get active add-ons
  const { data: addons } = await supabase
    .from('user_addons')
    .select('addon_type, quantity')
    .eq('user_id', userId)
    .eq('status', 'active');

  const addonMap = new Map<string, number>();
  if (addons) {
    for (const a of addons) {
      addonMap.set(a.addon_type, a.quantity);
    }
  }

  // 3. Merge
  return {
    publishLimit:     planPublishLimit + (addonMap.get('extra_sites') ?? 0),
    customDomainLimit: 1 + (addonMap.get('extra_domains') ?? 0),
    storageLimitMb:   planStorageMb + (addonMap.get('extra_storage') ?? 0) * ADDON_TYPES.extra_storage.perUnit,
    aiMultiplier:     1 + (addonMap.get('extra_ai') ?? 0),
    whiteLabel:       (addonMap.get('white_label') ?? 0) > 0,
  };
}
