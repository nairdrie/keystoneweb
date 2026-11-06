/** Small HTTP helpers shared by the OAuth / metadata routes. */
import { NextResponse } from 'next/server';
import { OAuthError } from './oauth';

// Metadata, registration and token endpoints are called by AI apps' servers
// and sometimes by browser-based clients, so they allow cross-origin reads.
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version',
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store', ...extra } });
}

export function oauthError(e: unknown) {
  if (e instanceof OAuthError) return json({ error: e.code, error_description: e.message }, e.status);
  console.error('[oauth]', e);
  return json({ error: 'server_error', error_description: 'Something went wrong' }, 500);
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** Token endpoints receive form posts (RFC 6749); accept JSON too. */
export async function readForm(request: Request): Promise<URLSearchParams> {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) if (v !== undefined && v !== null) params.set(k, String(v));
    return params;
  }
  return new URLSearchParams(await request.text());
}
