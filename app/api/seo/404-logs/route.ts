import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

async function assertSiteOwner(supabase: Awaited<ReturnType<typeof createClient>>, siteId: string) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized', status: 401 as const };

  const { data: site } = await supabase
    .from('sites')
    .select('user_id')
    .eq('id', siteId)
    .single();

  if (!site) return { error: 'Site not found', status: 404 as const };
  if (site.user_id && site.user_id !== user.id) return { error: 'Forbidden', status: 403 as const };
  return { user };
}

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('siteId');
  const includeResolved = request.nextUrl.searchParams.get('includeResolved') === '1';
  if (!siteId) return NextResponse.json({ error: 'siteId is required' }, { status: 400 });

  const supabase = await createClient();
  const owner = await assertSiteOwner(supabase, siteId);
  if ('error' in owner) return NextResponse.json({ error: owner.error }, { status: owner.status });

  let q = supabase
    .from('site_404_logs')
    .select('id, path, hit_count, first_hit_at, last_hit_at, referrer_sample, resolved')
    .eq('site_id', siteId)
    .order('hit_count', { ascending: false })
    .limit(200);
  if (!includeResolved) q = q.eq('resolved', false);

  const { data, error } = await q;
  if (error) {
    console.error('404-logs GET failed:', error);
    return NextResponse.json({ error: 'Failed to load 404 logs' }, { status: 500 });
  }
  return NextResponse.json({ logs: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const { siteId, id, resolved } = body as { siteId?: string; id?: string; resolved?: boolean };
  if (!siteId || !id || typeof resolved !== 'boolean') {
    return NextResponse.json({ error: 'siteId, id, resolved are required' }, { status: 400 });
  }

  const supabase = await createClient();
  const owner = await assertSiteOwner(supabase, siteId);
  if ('error' in owner) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const { error } = await supabase
    .from('site_404_logs')
    .update({ resolved })
    .eq('id', id)
    .eq('site_id', siteId);
  if (error) {
    console.error('404-logs PATCH failed:', error);
    return NextResponse.json({ error: 'Failed to update log' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
