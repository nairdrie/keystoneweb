import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { calculateDomainPrice, priceToCents } from '@/lib/domains/pricing';
import Stripe from 'stripe';

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_API_BASE = 'https://api.vercel.com';

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

interface CheckoutRequest {
  siteId: string;
  domain: string;
}

/**
 * POST /api/domains/checkout
 *
 * For paid domain purchases (user already used their free Pro domain).
 * Creates a Stripe Checkout Session for a one-time domain payment.
 * On payment success, the webhook triggers the actual Vercel purchase.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Pro plan
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('subscription_status, subscription_plan, stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    const isPro = subscription?.subscription_status === 'active' &&
      subscription?.subscription_plan?.toLowerCase().includes('pro');

    if (!isPro) {
      return NextResponse.json(
        { error: 'Pro plan required for custom domains' },
        { status: 403 }
      );
    }

    const body: CheckoutRequest = await request.json();
    const { siteId, domain } = body;

    if (!siteId || !domain) {
      return NextResponse.json(
        { error: 'Missing required fields: siteId, domain' },
        { status: 400 }
      );
    }

    // Verify site ownership
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, user_id')
      .eq('id', siteId)
      .single();

    if (siteError || !site || site.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Site not found or access denied' },
        { status: 404 }
      );
    }

    if (!VERCEL_API_TOKEN) {
      return NextResponse.json(
        { error: 'Domain purchasing is not configured. Contact support.' },
        { status: 503 }
      );
    }

    // Get current Vercel price
    const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
    const priceRes = await fetch(
      `${VERCEL_API_BASE}/v1/registrar/domains/${encodeURIComponent(domain)}/price${teamParam}`,
      {
        headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` },
      }
    );

    if (!priceRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch domain price. Please try again.' },
        { status: 502 }
      );
    }

    const priceData = await priceRes.json();
    const vercelPrice = typeof priceData.purchasePrice === 'string'
      ? parseFloat(priceData.purchasePrice)
      : priceData.purchasePrice;

    if (isNaN(vercelPrice) || vercelPrice <= 0) {
      return NextResponse.json(
        { error: 'Unable to determine domain price. Contact support.' },
        { status: 502 }
      );
    }

    const keystonePrice = calculateDomainPrice(vercelPrice);
    const amountCents = priceToCents(keystonePrice);

    // Create a pending domain_purchase record
    const { data: purchase, error: insertError } = await supabase
      .from('domain_purchases')
      .insert({
        user_id: user.id,
        site_id: siteId,
        domain,
        amount_cents: amountCents,
        is_free_with_pro: false,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError || !purchase) {
      console.error('Failed to create domain_purchase record:', insertError);
      return NextResponse.json(
        { error: 'Failed to initiate domain purchase' },
        { status: 500 }
      );
    }

    // Create Stripe Checkout Session for one-time payment
    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Domain: ${domain}`,
              description: `1-year registration for ${domain}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer: subscription?.stripe_customer_id || undefined,
      customer_email: !subscription?.stripe_customer_id ? (user.email ?? undefined) : undefined,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/publish/domain-select?siteId=${siteId}&session_id={CHECKOUT_SESSION_ID}&domain_purchased=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/publish/domain-select?siteId=${siteId}&session_id=${request.nextUrl.searchParams.get('session_id') || ''}&domain_canceled=true`,
      metadata: {
        type: 'domain_purchase',
        domainPurchaseId: purchase.id,
        domain,
        siteId,
        userId: user.id,
        vercelPrice: vercelPrice.toString(),
      },
    });

    // Store Stripe session ID on the purchase record
    await supabase
      .from('domain_purchases')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', purchase.id);

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Error creating domain checkout:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
