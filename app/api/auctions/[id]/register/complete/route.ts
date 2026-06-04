import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getStripe } from '@/lib/auctions/stripe';
import { getCurrentMemberFromRequest } from '@/lib/membership/current-member';
import { pickUniqueAlias } from '@/lib/auctions/alias';

/**
 * GET /api/auctions/[id]/register/complete?session_id=cs_xxx
 *
 * Called by the browser after Stripe Checkout (setup mode) succeeds.
 * Exchanges the session for the captured PaymentMethod and finalises the
 * auction_registrations row, then redirects the user to the lobby.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.redirect(new URL(`/auctions/${id}/register?error=missing_session`, request.url));
  }

  const db = createAdminClient();
  const { data: auction } = await db.from('auctions').select('*').eq('id', id).single();
  if (!auction) {
    return NextResponse.redirect(new URL(`/auctions/${id}/register?error=not_found`, request.url));
  }

  const member = await getCurrentMemberFromRequest(request, auction.site_id);
  if (!member) {
    return NextResponse.redirect(new URL(`/auctions/${id}/register?error=session_expired`, request.url));
  }

  const { data: site } = await db.from('sites').select('stripe_account_id').eq('id', auction.site_id).single();
  if (!site?.stripe_account_id) {
    return NextResponse.redirect(new URL(`/auctions/${id}/register?error=stripe_misconfigured`, request.url));
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(
    sessionId,
    { expand: ['setup_intent'] },
    { stripeAccount: site.stripe_account_id },
  );

  if (session.mode !== 'setup' || !session.setup_intent) {
    return NextResponse.redirect(new URL(`/auctions/${id}/register?error=bad_session`, request.url));
  }

  const setupIntent = typeof session.setup_intent === 'string'
    ? await stripe.setupIntents.retrieve(session.setup_intent, undefined, { stripeAccount: site.stripe_account_id })
    : session.setup_intent;

  if (setupIntent.status !== 'succeeded' || !setupIntent.payment_method) {
    return NextResponse.redirect(new URL(`/auctions/${id}/register?error=card_not_captured`, request.url));
  }

  const paymentMethodId = typeof setupIntent.payment_method === 'string'
    ? setupIntent.payment_method
    : setupIntent.payment_method.id;
  const stripeCustomerId = typeof setupIntent.customer === 'string'
    ? setupIntent.customer
    : setupIntent.customer?.id;

  if (!stripeCustomerId) {
    return NextResponse.redirect(new URL(`/auctions/${id}/register?error=no_customer`, request.url));
  }

  // Make this card the customer's default for future off-session charges
  await stripe.customers.update(
    stripeCustomerId,
    { invoice_settings: { default_payment_method: paymentMethodId } },
    { stripeAccount: site.stripe_account_id },
  );

  // Pick a unique alias within the auction
  const { data: taken } = await db
    .from('auction_registrations')
    .select('alias_color, alias_animal')
    .eq('auction_id', id);
  const alias = pickUniqueAlias(taken ?? []);

  // Insert (or update if exists) the registration
  const { error } = await db
    .from('auction_registrations')
    .upsert(
      {
        auction_id: id,
        member_id: member.memberId,
        site_id: auction.site_id,
        status: auction.auto_approve_registrations ? 'approved' : 'pending',
        approved_at: auction.auto_approve_registrations ? new Date().toISOString() : null,
        alias_color: alias.color,
        alias_animal: alias.animal,
        stripe_customer_id: stripeCustomerId,
        stripe_payment_method_id: paymentMethodId,
      },
      { onConflict: 'auction_id,member_id' },
    );

  if (error) {
    console.error('[auctions/register/complete] upsert failed:', error);
    return NextResponse.redirect(new URL(`/auctions/${id}/register?error=registration_save_failed`, request.url));
  }

  return NextResponse.redirect(new URL(`/auctions/${id}/lobby`, request.url));
}
