/** RFC 8414 authorization server metadata for MCP sign-in. */
import { NextRequest } from 'next/server';
import { authorizationServerMetadata, requestOrigin } from '@/lib/v2/oauth';
import { json, preflight } from '@/lib/v2/oauth-http';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return json(authorizationServerMetadata(requestOrigin(request)), 200, { 'Cache-Control': 'public, max-age=3600' });
}
export const OPTIONS = preflight;
