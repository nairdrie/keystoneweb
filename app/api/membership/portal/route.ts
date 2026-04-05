import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { verifyMemberTokenAny, hashToken, MEMBER_COOKIE_NAME } from '@/lib/membership/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any,
});

/**
 * POST /api/membership/portal
 * Creates a Stripe Billing Portal session for the member to manage their subscription.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(MEMBER_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload = await verifyMemberTokenAny(token);
    if (!payload) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Verify session
    const { data: session } = await supabase
      .from('member_sessions')
      .select('id')
      .eq('token_hash', hashToken(token))
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get member and site
    const { data: member } = await supabase
      .from('members')
      .select('stripe_customer_id')
      .eq('id', payload.memberId)
      .eq('site_id', payload.siteId)
      .single();

    if (!member?.stripe_customer_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    const { data: site } = await supabase
      .from('sites')
      .select('stripe_account_id')
      .eq('id', payload.siteId)
      .single();

    if (!site?.stripe_account_id) {
      return NextResponse.json({ error: 'Site not configured for payments' }, { status: 400 });
    }

    const { returnUrl } = await request.json();

    const portalSession = await stripe.billingPortal.sessions.create(
      {
        customer: member.stripe_customer_id,
        return_url: returnUrl || '/',
      },
      { stripeAccount: site.stripe_account_id }
    );

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error('Membership portal error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
