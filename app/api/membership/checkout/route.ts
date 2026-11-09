import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import Stripe from 'stripe';
import { getCurrentMemberFromRequest } from '@/lib/membership/current-member';
import { isCheckoutAuthorized, sameHostUrl } from '@/lib/membership/checkout-auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any,
});

/**
 * POST /api/membership/checkout
 * Creates a Stripe Checkout Session for membership subscription.
 * Uses direct charges on the connected account (site owner is merchant).
 *
 * Only for the member being charged: with the checkoutToken that signup returned
 * for this member + package, or while signed in as that member. Stripe only
 * redirects back to the site that asked.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteId, memberId, packageId, checkoutToken } = body;

    if (!siteId || !memberId || !packageId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const successUrl = sameHostUrl(body.successUrl, host);
    const cancelUrl = sameHostUrl(body.cancelUrl, host);
    if (!successUrl || !cancelUrl) {
      return NextResponse.json({ error: 'Return URLs must be on this site' }, { status: 400 });
    }

    const session = await getCurrentMemberFromRequest(request, siteId);
    const authorized = await isCheckoutAuthorized({
      siteId,
      memberId,
      packageId,
      checkoutToken: typeof checkoutToken === 'string' ? checkoutToken : null,
      sessionMemberId: session?.memberId ?? null,
    });
    if (!authorized) {
      return NextResponse.json({ error: 'Please sign in to pay for your membership' }, { status: 401 });
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
      .eq('is_archived', false)
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

    // Check if the site has tax enabled (uses ecommerce_settings)
    const { data: ecomSettings } = await supabase
      .from('ecommerce_settings')
      .select('tax_enabled')
      .eq('site_id', siteId)
      .single();

    const taxEnabled = ecomSettings?.tax_enabled === true;

    // Determine mode
    const isRecurring = pkg.billing_interval === 'month' || pkg.billing_interval === 'year';
    const mode = isRecurring ? 'subscription' : 'payment';

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: pkg.stripe_price_id, quantity: 1 }],
      mode: mode as any,
      ...(taxEnabled && { automatic_tax: { enabled: true } }),
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        memberId: member.id,
        siteId,
        packageId: pkg.id,
        type: 'membership',
      },
    };

    if (isRecurring) {
      sessionParams.subscription_data = {
        // Lets the webhook find the member for subscription events directly.
        metadata: { memberId: member.id, siteId, packageId: pkg.id, type: 'membership' },
        ...(pkg.trial_days > 0 ? { trial_period_days: pkg.trial_days } : {}),
      };
    }

    const checkout = await stripe.checkout.sessions.create(sessionParams, {
      stripeAccount: site.stripe_account_id,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error: any) {
    console.error('Membership checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
