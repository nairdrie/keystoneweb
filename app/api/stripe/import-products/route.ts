import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any,
});

/**
 * POST /api/stripe/import-products
 *
 * Imports Stripe products and prices from the connected account as membership packages.
 * Matches on stripe_price_id to avoid duplicates — updates if exists, inserts if not.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId } = body;
    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    // Verify ownership and get stripe account
    const { data: site } = await supabase
      .from('sites')
      .select('stripe_account_id')
      .eq('id', siteId)
      .eq('user_id', user.id)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!site.stripe_account_id) {
      return NextResponse.json({ error: 'No Stripe account connected' }, { status: 400 });
    }

    const connectedAccountId = site.stripe_account_id;

    // Fetch existing packages for this site to match on stripe_price_id
    const { data: existingPackages } = await supabase
      .from('membership_packages')
      .select('id, stripe_price_id')
      .eq('site_id', siteId)
      .eq('is_archived', false);

    const existingByPriceId = new Map(
      (existingPackages || [])
        .filter(p => p.stripe_price_id)
        .map(p => [p.stripe_price_id as string, p.id as string])
    );

    // Fetch all active products from the connected account
    const products = await stripe.products.list(
      { active: true, limit: 100 },
      { stripeAccount: connectedAccountId }
    );

    let importedCount = 0;

    for (const product of products.data) {
      // Fetch all active prices for this product
      const prices = await stripe.prices.list(
        { product: product.id, active: true, limit: 100 },
        { stripeAccount: connectedAccountId }
      );

      for (const price of prices.data) {
        const isRecurring = price.recurring !== null && price.recurring !== undefined;
        const billingInterval = price.recurring?.interval ?? 'one_time';
        const priceCents = price.unit_amount ?? 0;
        const currency = (price.currency ?? 'usd').toUpperCase();
        const trialDays = price.recurring?.trial_period_days ?? 0;

        const packageData = {
          site_id: siteId,
          name: product.name,
          description: product.description || null,
          price_cents: priceCents,
          currency,
          billing_interval: isRecurring ? billingInterval : 'one_time',
          trial_days: trialDays,
          stripe_price_id: price.id,
          stripe_product_id: product.id,
          features: [],
          is_active: true,
          sort_order: 0,
          updated_at: new Date().toISOString(),
        };

        const existingId = existingByPriceId.get(price.id);

        if (existingId) {
          // Update existing package
          await supabase
            .from('membership_packages')
            .update(packageData)
            .eq('id', existingId);
        } else {
          // Insert new package
          await supabase
            .from('membership_packages')
            .insert(packageData);
        }

        importedCount++;
      }
    }

    return NextResponse.json({ imported: importedCount });
  } catch (error: any) {
    console.error('Stripe import-products error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
