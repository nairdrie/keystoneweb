import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_API_BASE = 'https://api.vercel.com';

/**
 * POST /api/domains/check-transfer-status
 * Check Vercel for domain transfer completion and promote pending_custom_domain if ready.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId } = await request.json();

    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    // Get site with pending domain
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, user_id, pending_custom_domain')
      .eq('id', siteId)
      .single();

    if (siteError || !site || site.user_id !== user.id) {
      return NextResponse.json({ error: 'Site not found or access denied' }, { status: 404 });
    }

    if (!site.pending_custom_domain) {
      return NextResponse.json({ status: 'no_pending_domain', message: 'No pending domain for this site.' });
    }

    const domain = site.pending_custom_domain;

    // Find the transfer purchase record for this domain
    const { data: purchase } = await supabase
      .from('domain_purchases')
      .select('id, transfer_status, purchase_type')
      .eq('site_id', siteId)
      .eq('domain', domain)
      .eq('purchase_type', 'transfer')
      .single();

    if (!purchase) {
      return NextResponse.json({ status: 'no_transfer', message: 'No transfer record found for this domain.' });
    }

    if (!VERCEL_API_TOKEN) {
      return NextResponse.json({ error: 'Domain service not configured' }, { status: 503 });
    }

    // Query Vercel for domain status
    const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
    const vercelRes = await fetch(
      `${VERCEL_API_BASE}/v4/domains/${encodeURIComponent(domain)}${teamParam}`,
      { headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` } }
    );

    if (!vercelRes.ok) {
      return NextResponse.json({
        status: 'pending',
        transferStatus: purchase.transfer_status,
        message: 'Transfer is still in progress.',
      });
    }

    const domainData = await vercelRes.json();

    // Vercel domain statuses: if the domain exists and is verified, transfer is complete
    const isTransferComplete = domainData.verified === true ||
      domainData.serviceType === 'external' ||
      (domainData.domain && !domainData.transferring);

    if (isTransferComplete) {
      // Promote pending domain to active
      await supabase
        .from('sites')
        .update({
          custom_domain: site.pending_custom_domain,
          pending_custom_domain: null,
        })
        .eq('id', siteId);

      // Update transfer status
      await supabase
        .from('domain_purchases')
        .update({ transfer_status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', purchase.id);

      return NextResponse.json({
        status: 'completed',
        domain,
        message: 'Transfer complete! Your custom domain is now active.',
      });
    }

    return NextResponse.json({
      status: 'pending',
      transferStatus: purchase.transfer_status,
      domain,
      message: 'Transfer is still in progress. This typically takes 5-7 days.',
    });
  } catch (error) {
    console.error('Error checking transfer status:', error);
    return NextResponse.json({ error: 'Failed to check transfer status' }, { status: 500 });
  }
}
