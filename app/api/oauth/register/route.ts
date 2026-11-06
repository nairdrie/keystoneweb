/** RFC 7591 dynamic client registration (public clients, PKCE). */
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { registerClient } from '@/lib/v2/oauth';
import { json, oauthError, preflight } from '@/lib/v2/oauth-http';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return json(await registerClient(createAdminClient(), body), 201);
  } catch (e) {
    return oauthError(e);
  }
}
export const OPTIONS = preflight;
