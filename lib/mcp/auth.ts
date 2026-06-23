// Bearer-token authentication for the MCP server (/api/mcp).
//
// External MCP clients (Claude Code, etc.) send `Authorization: Bearer ksk_…`.
// We hash the presented token and look it up in public.mcp_tokens to resolve the
// owning user. Every downstream tool call is then scoped to that user_id, so a
// client can only ever read or edit sites the token's owner owns.

import { createHash, randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/db/supabase-admin';

export const MCP_TOKEN_PREFIX = 'ksk_';

export interface McpAuthContext {
  userId: string;
  tokenId: string;
}

/** SHA-256 hex digest of a raw token — only the hash is ever persisted. */
export function hashMcpToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Mint a fresh, high-entropy token. Returned once; only its hash is stored. */
export function generateMcpToken(): { token: string; tokenHash: string; tokenPrefix: string } {
  const token = `${MCP_TOKEN_PREFIX}${randomBytes(24).toString('hex')}`;
  return {
    token,
    tokenHash: hashMcpToken(token),
    // Enough to recognise the token in a list without revealing the secret.
    tokenPrefix: token.slice(0, MCP_TOKEN_PREFIX.length + 6),
  };
}

/** Pull the raw bearer token out of an incoming request, if present. */
export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Authenticate a request against public.mcp_tokens.
 * Returns the owning user's context, or null when the token is missing,
 * malformed, unknown, or revoked. Refreshes last_used_at best-effort.
 */
export async function resolveMcpAuth(request: Request): Promise<McpAuthContext | null> {
  const token = extractBearerToken(request);
  if (!token || !token.startsWith(MCP_TOKEN_PREFIX)) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('mcp_tokens')
    .select('id, user_id, revoked_at')
    .eq('token_hash', hashMcpToken(token))
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;

  // Best-effort usage timestamp; never block the request on it.
  void admin
    .from('mcp_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(undefined, () => {});

  return { userId: data.user_id as string, tokenId: data.id as string };
}
