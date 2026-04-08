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
      .select('id, site_id, status, auto_renew, cancelled_at')
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

    // Assign domain to site and re-enable auto-renewal if the cron had turned it off
    const dpUpdate: Record<string, unknown> = { site_id: siteId };
    if (!domainPurchase.auto_renew && !domainPurchase.cancelled_at) {
      dpUpdate.auto_renew = true;
      dpUpdate.updated_at = new Date().toISOString();

      // Re-enable on Vercel as well
      const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
      const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
      if (VERCEL_API_TOKEN) {
        const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
        try {
          await fetch(
            `https://api.vercel.com/v1/registrar/domains/${encodeURIComponent(domain)}${teamParam}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${VERCEL_API_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ renew: true }),
            }
          );
        } catch (err) {
          console.error('Failed to re-enable auto-renew on Vercel for', domain, err);
        }
      }
    }

    const { error: updateDpError } = await supabase
      .from('domain_purchases')
      .update(dpUpdate)
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
