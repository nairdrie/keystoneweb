import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

function normalizePath(input: string): string {
  let p = (input || '').trim();
  if (!p) return '';
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

// True when the input is an absolute URL (http(s)://...) or a bare hostname
// like "kswd.ca" or "example.com/path". Used for the redirect "to" field so
// users can point a redirect at another site, not just another path on the
// same site.
function looksLikeExternalUrl(input: string): boolean {
  const s = (input || '').trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  // Bare-hostname heuristic: starts with a label, has a dot followed by a TLD
  // of at least 2 letters, no leading slash.
  if (s.startsWith('/')) return false;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/.*)?$/i.test(s);
}

function normalizeDestination(input: string): string {
  const s = (input || '').trim();
  if (!s) return '';
  if (looksLikeExternalUrl(s)) {
    return /^https?:\/\//i.test(s) ? s : `https://${s}`;
  }
  return normalizePath(s);
}

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
  if (!siteId) return NextResponse.json({ error: 'siteId is required' }, { status: 400 });

  const supabase = await createClient();
  const owner = await assertSiteOwner(supabase, siteId);
  if ('error' in owner) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const { data, error } = await supabase
    .from('site_redirects')
    .select('id, from_path, to_path, status_code, source, hit_count, last_hit_at, created_at')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('redirects GET failed:', error);
    return NextResponse.json({ error: 'Failed to load redirects' }, { status: 500 });
  }

  return NextResponse.json({ redirects: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { siteId, fromPath, toPath, statusCode = 301, source = 'manual' } = body;
  if (!siteId || !fromPath || !toPath) {
    return NextResponse.json({ error: 'siteId, fromPath, toPath are required' }, { status: 400 });
  }

  const from = normalizePath(fromPath);
  const to = normalizeDestination(toPath);
  if (!from || !to) return NextResponse.json({ error: 'fromPath and toPath cannot be empty' }, { status: 400 });
  if (from === to) return NextResponse.json({ error: 'Source and destination cannot be the same' }, { status: 400 });

  const supabase = await createClient();
  const owner = await assertSiteOwner(supabase, siteId);
  if ('error' in owner) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const { data, error } = await supabase
    .from('site_redirects')
    .upsert(
      {
        site_id: siteId,
        from_path: from,
        to_path: to,
        status_code: statusCode,
        source,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'site_id,from_path' },
    )
    .select()
    .single();

  if (error) {
    console.error('redirects POST failed:', error);
    return NextResponse.json({ error: 'Failed to save redirect' }, { status: 500 });
  }

  return NextResponse.json({ redirect: data });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const siteId = request.nextUrl.searchParams.get('siteId');
  if (!id || !siteId) return NextResponse.json({ error: 'id and siteId are required' }, { status: 400 });

  const supabase = await createClient();
  const owner = await assertSiteOwner(supabase, siteId);
  if ('error' in owner) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const { error } = await supabase
    .from('site_redirects')
    .delete()
    .eq('id', id)
    .eq('site_id', siteId);

  if (error) {
    console.error('redirects DELETE failed:', error);
    return NextResponse.json({ error: 'Failed to delete redirect' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
