import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import Stripe from 'stripe';

// Initialize Stripe only when API key is available
const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

interface CheckoutRequest {
  siteId?: string;
  priceId: string; // Stripe Price ID for the selected plan
  planName: string; // e.g., 'Basic', 'Pro'
}

/**
 * POST /api/stripe/checkout-session
 * Create a Stripe checkout session for site publishing
 * 
 * User must be authenticated and own the site
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CheckoutRequest = await request.json();
    const { siteId, priceId, planName } = body;

    if (!priceId || !planName) {
      return NextResponse.json(
        { error: 'Missing required fields: priceId, planName' },
        { status: 400 }
      );
    }

    let siteName = 'My Website';

    // Verify user owns this site if it was provided
    if (siteId) {
      const { data: site, error: siteError } = await supabase
        .from('sites')
        .select('id, user_id, site_slug')
        .eq('id', siteId)
        .single();

      if (siteError || !site) {
        return NextResponse.json(
          { error: 'Site not found' },
          { status: 404 }
        );
      }

      if (site.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden: You do not own this site' },
          { status: 403 }
        );
      }
      siteName = site.site_slug || 'My Website';
    }

    // Create Stripe checkout session
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      allow_promotion_codes: true,
      success_url: siteId
        ? `${process.env.NEXT_PUBLIC_APP_URL}/publish/domain-select?session_id={CHECKOUT_SESSION_ID}&siteId=${siteId}`
        : `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: siteId
        ? `${process.env.NEXT_PUBLIC_APP_URL}/pricing?action=publish&siteId=${siteId}&canceled=true`
        : `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      customer_email: user.email,
      metadata: {
        ...(siteId ? { siteId } : {}),
        userId: user.id,
        planName,
        siteName,
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      clientSecret: session.client_secret,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
