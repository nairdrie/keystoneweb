/**
 * AP2 checkout initiation. The agent posts a cartId; we:
 *   1. Re-quote the cart (fresh prices, tax, shipping).
 *   2. Mark it `checking_out`.
 *   3. Issue a `cart` mandate signed by the platform — the agent now has
 *      a tamper-evident receipt of what it agreed to.
 *   4. Return the mandate envelope + acceptable payment methods so the
 *      agent can produce a matching `payment` mandate with a tokenized
 *      Google Pay / wallet token.
 *
 * The merchant is the Merchant of Record — we don't hand the cart off to
 * Google. We return the mandate, the agent sends back a payment mandate
 * pointing at our /api/ucp/.../mandate/verify endpoint, and we then charge
 * via Stripe Connect on our side.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadUcpSiteContext } from '@/lib/ucp/site-context';
import { logAgentActivity, detectAgent } from '@/lib/ucp/agent-detect';
import { loadCart, markCheckingOut } from '@/lib/ucp/cart';
import { issueMandate } from '@/lib/ucp/mandate';
import { createAdminClient } from '@/lib/db/supabase-admin';

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const ctx = await loadUcpSiteContext(siteId);
  if (!ctx) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const body = await request.json().catch(() => ({})) as { cartId?: string };
  if (!body.cartId) return NextResponse.json({ error: 'Missing cartId' }, { status: 400 });

  const cart = await loadCart(body.cartId);
  if (!cart || cart.siteId !== siteId) return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
  if (cart.items.length === 0) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });

  const detect = detectAgent(request.headers);
  await markCheckingOut(cart.id);

  const mandate = issueMandate({
    type: 'cart',
    siteId,
    cartId: cart.id,
    agentId: detect.agentId,
    agentSessionId: detect.sessionId ?? undefined,
    cart,
    amount: { amount: cart.totals.totalCents, currency: cart.currency },
  });

  // Persist for later verification + audit trail
  const admin = createAdminClient();
  await admin.from('ucp_mandates').insert({
    id: mandate.id,
    site_id: siteId,
    cart_id: cart.id,
    mandate_type: mandate.type,
    agent_id: mandate.agentId,
    agent_session_id: mandate.agentSessionId ?? null,
    payload_hash: mandate.payloadHash,
    payload: mandate.payload,
    signature: mandate.signature,
    signature_alg: mandate.signatureAlg,
    expires_at: mandate.payload.expiresAt,
  });

  await logAgentActivity(request, {
    siteId,
    surface: 'checkout',
    action: 'checkout_init',
    cartId: cart.id,
    amountCents: cart.totals.totalCents,
    httpStatus: 200,
  });

  return NextResponse.json({
    mandate,
    paymentMethods: [
      { type: 'google_pay', supported: true, ap2Profile: 'wallet_token_v1' },
      { type: 'apple_pay', supported: true, ap2Profile: 'wallet_token_v1' },
      { type: 'card_token', supported: true, ap2Profile: 'card_token_v1' },
    ],
    nextStep: {
      // The agent must POST a `payment` mandate that references this
      // mandate's id and a tokenized payment instrument.
      url: `${new URL(request.url).origin}/api/ucp/${siteId}/mandate`,
      method: 'POST',
      expectedMandateType: 'payment',
      cartMandateId: mandate.id,
    },
    merchantOfRecord: ctx.businessName,
  }, { headers: { 'X-UCP-Version': '0.1' } });
}
