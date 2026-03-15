import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

interface LinkRequest {
  siteId: string;
  domain: string;
}

/**
 * POST /api/domains/link-external
 * Link an externally-owned domain to a site and return DNS instructions
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

    const body: LinkRequest = await request.json();
    const { siteId, domain } = body;

    if (!siteId || !domain) {
      return NextResponse.json(
        { error: 'Missing required fields: siteId, domain' },
        { status: 400 }
      );
    }

    // Validate domain format
    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
    if (!domainRegex.test(domain)) {
      return NextResponse.json(
        { error: 'Invalid domain format' },
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

    // Check domain isn't already linked to another site
    const { data: existingDomain } = await supabase
      .from('sites')
      .select('id')
      .eq('custom_domain', domain)
      .neq('id', siteId)
      .single();

    if (existingDomain) {
      return NextResponse.json(
        { error: 'This domain is already linked to another site' },
        { status: 409 }
      );
    }

    // Update site with custom domain (pending verification)
    const { error: updateError } = await supabase
      .from('sites')
      .update({ custom_domain: domain })
      .eq('id', siteId);

    if (updateError) {
      console.error('Failed to link custom domain:', updateError);
      return NextResponse.json(
        { error: 'Failed to link domain' },
        { status: 500 }
      );
    }

    // Create DNS verification record
    const verificationToken = `kswd-verify-${siteId.slice(0, 8)}`;

    // Upsert DNS records for the external domain
    // Remove old records for this site first
    await supabase
      .from('dns_records')
      .delete()
      .eq('site_id', siteId);

    // Insert required DNS records
    await supabase.from('dns_records').insert([
      {
        site_id: siteId,
        record_type: 'CNAME',
        name: domain,
        value: 'sites.kswd.ca',
        ttl: 3600,
      },
      {
        site_id: siteId,
        record_type: 'TXT',
        name: domain,
        value: verificationToken,
        ttl: 3600,
      },
    ]);

    return NextResponse.json({
      success: true,
      domain,
      dnsInstructions: {
        records: [
          {
            type: 'CNAME',
            name: 'www',
            value: 'sites.kswd.ca',
            description: 'Points your domain to Keystoneweb servers',
          },
          {
            type: 'A',
            name: '@',
            value: '76.76.21.21',
            description: 'Points your root domain to Keystoneweb (Vercel)',
          },
          {
            type: 'TXT',
            name: '@',
            value: verificationToken,
            description: 'Verifies you own this domain',
          },
        ],
        note: 'DNS changes can take up to 48 hours to propagate, but usually take effect within a few minutes.',
      },
      message: 'Domain linked! Please configure the DNS records below at your domain registrar.',
    });
  } catch (error) {
    console.error('Error linking external domain:', error);
    return NextResponse.json(
      { error: 'Failed to link domain' },
      { status: 500 }
    );
  }
}
