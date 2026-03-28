import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

/**
 * GET /api/contact/settings?siteId=...
 * Returns contact inbox settings for the authenticated site owner.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = request.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const { data: site } = await supabase
    .from('sites')
    .select('user_id, contact_ai_replies_enabled')
    .eq('id', siteId)
    .single();

  if (!site || site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    ai_replies_enabled: site.contact_ai_replies_enabled ?? true,
  });
}

/**
 * PUT /api/contact/settings
 * Body: { siteId: string, ai_replies_enabled: boolean }
 */
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId, ai_replies_enabled } = await request.json();
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const { data: site } = await supabase
    .from('sites')
    .select('user_id')
    .eq('id', siteId)
    .single();

  if (!site || site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await supabase
    .from('sites')
    .update({ contact_ai_replies_enabled: Boolean(ai_replies_enabled) })
    .eq('id', siteId);

  return NextResponse.json({ success: true });
}
