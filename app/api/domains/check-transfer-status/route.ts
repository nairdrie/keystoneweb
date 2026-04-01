import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { checkAndPromoteTransfer } from '@/lib/domains/status';

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

    const finished = await checkAndPromoteTransfer(domain, siteId, user.id);

    if (finished) {
      return NextResponse.json({
        status: 'completed',
        domain,
        message: 'Transfer complete! Your custom domain is now active.',
      });
    }

    return NextResponse.json({
      status: 'pending',
      domain,
      message: 'Transfer is still in progress. This typically takes 5-7 days.',
    });
  } catch (error) {
    console.error('Error checking transfer status:', error);
    return NextResponse.json({ error: 'Failed to check transfer status' }, { status: 500 });
  }
}
