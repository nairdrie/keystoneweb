import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { PLANS } from '@/lib/plans';

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, { apiVersion: '2026-02-25.clover' as any });
}

/**
 * POST /api/onboarding/launch/[token]/checkout
 *
 * Creates a Stripe checkout session for the launch-service client.
 *
 * Stripe Checkout in subscription mode only accepts recurring line items, so
 * one-time charges (launch service + optional domain) are pre-created as
 * invoice items on the Stripe customer. Stripe automatically attaches any
 * pending invoice items to the first invoice of the new subscription.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const db = createAdminClient();
  const { data: req, error } = await db
    .from('launch_requests')
    .select(
      'id, email, business_name, site_id, launch_config, launch_service_price_cents, onboarding_user_id, onboarding_status',
    )
    .eq('onboarding_token', token)
    .single();

  if (error || !req) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (req.onboarding_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!req.launch_config || !req.site_id) {
    return NextResponse.json({ error: 'Launch configuration is incomplete' }, { status: 400 });
  }

  const cfg = req.launch_config as {
    planTier?: 'basic' | 'pro';
    billingInterval?: 'monthly' | 'yearly';
    domain?: {
      mode?: string;
      domainName?: string;
      billToClient?: boolean;
    };
    billDomainCents?: number;
  };

  const planTier = cfg.planTier ?? (cfg.domain?.mode === 'subdomain' ? 'basic' : 'pro');
  const billingInterval = cfg.billingInterval ?? 'yearly';
  const plan = PLANS[planTier];
  if (!plan) return NextResponse.json({ error: 'Invalid plan tier' }, { status: 500 });
  const priceId = billingInterval === 'monthly' ? plan.stripe.monthly : plan.stripe.yearly;
  if (!priceId) return NextResponse.json({ error: 'Stripe plan price is not configured' }, { status: 500 });

  const launchServiceCents = req.launch_service_price_cents ?? 39900;
  const domainCents = cfg.domain?.billToClient ? (cfg.billDomainCents ?? 0) : 0;

  const stripe = getStripeClient();

  // Create a customer (or reuse existing one for this email).
  const customerSearch = await stripe.customers.list({ email: req.email, limit: 1 });
  const customer =
    customerSearch.data[0] ??
    (await stripe.customers.create({
      email: req.email,
      name: req.business_name ?? undefined,
      metadata: {
        launch_request_id: req.id,
        user_id: user.id,
      },
    }));

  // Pre-create one-time invoice items so they roll into the first subscription invoice.
  await stripe.invoiceItems.create({
    customer: customer.id,
    amount: launchServiceCents,
    currency: 'usd',
    description: 'Launch Service',
    metadata: { launch_request_id: req.id, type: 'launch_service_fee' },
  });

  if (domainCents > 0 && cfg.domain?.domainName) {
    await stripe.invoiceItems.create({
      customer: customer.id,
      amount: domainCents,
      currency: 'usd',
      description: `Custom domain: ${cfg.domain.domainName}`,
      metadata: { launch_request_id: req.id, type: 'launch_service_domain', domain: cfg.domain.domainName },
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://keystoneweb.ca';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    customer: customer.id,
    billing_address_collection: 'required',
    automatic_tax: { enabled: true },
    subscription_data: {
      billing_mode: { type: 'flexible' },
      metadata: {
        type: 'launch_service',
        launch_request_id: req.id,
        onboarding_token: token,
      },
    },
    success_url: `${baseUrl}/onboarding/launch/${token}?step=launching`,
    cancel_url: `${baseUrl}/onboarding/launch/${token}?step=payment&cancelled=1`,
    metadata: {
      type: 'launch_service',
      launch_request_id: req.id,
      onboarding_token: token,
      userId: user.id,
      planName: plan.name,
      siteId: req.site_id,
      siteName: req.business_name ?? '',
    },
  });

  await db
    .from('launch_requests')
    .update({
      stripe_checkout_session_id: session.id,
      onboarding_status: 'awaiting_payment',
    })
    .eq('id', req.id);

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
