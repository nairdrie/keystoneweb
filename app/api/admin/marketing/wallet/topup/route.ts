import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getMarketingAccess } from '@/lib/marketing/admin-auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: '2026-02-25.clover' as any,
});

const MIN_TOPUP_CENTS = 1000;     // $10
const MAX_TOPUP_CENTS = 1_000_000; // $10,000

/**
 * POST /api/admin/marketing/wallet/topup
 *
 * Creates a Stripe Checkout Session for a wallet top-up. The Stripe webhook
 * (type=marketing_topup) credits the wallet when payment succeeds.
 *
 * Body: { siteId, amountCents }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await getMarketingAccess(request, { siteIdFromBody: body });
  if ('error' in result) return result.error;
  const { access } = result;

  const amountCents = Math.round(Number(body.amountCents) || 0);
  if (amountCents < MIN_TOPUP_CENTS || amountCents > MAX_TOPUP_CENTS) {
    return NextResponse.json({
      error: `Top-up must be between $${MIN_TOPUP_CENTS / 100} and $${MAX_TOPUP_CENTS / 100}`,
    }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  const successUrl = `${origin}/admin/marketing/budget?siteId=${access.siteId}&topup=success`;
  const cancelUrl = `${origin}/admin/marketing/budget?siteId=${access.siteId}&topup=cancel`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'cad',
          product_data: {
            name: 'Marketing Wallet Top-up',
            description: 'Credits used to fund Google Ads campaigns from your Keystone Web admin.',
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: 'marketing_topup',
        siteId: access.siteId,
        userId: access.userId,
        amountCents: String(amountCents),
      },
      payment_intent_data: {
        metadata: {
          type: 'marketing_topup',
          siteId: access.siteId,
          userId: access.userId,
        },
      },
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[admin/marketing/wallet/topup] Stripe error:', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
