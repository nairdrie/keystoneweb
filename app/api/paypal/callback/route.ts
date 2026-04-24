import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getMerchantIntegrationStatus } from '@/lib/paypal';

/**
 * GET /api/paypal/callback
 *
 * Landing page after the site owner completes PayPal seller onboarding.
 * PayPal appends query params to the partner `return_url` including the
 * merchantIdInPayPal (the payer id we store as paypal_merchant_id) and the
 * tracking_id we set during createPartnerReferral (= siteId).
 *
 * We persist the connection, then immediately re-check merchant integration
 * status so the UI can show "active" vs "needs more info".
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const merchantIdInPayPal =
    params.get('merchantIdInPayPal') ||
    params.get('merchant_id_in_paypal') ||
    '';
  const trackingId = params.get('tracking_id') || params.get('trackingId') || '';
  const permissionsGranted =
    params.get('permissionsGranted') === 'true' ||
    params.get('permissions_granted') === 'true';
  const emailConfirmed =
    params.get('emailConfirmed') === 'true' ||
    params.get('email_confirmed') === 'true' ||
    params.get('consentStatus') === 'true';
  const accountStatus =
    params.get('accountStatus') || params.get('account_status') || '';
  const returnTo = params.get('returnTo') || '/';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const fallback = appUrl ? `${appUrl}/` : '/';

  if (!merchantIdInPayPal || !trackingId) {
    return NextResponse.redirect(
      new URL(`${returnTo}?paypal_error=missing_params`, request.url)
    );
  }

  const admin = createAdminClient();

  // trackingId is the siteId we set during createPartnerReferral.
  const { data: site } = await admin
    .from('sites')
    .select('id, user_id')
    .eq('id', trackingId)
    .single();

  if (!site) {
    return NextResponse.redirect(
      new URL(`${returnTo}?paypal_error=unknown_site`, request.url)
    );
  }

  // Optionally fetch the authoritative integration status from PayPal.
  let finalStatus: 'active' | 'limited' | 'pending' =
    permissionsGranted && emailConfirmed && accountStatus !== 'BUSINESS_ACCOUNT_RESTRICTED'
      ? 'active'
      : 'limited';
  let hasPPCP = false;
  let primaryEmail: string | null = null;

  try {
    const status = await getMerchantIntegrationStatus(merchantIdInPayPal);
    if (!status.payments_receivable) finalStatus = 'limited';
    hasPPCP = (status.products || []).some(
      (p) => p.name === 'PPCP_CUSTOM' && p.vetting_status === 'SUBSCRIBED'
    );
  } catch (err) {
    console.warn('PayPal merchant-status check failed on callback:', err);
  }

  await admin
    .from('sites')
    .update({
      paypal_merchant_id: merchantIdInPayPal,
      paypal_onboarding_status: finalStatus,
      paypal_permissions_granted: permissionsGranted,
      paypal_email_confirmed: emailConfirmed,
      paypal_primary_email: primaryEmail,
      paypal_advanced_card_enabled: hasPPCP,
    })
    .eq('id', trackingId);

  const target = new URL(returnTo || fallback, request.url);
  target.searchParams.set('paypal_connected', finalStatus);
  return NextResponse.redirect(target);
}
