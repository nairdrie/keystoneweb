/**
 * Signed, expiring image-upload links for one site (/api/v2/upload/<token>).
 *
 * MCP clients can only pass text to tools, so an image the owner attached in
 * their chat never reaches import_media. create_upload_link hands the agent a
 * link: the owner opens it to drop their photos, or an agent with a shell
 * POSTs the file to it. Either way the files land in the site's media library.
 */
import { createHash } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

export const UPLOAD_TTL_DEFAULT = 2 * 3600;
export const UPLOAD_TTL_MAX = 24 * 3600;

function key(): Uint8Array {
  const secret = process.env.KS_V2_PREVIEW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Missing KS_V2_PREVIEW_SECRET (or SUPABASE_SERVICE_ROLE_KEY) for upload links');
  return createHash('sha256').update(`${secret}:ks-v2-upload`).digest();
}

export interface UploadGrant {
  siteId: string;
  /** Who the files are filed under in site_media (the site owner). */
  ownerUserId: string;
  expiresAt: Date;
}

export async function createUploadToken(siteId: string, ownerUserId: string, ttlSeconds: number): Promise<{ token: string; expiresAt: Date }> {
  const ttl = Math.max(60, Math.min(UPLOAD_TTL_MAX, Math.floor(ttlSeconds)));
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const token = await new SignJWT({ sid: siteId, uid: ownerUserId, k: 'upload' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key());
  return { token, expiresAt: new Date(exp * 1000) };
}

export async function verifyUploadToken(token: string): Promise<UploadGrant | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    if (payload.k !== 'upload' || typeof payload.sid !== 'string' || typeof payload.uid !== 'string' || !payload.exp) return null;
    return { siteId: payload.sid, ownerUserId: payload.uid, expiresAt: new Date(payload.exp * 1000) };
  } catch {
    return null;
  }
}

export function uploadUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, '')}/api/v2/upload/${token}`;
}
