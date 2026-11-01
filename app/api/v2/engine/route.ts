/**
 * GET /api/v2/engine?siteId=…  → { siteId, engine }
 * Without siteId, resolves the user's most recently updated site (matching the
 * classic editor's default) so /design can pick the right editor.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getSiteEngine } from '@/lib/v2/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let siteId = request.nextUrl.searchParams.get('siteId');
  try {
    if (!siteId) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ siteId: null, engine: 'blocks_v1' });
      const { data } = await supabase
        .from('sites')
        .select('id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      siteId = data?.id ?? null;
      if (!siteId) return NextResponse.json({ siteId: null, engine: 'blocks_v1' });
    }
    const access = await requireSiteAccess(siteId, request);
    return NextResponse.json({ siteId: access.siteId, engine: await getSiteEngine(createAdminClient(), access.siteId) });
  } catch (e) {
    return siteAccessErrorResponse(e);
  }
}
