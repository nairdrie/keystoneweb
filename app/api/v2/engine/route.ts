/**
 * GET /api/v2/engine?siteId=…  → { siteId, engine, features? }
 * Without siteId, resolves the user's most recently updated site (matching the
 * classic editor's default) so /design can pick the right editor.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getSiteEngine } from '@/lib/v2/store';
import { ENGINE_V2 } from '@/lib/v2/types';
import { featuresIn } from '@/lib/v2/collections';

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
    const db = createAdminClient();
    const engine = await getSiteEngine(db, access.siteId);
    if (engine !== ENGINE_V2) return NextResponse.json({ siteId: access.siteId, engine });
    // Platform features the agent's design uses (drives admin tabs).
    const [{ data: sections }, { data: pages }, { data: layouts }] = await Promise.all([
      db.from('v2_sections').select('html').eq('site_id', access.siteId),
      db.from('pages').select('design_data').eq('site_id', access.siteId),
      db.from('v2_page_layouts').select('instances').eq('site_id', access.siteId),
    ]);
    const features = featuresIn((sections || []).map((s) => String(s.html || '')));
    // Members-only pages or sections also count as using membership.
    if (
      (pages || []).some((p) => (p.design_data as { v2Access?: { members?: boolean } } | null)?.v2Access?.members) ||
      (layouts || []).some((l) => Array.isArray(l.instances) && l.instances.some((i: { audience?: string }) => i?.audience === 'members' || i?.audience === 'guests'))
    ) {
      features.membership = true;
    }
    return NextResponse.json({ siteId: access.siteId, engine, features });
  } catch (e) {
    return siteAccessErrorResponse(e);
  }
}
