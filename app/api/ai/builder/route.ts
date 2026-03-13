import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { buildSystemPrompt } from '@/lib/ai/builder-schema';

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pro user check
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('subscription_status')
      .eq('user_id', user.id)
      .single();

    if (!subscription || subscription.subscription_status !== 'active') {
      return NextResponse.json({ error: 'AI Builder requires an active Pro subscription.' }, { status: 403 });
    }

    const apiKey = process.env.AI_BUILDER_API_KEY;
    const apiProvider = process.env.AI_BUILDER_PROVIDER || 'anthropic'; // 'anthropic' | 'openai'
    const modelId = process.env.AI_BUILDER_MODEL || (apiProvider === 'anthropic' ? 'claude-sonnet-4-5-20250514' : 'gpt-4o-mini');

    if (!apiKey) {
      return NextResponse.json({ error: 'AI Builder is not configured. Please set AI_BUILDER_API_KEY.' }, { status: 500 });
    }

    const body = await req.json();
    const { prompt, siteState, availablePalettes } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing prompt.' }, { status: 400 });
    }

    // Build the user message with current site context
    const siteContext = siteState ? `
CURRENT SITE STATE:
- Site Title: "${siteState.title || 'Untitled'}"
- Current Blocks: ${JSON.stringify(siteState.blocks?.map((b: any) => ({ id: b.id, type: b.type, data: b.data })) || [], null, 2)}
- Current Palette: ${siteState.palette || 'default'}
- Heading Font: ${siteState.headingFont || 'default'}
- Body Font: ${siteState.bodyFont || 'default'}
` : '';

    const systemPrompt = buildSystemPrompt(availablePalettes || []);

    const userMessage = `${siteContext}

USER REQUEST: ${prompt}`;

    let aiResponse: string;

    if (apiProvider === 'anthropic') {
      aiResponse = await callAnthropic(apiKey, modelId, systemPrompt, userMessage);
    } else {
      aiResponse = await callOpenAI(apiKey, modelId, systemPrompt, userMessage);
    }

    // Parse the AI response as JSON
    let parsed;
    try {
      // Strip markdown code fences if present
      let cleaned = aiResponse.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({
        operations: [],
        message: aiResponse.slice(0, 500),
        raw: aiResponse,
        parseError: true,
      });
    }

    return NextResponse.json({
      operations: parsed.operations || [],
      message: parsed.message || 'Done.',
    });
  } catch (err: any) {
    console.error('AI Builder error:', err);
    return NextResponse.json({ error: err.message || 'AI Builder failed.' }, { status: 500 });
  }
}

async function callAnthropic(apiKey: string, model: string, system: string, userMessage: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

async function callOpenAI(apiKey: string, model: string, system: string, userMessage: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}
