/**
 * GET /api/printful/oauth/callback?code&state&success  (Printful redirects here)
 * Exchanges the code, stores the encrypted tokens for the site that started
 * the flow, and returns the owner to Admin → Ecommerce → Fulfillment.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess } from '@/lib/auth/site-access';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { APP_URL } from '@/lib/env/domain';
import { exchangeOAuthCode, tokenExpiry } from '@/lib/printful/client';
import { saveConnection } from '@/lib/printful/connect';

export const dynamic = 'force-dynamic';

function back(siteId: string | null, params: Record<string, string>) {
  const url = new URL(siteId ? '/admin/ecommerce' : '/admin', APP_URL);
  if (siteId) {
    url.searchParams.set('siteId', siteId);
    url.searchParams.set('tab', 'fulfillment');
  }
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const state = q.get('state') || '';
  if (!/^[0-9a-f]{48}$/.test(state)) return back(null, { printful_error: 'Printful sign-in expired. Try again.' });

  const db = createAdminClient();
  const { data: saved } = await db.from('printful_oauth_states').select('site_id, user_id, expires_at').eq('state', state).maybeSingle();
  await db.from('printful_oauth_states').delete().eq('state', state);
  if (!saved || Date.parse(saved.expires_at) < Date.now()) return back(null, { printful_error: 'Printful sign-in expired. Try again.' });

  // The browser finishing the flow must be the user who started it.
  let access;
  try {
    access = await requireSiteAccess(saved.site_id, request);
  } catch {
    return back(saved.site_id, { printful_error: 'Sign in to Keystone, then connect Printful again.' });
  }
  if (access.user.id !== saved.user_id) return back(saved.site_id, { printful_error: 'Printful was connected from a different Keystone account. Try again.' });

  const code = q.get('code');
  if (q.get('success') !== '1' || !code) return back(saved.site_id, { printful_error: 'Printful was not connected.' });

  try {
    const tokens = await exchangeOAuthCode(code);
    await saveConnection(db, {
      siteId: saved.site_id,
      userId: access.user.id,
      authType: 'oauth',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokenExpiry(tokens.expires_at),
    });
    return back(saved.site_id, { printful: 'connected' });
  } catch (e) {
    console.error('[printful/oauth] connect failed', e);
    return back(saved.site_id, { printful_error: e instanceof Error ? e.message.slice(0, 200) : 'Printful could not be connected.' });
  }
}
