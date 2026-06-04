import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

export interface AuctionsAccess {
  userId: string;
  userEmail: string;
  siteId: string;
  stripeAccountId: string | null;
}

export async function getAuctionsAccess(
  request: NextRequest,
  opts: { siteIdFromQuery?: boolean; siteIdFromBody?: Record<string, unknown> } = {},
): Promise<{ access: AuctionsAccess } | { error: NextResponse }> {
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
    .select('id, user_id, auctions_enabled, stripe_account_id')
    .eq('id', siteId)
    .single();

  if (siteError || !site || site.user_id !== user.id) {
    return { error: NextResponse.json({ error: 'Site not found' }, { status: 404 }) };
  }

  if (!site.auctions_enabled) {
    return { error: NextResponse.json({ error: 'Auctions are not enabled for this site' }, { status: 403 }) };
  }

  return {
    access: {
      userId: user.id,
      userEmail: user.email || '',
      siteId,
      stripeAccountId: site.stripe_account_id ?? null,
    },
  };
}
