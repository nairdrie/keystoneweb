import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import {
  createPartnerReferral,
  getMerchantIntegrationStatus,
  isPaypalConfigured,
} from '@/lib/paypal';

/** GET /api/paypal/connect?siteId=xxx — connection status */
export async function GET(request: NextRequest) {
  try {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: site } = await supabase
      .from('sites')
      .select(
        'paypal_merchant_id, paypal_onboarding_status, paypal_permissions_granted, paypal_email_confirmed, paypal_primary_email, paypal_advanced_card_enabled'
      )
      .eq('id', siteId)
      .eq('user_id', user.id)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      connected:
        !!site.paypal_merchant_id &&
        site.paypal_onboarding_status === 'active',
      paypalMerchantId: site.paypal_merchant_id || null,
      status: site.paypal_onboarding_status || null,
      permissionsGranted: site.paypal_permissions_granted || false,
      emailConfirmed: site.paypal_email_confirmed || false,
      primaryEmail: site.paypal_primary_email || null,
      advancedCardEnabled: site.paypal_advanced_card_enabled || false,
    });
  } catch (error: any) {
    console.error('PayPal connect GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/paypal/connect
 * Generates a PayPal Partner Referral signup link so the site owner can
 * connect their PayPal business account (mirrors stripe.accountLinks.create).
 */
export async function POST(request: NextRequest) {
  try {
    if (!isPaypalConfigured()) {
      return NextResponse.json(
        { error: 'PayPal is not configured on this platform' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, returnUrl, advancedCard } = body;
    if (!siteId || !returnUrl) {
      return NextResponse.json(
        { error: 'Missing siteId or returnUrl' },
        { status: 400 }
      );
    }

    const { data: site } = await supabase
      .from('sites')
      .select('user_id')
      .eq('id', siteId)
      .single();

    if (!site || site.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await supabase
      .from('sites')
      .update({ paypal_onboarding_status: 'pending' })
      .eq('id', siteId);

    const url = await createPartnerReferral({
      siteId,
      returnUrl,
      email: user.email || undefined,
      advancedCard: Boolean(advancedCard),
    });

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('PayPal connect POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create PayPal onboarding link' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/paypal/connect — re-sync a site's onboarding status from PayPal.
 * Useful when the seller finishes onboarding and we want to confirm
 * `payments_receivable` before enabling PayPal at checkout.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId } = await request.json();
    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const { data: site } = await supabase
      .from('sites')
      .select('user_id, paypal_merchant_id')
      .eq('id', siteId)
      .single();

    if (!site || site.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!site.paypal_merchant_id) {
      return NextResponse.json({ error: 'Not onboarded yet' }, { status: 400 });
    }

    const status = await getMerchantIntegrationStatus(site.paypal_merchant_id);
    const receivable = !!status.payments_receivable;
    const emailConfirmed = !!status.primary_email_confirmed;
    const hasPPCP = (status.products || []).some(
      (p) => p.name === 'PPCP_CUSTOM' && p.vetting_status === 'SUBSCRIBED'
    );

    await supabase
      .from('sites')
      .update({
        paypal_onboarding_status: receivable ? 'active' : 'limited',
        paypal_permissions_granted: receivable,
        paypal_email_confirmed: emailConfirmed,
        paypal_advanced_card_enabled: hasPPCP,
      })
      .eq('id', siteId);

    return NextResponse.json({
      status: receivable ? 'active' : 'limited',
      permissionsGranted: receivable,
      emailConfirmed,
      advancedCardEnabled: hasPPCP,
    });
  } catch (error: any) {
    console.error('PayPal connect PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to refresh PayPal status' },
      { status: 500 }
    );
  }
}
