/** RFC 7009 token revocation. Always 200 for unknown tokens. */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { revokeToken } from '@/lib/v2/oauth';
import { CORS_HEADERS, preflight, readForm } from '@/lib/v2/oauth-http';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const form = await readForm(request);
  const token = form.get('token');
  if (token) await revokeToken(createAdminClient(), token);
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}
export const OPTIONS = preflight;
