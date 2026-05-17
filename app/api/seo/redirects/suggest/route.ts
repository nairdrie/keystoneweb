import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { callAi, getProviderConfig } from '@/lib/ai/ai-client';

/**
 * Given a 404 path, ask the configured AI model which of the site's existing
 * pages is the most likely intended target. Returns { toPath, reason } so the
 * admin UI can offer a one-click "Apply" button.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { siteId, path } = body as { siteId?: string; path?: string };
  if (!siteId || !path) return NextResponse.json({ error: 'siteId and path are required' }, { status: 400 });

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

  const { data: pages } = await supabase
    .from('pages')
    .select('slug, title, display_name')
    .eq('site_id', siteId);

  const pageList = (pages ?? []).map(p => ({
    slug: p.slug,
    path: p.slug === 'home' ? '/' : `/${p.slug}`,
    label: p.display_name || p.title,
  }));

  if (pageList.length === 0) {
    return NextResponse.json({ toPath: '', reason: 'No pages exist on this site yet.' });
  }

  const { apiKey, provider, model } = getProviderConfig();
  if (!apiKey) {
    return NextResponse.json({
      toPath: '',
      reason: 'AI suggestions are unavailable — no AI_BUILDER_API_KEY configured.',
    });
  }

  const system = `You are an SEO assistant. Given a 404'd URL path and the list of real pages on a website, pick the single best page to redirect the broken URL to.
Reply with strict JSON only: {"toPath":"/some-slug","reason":"<one short sentence>"}.
If none of the listed pages is a reasonable match, reply {"toPath":"","reason":"<one short sentence explaining why>"}.
Use exact paths from the list. Never invent a path that isn't in the list.`;

  const userMsg = `Broken path: ${path}

Available pages:
${pageList.map(p => `- ${p.path} (${p.label})`).join('\n')}

Pick the best redirect target.`;

  try {
    const raw = await callAi({ apiKey, model, system, user: userMsg, maxTokens: 300 }, provider);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found in AI response');
    const parsed = JSON.parse(match[0]) as { toPath?: string; reason?: string };

    const toPath = (parsed.toPath || '').trim();
    const reason = (parsed.reason || '').trim();

    if (toPath && !pageList.some(p => p.path === toPath)) {
      return NextResponse.json({ toPath: '', reason: `Model proposed '${toPath}' which is not a real page on this site.` });
    }

    return NextResponse.json({ toPath, reason });
  } catch (err) {
    console.error('redirect suggest failed:', err);
    return NextResponse.json({ toPath: '', reason: 'AI suggestion failed. Try again or set the redirect manually.' });
  }
}
