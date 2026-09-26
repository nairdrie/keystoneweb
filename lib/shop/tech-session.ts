import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'crypto';

/**
 * Shop device sessions for the tech view. A site has a single owner login, so
 * the phone or tablet in the bay signs in with the shop code + PIN instead and
 * gets a long-lived, httpOnly cookie scoped to that site and device.
 */

export const TECH_COOKIE = 'ks_shop_tech';
const SESSION_DAYS = 180;

function signingKey(): Uint8Array {
  const master = process.env.SHOP_TECH_JWT_SECRET || process.env.MEMBER_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!master) throw new Error('No signing secret configured for shop device sessions');
  return new Uint8Array(createHash('sha256').update(`${master}:shop-tech`).digest());
}

export interface TechSession { siteId: string; deviceId: string }

export async function signTechSession(session: TechSession): Promise<string> {
  return new SignJWT({ siteId: session.siteId, deviceId: session.deviceId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(signingKey());
}

export async function readTechSession(request: NextRequest): Promise<TechSession | null> {
  const token = request.cookies.get(TECH_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey());
    if (typeof payload.siteId !== 'string' || typeof payload.deviceId !== 'string') return null;
    return { siteId: payload.siteId, deviceId: payload.deviceId };
  } catch {
    return null;
  }
}

export function setTechCookie(res: NextResponse, token: string) {
  res.cookies.set(TECH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearTechCookie(res: NextResponse) {
  res.cookies.set(TECH_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}
