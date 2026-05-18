import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { callAi, getProviderConfig } from '@/lib/ai/ai-client';
import type { BusinessProfile } from '@/lib/types/sites';

type Field = 'seoTitle' | 'seoDescription' | 'ogAlt';

interface Block { type?: string; data?: Record<string, unknown> | null }

function extractText(blocks: Block[], limit = 1500): string {
  const out: string[] = [];
  for (const block of blocks) {
    const d = (block.data ?? {}) as Record<string, unknown>;
    for (const key of ['title', 'subtitle', 'heading', 'description', 'body', 'text']) {
      const v = d[key];
      if (typeof v === 'string' && v.trim()) out.push(v.trim());
    }
    if (Array.isArray(d.items)) {
      for (const item of d.items as Array<Record<string, unknown>>) {
        if (typeof item.title === 'string') out.push(item.title);
        if (typeof item.description === 'string') out.push(item.description);
        if (typeof item.question === 'string') out.push(item.question);
      }
    }
    if (out.join(' ').length > limit) break;
  }
  return out.join('\n').slice(0, limit);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { siteId, pageId, field } = body as { siteId?: string; pageId?: string; field?: Field };
  if (!siteId || !pageId || !field) {
    return NextResponse.json({ error: 'siteId, pageId, field are required' }, { status: 400 });
  }
  if (!['seoTitle', 'seoDescription', 'ogAlt'].includes(field)) {
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: site } = await supabase
    .from('sites')
    .select('user_id, business_profile, category, business_type, design_data')
    .eq('id', siteId)
    .single();
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  if (site.user_id && site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: page } = await supabase
    .from('pages')
    .select('slug, title, display_name, design_data')
    .eq('id', pageId)
    .eq('site_id', siteId)
    .single();
  if (!page) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  const bp = site.business_profile as BusinessProfile | null;
  const dd = (page.design_data as Record<string, unknown>) || {};
  const blocks: Block[] = Array.isArray(dd.blocks) ? (dd.blocks as Block[]) : [];
  const pageContent = extractText(blocks);

  const businessContext = [
    bp?.legalName ? `Business: ${bp.legalName}` : null,
    site.category ? `Category: ${site.category}` : null,
    bp?.addressLocality ? `Location: ${bp.addressLocality}, ${bp.addressRegion ?? ''}` : null,
    `Page slug: /${page.slug === 'home' ? '' : page.slug}`,
    `Page name: ${page.display_name || page.title}`,
  ].filter(Boolean).join('\n');

  const fieldSpec = {
    seoTitle: { max: 60, label: 'SEO title (shown in browser tabs and search results)', sentences: 'Single line, 50-60 characters. Include the page topic and city if local.' },
    seoDescription: { max: 160, label: 'Meta description (shown under the page title in search results)', sentences: '1-2 sentences, 140-160 characters. Persuasive but factual. Include a clear value proposition.' },
    ogAlt: { max: 125, label: 'Open Graph image alt text', sentences: '1 sentence describing the OG image. Mentions the business and the scene/subject.' },
  }[field];

  const { apiKey, provider, model } = getProviderConfig();
  if (!apiKey) return NextResponse.json({ error: 'AI_BUILDER_API_KEY not configured' }, { status: 500 });

  const system = `You are an SEO copywriter. Generate ONLY the requested text — no commentary, no quotes, no markdown. Stay within the character limit. Output a single, clean string.`;

  const userPrompt = `Generate ${fieldSpec.label} for this page.

Constraints:
- Max ${fieldSpec.max} characters
- ${fieldSpec.sentences}

${businessContext}

Page content excerpt:
${pageContent || '(empty page)'}

Reply with just the text.`;

  try {
    const raw = await callAi({ apiKey, model, system, user: userPrompt, maxTokens: 200 }, provider);
    const cleaned = raw.trim().replace(/^["']|["']$/g, '').slice(0, fieldSpec.max);
    return NextResponse.json({ value: cleaned });
  } catch (err) {
    console.error('seo/pages/generate failed:', err);
    return NextResponse.json({ error: 'AI generation failed' }, { status: 502 });
  }
}
