import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any,
});

/**
 * POST /api/membership/checkout
 * Creates a Stripe Checkout Session for membership subscription.
 * Uses direct charges on the connected account (site owner is merchant).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteId, memberId, packageId, successUrl, cancelUrl } = body;

    if (!siteId || !memberId || !packageId || !successUrl || !cancelUrl) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch site's Stripe account
    const { data: site } = await supabase
      .from('sites')
      .select('stripe_account_id')
      .eq('id', siteId)
      .single();

    if (!site?.stripe_account_id) {
      return NextResponse.json({
        error: 'This site has not connected a Stripe account yet',
      }, { status: 400 });
    }

    // Fetch member
    const { data: member } = await supabase
      .from('members')
      .select('id, email, name, stripe_customer_id')
      .eq('id', memberId)
      .eq('site_id', siteId)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Fetch package
    const { data: pkg } = await supabase
      .from('membership_packages')
      .select('id, name, stripe_price_id, billing_interval, trial_days')
      .eq('id', packageId)
      .eq('site_id', siteId)
      .eq('is_active', true)
      .single();

    if (!pkg || !pkg.stripe_price_id) {
      return NextResponse.json({ error: 'Package not found or has no price' }, { status: 404 });
    }

    // Create or reuse Stripe customer on the connected account
    let stripeCustomerId = member.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create(
        {
          email: member.email,
          name: member.name || undefined,
          metadata: { memberId: member.id, siteId },
        },
        { stripeAccount: site.stripe_account_id }
      );
      stripeCustomerId = customer.id;

      await supabase
        .from('members')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', member.id);
    }

    // Determine mode
    const isRecurring = pkg.billing_interval === 'month' || pkg.billing_interval === 'year';
    const mode = isRecurring ? 'subscription' : 'payment';

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: pkg.stripe_price_id, quantity: 1 }],
      mode: mode as any,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        memberId: member.id,
        siteId,
        packageId: pkg.id,
        type: 'membership',
      },
    };

    if (isRecurring && pkg.trial_days > 0) {
      sessionParams.subscription_data = {
        trial_period_days: pkg.trial_days,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams, {
      stripeAccount: site.stripe_account_id,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Membership checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
