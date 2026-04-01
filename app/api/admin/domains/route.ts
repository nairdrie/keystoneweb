import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

/**
 * GET /api/admin/domains?siteId=xxx
 * Returns domain status summary for a site (used by admin Domains tab)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    // Get site domain info
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, user_id, published_domain, custom_domain, pending_custom_domain')
      .eq('id', siteId)
      .single();

    if (siteError || !site || site.user_id !== user.id) {
      if(siteError) {
        console.error('Error fetching site:', siteError)
        return NextResponse.json({ error: siteError }, { status: 500 });
      }
      return NextResponse.json({ error: 'Site not found or access denied' }, { status: 404 });
    }

    // CHECK TRANSFER STATUS ON DEMAND
    // If there's a pending domain, check if the transfer is complete
    if (site.pending_custom_domain) {
      const { data: currentTransfer } = await supabase
        .from('domain_purchases')
        .select('transfer_status')
        .eq('site_id', siteId)
        .eq('domain', site.pending_custom_domain)
        .eq('transfer_status', 'initiated')
        .limit(1)
        .single();

      if (currentTransfer) {
        const { checkAndPromoteTransfer } = await import('@/lib/domains/status');
        await checkAndPromoteTransfer(site.pending_custom_domain, siteId, user.id);
      }
    } else if (site.custom_domain) {
        // SELF-HEALING: If it's already "completed" in our DB, check if Vercel says it's still transferring
        const { data: completedTransfer } = await supabase
            .from('domain_purchases')
            .select('transfer_status')
            .eq('site_id', siteId)
            .eq('domain', site.custom_domain)
            .eq('transfer_status', 'completed')
            .limit(1)
            .single();
        
        if (completedTransfer) {
            console.log(`GET /api/admin/domains: Domain ${site.custom_domain} is marked completed. Verifying with Vercel...`);
            const { checkAndPromoteTransfer } = await import('@/lib/domains/status');
            await checkAndPromoteTransfer(site.custom_domain, siteId, user.id);
        }
    }

    // Re-fetch site info to reflect any changes (promotion OR demotion)
    const { data: refreshedSite } = await supabase
        .from('sites')
        .select('id, user_id, published_domain, custom_domain, pending_custom_domain')
        .eq('id', siteId)
        .single();
    
    if (refreshedSite) {
        site.custom_domain = refreshedSite.custom_domain;
        site.pending_custom_domain = refreshedSite.pending_custom_domain;
    }

    // Get owned domains linked to this site
    const { data: ownedDomains } = await supabase
      .from('domain_purchases')
      .select('id, domain, status, purchase_type, transfer_status, expires_at, auto_renew, is_free_with_pro')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });

    // Check transfer status for pending domain
    let transferStatus: string | null = null;
    let transferDomain: string | null = null;

    if (site.pending_custom_domain) {
      const { data: transferPurchases } = await supabase
        .from('domain_purchases')
        .select('transfer_status, domain')
        .eq('site_id', siteId)
        .eq('domain', site.pending_custom_domain)
        .not('transfer_status', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      const transferPurchase = transferPurchases?.[0] ?? null;
      if (transferPurchase) {
        transferStatus = transferPurchase.transfer_status;
        transferDomain = transferPurchase.domain;
      }
    }

    return NextResponse.json({
      publishedDomain: site.published_domain,
      customDomain: site.custom_domain,
      pendingCustomDomain: site.pending_custom_domain,
      dnsChecks: null, // Will be populated by verify-dns calls
      transferStatus,
      transferDomain,
      ownedDomains: ownedDomains || [],
    });
  } catch (error) {
    console.error('Error fetching domain status:', error);
    return NextResponse.json({ error: 'Failed to fetch domain status' }, { status: 500 });
  }
}
