/**
 * Moving add-on subscription items to a new billing interval.
 *
 * Shared by the billing-cycle switch (app/api/stripe/billing-interval) and plan
 * changes (app/api/stripe/plan-change): whenever the base plan changes interval
 * the add-ons have to follow, or the customer pays monthly add-on rates on a
 * yearly plan.
 */

import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { intervalOfItem, isMeteredItem, resolveAddonTargetPrice, type BillingInterval } from './billing-interval';

export interface ActiveAddon {
  id: string;
  addon_type: string;
  quantity: number;
  monthly_price: number;
  yearly_price: number;
  stripe_item_id: string;
}

/** The user's active add-ons that are actually items on this subscription. */
export async function loadActiveAddons(
  db: SupabaseClient,
  userId: string,
  subscription: Stripe.Subscription,
): Promise<ActiveAddon[]> {
  const { data: addonRows } = await db
    .from('user_addons')
    .select('id, addon_type, quantity, monthly_price, yearly_price, stripe_item_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .not('stripe_item_id', 'is', null);

  const subscriptionItemIds = new Set((subscription.items?.data ?? []).map((item) => item.id));
  return (addonRows ?? [])
    .filter((row) => row.stripe_item_id && subscriptionItemIds.has(row.stripe_item_id))
    .map((row) => ({
      id: row.id,
      addon_type: row.addon_type,
      quantity: row.quantity,
      monthly_price: Number(row.monthly_price),
      yearly_price: Number(row.yearly_price),
      stripe_item_id: row.stripe_item_id as string,
    }));
}

export interface AddonIntervalUpdates {
  /** `subscriptions.update` items for the add-ons that need moving. */
  items: Stripe.SubscriptionUpdateParams.Item[];
  /** Per-user prices minted in `'apply'` mode, to remember on the add-on rows. */
  addonPriceUpdates: Array<{ addonId: string; priceId: string }>;
  skippedAddons: number;
}

/**
 * Build the item updates that move add-ons to `interval`.
 *
 * Add-ons whose price an admin overrode need a per-user Stripe Price at the new
 * interval. In `'apply'` mode we mint one and remember it; in `'preview'` mode we
 * describe the same amount inline with `price_data` instead, so a preview never
 * leaves stray Price objects behind yet still totals up to exactly what the
 * customer will be charged.
 *
 * `productId` is the product custom prices are created under.
 */
export async function buildAddonIntervalUpdates(params: {
  stripe: Stripe;
  subscription: Stripe.Subscription;
  addons: ActiveAddon[];
  productId: string | null;
  interval: BillingInterval;
  mode: 'preview' | 'apply';
}): Promise<AddonIntervalUpdates> {
  const { stripe, subscription, addons, productId, interval, mode } = params;
  const items: Stripe.SubscriptionUpdateParams.Item[] = [];
  const addonPriceUpdates: Array<{ addonId: string; priceId: string }> = [];
  let skippedAddons = 0;

  for (const addon of addons) {
    const item = subscription.items.data.find((i) => i.id === addon.stripe_item_id);
    if (!item || isMeteredItem(item)) continue;
    if (intervalOfItem(item) === interval) continue; // already on the target cycle

    const target = resolveAddonTargetPrice(addon, interval);
    if (!target) {
      skippedAddons += 1;
      continue;
    }

    if (!target.needsCustomPrice && target.priceId) {
      items.push({ id: addon.stripe_item_id, price: target.priceId, quantity: addon.quantity });
      continue;
    }

    if (!productId) {
      skippedAddons += 1;
      continue;
    }

    if (mode === 'preview') {
      items.push({
        id: addon.stripe_item_id,
        quantity: addon.quantity,
        price_data: {
          currency: 'cad',
          product: productId,
          recurring: { interval },
          unit_amount: target.unitAmountCents,
        },
      });
      continue;
    }

    const customPrice = await stripe.prices.create({
      product: productId,
      unit_amount: target.unitAmountCents,
      currency: 'cad',
      recurring: { interval },
      nickname: `Custom ${addon.addon_type} (${interval === 'year' ? 'yearly' : 'monthly'})`,
    });
    addonPriceUpdates.push({ addonId: addon.id, priceId: customPrice.id });
    items.push({ id: addon.stripe_item_id, price: customPrice.id, quantity: addon.quantity });
  }

  return { items, addonPriceUpdates, skippedAddons };
}

/** Remember minted per-user add-on prices so a later switch reuses them. */
export async function saveAddonPriceUpdates(
  db: SupabaseClient,
  updates: Array<{ addonId: string; priceId: string }>,
): Promise<void> {
  for (const { addonId, priceId } of updates) {
    await db
      .from('user_addons')
      .update({ stripe_price_id: priceId, updated_at: new Date().toISOString() })
      .eq('id', addonId);
  }
}
