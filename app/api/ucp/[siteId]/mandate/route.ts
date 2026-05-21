/**
 * AP2 mandate submission + verification.
 *
 *   POST /api/ucp/{siteId}/mandate
 *     - Agent submits a `payment` mandate referencing a prior `cart`
 *       mandate. We verify the signature, the amount, the cart id, and
 *       expiry, then create an `order` and return its id + the verified
 *       mandate. A subsequent charge call (Stripe Connect) uses the token
 *       in the payment mandate to actually settle the funds.
 *
 *   GET /api/ucp/{siteId}/mandate?id=...
 *     - Lets an agent (or the merchant dashboard) re-fetch a mandate it
 *       previously created. Returns 404 for foreign sites.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadUcpSiteContext } from '@/lib/ucp/site-context';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { logAgentActivity, detectAgent } from '@/lib/ucp/agent-detect';
import { verifyMandate, issueMandate } from '@/lib/ucp/mandate';
import { loadCart, markConverted } from '@/lib/ucp/cart';
import { chargeMandate } from '@/lib/ucp/charge';
import type { UcpMandate } from '@/lib/ucp/types';

interface SubmittedMandate {
  cartMandateId: string;
  payment: {
    type: 'google_pay' | 'apple_pay' | 'card_token' | 'wallet_token';
    token: string;
  };
  customer?: { name: string; email: string; phone?: string };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const ctx = await loadUcpSiteContext(siteId);
  if (!ctx) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const body = await request.json().catch(() => ({})) as SubmittedMandate;
  if (!body.cartMandateId || !body.payment?.type || !body.payment?.token) {
    return NextResponse.json({ error: 'Missing cartMandateId or payment' }, { status: 400 });
  }
  if (!body.customer?.email || !body.customer?.name) {
    return NextResponse.json({ error: 'Missing customer.name or customer.email' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: cartMandateRow } = await admin
    .from('ucp_mandates')
    .select('*')
    .eq('id', body.cartMandateId)
    .eq('site_id', siteId)
    .maybeSingle();
  if (!cartMandateRow) return NextResponse.json({ error: 'Cart mandate not found' }, { status: 404 });
  if (cartMandateRow.status === 'consumed') {
    return NextResponse.json({ error: 'Cart mandate already consumed' }, { status: 409 });
  }

  const cartMandate: Pick<UcpMandate, 'payload' | 'payloadHash' | 'signature' | 'signatureAlg' | 'siteId'> = {
    payload: cartMandateRow.payload,
    payloadHash: cartMandateRow.payload_hash,
    signature: cartMandateRow.signature,
    signatureAlg: cartMandateRow.signature_alg,
    siteId: cartMandateRow.site_id,
  };

  const v = verifyMandate(cartMandate, { siteId });
  if (!v.ok) {
    await logAgentActivity(request, { siteId, surface: 'checkout', action: 'mandate_reject', httpStatus: 400, requestMeta: { reason: v.reason } });
    return NextResponse.json({ error: 'Cart mandate rejected', reason: v.reason }, { status: 400 });
  }

  const cart = await loadCart(cartMandateRow.cart_id);
  if (!cart) return NextResponse.json({ error: 'Cart vanished' }, { status: 410 });

  const expectedAmount = (cartMandateRow.payload as { amount?: { amount?: number } } | null)?.amount?.amount;
  if (typeof expectedAmount === 'number' && cart.totals.totalCents !== expectedAmount) {
    // Cart changed (price drop, new tax) between issuance and submission —
    // refuse so the agent must re-quote and re-sign.
    return NextResponse.json({
      error: 'Cart totals shifted since mandate issuance — re-quote and re-issue',
      reason: 'amount_mismatch',
      expectedAmountCents: expectedAmount,
      currentAmountCents: cart.totals.totalCents,
    }, { status: 409 });
  }

  // Create the merchant order. Totals (tax, shipping) are written so the
  // Stripe charge below has the full picture, and the order matches what
  // the merchant sees in their dashboard.
  const detect = detectAgent(request.headers);
  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      site_id: siteId,
      items: cart.items.map(i => ({
        productId: i.productId,
        name: i.title ?? '',
        price_cents: i.unitPriceCents,
        qty: i.qty,
        variants: i.variants ?? {},
        options: i.options ?? {},
      })),
      subtotal_cents: cart.totals.subtotalCents,
      shipping_cents: cart.totals.shippingCents,
      tax_cents: cart.totals.taxCents,
      customer_name: body.customer.name,
      customer_email: body.customer.email,
      customer_phone: body.customer.phone || null,
      shipping_address: cart.shippingAddress ?? null,
      status: 'pending',
      payment_method: 'stripe',
      payment_status: 'pending',
      notes: `UCP/AP2 order via ${detect.agentId} — mandate ${cartMandateRow.id}`,
    })
    .select()
    .single();
  if (orderError || !order) return NextResponse.json({ error: orderError?.message || 'Order creation failed' }, { status: 500 });

  // Charge via Stripe Connect. The mandate id is the idempotency key so
  // accidental resubmission of the same mandate never double-charges.
  const charge = await chargeMandate({
    siteId,
    orderId: order.id,
    amountCents: cart.totals.totalCents,
    currency: cart.currency,
    customerEmail: body.customer.email,
    paymentToken: body.payment.token,
    paymentType: body.payment.type,
    agentId: detect.agentId,
    mandateId: cartMandateRow.id,
  });

  await admin.from('orders').update({
    payment_status: charge.status === 'paid' ? 'paid' : charge.status === 'pending' ? 'pending' : 'unpaid',
    status: charge.status === 'paid' ? 'confirmed' : 'pending',
    stripe_payment_id: charge.paymentIntentId ?? null,
    notes: charge.failureMessage
      ? `UCP/AP2 order via ${detect.agentId} — mandate ${cartMandateRow.id} — charge ${charge.status}: ${charge.failureMessage}`
      : undefined,
  }).eq('id', order.id);

  // If the charge failed outright, refund the cart back to `open` so the
  // agent can try again with a fresh token instead of being stranded.
  if (charge.status === 'failed') {
    await admin.from('ucp_carts').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', cart.id);
    await logAgentActivity(request, {
      siteId,
      surface: 'checkout',
      action: 'charge_failed',
      cartId: cart.id,
      orderId: order.id,
      amountCents: cart.totals.totalCents,
      httpStatus: 402,
      requestMeta: { code: charge.failureCode, message: charge.failureMessage },
    });
    return NextResponse.json({
      error: 'Charge failed',
      reason: charge.failureCode,
      message: charge.failureMessage,
      orderId: order.id,
    }, { status: 402 });
  }

  // Issue + persist the matching payment mandate so the audit trail is
  // a chain: cart mandate → payment mandate → order.
  const paymentMandate = issueMandate({
    type: 'payment',
    siteId,
    cartId: cart.id,
    agentId: detect.agentId,
    agentSessionId: detect.sessionId ?? undefined,
    amount: { amount: cart.totals.totalCents, currency: cart.currency },
    paymentMethod: { type: body.payment.type, token: body.payment.token },
  });
  await admin.from('ucp_mandates').insert({
    id: paymentMandate.id,
    site_id: siteId,
    cart_id: cart.id,
    order_id: order.id,
    mandate_type: paymentMandate.type,
    agent_id: paymentMandate.agentId,
    agent_session_id: paymentMandate.agentSessionId ?? null,
    payload_hash: paymentMandate.payloadHash,
    payload: paymentMandate.payload,
    signature: paymentMandate.signature,
    signature_alg: paymentMandate.signatureAlg,
    status: 'verified',
    expires_at: paymentMandate.payload.expiresAt,
  });
  await admin.from('ucp_mandates').update({
    status: 'consumed',
    consumed_at: new Date().toISOString(),
    order_id: order.id,
  }).eq('id', cartMandateRow.id);

  if (charge.status === 'paid') {
    await markConverted(cart.id);
  }

  await logAgentActivity(request, {
    siteId,
    surface: 'checkout',
    action: charge.status === 'paid' ? 'mandate_verify' : 'charge_pending',
    cartId: cart.id,
    orderId: order.id,
    amountCents: cart.totals.totalCents,
    httpStatus: charge.status === 'paid' ? 201 : 202,
    requestMeta: charge.status === 'paid' ? undefined : { code: charge.failureCode },
  });

  return NextResponse.json({
    order: {
      id: order.id,
      status: charge.status === 'paid' ? 'confirmed' : 'pending',
      paymentStatus: charge.status,
      paymentIntentId: charge.paymentIntentId,
      totals: cart.totals,
    },
    mandate: paymentMandate,
    merchantOfRecord: ctx.businessName,
  }, { status: charge.status === 'paid' ? 201 : 202, headers: { 'X-UCP-Version': '0.1' } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const ctx = await loadUcpSiteContext(siteId);
  if (!ctx) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const admin = createAdminClient();
  const { data } = await admin.from('ucp_mandates').select('*').eq('id', id).eq('site_id', siteId).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    type: data.mandate_type,
    siteId: data.site_id,
    cartId: data.cart_id,
    orderId: data.order_id,
    agentId: data.agent_id,
    payload: data.payload,
    payloadHash: data.payload_hash,
    signature: data.signature,
    signatureAlg: data.signature_alg,
    status: data.status,
  });
}
