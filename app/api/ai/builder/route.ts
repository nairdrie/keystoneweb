import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { buildSystemPrompt, generateCreativeSeed, type WizardData } from '@/lib/ai/builder-schema';
import { AI_SUPPORTED_BLOCK_TYPES, sanitizeAiBlockData, sanitizeAiCustomColors, sanitizeAiHeaderConfig } from '@/lib/ai/block-capabilities';
import { orchestrateNewSiteBuild, type ProgressEvent } from '@/lib/ai/builder-orchestrator';
import { AI_ONBOARDING_TEMPLATE_ID } from '@/lib/templates/ai-template';
import { sanitizeAiSampleDataPayload, hasAiSampleData } from '@/lib/ai/sample-data';
import { checkAndRecordUsage, getUsageRemaining, UserPlan } from './rate-limit';
import { getUserEffectiveLimits } from '@/lib/addons';

// ── Helpers ────────────────────────────────────────────────────────────────

function getPlan(status: string | undefined, plan: string | undefined): UserPlan {
  // Grace-aware: past_due keeps its paid tier during the dunning window.
  if (status !== 'active' && status !== 'past_due') return 'free';
  if (plan?.toLowerCase().includes('pro')) return 'pro';
  return 'basic';
}

// ── GET /api/ai/builder — return remaining usage without consuming a prompt ─

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('subscription_status, subscription_plan, subscription_started_at')
      .eq('user_id', user.id)
      .single();

    const plan = getPlan(subscription?.subscription_status, subscription?.subscription_plan);
    const effectiveLimits = await getUserEffectiveLimits(user.id, supabase);
    // ai_prompt_usage has no user-level policies; read/write via the admin client.
    const admin = createAdminClient();
    const remaining = await getUsageRemaining(
      user.id,
      plan,
      subscription?.subscription_started_at ?? null,
      admin,
      effectiveLimits.aiMultiplier,
    );

    return NextResponse.json({ remaining });
  } catch (err) {
    console.error('AI Builder usage check error:', err);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}

// ── POST /api/ai/builder — check limits, record usage, call AI ─────────────

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ops admin check — admins bypass rate limits and prompt length restrictions
    const { data: opsProfile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    const isOpsAdmin = opsProfile?.is_admin ?? false;

    // Subscription check
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('subscription_status, subscription_plan, subscription_started_at')
      .eq('user_id', user.id)
      .single();

    const plan = getPlan(subscription?.subscription_status, subscription?.subscription_plan);

    // Rate limit check + record usage in DB (ops admins skip).
    // ai_prompt_usage has no user-level policies; read/write via the admin client.
    let rateLimitResult: { allowed: boolean; remaining?: any; message?: string; upgradeRequired?: boolean };
    if (isOpsAdmin) {
      rateLimitResult = { allowed: true };
    } else {
      const aiLimits = await getUserEffectiveLimits(user.id, supabase);
      const admin = createAdminClient();
      rateLimitResult = await checkAndRecordUsage(
        user.id,
        plan,
        subscription?.subscription_started_at ?? null,
        admin,
        aiLimits.aiMultiplier,
      );
    }

    if (!rateLimitResult.allowed) {
      return NextResponse.json({
        error: rateLimitResult.message,
        remaining: rateLimitResult.remaining,
        ...(rateLimitResult.upgradeRequired ? { upgradeRequired: true } : {}),
      }, { status: 429 });
    }

    const apiKey = process.env.AI_BUILDER_API_KEY;
    const apiProvider = process.env.AI_BUILDER_PROVIDER || 'anthropic'; // 'anthropic' | 'openai'
    const modelId = process.env.AI_BUILDER_MODEL || (apiProvider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o-mini');

    if (!apiKey) {
      return NextResponse.json({ error: 'AI Builder is not configured. Please set AI_BUILDER_API_KEY.' }, { status: 500 });
    }

    const body = await req.json();
    const { prompt, history, siteState, availablePalettes, isNewSite, wizardData } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing prompt.' }, { status: 400 });
    }

    // Limit prompt length to prevent abuse / excessive token usage.
    // Ops admins get an unlimited prompt length for internal site building.
    if (!isOpsAdmin && prompt.length > 1000) {
      return NextResponse.json({ error: 'Prompt is too long. Please keep it under 1000 characters.' }, { status: 400 });
    }

    // ── Orchestrator path ─────────────────────────────────────────────
    // For new-site builds with structured wizard data, run the multi-pass
    // orchestrator and stream NDJSON progress events back to the client.
    // Falls through to the single-call path below if either flag is missing.
    if (isNewSite && wizardData && typeof wizardData === 'object') {
      const wd = sanitizeWizardData(wizardData);
      console.log(`[AI Builder] Orchestrating new-site build — userId=${user.id} pages=${wd.pageLabels?.join(',') ?? 'none'}`);
      return streamOrchestrator({
        wizardData: wd,
        availablePalettes: Array.isArray(availablePalettes) ? availablePalettes : [],
        remaining: rateLimitResult.remaining,
        signal: req.signal,
      });
    }

    // Filter history to latest N messages (e.g., 10 turns) to manage context window
    const sanitizedHistory = (Array.isArray(history) ? history : [])
      .slice(-20) // Latest 10 turns (user+ai)
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.content === 'string' ? m.content.slice(0, 1000) : '',
      }));

    // Build the user message with current site context
    const siteContext = siteState ? `
CURRENT SITE STATE:
- Site Title: "${siteState.title || 'Untitled'}"
- Current Blocks: ${JSON.stringify(siteState.blocks?.map((b: any) => ({ id: b.id, type: b.type, data: b.data })) || [], null, 2)}
- Current Palette: ${siteState.palette || 'default'}
- Heading Font: ${siteState.headingFont || 'default'}
- Body Font: ${siteState.bodyFont || 'default'}
` : '';

    // For NEW site builds, mint a fresh creative seed so every user gets a
    // visibly different site even when their prompts are similar. Skipped for
    // incremental edits — those should stay consistent with what's there.
    const creativeSeed = isNewSite ? generateCreativeSeed() : undefined;
    const systemPrompt = buildSystemPrompt(availablePalettes || [], creativeSeed);

    const newSiteContext = isNewSite ? `
CONTEXT: This is a BRAND NEW site being built from scratch via onboarding. Use the AI-only Custom baseline and replace any starter blocks with blocks tailored to the user's request.
` : '';

    const latestUserMessage = `${siteContext}${newSiteContext}
USER REQUEST: ${prompt}`;

    let aiResponse: string;

    const startTime = Date.now();
    console.log(`[AI Builder] Request started — provider=${apiProvider} model=${modelId} promptLen=${prompt.length} historyLen=${sanitizedHistory.length} isNewSite=${!!isNewSite} isOpsAdmin=${isOpsAdmin} userId=${user.id}`);
    console.log(`[AI Builder] Prompt: ${prompt.slice(0, 500)}${prompt.length > 500 ? `... (${prompt.length} chars total)` : ''}`);
    if (creativeSeed) {
      console.log(`[AI Builder] Creative seed:`, creativeSeed);
    }

    try {
      if (apiProvider === 'anthropic') {
        aiResponse = await callAnthropic(apiKey, modelId, systemPrompt, sanitizedHistory, latestUserMessage);
      } else {
        aiResponse = await callOpenAI(apiKey, modelId, systemPrompt, sanitizedHistory, latestUserMessage);
      }
    } catch (providerErr: any) {
      const elapsed = Date.now() - startTime;
      const isTimeout = providerErr?.name === 'AbortError' || /timed?\s*out|timeout|ETIMEDOUT|ECONNRESET|socket hang up/i.test(providerErr?.message || '');
      console.error(`[AI Builder] ${isTimeout ? 'TIMEOUT' : 'Provider error'} after ${elapsed}ms — provider=${apiProvider} model=${modelId} promptLen=${prompt.length}`, providerErr?.message || providerErr);
      return NextResponse.json({
        error: isTimeout
          ? 'The AI took too long to respond. Try a shorter or simpler prompt.'
          : 'Something went wrong. Please try again in a moment.',
      }, { status: isTimeout ? 504 : 500 });
    }

    const elapsed = Date.now() - startTime;
    console.log(`[AI Builder] Response received in ${elapsed}ms — responseLen=${aiResponse.length}`);

    // Parse the AI response as JSON — try multiple extraction strategies
    let parsed;
    try {
      parsed = extractJSON(aiResponse);
    } catch {
      // Never expose raw AI response to the client — log it server-side for debugging
      console.error(`[AI Builder] Failed to parse JSON after ${elapsed}ms. Raw response (first 1000 chars):`, aiResponse.slice(0, 1000));
      return NextResponse.json({
        operations: [],
        message: 'Sorry, I had trouble processing that request. Please try again.',
        parseError: true,
        remaining: rateLimitResult.remaining,
      });
    }

    // Server-side validation: sanitize operations before returning to client.
    // Even if the LLM is manipulated via prompt injection, only valid operations
    // with valid block types can pass through.
    const sanitized = sanitizeOperations(parsed.operations || [], { siteState });

    console.log(`[AI Builder] Done in ${elapsed}ms — operations=${sanitized.length} message="${(parsed.message || '').slice(0, 100)}"`);

    // Sanitize the message: if it looks like raw JSON or contains JSON objects, replace with a generic message
    let safeMessage = typeof parsed.message === 'string' ? parsed.message.slice(0, 1000) : 'Done.';
    if (safeMessage.trim().startsWith('{') || safeMessage.trim().startsWith('[') || safeMessage.includes('"op":')) {
      safeMessage = sanitized.length > 0
        ? `I've made ${sanitized.length} change${sanitized.length !== 1 ? 's' : ''} to your site.`
        : 'Done.';
    }

    return NextResponse.json({
      operations: sanitized,
      message: safeMessage,
      remaining: rateLimitResult.remaining,
    });
  } catch (err: any) {
    // Log full error server-side only — never expose raw provider messages to the client
    console.error('[AI Builder] Unhandled error:', err?.message || err, err?.stack);
    return NextResponse.json({ error: 'Something went wrong. Please try again in a moment.' }, { status: 500 });
  }
}

const AI_FETCH_TIMEOUT_MS = 120_000; // 2 minutes

async function callAnthropic(apiKey: string, model: string, system: string, history: any[], latestUserMessage: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        system,
        messages: [
          ...history,
          { role: 'user', content: latestUserMessage }
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[AI Builder] Anthropic API error ${res.status}:`, errBody.slice(0, 500));
      if (res.status === 529 || res.status === 503) {
        throw new Error(`Anthropic overloaded (${res.status})`);
      }
      if (res.status === 408 || res.status === 504) {
        throw new Error(`Anthropic timeout (${res.status})`);
      }
      throw new Error(`Anthropic API error ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const stopReason = data.stop_reason || 'unknown';
    console.log(`[AI Builder] Anthropic response — stopReason=${stopReason} inputTokens=${data.usage?.input_tokens} outputTokens=${data.usage?.output_tokens}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// ---- Server-side operation sanitizer ----
// This is the security boundary. No matter what the LLM returns, only known
// operations with valid block types pass through. This prevents prompt injection
// from producing arbitrary payloads.

const VALID_OPS = new Set(['addBlock', 'updateBlock', 'removeBlock', 'reorderBlocks', 'setSiteTitle', 'setFont', 'setCustomColors', 'setTemplate', 'replaceBlocks', 'setHeaderConfig', 'createPages', 'seedSampleData']);
const VALID_BLOCK_TYPES = new Set<string>(AI_SUPPORTED_BLOCK_TYPES);
const VALID_TEMPLATES = new Set([
  'luxe', 'vivid', 'airy', 'edge', 'classic', 'organic', 'sleek', 'vibrant',
  'atlas', 'editorial', 'booked', 'menu', 'craft', 'retro', 'proof', 'gallery',
  AI_ONBOARDING_TEMPLATE_ID,
]);

function sanitizeOperations(operations: any[], options: { siteState?: any; allowSampleData?: boolean } = {}): any[] {
  if (!Array.isArray(operations)) return [];
  const blockTypeById = new Map<string, string>();
  const currentBlocks = Array.isArray(options.siteState?.blocks) ? options.siteState.blocks : [];
  for (const block of currentBlocks) {
    if (block && typeof block.id === 'string' && typeof block.type === 'string') {
      blockTypeById.set(block.id, block.type);
    }
  }

  return operations
    .filter((op): op is Record<string, any> => op && typeof op === 'object' && VALID_OPS.has(op.op))
    .map(op => {
      switch (op.op) {
        case 'setTemplate': {
          if (!VALID_TEMPLATES.has(op.templateId)) return null;
          return { op: 'setTemplate', templateId: op.templateId };
        }
        case 'replaceBlocks': {
          if (!Array.isArray(op.blocks)) return null;
          const sanitizedBlocks = op.blocks.map((b: any, idx: number) => {
            if (!b || typeof b !== 'object' || !VALID_BLOCK_TYPES.has(b.blockType)) return null;
            const data = sanitizeAiBlockData(b.blockType, b.data);
            return {
              id: `block-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
              type: b.blockType,
              data: deepSanitizeStrings(data)
            };
          }).filter(Boolean);
          return { op: 'replaceBlocks', blocks: sanitizedBlocks };
        }
        case 'createPages': {
          if (!Array.isArray(op.pages)) return null;
          const sanitizedPages = op.pages.map((p: any, pIdx: number) => {
            if (!p || typeof p !== 'object') return null;
            const rawSlug = typeof p.slug === 'string' ? p.slug.toLowerCase().trim() : '';
            // Slug must be lowercase alphanumeric + hyphens, not "home"
            const slug = rawSlug.replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 60);
            if (!slug || slug === 'home') return null;
            const title = typeof p.title === 'string' ? stripTags(p.title).slice(0, 100) : slug;
            const displayName = typeof p.displayName === 'string' ? stripTags(p.displayName).slice(0, 100) : title;
            const isVisibleInNav = p.isVisibleInNav !== false;
            const blocks = Array.isArray(p.blocks) ? p.blocks.map((b: any, bIdx: number) => {
              if (!b || typeof b !== 'object' || !VALID_BLOCK_TYPES.has(b.blockType)) return null;
              const data = sanitizeAiBlockData(b.blockType, b.data);
              return {
                id: `block-${Date.now()}-${pIdx}-${bIdx}-${Math.random().toString(36).substr(2, 9)}`,
                type: b.blockType,
                data: deepSanitizeStrings(data),
              };
            }).filter(Boolean) : [];
            // Defence-in-depth: drop pages with no blocks. The orchestrator's
            // recipe fallback should prevent this, but if the single-call
            // path produces an empty page we don't want to save it.
            if (blocks.length === 0) {
              console.warn(`[AI Builder] Dropped empty-blocks page slug=${slug}`);
              return null;
            }
            return { slug, title, displayName, isVisibleInNav, blocks };
          }).filter(Boolean);
          if (sanitizedPages.length === 0) return null;
          return { op: 'createPages', pages: sanitizedPages };
        }
        case 'seedSampleData': {
          if (!options.allowSampleData) return null;
          const samples = sanitizeAiSampleDataPayload(op.samples);
          if (!hasAiSampleData(samples)) return null;
          return { op: 'seedSampleData', samples };
        }
        case 'addBlock': {
          if (!VALID_BLOCK_TYPES.has(op.blockType)) return null;
          const data = sanitizeAiBlockData(op.blockType, op.data);
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
          const blockType = blockTypeById.get(op.blockId);
          if (!blockType || !VALID_BLOCK_TYPES.has(blockType)) return null;
          const updates = sanitizeAiBlockData(blockType, op.updates);
          return { op: 'updateBlock', blockId: op.blockId, updates: deepSanitizeStrings(updates) };
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
          const colors = sanitizeAiCustomColors(op);
          if (Object.keys(colors).length === 0) return null;
          return { op: 'setCustomColors', ...colors };
        }
        case 'setHeaderConfig': {
          if (!op.config || typeof op.config !== 'object') return null;
          const config = sanitizeAiHeaderConfig(op.config, stripTags);
          if (Object.keys(config).length === 0) return null;
          return { op: 'setHeaderConfig', config };
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
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<style[\s>]/gi, '')
    .replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/@import\s+[^;<>]+;?/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

/**
 * Robustly extract a JSON object from an AI response.
 * Tries multiple strategies: direct parse, markdown fence stripping,
 * and scanning for the outermost { ... } in the response.
 */
function extractJSON(raw: string): { operations: any[]; message: string } {
  const cleaned = raw.trim();

  // Strategy 1: Direct parse
  try {
    const result = JSON.parse(cleaned);
    if (result && typeof result === 'object') return result;
  } catch { /* continue */ }

  // Strategy 2a: Strip complete markdown code fences (opening + closing)
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      const result = JSON.parse(fenceMatch[1].trim());
      if (result && typeof result === 'object') return result;
    } catch { /* continue */ }
  }

  // Strategy 2b: Strip a leading fence with no closing fence (model wrapped but truncated)
  const leadingFenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]+)/);
  if (leadingFenceMatch) {
    try {
      const result = JSON.parse(leadingFenceMatch[1].replace(/\n?```\s*$/, '').trim());
      if (result && typeof result === 'object') return result;
    } catch { /* continue */ }
  }

  // Strategy 3: Find the outermost JSON object by scanning for balanced braces
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBrace; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      if (ch === '}') { depth--; if (depth === 0) {
        try {
          const result = JSON.parse(cleaned.slice(firstBrace, i + 1));
          if (result && typeof result === 'object') return result;
        } catch { /* continue scanning */ }
      }}
    }
  }

  throw new Error('No valid JSON found in AI response');
}

async function callOpenAI(apiKey: string, model: string, system: string, history: any[], latestUserMessage: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        messages: [
          { role: 'system', content: system },
          ...history,
          { role: 'user', content: latestUserMessage },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[AI Builder] OpenAI API error ${res.status}:`, errBody.slice(0, 500));
      throw new Error(`OpenAI API error ${res.status}`);
    }

    const data = await res.json();
    const finishReason = data.choices?.[0]?.finish_reason || 'unknown';
    console.log(`[AI Builder] OpenAI response — finishReason=${finishReason} totalTokens=${data.usage?.total_tokens}`);
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator integration
// ─────────────────────────────────────────────────────────────────────────────

/** Sanitize the wizardData payload from the client. */
function sanitizeWizardData(raw: any): WizardData {
  const description = typeof raw.description === 'string' ? raw.description.slice(0, 1000) : '';
  const styleIds = Array.isArray(raw.styleIds) ? raw.styleIds.filter((s: any) => typeof s === 'string').slice(0, 8) : [];
  const styleLabels = Array.isArray(raw.styleLabels) ? raw.styleLabels.filter((s: any) => typeof s === 'string').slice(0, 8) : [];
  const pageIds = Array.isArray(raw.pageIds) ? raw.pageIds.filter((s: any) => typeof s === 'string').slice(0, 16) : [];
  const pageLabels = Array.isArray(raw.pageLabels) ? raw.pageLabels.filter((s: any) => typeof s === 'string').slice(0, 16) : [];
  const extras = typeof raw.extras === 'string' ? raw.extras.slice(0, 1000) : '';
  const businessType = typeof raw.businessType === 'string' ? raw.businessType.slice(0, 80) : undefined;
  const category = typeof raw.category === 'string' ? raw.category.slice(0, 80) : undefined;
  const categoryLabel = typeof raw.categoryLabel === 'string' ? raw.categoryLabel.slice(0, 120) : undefined;
  const templateId = typeof raw.templateId === 'string' ? raw.templateId.slice(0, 120) : undefined;
  return { description, styleIds, styleLabels, pageIds, pageLabels, extras, businessType, category, categoryLabel, templateId };
}

/**
 * Run the orchestrator and stream its progress events as NDJSON. Each event
 * (one JSON object per line, terminated with \n) tells the client either
 * which phase is running or, for the terminal "result" event, the full
 * sanitized operations payload.
 */
function streamOrchestrator(input: {
  wizardData: WizardData;
  availablePalettes: string[];
  remaining: any;
  signal?: AbortSignal;
}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (evt: ProgressEvent | { type: 'result'; operations: any[]; message: string; remaining: any }) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(evt) + '\n'));
        } catch {
          /* controller already closed */
        }
      };

      try {
        await orchestrateNewSiteBuild(
          { wizardData: input.wizardData, availablePalettes: input.availablePalettes, signal: input.signal },
          (evt) => {
            if (evt.type === 'progress') {
              send(evt);
            } else if (evt.type === 'result') {
              // Run the same sanitizer the single-call path uses so the
              // client gets identical-shape ops regardless of which path ran.
              const sanitized = sanitizeOperations(evt.operations, { allowSampleData: true });
              send({ type: 'result', operations: sanitized, message: evt.message, remaining: input.remaining });
            } else if (evt.type === 'error') {
              send({ type: 'error', message: evt.message });
            }
          }
        );
      } catch (err: any) {
        console.error('[AI Builder] Orchestrator unhandled error:', err?.message || err);
        send({ type: 'error', message: 'Something went wrong while building your site. Please try again.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
