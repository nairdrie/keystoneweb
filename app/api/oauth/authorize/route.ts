/** Records the user's decision on the MCP sign-in approval page and redirects back to the app. */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createAuthorizationCode, redirectWith, requestOrigin, validateAuthorizeRequest, verifyConsentTicket } from '@/lib/v2/oauth';
import type { TokenScope } from '@/lib/v2/api-tokens';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const ticket = await verifyConsentTicket(String(form.get('ticket') || ''));
  if (!ticket) return new NextResponse('This approval page expired. Start the connection again from the app.', { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== ticket.userId) return new NextResponse('Please sign in again and retry.', { status: 401 });

  const db = createAdminClient();
  const params = new URLSearchParams(ticket.query);
  let req;
  try {
    req = await validateAuthorizeRequest(db, params);
  } catch {
    return new NextResponse('This connection request is no longer valid.', { status: 400 });
  }

  const iss = requestOrigin(request);
  if (form.get('decision') !== 'allow') {
    return NextResponse.redirect(redirectWith(req.redirectUri, { error: 'access_denied', state: req.state, iss }), 303);
  }

  const scopes = new Set<TokenScope>(req.scopes.filter((s) => s !== 'sites:publish'));
  scopes.add('sites:read');
  scopes.add('sites:write');
  if (form.get('allow_publish')) scopes.add('sites:publish');
  const code = await createAuthorizationCode(db, req, user.id, [...scopes]);
  return NextResponse.redirect(redirectWith(req.redirectUri, { code, state: req.state, iss }), 303);
}
