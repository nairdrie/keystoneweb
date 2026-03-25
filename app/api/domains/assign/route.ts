import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

/**
 * POST /api/domains/assign
 * Assign an owned (unallocated) domain to a site.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId, domain } = await request.json();

    if (!siteId || !domain) {
      return NextResponse.json(
        { error: 'Missing required fields: siteId, domain' },
        { status: 400 }
      );
    }

    // Verify the user owns this domain and it's unallocated
    const { data: domainPurchase, error: dpError } = await supabase
      .from('domain_purchases')
      .select('id, site_id, status')
      .eq('user_id', user.id)
      .eq('domain', domain)
      .eq('status', 'completed')
      .single();

    if (dpError || !domainPurchase) {
      return NextResponse.json(
        { error: 'Domain not found or not owned by you' },
        { status: 404 }
      );
    }

    if (domainPurchase.site_id) {
      return NextResponse.json(
        { error: 'This domain is already allocated to a site. Unlink it first from your account settings.' },
        { status: 409 }
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

    // Assign domain to site
    const { error: updateDpError } = await supabase
      .from('domain_purchases')
      .update({ site_id: siteId })
      .eq('id', domainPurchase.id);

    if (updateDpError) {
      console.error('Failed to update domain_purchases:', updateDpError);
      return NextResponse.json({ error: 'Failed to assign domain' }, { status: 500 });
    }

    const { error: updateSiteError } = await supabase
      .from('sites')
      .update({ custom_domain: domain })
      .eq('id', siteId);

    if (updateSiteError) {
      console.error('Failed to update site custom_domain:', updateSiteError);
      return NextResponse.json({ error: 'Failed to link domain to site' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      domain,
      message: `Domain ${domain} has been assigned to your site.`,
    });
  } catch (error) {
    console.error('Error assigning domain:', error);
    return NextResponse.json({ error: 'Failed to assign domain' }, { status: 500 });
  }
}
