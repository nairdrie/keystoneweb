import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { callAi, getProviderConfig } from '@/lib/ai/ai-client';
import type { BusinessProfile } from '@/lib/types/sites';

/**
 * Given a single audit check (sent by id + label + detail + fixHint),
 * generate a business-specific, actionable fix paragraph using the configured
 * AI provider. Returns plain text so the UI can render it as a quick callout.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { siteId, checkLabel, checkDetail, fixHint } = body as {
    siteId?: string;
    checkLabel?: string;
    checkDetail?: string;
    fixHint?: string;
  };
  if (!siteId || !checkLabel) return NextResponse.json({ error: 'siteId and checkLabel are required' }, { status: 400 });

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

  const bp = site.business_profile as BusinessProfile | null;
  const dd = (site.design_data as Record<string, unknown>) || {};
  const businessContext = [
    bp?.legalName ? `Business name: ${bp.legalName}` : null,
    site.category ? `Category: ${site.category}` : null,
    site.business_type ? `Business type: ${site.business_type}` : null,
    bp?.addressLocality ? `City: ${bp.addressLocality}, ${bp.addressRegion ?? ''}` : null,
    (dd.tagline as string) ? `Tagline: ${dd.tagline}` : null,
    (dd.siteTitle as string) ? `Site title: ${dd.siteTitle}` : null,
  ].filter(Boolean).join('\n');

  const { apiKey, provider, model } = getProviderConfig();
  if (!apiKey) {
    return NextResponse.json({
      suggestion: 'AI suggestions unavailable — no AI_BUILDER_API_KEY configured. Set the env var to enable AI-generated fixes.',
    });
  }

  const system = `You are an SEO consultant helping a small business owner. Given an audit finding and the business context, give a *concise*, *business-specific* fix that the owner can act on in under 5 minutes.
Output 2-4 short sentences, plain prose. No markdown headings, no bullet lists unless absolutely necessary. Reference the business by name where relevant. Be direct and warm.`;

  const userPrompt = `Business context:
${businessContext || '(none provided)'}

Audit finding:
- ${checkLabel}
- Detail: ${checkDetail || '(none)'}
- Fix hint for you: ${fixHint || 'Give a clear, specific recommendation.'}

Write the fix recommendation.`;

  try {
    const raw = await callAi({ apiKey, model, system, user: userPrompt, maxTokens: 400 }, provider);
    return NextResponse.json({ suggestion: raw.trim() });
  } catch (err) {
    console.error('audit suggest failed:', err);
    return NextResponse.json({
      suggestion: 'AI suggestion failed — please try again, or set the field manually based on the audit detail.',
    });
  }
}
