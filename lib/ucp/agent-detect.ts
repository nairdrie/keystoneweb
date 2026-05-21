/**
 * Detects which AI agent (if any) is calling us, from request headers.
 *
 * Order of precedence:
 *   1. `X-Agent-Id` — explicit self-identification (UCP/MCP/A2A clients).
 *   2. `User-Agent` substring match against known patterns.
 *   3. `none` (a regular browser or unknown client).
 *
 * We deliberately keep this list small and well-known. Anything else with a
 * "bot"-like UA gets bucketed as `unknown-bot` so agent dashboards don't
 * over-attribute to specific platforms.
 */

import type { UcpAgentId, UcpSurface } from './types';

const KNOWN_AGENTS: Array<[RegExp, UcpAgentId]> = [
  [/Google-Extended|GoogleOther|google-gemini|Gemini-Shopping/i, 'google-gemini'],
  [/Storebot-Google|GoogleBot.*Shopping|Google-Shopping/i, 'google-shopping'],
  [/OAI-SearchBot|OpenAI-Operator|operator-openai/i, 'openai-operator'],
  [/ChatGPT-User|GPTBot/i, 'openai-chatgpt'],
  [/ClaudeBot|Claude-Web|Anthropic-AI/i, 'anthropic-claude'],
  [/PerplexityBot|Perplexity-User/i, 'perplexity'],
  [/Meta-ExternalAgent|FacebookBot|Meta-AI/i, 'meta-ai'],
  [/CopilotBot|MicrosoftCopilot|BingPreview/i, 'microsoft-copilot'],
];

export function detectAgent(headers: Headers | Record<string, string | null | undefined>): {
  agentId: UcpAgentId;
  isAgent: boolean;
  userAgent: string;
  sessionId: string | null;
} {
  const get = (k: string): string => {
    if (headers instanceof Headers) return headers.get(k) ?? '';
    const v = (headers as Record<string, string | null | undefined>)[k]
      ?? (headers as Record<string, string | null | undefined>)[k.toLowerCase()];
    return v ?? '';
  };

  const explicit = get('x-agent-id').trim().toLowerCase();
  const ua = get('user-agent') || '';
  const sessionId = get('x-agent-session-id') || null;

  if (explicit) {
    return { agentId: explicit as UcpAgentId, isAgent: explicit !== 'browser', userAgent: ua, sessionId };
  }

  for (const [pattern, id] of KNOWN_AGENTS) {
    if (pattern.test(ua)) {
      return { agentId: id, isAgent: true, userAgent: ua, sessionId };
    }
  }

  if (/\bbot\b|crawler|spider|agent|headless/i.test(ua)) {
    return { agentId: 'unknown-bot', isAgent: true, userAgent: ua, sessionId };
  }

  return { agentId: 'browser', isAgent: false, userAgent: ua, sessionId };
}

export function hashIp(ip: string | null, siteId: string): string | null {
  if (!ip) return null;
  // Lightweight non-crypto hash — we only need a per-site bucket key, not
  // a privacy primitive. The DB column accepts arbitrary strings.
  let h = 0;
  const s = `${siteId}:${ip}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return `h_${(h >>> 0).toString(36)}`;
}

export interface ActivityLogInput {
  siteId: string;
  surface: UcpSurface;
  action: string;
  productId?: string | null;
  cartId?: string | null;
  orderId?: string | null;
  httpStatus?: number;
  amountCents?: number | null;
  requestMeta?: Record<string, unknown>;
}

/**
 * Fire-and-forget activity logger. Uses the service-role client so it works
 * for fully-public UCP endpoints (no Supabase session). Failures are
 * swallowed — observability code must never break the request path.
 */
export async function logAgentActivity(
  request: Request,
  input: ActivityLogInput,
): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/db/supabase-admin');
    const detect = detectAgent(request.headers);
    const ipHeader = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
    const ip = ipHeader?.split(',')[0]?.trim() ?? null;
    const admin = createAdminClient();
    await admin.from('ai_agent_activity').insert({
      site_id: input.siteId,
      agent_id: detect.agentId,
      surface: input.surface,
      action: input.action,
      product_id: input.productId ?? null,
      cart_id: input.cartId ?? null,
      order_id: input.orderId ?? null,
      http_status: input.httpStatus ?? null,
      user_agent: detect.userAgent.slice(0, 500),
      ip_hash: hashIp(ip, input.siteId),
      request_meta: input.requestMeta ?? {},
      amount_cents: input.amountCents ?? null,
    });
  } catch (err) {
    console.warn('[UCP] activity log failed:', (err as Error).message);
  }
}
