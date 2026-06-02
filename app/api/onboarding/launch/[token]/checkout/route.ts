import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { PLANS } from '@/lib/plans';
import { checkExternalDomainDns } from '@/lib/domains/dns-check';

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
 * Stripe Checkout subscription mode allows mixing the recurring plan price
 * with additional one-time line items (launch service + optional domain),
 * so they appear in the hosted checkout UI and are charged on the first
 * invoice alongside the subscription.
 *
 * Body (optional): { billingInterval?: 'monthly' | 'yearly' }
 *  - Overrides the operator-set interval so the client can flip from
 *    yearly (default) to monthly at checkout time.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
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
      externalVerified?: boolean;
    };
    billDomainCents?: number;
  };

  let bodyInterval: 'monthly' | 'yearly' | undefined;
  try {
    const body = await request.json();
    if (body?.billingInterval === 'monthly' || body?.billingInterval === 'yearly') {
      bodyInterval = body.billingInterval;
    }
  } catch {
    // No body — fall back to config.
  }

  const planTier = cfg.planTier ?? (cfg.domain?.mode === 'subdomain' ? 'basic' : 'pro');
  const billingInterval = bodyInterval ?? cfg.billingInterval ?? 'yearly';
  const plan = PLANS[planTier];
  if (!plan) return NextResponse.json({ error: 'Invalid plan tier' }, { status: 500 });
  const priceId = billingInterval === 'monthly' ? plan.stripe.monthly : plan.stripe.yearly;
  if (!priceId) return NextResponse.json({ error: 'Stripe plan price is not configured' }, { status: 500 });

  // Pre-launch DNS gate for external domains. We do NOT want to take the
  // client's money and then fail to point their domain at the site, so we
  // verify resolution before creating the Stripe session. The operator can
  // override by ticking the externalVerified flag (set automatically by the
  // ops DNS check button) — that path is for edge cases where DNS resolves
  // from the user's region but our resolver hasn't caught up yet.
  if (cfg.domain?.mode === 'external' && cfg.domain.domainName) {
    const dns = await checkExternalDomainDns(cfg.domain.domainName, req.site_id);
    if (!dns.verified && !cfg.domain.externalVerified) {
      return NextResponse.json(
        {
          error:
            'Your custom domain DNS is not set up yet. Add the DNS records we sent you, then try again — the records take a few minutes to propagate.',
          dnsCheck: dns,
          retryable: true,
        },
        { status: 409 },
      );
    }
  }

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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://keystoneweb.ca';

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceId, quantity: 1 },
    {
      price_data: {
        currency: 'usd',
        unit_amount: launchServiceCents,
        product_data: {
          name: 'Launch Service',
          description: 'One-time setup, design, and launch assistance.',
        },
        tax_behavior: 'exclusive',
      },
      quantity: 1,
    },
  ];

  if (domainCents > 0 && cfg.domain?.domainName) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        unit_amount: domainCents,
        product_data: {
          name: `Custom domain: ${cfg.domain.domainName}`,
          description: 'First-year custom domain registration.',
        },
        tax_behavior: 'exclusive',
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'subscription',
    customer: customer.id,
    billing_address_collection: 'required',
    automatic_tax: { enabled: true },
    allow_promotion_codes: true,
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
      planBillingInterval: billingInterval,
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
