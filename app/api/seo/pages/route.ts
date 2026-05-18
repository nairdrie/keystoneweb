import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

type SeoFields = {
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  canonical?: string;
  robotsNoindex?: boolean;
  robotsNofollow?: boolean;
};

const SEO_KEYS: (keyof SeoFields)[] = [
  'seoTitle',
  'seoDescription',
  'ogImage',
  'ogTitle',
  'ogDescription',
  'twitterTitle',
  'twitterDescription',
  'twitterImage',
  'canonical',
  'robotsNoindex',
  'robotsNofollow',
];

function extractSeo(designOrPublished: Record<string, unknown> | null | undefined): SeoFields {
  const src = (designOrPublished ?? {}) as Record<string, unknown>;
  const out: SeoFields = {};
  for (const k of SEO_KEYS) {
    if (src[k] !== undefined) (out as Record<string, unknown>)[k] = src[k];
  }
  return out;
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
    .from('pages')
    .select('id, slug, title, display_name, design_data, published_data, updated_at')
    .eq('site_id', siteId)
    .order('nav_order', { ascending: true });

  if (error) {
    console.error('seo/pages GET failed:', error);
    return NextResponse.json({ error: 'Failed to load pages' }, { status: 500 });
  }

  const pages = (data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    displayName: p.display_name,
    updatedAt: p.updated_at,
    seo: extractSeo(p.design_data as Record<string, unknown> | null),
    publishedSeo: extractSeo(p.published_data as Record<string, unknown> | null),
  }));

  return NextResponse.json({ pages });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { siteId, pageId, seo } = body as { siteId?: string; pageId?: string; seo?: SeoFields };
  if (!siteId || !pageId || !seo) {
    return NextResponse.json({ error: 'siteId, pageId, seo are required' }, { status: 400 });
  }

  const supabase = await createClient();
  const owner = await assertSiteOwner(supabase, siteId);
  if ('error' in owner) return NextResponse.json({ error: owner.error }, { status: owner.status });

  const { data: page, error: fetchErr } = await supabase
    .from('pages')
    .select('id, design_data')
    .eq('id', pageId)
    .eq('site_id', siteId)
    .single();

  if (fetchErr || !page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  const designData = (page.design_data as Record<string, unknown>) || {};
  const merged: Record<string, unknown> = { ...designData };
  for (const k of SEO_KEYS) {
    if (seo[k] !== undefined) merged[k] = seo[k];
  }

  const { error: updateErr } = await supabase
    .from('pages')
    .update({ design_data: merged, updated_at: new Date().toISOString() })
    .eq('id', pageId)
    .eq('site_id', siteId);

  if (updateErr) {
    console.error('seo/pages PATCH failed:', updateErr);
    return NextResponse.json({ error: 'Failed to save SEO' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, seo: extractSeo(merged) });
}
