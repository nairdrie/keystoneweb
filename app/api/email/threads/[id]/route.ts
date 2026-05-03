import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';

/**
 * GET /api/email/threads/[id]?siteId=...
 * Returns all messages in a thread (oldest first) for the conversation view.
 *
 * DELETE /api/email/threads/[id]?siteId=...
 * Deletes the entire thread.
 */

type Params = { params: Promise<{ id: string }> };

async function authOrFail(siteId: string | null, userId: string) {
  if (!siteId) return { ok: false as const, status: 400, error: 'siteId is required' };
  const supabase = await createClient();
  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id')
    .eq('id', siteId)
    .single();
  if (!site || site.user_id !== userId) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const };
}

export async function GET(request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: threadId } = await params;
  const siteId = request.nextUrl.searchParams.get('siteId');
  const auth = await authOrFail(siteId, user.id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = createAdminClient();

  const { data: messages, error } = await db
    .from('contact_submissions')
    .select('*')
    .eq('thread_id', threadId)
    .eq('site_id', siteId!)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch thread' }, { status: 500 });
  }
  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
  }

  // Read state is now driven by a deliberate client-side timer (POST below)
  // so a quick preview / accidental click doesn't lose the unread badge.
  return NextResponse.json({ threadId, messages });
}

/**
 * POST /api/email/threads/[id]?siteId=...
 * Mark every inbound message in this thread as read. Called by the client
 * after a short dwell so quick previews don't auto-clear unread state.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: threadId } = await params;
  const siteId = request.nextUrl.searchParams.get('siteId');
  const auth = await authOrFail(siteId, user.id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = createAdminClient();
  await db
    .from('contact_submissions')
    .update({ is_read: true })
    .eq('thread_id', threadId)
    .eq('site_id', siteId!)
    .eq('direction', 'inbound')
    .eq('is_read', false);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: threadId } = await params;
  const siteId = request.nextUrl.searchParams.get('siteId');
  const auth = await authOrFail(siteId, user.id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = createAdminClient();
  await db.from('contact_submissions').delete().eq('thread_id', threadId).eq('site_id', siteId!);
  return NextResponse.json({ success: true });
}
