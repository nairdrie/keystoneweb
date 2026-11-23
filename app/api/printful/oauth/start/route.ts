/**
 * GET /api/printful/oauth/start?siteId=  → redirect to Printful's "install app" page.
 * Needs PRINTFUL_CLIENT_ID / PRINTFUL_CLIENT_SECRET (a Printful public app whose
 * redirect URL is <APP_URL>/api/printful/oauth/callback).
 */
import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { APP_URL } from '@/lib/env/domain';
import { OAUTH_AUTHORIZE_URL, oauthConfigured } from '@/lib/printful/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let access;
  try {
    access = await requireSiteAccess(request.nextUrl.searchParams.get('siteId'), request);
  } catch (e) {
    return siteAccessErrorResponse(e);
  }
  if (!oauthConfigured()) return NextResponse.json({ error: 'Printful sign-in is not configured on this server; paste a private token instead.' }, { status: 501 });

  const state = randomBytes(24).toString('hex');
  const db = createAdminClient();
  await db.from('printful_oauth_states').delete().lt('expires_at', new Date().toISOString());
  const { error } = await db.from('printful_oauth_states').insert({ state, site_id: access.siteId, user_id: access.user.id });
  if (error) return NextResponse.json({ error: 'Could not start Printful sign-in' }, { status: 500 });

  const url = new URL(OAUTH_AUTHORIZE_URL);
  url.searchParams.set('client_id', process.env.PRINTFUL_CLIENT_ID!);
  url.searchParams.set('redirect_url', `${APP_URL}/api/printful/oauth/callback`);
  url.searchParams.set('state', state);
  return NextResponse.redirect(url);
}
