import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getStripe } from '@/lib/auctions/stripe';
import {
  hashPassword,
  verifyPassword,
  signMemberToken,
  hashToken,
  getTokenExpiresAt,
  MEMBER_COOKIE_NAME,
  getMemberCookieOptions,
} from '@/lib/membership/auth';

/**
 * POST /api/auctions/[id]/register
 *
 * Body: { email, password, name }
 *
 * - Creates or signs in a member (per-site account)
 * - Creates a Stripe customer on the site's connected account if needed
 * - Creates a Checkout Session in `mode: 'setup'` to capture a card
 * - Returns the Stripe URL to redirect the browser to
 *
 * On Stripe success the user is redirected to
 * `/auctions/[id]/register/complete?session_id=cs_...` which finalizes the
 * registration (creates the auction_registrations row).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { email, password, name } = body as { email?: string; password?: string; name?: string };

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }
  const emailLower = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const db = createAdminClient();

  // Load auction + site
  const { data: auction } = await db.from('auctions').select('*').eq('id', id).single();
  if (!auction || auction.status === 'draft' || auction.status === 'cancelled' || auction.status === 'ended') {
    return NextResponse.json({ error: 'Registration is not open for this auction' }, { status: 400 });
  }

  const { data: site } = await db
    .from('sites')
    .select('id, stripe_account_id, auctions_enabled')
    .eq('id', auction.site_id)
    .single();
  if (!site?.auctions_enabled) {
    return NextResponse.json({ error: 'Auctions are not enabled for this site' }, { status: 400 });
  }
  if (!site.stripe_account_id) {
    return NextResponse.json({ error: 'This site is not configured to accept payments yet' }, { status: 400 });
  }

  // Find or create member (per-site)
  const { data: existing } = await db
    .from('members')
    .select('id, password_hash, status, stripe_customer_id, is_archived, name')
    .eq('site_id', auction.site_id)
    .eq('email', emailLower)
    .maybeSingle();

  let memberId: string;
  let stripeCustomerId: string | null;

  if (existing) {
    if (existing.is_archived) {
      return NextResponse.json({ error: 'This account has been archived. Contact support.' }, { status: 400 });
    }
    const ok = await verifyPassword(password, existing.password_hash);
    if (!ok) {
      return NextResponse.json({ error: 'An account with this email already exists. Use the correct password to register.' }, { status: 401 });
    }
    memberId = existing.id;
    stripeCustomerId = existing.stripe_customer_id ?? null;
  } else {
    const passwordHash = await hashPassword(password);
    const { data: inserted, error: insertErr } = await db
      .from('members')
      .insert({
        site_id: auction.site_id,
        email: emailLower,
        password_hash: passwordHash,
        name: name || null,
        status: 'active',
        email_verified: true, // card on file is the trust signal for auctions
        signed_up_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (insertErr || !inserted) {
      console.error('[auctions/register] member insert failed:', insertErr);
      return NextResponse.json({ error: 'Could not create account' }, { status: 500 });
    }
    memberId = inserted.id;
    stripeCustomerId = null;
  }

  // Stop early if they're already registered for this auction
  const { data: existingReg } = await db
    .from('auction_registrations')
    .select('id, status')
    .eq('auction_id', id)
    .eq('member_id', memberId)
    .maybeSingle();
  if (existingReg) {
    // Sign them in so the lobby loads
    await issueMemberCookie(memberId, auction.site_id, emailLower);
    return NextResponse.json({
      alreadyRegistered: true,
      redirectTo: `/auctions/${id}/lobby`,
    });
  }

  // Ensure Stripe customer exists on the connected account
  const stripe = getStripe();
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create(
      {
        email: emailLower,
        name: name || undefined,
        metadata: { memberId, siteId: auction.site_id, source: 'auction_registration' },
      },
      { stripeAccount: site.stripe_account_id },
    );
    stripeCustomerId = customer.id;
    await db.from('members').update({ stripe_customer_id: stripeCustomerId }).eq('id', memberId);
  }

  // Issue member cookie so the user is signed in when they come back from Stripe
  await issueMemberCookie(memberId, auction.site_id, emailLower);

  // Create a Stripe Checkout Session in setup mode to capture the card
  const origin = request.nextUrl.origin;
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'setup',
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      success_url: `${origin}/auctions/${id}/register/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/auctions/${id}/register?cancelled=1`,
      metadata: { auctionId: id, memberId, siteId: auction.site_id },
    },
    { stripeAccount: site.stripe_account_id },
  );

  return NextResponse.json({ checkoutUrl: session.url });
}

async function issueMemberCookie(memberId: string, siteId: string, email: string) {
  const token = await signMemberToken({ memberId, siteId, email });
  const db = createAdminClient();
  await db.from('member_sessions').insert({
    member_id: memberId,
    site_id: siteId,
    token_hash: hashToken(token),
    expires_at: getTokenExpiresAt().toISOString(),
  });
  const { cookies } = await import('next/headers');
  const store = await cookies();
  store.set(MEMBER_COOKIE_NAME, token, getMemberCookieOptions());
}
