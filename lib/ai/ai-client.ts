/**
 * Thin wrappers around the Anthropic and OpenAI message APIs plus a robust
 * JSON extractor. Shared between the single-call API route and the new-site
 * orchestrator so both paths have identical behavior, retries, and timeouts.
 */

export const AI_FETCH_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_TOKENS = 8192;

export interface AICallOptions {
  /** Anthropic or OpenAI key. */
  apiKey: string;
  /** Model id (defaults to provider's default). */
  model: string;
  /** System prompt. */
  system: string;
  /** Optional prior turns. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** The user-turn content. */
  user: string;
  /** Override max output tokens. */
  maxTokens?: number;
  /** Abort signal (for cancellation). */
  signal?: AbortSignal;
}

export async function callAnthropic({ apiKey, model, system, history = [], user, maxTokens = DEFAULT_MAX_TOKENS, signal }: AICallOptions): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_FETCH_TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
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
        max_tokens: maxTokens,
        system,
        messages: [...history, { role: 'user', content: user }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[AI Client] Anthropic ${res.status}:`, errBody.slice(0, 500));
      if (res.status === 529 || res.status === 503) throw new Error(`Anthropic overloaded (${res.status})`);
      if (res.status === 408 || res.status === 504) throw new Error(`Anthropic timeout (${res.status})`);
      throw new Error(`Anthropic API error ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const stopReason = data.stop_reason || 'unknown';
    console.log(`[AI Client] Anthropic resp — stopReason=${stopReason} in=${data.usage?.input_tokens} out=${data.usage?.output_tokens}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function callOpenAI({ apiKey, model, system, history = [], user, maxTokens = DEFAULT_MAX_TOKENS, signal }: AICallOptions): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_FETCH_TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          ...history,
          { role: 'user', content: user },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[AI Client] OpenAI ${res.status}:`, errBody.slice(0, 500));
      throw new Error(`OpenAI API error ${res.status}`);
    }

    const data = await res.json();
    const finishReason = data.choices?.[0]?.finish_reason || 'unknown';
    console.log(`[AI Client] OpenAI resp — finishReason=${finishReason} totalTokens=${data.usage?.total_tokens}`);
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Robust JSON extractor — tries direct parse, fence-stripped parse, and
 * brace-balanced scanning so we recover from "I'll output JSON: { ... }"
 * responses as well as truncated markdown fences.
 */
export function extractJSON<T = unknown>(raw: string): T {
  const cleaned = raw.trim();

  try {
    const result = JSON.parse(cleaned);
    if (result && typeof result === 'object') return result as T;
  } catch { /* continue */ }

  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      const result = JSON.parse(fenceMatch[1].trim());
      if (result && typeof result === 'object') return result as T;
    } catch { /* continue */ }
  }

  const leadingFenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]+)/);
  if (leadingFenceMatch) {
    try {
      const result = JSON.parse(leadingFenceMatch[1].replace(/\n?```\s*$/, '').trim());
      if (result && typeof result === 'object') return result as T;
    } catch { /* continue */ }
  }

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
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            const result = JSON.parse(cleaned.slice(firstBrace, i + 1));
            if (result && typeof result === 'object') return result as T;
          } catch { /* continue scanning */ }
        }
      }
    }
  }

  throw new Error('No valid JSON found in AI response');
}

export function getProviderConfig() {
  const apiKey = process.env.AI_BUILDER_API_KEY;
  const provider = (process.env.AI_BUILDER_PROVIDER || 'anthropic') as 'anthropic' | 'openai';
  const model = process.env.AI_BUILDER_MODEL || (provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o-mini');
  return { apiKey, provider, model };
}

export async function callAi(opts: AICallOptions, provider: 'anthropic' | 'openai'): Promise<string> {
  return provider === 'anthropic' ? callAnthropic(opts) : callOpenAI(opts);
}
