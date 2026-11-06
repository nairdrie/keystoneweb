/**
 * Keystone MCP server (Streamable HTTP transport, stateless, JSON responses).
 *
 * Sign-in: AI apps discover OAuth via the 401's resource_metadata (see
 * lib/v2/oauth.ts). Personal tokens (Authorization: Bearer ks_pat_…) also work.
 *
 * Protocol handling lives in lib/v2/mcp-server.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { handleMcpHttp, unauthorizedResult } from '@/lib/v2/mcp-server';
import { requestOrigin } from '@/lib/v2/oauth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = undefined;
  }
  const result = await handleMcpHttp(
    createAdminClient(),
    request.headers.get('authorization'),
    payload,
    request.headers.get('x-keystone-token'),
    requestOrigin(request),
  );
  if (result.body === null) return new NextResponse(null, { status: result.status, headers: result.headers });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

export async function GET(request: NextRequest) {
  // Clients probing without credentials learn how to sign in.
  if (!request.headers.get('authorization') && !request.headers.get('x-keystone-token')) {
    const result = unauthorizedResult(requestOrigin(request));
    return NextResponse.json(result.body, { status: result.status, headers: result.headers });
  }
  // No server-initiated stream: this server answers each POST directly.
  return new NextResponse('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}

export async function DELETE() {
  return new NextResponse('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
