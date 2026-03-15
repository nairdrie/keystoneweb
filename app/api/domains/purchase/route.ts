import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

const GODADDY_API_KEY = process.env.GODADDY_API_KEY;
const GODADDY_API_SECRET = process.env.GODADDY_API_SECRET;
const GODADDY_BASE_URL = process.env.GODADDY_ENV === 'production'
  ? 'https://api.godaddy.com'
  : 'https://api.ote-godaddy.com';

interface PurchaseRequest {
  siteId: string;
  domain: string;
}

/**
 * POST /api/domains/purchase
 * Purchase a domain via GoDaddy and link it to a site
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

    if (!GODADDY_API_KEY || !GODADDY_API_SECRET) {
      return NextResponse.json(
        { error: 'Domain purchasing is not configured. Contact support.' },
        { status: 503 }
      );
    }

    // Fetch user profile for contact info
    const { data: userProfile } = await supabase
      .from('users')
      .select('email, business_name')
      .eq('id', user.id)
      .single();

    // Purchase domain via GoDaddy
    const purchaseRes = await fetch(
      `${GODADDY_BASE_URL}/v1/domains/purchase`,
      {
        method: 'POST',
        headers: {
          'Authorization': `sso-key ${GODADDY_API_KEY}:${GODADDY_API_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain,
          consent: {
            agreedAt: new Date().toISOString(),
            agreedBy: user.id,
            agreementKeys: ['DNRA'],
          },
          contactAdmin: {
            email: userProfile?.email || user.email,
            nameFirst: userProfile?.business_name || 'Site',
            nameLast: 'Owner',
            phone: '+1.0000000000',
            addressMailing: {
              address1: 'TBD',
              city: 'TBD',
              state: 'TBD',
              postalCode: '00000',
              country: 'CA',
            },
          },
          contactBilling: {
            email: userProfile?.email || user.email,
            nameFirst: userProfile?.business_name || 'Site',
            nameLast: 'Owner',
            phone: '+1.0000000000',
            addressMailing: {
              address1: 'TBD',
              city: 'TBD',
              state: 'TBD',
              postalCode: '00000',
              country: 'CA',
            },
          },
          contactRegistrant: {
            email: userProfile?.email || user.email,
            nameFirst: userProfile?.business_name || 'Site',
            nameLast: 'Owner',
            phone: '+1.0000000000',
            addressMailing: {
              address1: 'TBD',
              city: 'TBD',
              state: 'TBD',
              postalCode: '00000',
              country: 'CA',
            },
          },
          contactTech: {
            email: userProfile?.email || user.email,
            nameFirst: 'Keystoneweb',
            nameLast: 'Support',
            phone: '+1.0000000000',
            addressMailing: {
              address1: 'TBD',
              city: 'TBD',
              state: 'TBD',
              postalCode: '00000',
              country: 'CA',
            },
          },
          period: 1,
          privacy: true,
          renewAuto: true,
        }),
      }
    );

    if (!purchaseRes.ok) {
      const errorData = await purchaseRes.text();
      console.error('GoDaddy purchase failed:', errorData);
      return NextResponse.json(
        { error: 'Domain purchase failed. Please try again or contact support.' },
        { status: 502 }
      );
    }

    const purchaseData = await purchaseRes.json();

    // Update site with custom domain
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

    // Create DNS records for the custom domain
    // CNAME pointing to the published subdomain
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
