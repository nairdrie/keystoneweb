import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { ADDON_STRIPE_PRICES, ADDON_PRICES, type AddonType } from '@/lib/addons';
import Stripe from 'stripe';

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover' as any,
  });
};

/**
 * POST /api/stripe/addons/activate
 * Accept & pay for an approved add-on.
 * Adds a new subscription item to the user's existing Pro subscription.
 *
 * Body: { addonId: uuid }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { addonId } = body;

  if (!addonId) {
    return NextResponse.json({ error: 'Missing addonId' }, { status: 400 });
  }

  const db = createAdminClient();

  // 1. Fetch the add-on and verify ownership + status
  const { data: addon, error: addonErr } = await db
    .from('user_addons')
    .select('*')
    .eq('id', addonId)
    .eq('user_id', user.id)
    .eq('status', 'approved')
    .single();

  if (addonErr || !addon) {
    return NextResponse.json({ error: 'Add-on not found or not in approved state' }, { status: 404 });
  }

  // 2. Get user's Stripe subscription
  const { data: sub } = await db
    .from('user_subscriptions')
    .select('stripe_subscription_id, stripe_customer_id, subscription_status')
    .eq('user_id', user.id)
    .single();

  if (!sub?.stripe_subscription_id || sub.subscription_status !== 'active') {
    return NextResponse.json({ error: 'Active Pro subscription required' }, { status: 402 });
  }

  const stripe = getStripeClient();

  // 3. Determine billing interval from current subscription
  const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const baseItem = stripeSubscription.items.data[0];
  const isYearly = baseItem?.price?.recurring?.interval === 'year';

  // 4. Pick the correct Stripe price
  const addonType = addon.addon_type as AddonType;
  const interval = isYearly ? 'yearly' : 'monthly';

  // Use custom price if admin set one, otherwise use shared price
  let priceId = addon.stripe_price_id;

  if (!priceId) {
    const defaultPrice = ADDON_STRIPE_PRICES[addonType]?.[interval];
    const addonDefaultPricing = ADDON_PRICES[addonType];

    // Check if admin overrode pricing — if so, create a custom Stripe Price
    const expectedPrice = isYearly ? addonDefaultPricing.yearly : addonDefaultPricing.monthly;
    const actualPrice = isYearly ? addon.yearly_price : addon.monthly_price;

    if (actualPrice !== expectedPrice || !defaultPrice) {
      // Create a custom Stripe Price for this user's add-on
      const product = baseItem?.price?.product as string;
      const customPrice = await stripe.prices.create({
        product,
        unit_amount: Math.round(actualPrice * 100),
        currency: 'cad',
        recurring: {
          interval: isYearly ? 'year' : 'month',
        },
        nickname: `Custom ${addonType} for ${user.email}`,
      });
      priceId = customPrice.id;

      // Store custom price ID for future reference
      await db
        .from('user_addons')
        .update({ stripe_price_id: priceId })
        .eq('id', addonId);
    } else {
      priceId = defaultPrice;
    }
  }

  if (!priceId) {
    return NextResponse.json({ error: 'Stripe price not configured for this add-on' }, { status: 500 });
  }

  // 5. Add subscription item to existing subscription
  try {
    const subscriptionItem = await stripe.subscriptionItems.create({
      subscription: sub.stripe_subscription_id,
      price: priceId,
      quantity: addon.quantity,
      proration_behavior: 'create_prorations',
    });

    // 6. Update add-on status to active
    await db
      .from('user_addons')
      .update({
        status: 'active',
        activated_at: new Date().toISOString(),
        stripe_item_id: subscriptionItem.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', addonId);

    return NextResponse.json({ success: true, subscriptionItemId: subscriptionItem.id });
  } catch (stripeErr: any) {
    console.error('Failed to add subscription item:', stripeErr);
    return NextResponse.json(
      { error: stripeErr.message || 'Failed to add add-on to subscription' },
      { status: 500 }
    );
  }
}
