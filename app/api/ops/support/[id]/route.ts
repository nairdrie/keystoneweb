import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';

async function assertAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
      .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    return adminEmails.includes(user.email?.toLowerCase() ?? '');
  } catch {
    return false;
  }
}

/**
 * GET /api/ops/support/[id]
 * Returns a single support request including body_html.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();
  const { data, error } = await db
    .from('support_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Resolve the thread root: if this is a reply, follow to root
  const rootId = data.thread_id ?? data.id;

  // Fetch all messages in this thread (root + replies) sorted chronologically
  const { data: threadMessages } = await db
    .from('support_requests')
    .select('id, from_email, from_name, subject, body_text, body_html, created_at, thread_id')
    .or(`id.eq.${rootId},thread_id.eq.${rootId}`)
    .order('created_at', { ascending: true });

  return NextResponse.json({ ...data, thread_messages: threadMessages ?? [] });
}

/**
 * PATCH /api/ops/support/[id]
 * Update status, priority, or notes on a support request.
 * Body: { status?, priority?, notes? }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const allowed = ['status', 'priority', 'notes'];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('support_requests')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/ops/support/[id]
 * Permanently delete a support request.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();
  
  // Find the root ID of this thread
  const { data } = await db
    .from('support_requests')
    .select('thread_id')
    .eq('id', id)
    .single();
    
  const rootId = data?.thread_id ?? id;

  // Delete the root ticket and all its replies
  const { error } = await db
    .from('support_requests')
    .delete()
    .or(`id.eq.${rootId},thread_id.eq.${rootId}`);

  if (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
