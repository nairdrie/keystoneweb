import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

const RESERVED_SLUGS = new Set(['home', 'admin', 'design', 'editor', 'preview', 'api', 'auth']);

function normalizeSlug(input: string): string {
  return (input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { siteId, pageId, newSlug, createRedirect = true } = body as {
    siteId?: string;
    pageId?: string;
    newSlug?: string;
    createRedirect?: boolean;
  };
  if (!siteId || !pageId || !newSlug) {
    return NextResponse.json({ error: 'siteId, pageId, newSlug are required' }, { status: 400 });
  }

  const normalized = normalizeSlug(newSlug);
  if (!normalized) return NextResponse.json({ error: 'Slug must contain letters or numbers' }, { status: 400 });
  if (RESERVED_SLUGS.has(normalized)) {
    return NextResponse.json({ error: `'${normalized}' is reserved` }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: site } = await supabase
    .from('sites')
    .select('user_id')
    .eq('id', siteId)
    .single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  if (site.user_id && site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: page, error: pageErr } = await supabase
    .from('pages')
    .select('id, slug')
    .eq('id', pageId)
    .eq('site_id', siteId)
    .single();
  if (pageErr || !page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  const oldSlug = page.slug;
  if (oldSlug === normalized) {
    return NextResponse.json({ ok: true, slug: normalized, redirectCreated: false, unchanged: true });
  }

  // Refuse if another page in this site already uses the new slug.
  const { data: clash } = await supabase
    .from('pages')
    .select('id')
    .eq('site_id', siteId)
    .eq('slug', normalized)
    .neq('id', pageId)
    .maybeSingle();
  if (clash) return NextResponse.json({ error: `Another page already uses '${normalized}'` }, { status: 409 });

  const { error: updateErr } = await supabase
    .from('pages')
    .update({ slug: normalized, updated_at: new Date().toISOString() })
    .eq('id', pageId)
    .eq('site_id', siteId);
  if (updateErr) {
    console.error('seo/pages/slug PATCH failed:', updateErr);
    return NextResponse.json({ error: 'Failed to rename slug' }, { status: 500 });
  }

  let redirectCreated = false;
  if (createRedirect && oldSlug !== 'home') {
    const fromPath = `/${oldSlug}`;
    const toPath = normalized === 'home' ? '/' : `/${normalized}`;
    const { error: redirectErr } = await supabase
      .from('site_redirects')
      .upsert(
        {
          site_id: siteId,
          from_path: fromPath,
          to_path: toPath,
          status_code: 301,
          source: 'auto_slug_rename',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'site_id,from_path' },
      );
    if (redirectErr) console.error('auto-redirect insert failed:', redirectErr);
    else redirectCreated = true;
  }

  return NextResponse.json({ ok: true, slug: normalized, previousSlug: oldSlug, redirectCreated });
}
