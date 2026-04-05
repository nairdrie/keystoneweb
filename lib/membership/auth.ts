import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'crypto';

const BCRYPT_ROUNDS = 12;
const TOKEN_EXPIRY_DAYS = 7;

// Derive a per-site signing key from the master secret + siteId
function getSigningKey(siteId: string): Uint8Array {
  const master = process.env.MEMBER_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const derived = createHash('sha256').update(`${master}:member:${siteId}`).digest();
  return new Uint8Array(derived);
}

// ─── Password helpers ───────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT helpers ────────────────────────────────────────────────────────────

export interface MemberTokenPayload {
  memberId: string;
  siteId: string;
  email: string;
}

export async function signMemberToken(payload: MemberTokenPayload): Promise<string> {
  const key = getSigningKey(payload.siteId);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_EXPIRY_DAYS}d`)
    .sign(key);
}

export async function verifyMemberToken(token: string, siteId: string): Promise<MemberTokenPayload | null> {
  try {
    const key = getSigningKey(siteId);
    const { payload } = await jwtVerify(token, key);
    if (payload.siteId !== siteId) return null;
    return {
      memberId: payload.memberId as string,
      siteId: payload.siteId as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

// When we don't know the siteId upfront (e.g., reading cookie on a published site),
// we decode without verification first to extract siteId, then verify.
export async function verifyMemberTokenAny(token: string): Promise<MemberTokenPayload | null> {
  try {
    // Decode header+payload without verification to get siteId
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadStr = Buffer.from(parts[1], 'base64url').toString();
    const decoded = JSON.parse(payloadStr);
    if (!decoded.siteId) return null;
    // Now verify with the correct key
    return verifyMemberToken(token, decoded.siteId);
  } catch {
    return null;
  }
}

// ─── Session helpers ────────────────────────────────────────────────────────

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getTokenExpiresAt(): Date {
  return new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

// ─── Verification / reset token helpers ─────────────────────────────────────

export function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getVerificationExpiresAt(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
}

export function getPasswordResetExpiresAt(): Date {
  return new Date(Date.now() + 60 * 60 * 1000); // 1 hour
}

// ─── Cookie config ──────────────────────────────────────────────────────────

export const MEMBER_COOKIE_NAME = 'ks_member_token';

export function getMemberCookieOptions(domain?: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
    ...(domain ? { domain } : {}),
  };
}
