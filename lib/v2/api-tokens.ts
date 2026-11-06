/**
 * Personal access tokens for the Keystone MCP server / API.
 * Tokens look like `ks_pat_<40 chars>`; only a SHA-256 hash is stored.
 */
import { createHash, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const TOKEN_SCOPES = ['sites:read', 'sites:write', 'sites:publish'] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateToken(): string {
  const bytes = randomBytes(40);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `ks_pat_${out}`;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface TokenIdentity {
  tokenId: string;
  tokenName: string;
  userId: string;
  email: string | null;
  isStaff: boolean;
  scopes: TokenScope[];
}

/** Resolve a bearer token to its user. Returns null for unknown, revoked or expired tokens. */
export async function authenticateToken(db: SupabaseClient, token: string | null | undefined): Promise<TokenIdentity | null> {
  if (!token || !token.startsWith('ks_pat_') || token.length > 120) return null;
  const { data } = await db
    .from('api_tokens')
    .select('id, name, user_id, scopes, revoked_at, expires_at, last_used_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;

  const { data: user } = await db.from('users').select('email, is_admin, is_banned').eq('id', data.user_id).maybeSingle();
  if (!user || user.is_banned) return null;

  // Touch last_used_at at most once a minute.
  if (!data.last_used_at || Date.now() - new Date(data.last_used_at).getTime() > 60_000) {
    void db.from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(() => {});
  }

  return {
    tokenId: data.id,
    tokenName: data.name,
    userId: data.user_id,
    email: user.email ?? null,
    isStaff: !!user.is_admin,
    scopes: (data.scopes || []).filter((s: string): s is TokenScope => (TOKEN_SCOPES as readonly string[]).includes(s)),
  };
}
