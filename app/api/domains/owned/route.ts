import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

/**
 * GET /api/domains/owned
 * Returns all domains owned by the authenticated user, including which site
 * each domain is allocated to (if any).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: domains, error } = await supabase
      .from('domain_purchases')
      .select('id, domain, site_id, status, is_free_with_pro, amount_cents, expires_at, auto_renew, cancelled_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching owned domains:', error);
      return NextResponse.json({ error: 'Failed to fetch domains' }, { status: 500 });
    }

    // Enrich with site names for allocated domains
    const siteIds = (domains || []).filter((d) => d.site_id).map((d) => d.site_id);
    let siteMap: Record<string, string> = {};

    if (siteIds.length > 0) {
      const { data: sites } = await supabase
        .from('sites')
        .select('id, site_slug')
        .in('id', siteIds);

      if (sites) {
        siteMap = Object.fromEntries(sites.map((s) => [s.id, s.site_slug]));
      }
    }

    const enriched = (domains || []).map((d) => ({
      ...d,
      site_name: d.site_id ? siteMap[d.site_id] || null : null,
    }));

    return NextResponse.json({ domains: enriched });
  } catch (error) {
    console.error('Error in /api/domains/owned:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
