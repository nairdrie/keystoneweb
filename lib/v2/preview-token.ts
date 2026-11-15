/**
 * Signed, expiring links to a v2 draft (/v2r/draft/<token>/<path>).
 * Used by the owner editor's canvas (mode "edit") and for sharing previews
 * with agents and clients (mode "preview").
 */
import { createHash } from 'crypto';
import { SignJWT, errors, jwtVerify } from 'jose';

export type DraftMode = 'edit' | 'preview';

function key(): Uint8Array {
  const secret = process.env.KS_V2_PREVIEW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Missing KS_V2_PREVIEW_SECRET (or SUPABASE_SERVICE_ROLE_KEY) for draft links');
  return createHash('sha256').update(`${secret}:ks-v2-draft`).digest();
}

export async function createDraftToken(siteId: string, mode: DraftMode, ttlSeconds: number): Promise<string> {
  return new SignJWT({ sid: siteId, m: mode })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(key());
}

export type DraftTokenCheck =
  | { status: 'valid'; siteId: string; mode: DraftMode }
  | { status: 'expired'; siteId: string; mode: DraftMode };

/**
 * Like verifyDraftToken, but tells an expired (correctly signed) token apart
 * from a forged or malformed one, so the owner can be offered an extension.
 */
export async function inspectDraftToken(token: string): Promise<DraftTokenCheck | null> {
  const claims = (payload: Record<string, unknown>) =>
    typeof payload.sid === 'string'
      ? { siteId: payload.sid, mode: (payload.m === 'edit' ? 'edit' : 'preview') as DraftMode }
      : null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    const c = claims(payload);
    return c && { status: 'valid', ...c };
  } catch (e) {
    // jose checks the signature before the claims, so JWTExpired means the
    // token is genuine and only its lifetime has run out.
    if (e instanceof errors.JWTExpired) {
      const c = claims(e.payload);
      return c && { status: 'expired', ...c };
    }
    return null;
  }
}

export async function verifyDraftToken(token: string): Promise<{ siteId: string; mode: DraftMode } | null> {
  const check = await inspectDraftToken(token);
  return check?.status === 'valid' ? { siteId: check.siteId, mode: check.mode } : null;
}

export function draftTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function draftUrl(appUrl: string, siteId: string, mode: DraftMode, ttlSeconds: number, path = '/'): Promise<string> {
  const token = await createDraftToken(siteId, mode, ttlSeconds);
  const suffix = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return `${appUrl.replace(/\/$/, '')}/v2r/draft/${token}${suffix}`;
}
