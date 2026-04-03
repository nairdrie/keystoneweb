import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { FREE_DOMAIN_MAX_USD } from '@/lib/domains/pricing';

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_API_BASE = 'https://api.vercel.com';

/**
 * Links a domain to the Vercel project so it can be served.
 * This is required for Vercel to manage DNS and SSL for the domain.
 */
async function addDomainToProject(domain: string): Promise<{ success: boolean; error?: string }> {
  if (!VERCEL_PROJECT_ID) {
    console.error('addDomainToProject: VERCEL_PROJECT_ID is missing');
    return { success: false, error: 'VERCEL_PROJECT_ID is missing' };
  }

  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
  
  try {
    const res = await fetch(
      `${VERCEL_API_BASE}/v9/projects/${VERCEL_PROJECT_ID}/domains${teamParam}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: domain }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      // 409 means it's already added, which we can treat as success
      if (res.status === 409) return { success: true };
      
      console.error(`addDomainToProject: Failed to add ${domain} to project:`, res.status, errorData);
      return { success: false, error: errorData.error?.message || 'Failed to add domain to project' };
    }

    console.log(`addDomainToProject: Successfully added ${domain} to project ${VERCEL_PROJECT_ID}`);
    return { success: true };
  } catch (err) {
    console.error(`addDomainToProject: Unexpected error for ${domain}:`, err);
    return { success: false, error: 'Unexpected error linking domain' };
  }
}

interface PurchaseRequest {
  siteId: string;
  domain: string;
}

/**
 * Purchase a domain from Vercel and link it to a site.
 * Shared logic used by both the free domain flow (POST handler) and
 * the paid domain flow (called from webhook via completeDomainPurchase).
 */
async function buyDomainFromVercel(
  domain: string,
  siteId: string,
  userId: string,
  email: string,
  businessName: string | null,
  supabase: Awaited<ReturnType<typeof createClient>>,
  maxPriceUsd?: number,
): Promise<{ success: boolean; orderId?: string; error?: string; status?: number }> {
  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';

  // Get current price (required as expectedPrice for purchase)
  const priceRes = await fetch(
    `${VERCEL_API_BASE}/v1/registrar/domains/${encodeURIComponent(domain)}/price${teamParam}`,
    {
      headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` },
    }
  );

  if (!priceRes.ok) {
    return { success: false, error: 'Failed to fetch domain price.', status: 502 };
  }

  const priceData = await priceRes.json();
  const expectedPrice = typeof priceData.purchasePrice === 'string'
    ? parseFloat(priceData.purchasePrice)
    : priceData.purchasePrice;

  if (isNaN(expectedPrice) || expectedPrice <= 0) {
    return { success: false, error: 'Unable to determine domain price.', status: 502 };
  }

  if (maxPriceUsd !== undefined && expectedPrice > maxPriceUsd) {
    return {
      success: false,
      error: `This domain costs $${expectedPrice.toFixed(2)}/yr, which exceeds the $${maxPriceUsd} limit included with Pro. Choose a domain under $${maxPriceUsd}/yr or purchase it at the full price.`,
      status: 400,
    };
  }

  // Purchase from Vercel
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
          firstName: businessName || 'Site',
          lastName: 'Owner',
          email,
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
      return { success: false, error: 'This domain is no longer available.', status: 409 };
    }
    if (code === 'expected_price_mismatch') {
      return { success: false, error: 'Domain price has changed. Please search again.', status: 409 };
    }
    if (code === 'tld_not_supported') {
      return { success: false, error: 'This domain extension is not supported for purchase.', status: 400 };
    }
    return { success: false, error: 'Domain purchase failed.', status: 502 };
  }

  const purchaseData = await purchaseRes.json();

  // Update site with custom domain
  const { error: updateError } = await supabase
    .from('sites')
    .update({ custom_domain: domain })
    .eq('id', siteId);

  if (updateError) {
    console.error('Failed to update site with custom domain:', updateError);
    return { success: false, error: 'Domain purchased but failed to link to site. Contact support.', status: 500 };
  }

  // Create DNS records
  await supabase.from('dns_records').insert({
    site_id: siteId,
    record_type: 'CNAME',
    name: domain,
    value: 'sites.kswd.ca',
    ttl: 3600,
  });

  // Link to Vercel project (automates DNS setup)
  await addDomainToProject(domain);

  return { success: true, orderId: purchaseData.orderId };
}

/**
 * Complete a paid domain purchase (called from the Stripe webhook).
 * If isDomainSwitch is true, disconnects any existing custom domain from
 * other sites belonging to this user before linking the new domain.
 */
export async function completeDomainPurchase(
  purchaseId: string,
  domain: string,
  siteId: string,
  userId: string,
  isDomainSwitch?: boolean,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // If this is a domain switch, disconnect old custom domain from any other site
  if (isDomainSwitch) {
    const { data: sitesWithDomain } = await supabase
      .from('sites')
      .select('id, custom_domain')
      .eq('user_id', userId)
      .not('custom_domain', 'is', null)
      .neq('id', siteId);

    if (sitesWithDomain && sitesWithDomain.length > 0) {
      for (const otherSite of sitesWithDomain) {
        // Park the old domain (clear from site, keep domain_purchases record)
        // Also clear custom inbox email since it belonged to the old domain
        await supabase
          .from('sites')
          .update({ custom_domain: null, inbox_custom_email: null, inbox_resend_domain_id: null })
          .eq('id', otherSite.id);

        await supabase
          .from('domain_purchases')
          .update({ site_id: null })
          .eq('domain', otherSite.custom_domain)
          .eq('user_id', userId);
      }
    }
  }

  // Get user info
  const { data: userProfile } = await supabase
    .from('users')
    .select('email, business_name')
    .eq('id', userId)
    .single();

  const result = await buyDomainFromVercel(
    domain,
    siteId,
    userId,
    userProfile?.email || '',
    userProfile?.business_name,
    supabase
  );

  if (result.success) {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await supabase
      .from('domain_purchases')
      .update({
        vercel_order_id: result.orderId,
        status: 'completed',
        updated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        auto_renew: true,
      })
      .eq('id', purchaseId);

    return { success: true };
  } else {
    await supabase
      .from('domain_purchases')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', purchaseId);

    return { success: false, error: result.error };
  }
}

/**
 * POST /api/domains/purchase
 *
 * For FREE domain purchases (first domain on Pro plan).
 * Purchases directly from Vercel, no Stripe payment needed.
 * Paid domains go through /api/domains/checkout → Stripe → webhook instead.
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
      .select('subscription_status, subscription_plan, stripe_subscription_id')
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

    // Check if user has already used their free domain
    const { count: purchaseCount } = await supabase
      .from('domain_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed');

    if ((purchaseCount ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Free domain already used. Use /api/domains/checkout for paid purchases.' },
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

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('email, business_name')
      .eq('id', user.id)
      .single();

    // Purchase from Vercel (free with Pro — enforce $20 max)
    const result = await buyDomainFromVercel(
      domain,
      siteId,
      user.id,
      userProfile?.email || user.email || '',
      userProfile?.business_name,
      supabase,
      FREE_DOMAIN_MAX_USD,
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Domain purchase failed.' },
        { status: result.status || 502 }
      );
    }

    const claimedAt = new Date().toISOString();

    // Record the free domain purchase, linking it to the active subscription
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await supabase.from('domain_purchases').insert({
      user_id: user.id,
      site_id: siteId,
      domain,
      vercel_order_id: result.orderId,
      amount_cents: 0,
      is_free_with_pro: true,
      status: 'completed',
      stripe_subscription_id: subscription?.stripe_subscription_id ?? null,
      expires_at: expiresAt.toISOString(),
      auto_renew: true,
    });

    // Flag the subscription so refund-review logic (webhook) knows a digital good was delivered
    await supabase
      .from('user_subscriptions')
      .update({ free_domain_claimed: true, free_domain_claimed_at: claimedAt })
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      domain,
      orderId: result.orderId,
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
