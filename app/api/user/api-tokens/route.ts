/**
 * Manage the signed-in user's personal access tokens (for the MCP server).
 *   GET    → list (no secrets)
 *   POST   { name, scopes } → create; the token is returned once
 *   DELETE { id } → revoke
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { TOKEN_SCOPES, generateToken, hashToken } from '@/lib/v2/api-tokens';

export const dynamic = 'force-dynamic';

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await createAdminClient()
    .from('api_tokens')
    .select('id, name, token_prefix, scopes, created_at, last_used_at, revoked_at, expires_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tokens: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim().slice(0, 60) || 'Agent token';
  const requested: string[] = Array.isArray(body.scopes) ? body.scopes : ['sites:read', 'sites:write'];
  const scopes = requested.filter((s) => (TOKEN_SCOPES as readonly string[]).includes(s));
  if (!scopes.includes('sites:read')) scopes.unshift('sites:read');

  const db = createAdminClient();
  const { count } = await db.from('api_tokens').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('revoked_at', null);
  if ((count ?? 0) >= 20) return NextResponse.json({ error: 'You have 20 active tokens. Revoke one first.' }, { status: 400 });

  const token = generateToken();
  const { data, error } = await db
    .from('api_tokens')
    .insert({ user_id: user.id, name, token_prefix: token.slice(0, 14), token_hash: hashToken(token), scopes })
    .select('id, name, token_prefix, scopes, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token, record: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error } = await createAdminClient()
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', body.id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
