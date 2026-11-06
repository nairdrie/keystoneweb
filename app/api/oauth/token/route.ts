/** Token endpoint: authorization_code (+PKCE) and refresh_token grants. */
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { exchangeToken } from '@/lib/v2/oauth';
import { json, oauthError, preflight, readForm } from '@/lib/v2/oauth-http';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    return json(await exchangeToken(createAdminClient(), await readForm(request)), 200, { Pragma: 'no-cache' });
  } catch (e) {
    return oauthError(e);
  }
}
export const OPTIONS = preflight;
