/** RFC 9728 protected resource metadata for the MCP server (/api/mcp). */
import { NextRequest } from 'next/server';
import { protectedResourceMetadata, requestOrigin } from '@/lib/v2/oauth';
import { json, preflight } from '@/lib/v2/oauth-http';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return json(protectedResourceMetadata(requestOrigin(request)), 200, { 'Cache-Control': 'public, max-age=3600' });
}
export const OPTIONS = preflight;
