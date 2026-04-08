import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover' as any,
});

/** Verify site ownership and return stripe_account_id */
async function verifySiteOwner(siteId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: site } = await supabase
    .from('sites')
    .select('id, stripe_account_id')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single();

  return site;
}

/** GET /api/membership/promo-codes?siteId=xxx — List promotion codes */
export async function GET(request: NextRequest) {
  try {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const site = await verifySiteOwner(siteId);
    if (!site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!site.stripe_account_id) {
      return NextResponse.json({ error: 'No Stripe account connected' }, { status: 400 });
    }

    const promoCodes = await stripe.promotionCodes.list(
      { limit: 50, expand: ['data.coupon'] },
      { stripeAccount: site.stripe_account_id }
    );

    const codes = promoCodes.data.map(pc => {
      const coupon = (pc as any).coupon as Stripe.Coupon | undefined;
      return {
        id: pc.id,
        code: pc.code,
        active: pc.active,
        couponId: coupon?.id ?? null,
        percentOff: coupon?.percent_off ?? null,
        amountOff: coupon?.amount_off ?? null,
        currency: coupon?.currency ?? null,
        maxRedemptions: pc.max_redemptions,
        timesRedeemed: pc.times_redeemed,
        expiresAt: pc.expires_at ? new Date(pc.expires_at * 1000).toISOString() : null,
        created: new Date(pc.created * 1000).toISOString(),
      };
    });

    return NextResponse.json({ promoCodes: codes });
  } catch (error: any) {
    console.error('Promo codes list error:', error);
    return NextResponse.json({ error: error.message || 'Failed to list promo codes' }, { status: 500 });
  }
}

/** POST /api/membership/promo-codes — Create a promotion code */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteId, code, percentOff, amountOff, currency, maxRedemptions, expiresAt } = body;

    if (!siteId || !code) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!percentOff && !amountOff) {
      return NextResponse.json({ error: 'Provide either percentOff or amountOff' }, { status: 400 });
    }

    const site = await verifySiteOwner(siteId);
    if (!site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!site.stripe_account_id) {
      return NextResponse.json({ error: 'No Stripe account connected' }, { status: 400 });
    }

    // Create coupon on connected account
    const couponParams: Stripe.CouponCreateParams = {
      name: code.toUpperCase(),
    };
    if (percentOff) {
      couponParams.percent_off = percentOff;
    } else {
      couponParams.amount_off = amountOff;
      couponParams.currency = (currency || 'CAD').toLowerCase();
    }

    const coupon = await stripe.coupons.create(couponParams, {
      stripeAccount: site.stripe_account_id,
    });

    // Create promotion code wrapping the coupon
    const promoParams: Record<string, any> = {
      coupon: coupon.id,
      code: code.toUpperCase(),
    };
    if (maxRedemptions) promoParams.max_redemptions = maxRedemptions;
    if (expiresAt) promoParams.expires_at = Math.floor(new Date(expiresAt).getTime() / 1000);

    const promoCode = await stripe.promotionCodes.create(promoParams as any, {
      stripeAccount: site.stripe_account_id,
    });

    return NextResponse.json({
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        active: promoCode.active,
        percentOff: coupon.percent_off,
        amountOff: coupon.amount_off,
        currency: coupon.currency,
      },
    });
  } catch (error: any) {
    console.error('Promo code create error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create promo code' }, { status: 500 });
  }
}

/** DELETE /api/membership/promo-codes — Deactivate a promotion code */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteId, promoCodeId } = body;

    if (!siteId || !promoCodeId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const site = await verifySiteOwner(siteId);
    if (!site) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!site.stripe_account_id) {
      return NextResponse.json({ error: 'No Stripe account connected' }, { status: 400 });
    }

    await stripe.promotionCodes.update(
      promoCodeId,
      { active: false },
      { stripeAccount: site.stripe_account_id }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Promo code deactivate error:', error);
    return NextResponse.json({ error: error.message || 'Failed to deactivate promo code' }, { status: 500 });
  }
}
