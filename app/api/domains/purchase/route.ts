import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_API_BASE = 'https://api.vercel.com';

interface PurchaseRequest {
  siteId: string;
  domain: string;
}

/**
 * POST /api/domains/purchase
 * Purchase a domain via Vercel Registrar API and link it to a site.
 *
 * Flow:
 * 1. Verify auth + Pro plan + site ownership
 * 2. Fetch current price from Vercel (for expectedPrice confirmation)
 * 3. Buy domain via POST /v1/registrar/domains/{domain}/buy
 * 4. Update site record with custom_domain
 * 5. Create DNS records
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Pro plan
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('subscription_status, subscription_plan')
      .eq('user_id', user.id)
      .single();

    const isPro = subscription?.subscription_status === 'active' &&
      subscription?.subscription_plan?.toLowerCase().includes('pro');

    if (!isPro) {
      return NextResponse.json(
        { error: 'Pro plan required for custom domains' },
        { status: 403 }
      );
    }

    const body: PurchaseRequest = await request.json();
    const { siteId, domain } = body;

    if (!siteId || !domain) {
      return NextResponse.json(
        { error: 'Missing required fields: siteId, domain' },
        { status: 400 }
      );
    }

    // Verify site ownership
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, user_id')
      .eq('id', siteId)
      .single();

    if (siteError || !site || site.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Site not found or access denied' },
        { status: 404 }
      );
    }

    if (!VERCEL_API_TOKEN) {
      return NextResponse.json(
        { error: 'Domain purchasing is not configured. Contact support.' },
        { status: 503 }
      );
    }

    const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';

    // Fetch user profile for contact info
    const { data: userProfile } = await supabase
      .from('users')
      .select('email, business_name')
      .eq('id', user.id)
      .single();

    // Step 1: Get current price (required as expectedPrice for purchase)
    const priceRes = await fetch(
      `${VERCEL_API_BASE}/v1/registrar/domains/${encodeURIComponent(domain)}/price${teamParam}`,
      {
        headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` },
      }
    );

    if (!priceRes.ok) {
      console.error('Vercel price check failed:', priceRes.status, await priceRes.text());
      return NextResponse.json(
        { error: 'Failed to fetch domain price. Please try again.' },
        { status: 502 }
      );
    }

    const priceData = await priceRes.json();
    const expectedPrice = typeof priceData.purchasePrice === 'string'
      ? parseFloat(priceData.purchasePrice)
      : priceData.purchasePrice;

    if (isNaN(expectedPrice) || expectedPrice <= 0) {
      return NextResponse.json(
        { error: 'Unable to determine domain price. Contact support.' },
        { status: 502 }
      );
    }

    // Step 2: Purchase domain via Vercel
    const purchaseRes = await fetch(
      `${VERCEL_API_BASE}/v1/registrar/domains/${encodeURIComponent(domain)}/buy${teamParam}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          autoRenew: true,
          years: priceData.years || 1,
          expectedPrice,
          contactInformation: {
            firstName: userProfile?.business_name || 'Site',
            lastName: 'Owner',
            email: userProfile?.email || user.email,
            phone: '+1.0000000000',
            address1: 'TBD',
            city: 'TBD',
            state: 'TBD',
            zip: '00000',
            country: 'CA',
          },
        }),
      }
    );

    if (!purchaseRes.ok) {
      const errorData = await purchaseRes.json().catch(() => ({}));
      console.error('Vercel purchase failed:', purchaseRes.status, errorData);

      const code = errorData?.code;
      if (code === 'domain_not_available') {
        return NextResponse.json(
          { error: 'This domain is no longer available. Please search again.' },
          { status: 409 }
        );
      }
      if (code === 'expected_price_mismatch') {
        return NextResponse.json(
          { error: 'Domain price has changed. Please search again to see the updated price.' },
          { status: 409 }
        );
      }
      if (code === 'tld_not_supported') {
        return NextResponse.json(
          { error: 'This domain extension is not supported for purchase.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Domain purchase failed. Please try again or contact support.' },
        { status: 502 }
      );
    }

    const purchaseData = await purchaseRes.json();

    // Step 3: Update site with custom domain
    const { error: updateError } = await supabase
      .from('sites')
      .update({ custom_domain: domain })
      .eq('id', siteId);

    if (updateError) {
      console.error('Failed to update site with custom domain:', updateError);
      return NextResponse.json(
        { error: 'Domain purchased but failed to link to site. Contact support.' },
        { status: 500 }
      );
    }

    // Step 4: Create DNS records for the custom domain
    await supabase.from('dns_records').insert({
      site_id: siteId,
      record_type: 'CNAME',
      name: domain,
      value: 'sites.kswd.ca',
      ttl: 3600,
    });

    return NextResponse.json({
      success: true,
      domain,
      orderId: purchaseData.orderId,
      message: `Domain ${domain} has been purchased and linked to your site!`,
    });
  } catch (error) {
    console.error('Error purchasing domain:', error);
    return NextResponse.json(
      { error: 'Failed to purchase domain' },
      { status: 500 }
    );
  }
}
