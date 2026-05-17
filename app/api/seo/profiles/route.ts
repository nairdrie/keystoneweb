import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

const KNOWN_KEYS = ['applemaps', 'bingplaces', 'yelp', 'facebook', 'tripadvisor', 'nextdoor'] as const;
type ProfileKey = typeof KNOWN_KEYS[number];

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId is required' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: site } = await supabase
    .from('sites')
    .select('user_id, design_data')
    .eq('id', siteId)
    .single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  if (site.user_id && site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const profileChecklist = (site.design_data as { profileChecklist?: Record<string, { claimed?: boolean; profileUrl?: string }> } | null)?.profileChecklist || {};
  return NextResponse.json({ profileChecklist });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const { siteId, key, claimed, profileUrl } = body as { siteId?: string; key?: ProfileKey; claimed?: boolean; profileUrl?: string };
  if (!siteId || !key || !KNOWN_KEYS.includes(key)) {
    return NextResponse.json({ error: 'siteId and a valid profile key are required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: site } = await supabase
    .from('sites')
    .select('user_id, design_data')
    .eq('id', siteId)
    .single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  if (site.user_id && site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const dd = (site.design_data as Record<string, unknown>) || {};
  const existing = ((dd as { profileChecklist?: Record<string, { claimed?: boolean; profileUrl?: string }> }).profileChecklist) || {};
  const merged = {
    ...existing,
    [key]: {
      ...existing[key],
      ...(claimed !== undefined ? { claimed } : {}),
      ...(profileUrl !== undefined ? { profileUrl } : {}),
    },
  };

  const newDesign = { ...dd, profileChecklist: merged };
  const { error } = await supabase
    .from('sites')
    .update({ design_data: newDesign, updated_at: new Date().toISOString() })
    .eq('id', siteId);
  if (error) {
    console.error('profiles PATCH failed:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profileChecklist: merged });
}
