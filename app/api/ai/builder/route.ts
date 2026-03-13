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

    // Limit prompt length to prevent abuse / excessive token usage
    if (prompt.length > 2000) {
      return NextResponse.json({ error: 'Prompt is too long. Please keep it under 2000 characters.' }, { status: 400 });
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

    // Server-side validation: sanitize operations before returning to client.
    // Even if the LLM is manipulated via prompt injection, only valid operations
    // with valid block types can pass through.
    const sanitized = sanitizeOperations(parsed.operations || []);

    return NextResponse.json({
      operations: sanitized,
      message: typeof parsed.message === 'string' ? parsed.message.slice(0, 1000) : 'Done.',
    });
  } catch (err: any) {
    // Log full error server-side only — never expose raw provider messages to the client
    console.error('AI Builder error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again in a moment.' }, { status: 500 });
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
    // Log full details server-side only
    console.error(`Anthropic API error ${res.status}:`, errBody);
    throw new Error('AI service unavailable.');
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ---- Server-side operation sanitizer ----
// This is the security boundary. No matter what the LLM returns, only known
// operations with valid block types pass through. This prevents prompt injection
// from producing arbitrary payloads.

const VALID_OPS = new Set(['addBlock', 'updateBlock', 'removeBlock', 'reorderBlocks', 'setSiteTitle', 'setFont', 'setCustomColors']);
const VALID_BLOCK_TYPES = new Set([
  'hero', 'text', 'image', 'servicesGrid', 'featuresList', 'aboutImageText',
  'testimonials', 'stats', 'gallery', 'contact', 'faq', 'cta', 'booking',
  'productGrid', 'contact_form', 'map', 'custom_html',
]);
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

function sanitizeOperations(operations: any[]): any[] {
  if (!Array.isArray(operations)) return [];

  return operations
    .filter((op): op is Record<string, any> => op && typeof op === 'object' && VALID_OPS.has(op.op))
    .map(op => {
      switch (op.op) {
        case 'addBlock': {
          if (!VALID_BLOCK_TYPES.has(op.blockType)) return null;
          const data = (typeof op.data === 'object' && op.data !== null) ? op.data : {};
          // Strip <script> tags from any string value in block data
          const cleanData = deepSanitizeStrings(data);
          return {
            op: 'addBlock',
            blockType: op.blockType,
            data: cleanData,
            ...(typeof op.index === 'number' ? { index: Math.max(0, Math.floor(op.index)) } : {}),
          };
        }
        case 'updateBlock': {
          if (typeof op.blockId !== 'string' || typeof op.updates !== 'object') return null;
          return { op: 'updateBlock', blockId: op.blockId, updates: deepSanitizeStrings(op.updates) };
        }
        case 'removeBlock': {
          if (typeof op.blockId !== 'string') return null;
          return { op: 'removeBlock', blockId: op.blockId };
        }
        case 'reorderBlocks': {
          if (!Array.isArray(op.blockIds) || !op.blockIds.every((id: any) => typeof id === 'string')) return null;
          return { op: 'reorderBlocks', blockIds: op.blockIds };
        }
        case 'setSiteTitle': {
          if (typeof op.title !== 'string') return null;
          return { op: 'setSiteTitle', title: stripTags(op.title).slice(0, 200) };
        }
        case 'setFont': {
          if (!['heading', 'body'].includes(op.target) || typeof op.font !== 'string') return null;
          // Only allow alphanumeric + spaces (Google Font names)
          const fontName = op.font.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50);
          return { op: 'setFont', target: op.target, font: fontName };
        }
        case 'setCustomColors': {
          const colors: Record<string, string> = {};
          for (const key of ['primary', 'secondary', 'accent'] as const) {
            if (typeof op[key] === 'string' && HEX_COLOR.test(op[key])) {
              colors[key] = op[key];
            }
          }
          if (Object.keys(colors).length === 0) return null;
          return { op: 'setCustomColors', ...colors };
        }
        default:
          return null;
      }
    })
    .filter(Boolean);
}

/** Recursively sanitize all string values: strip script tags and event handlers */
function deepSanitizeStrings(obj: any): any {
  if (typeof obj === 'string') return stripTags(obj);
  if (Array.isArray(obj)) return obj.map(deepSanitizeStrings);
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      // Drop any keys that look like event handlers
      if (/^on[A-Z]/.test(key)) continue;
      result[key] = deepSanitizeStrings(val);
    }
    return result;
  }
  return obj;
}

/** Strip <script> tags and javascript: URIs from a string */
function stripTags(str: string): string {
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script[\s>]/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
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
    console.error(`OpenAI API error ${res.status}:`, errBody);
    throw new Error('AI service unavailable.');
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}
