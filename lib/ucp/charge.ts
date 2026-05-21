/**
 * Stripe charge for a verified UCP/AP2 payment mandate.
 *
 * The mandate route hands us a PaymentMethod id (Stripe-compatible token)
 * plus the verified amount + cart. We:
 *   1. Look up the merchant's connected Stripe account id.
 *   2. Create a confirmed PaymentIntent with destination charges so funds
 *      route to the connected account (0% platform fee, matching the
 *      existing /api/stripe/checkout behavior).
 *   3. Return { paymentIntentId, status } so the caller can update the
 *      order row to paid/pending/failed.
 *
 * Wallet tokens (Google Pay / Apple Pay): per AP2, agents hand off a
 * tokenized payload. The pragmatic mapping is for the agent to convert
 * that into a Stripe PaymentMethod (via the Payment Element / Google Pay
 * for Stripe) before submitting the mandate. We accept any of:
 *   - "pm_..."  — already a Stripe PaymentMethod, use as-is.
 *   - "tok_..." — legacy Stripe card token, attach as PaymentMethod.
 *   - "pi_..."  — already-confirmed PaymentIntent (idempotent re-submission).
 *
 * Anything else returns a structured error so the agent can re-tokenize.
 */

import Stripe from 'stripe';
import { createAdminClient } from '@/lib/db/supabase-admin';

const STRIPE_API_VERSION = '2026-02-25.clover' as Stripe.LatestApiVersion;

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
}

export interface ChargeMandateInput {
  siteId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
  paymentToken: string;
  paymentType: 'google_pay' | 'apple_pay' | 'card_token' | 'wallet_token';
  agentId: string;
  mandateId: string;
}

export interface ChargeMandateResult {
  status: 'paid' | 'pending' | 'failed';
  paymentIntentId?: string;
  failureCode?: string;
  failureMessage?: string;
}

export async function chargeMandate(input: ChargeMandateInput): Promise<ChargeMandateResult> {
  const admin = createAdminClient();
  const { data: site } = await admin
    .from('sites')
    .select('stripe_account_id')
    .eq('id', input.siteId)
    .maybeSingle();

  if (!site?.stripe_account_id) {
    return { status: 'failed', failureCode: 'no_stripe_account', failureMessage: 'Merchant has not connected Stripe yet.' };
  }

  const stripe = getStripe();
  const token = input.paymentToken.trim();

  // Idempotent re-submission of an already-completed intent.
  if (token.startsWith('pi_')) {
    try {
      const pi = await stripe.paymentIntents.retrieve(token);
      return {
        status: pi.status === 'succeeded' ? 'paid' : pi.status === 'requires_action' ? 'pending' : 'failed',
        paymentIntentId: pi.id,
      };
    } catch (err) {
      return { status: 'failed', failureCode: 'pi_lookup_failed', failureMessage: (err as Error).message };
    }
  }

  // Resolve the payment_method id we'll attach to the PaymentIntent.
  let paymentMethodId: string;
  try {
    if (token.startsWith('pm_')) {
      paymentMethodId = token;
    } else if (token.startsWith('tok_')) {
      // Legacy card token: wrap as a PaymentMethod once so we can confirm.
      const pm = await stripe.paymentMethods.create({ type: 'card', card: { token } });
      paymentMethodId = pm.id;
    } else {
      return {
        status: 'failed',
        failureCode: 'unsupported_token',
        failureMessage: 'Payment token must be a Stripe PaymentMethod (pm_), legacy token (tok_), or PaymentIntent (pi_).',
      };
    }
  } catch (err) {
    return { status: 'failed', failureCode: 'pm_create_failed', failureMessage: (err as Error).message };
  }

  // The mandate id doubles as the Stripe idempotency key — re-submitting the
  // same mandate creates the same PaymentIntent, never a duplicate charge.
  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: input.amountCents,
        currency: input.currency.toLowerCase(),
        payment_method: paymentMethodId,
        confirm: true,
        // Off-session because the customer is not in front of a browser —
        // an AI agent is acting on their behalf with a pre-signed mandate.
        off_session: true,
        receipt_email: input.customerEmail || undefined,
        description: `UCP order ${input.orderId} (${input.agentId})`,
        metadata: {
          ucp_order_id: input.orderId,
          ucp_site_id: input.siteId,
          ucp_mandate_id: input.mandateId,
          ucp_agent_id: input.agentId,
          ucp_payment_type: input.paymentType,
        },
        transfer_data: { destination: site.stripe_account_id },
      },
      { idempotencyKey: `ucp_mandate_${input.mandateId}` },
    );

    if (pi.status === 'succeeded') {
      return { status: 'paid', paymentIntentId: pi.id };
    }
    if (pi.status === 'requires_action' || pi.status === 'requires_confirmation' || pi.status === 'processing') {
      // Off-session 3DS challenge — agent will need to escalate to the user.
      return { status: 'pending', paymentIntentId: pi.id, failureCode: pi.status };
    }
    return {
      status: 'failed',
      paymentIntentId: pi.id,
      failureCode: pi.status,
      failureMessage: pi.last_payment_error?.message || `Payment status ${pi.status}`,
    };
  } catch (err) {
    const e = err as Stripe.errors.StripeError;
    return {
      status: 'failed',
      failureCode: e.code || 'stripe_error',
      failureMessage: e.message,
    };
  }
}
