import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('siteId');

  let access;
  try {
    access = await requireSiteAccess(siteId, request);
  } catch (e) {
    return siteAccessErrorResponse(e);
  }
  const { supabase } = access;

  const { data: site } = await supabase
    .from('sites')
    .select('contact_ai_replies_enabled')
    .eq('id', siteId!)
    .single();

  return NextResponse.json({
    ai_replies_enabled: site?.contact_ai_replies_enabled ?? true,
  });
}

export async function PUT(request: NextRequest) {
  const { siteId, ai_replies_enabled } = await request.json();

  let access;
  try {
    access = await requireSiteAccess(siteId, request);
  } catch (e) {
    return siteAccessErrorResponse(e);
  }
  const { supabase } = access;

  await supabase
    .from('sites')
    .update({ contact_ai_replies_enabled: Boolean(ai_replies_enabled) })
    .eq('id', siteId);

  return NextResponse.json({ success: true });
}
