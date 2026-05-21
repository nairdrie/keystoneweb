/**
 * Shared auth helper for /api/admin/marketing/* routes.
 *
 * Verifies:
 *  - User is authenticated
 *  - User owns the site referenced by `siteId`
 *  - The site has `marketing_enabled = true`
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

export interface MarketingAccess {
  userId: string;
  userEmail: string;
  siteId: string;
  marketingEnabled: boolean;
  googleAdsCustomerId: string | null;
}

export async function getMarketingAccess(
  request: NextRequest,
  opts: { siteIdFromQuery?: boolean; siteIdFromBody?: Record<string, unknown> } = {},
): Promise<{ access: MarketingAccess } | { error: NextResponse }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  let siteId: string | null = null;
  if (opts.siteIdFromQuery !== false) {
    siteId = request.nextUrl.searchParams.get('siteId');
  }
  if (!siteId && opts.siteIdFromBody) {
    const body = opts.siteIdFromBody;
    siteId = (body.siteId as string) || (body.site_id as string) || null;
  }

  if (!siteId) {
    return { error: NextResponse.json({ error: 'Missing siteId' }, { status: 400 }) };
  }

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, user_id, marketing_enabled, google_ads_customer_id')
    .eq('id', siteId)
    .single();

  if (siteError || !site || site.user_id !== user.id) {
    return { error: NextResponse.json({ error: 'Site not found' }, { status: 404 }) };
  }

  if (!site.marketing_enabled) {
    return { error: NextResponse.json({ error: 'Marketing is not enabled for this site' }, { status: 403 }) };
  }

  return {
    access: {
      userId: user.id,
      userEmail: user.email || '',
      siteId,
      marketingEnabled: site.marketing_enabled,
      googleAdsCustomerId: site.google_ads_customer_id,
    },
  };
}
