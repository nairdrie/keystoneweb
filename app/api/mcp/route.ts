/**
 * Keystone MCP server (Streamable HTTP transport, stateless, JSON responses).
 *
 * Authenticate with a personal access token from Account Settings:
 *   Authorization: Bearer ks_pat_…
 *
 * Protocol handling lives in lib/v2/mcp-server.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { handleMcpHttp } from '@/lib/v2/mcp-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = undefined;
  }
  const result = await handleMcpHttp(createAdminClient(), request.headers.get('authorization'), payload);
  if (result.body === null) return new NextResponse(null, { status: result.status, headers: result.headers });
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}

export async function GET() {
  // No server-initiated stream: this server answers each POST directly.
  return new NextResponse('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}

export async function DELETE() {
  return new NextResponse('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
