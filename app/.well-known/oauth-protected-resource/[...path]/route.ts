/** Path-specific form (/.well-known/oauth-protected-resource/api/mcp) of the same metadata. */
import { NextRequest } from 'next/server';
import { protectedResourceMetadata, requestOrigin } from '@/lib/v2/oauth';
import { json, preflight } from '@/lib/v2/oauth-http';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.join('/') !== 'api/mcp') return json({ error: 'not_found' }, 404);
  return json(protectedResourceMetadata(requestOrigin(request)), 200, { 'Cache-Control': 'public, max-age=3600' });
}
export const OPTIONS = preflight;
