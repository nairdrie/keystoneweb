/**
 * AI apps the signed-in user has connected via MCP sign-in.
 *   GET → list · DELETE { clientId } → disconnect (revokes its tokens)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { disconnectClient, listConnectedApps } from '@/lib/v2/oauth';

export const dynamic = 'force-dynamic';

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ apps: await listConnectedApps(createAdminClient(), user.id) });
}

export async function DELETE(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!body.clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
  await disconnectClient(createAdminClient(), user.id, String(body.clientId));
  return NextResponse.json({ ok: true });
}
