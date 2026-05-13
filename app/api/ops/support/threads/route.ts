import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';
import { plainTextPreview } from '@/lib/email/preview';

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
type Status = typeof STATUSES[number];

/**
 * GET /api/ops/support/threads?status=open&q=…
 *
 * Returns thread roots (rows with thread_id IS NULL) plus per-status counts so
 * the OpsEmailClient can render its folder sidebar in one round trip.
 *
 * Agents only see threads addressed to their own contact email; admins see all.
 */
export async function GET(request: NextRequest) {
  const access = await getOpsAccessContext();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const statusParam = params.get('status') ?? 'open';
  const search = (params.get('q') ?? '').trim();
  const sort = params.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const limit = Math.min(parseInt(params.get('limit') ?? '100', 10), 300);

  const db = createAdminClient();
  const scopeEmail = access.isAdmin ? null : access.agentContactEmail;

  // Per-status counts (scoped) so the folder sidebar always reflects the
  // viewer's perspective.
  async function scopedCount(s: Status) {
    let q = db
      .from('support_requests')
      .select('id', { count: 'exact', head: true })
      .is('thread_id', null)
      .eq('status', s);
    if (scopeEmail) q = q.eq('from_email', scopeEmail);
    const { count } = await q;
    return count ?? 0;
  }

  const [openCount, inProgressCount, resolvedCount, closedCount] = await Promise.all([
    scopedCount('open'),
    scopedCount('in_progress'),
    scopedCount('resolved'),
    scopedCount('closed'),
  ]);

  const counts = {
    open: openCount,
    in_progress: inProgressCount,
    resolved: resolvedCount,
    closed: closedCount,
    all: openCount + inProgressCount + resolvedCount + closedCount,
  };

  // Thread list query
  let q = db
    .from('support_requests')
    .select('id, from_email, from_name, subject, body_text, status, priority, created_at, updated_at')
    .is('thread_id', null)
    .order('created_at', { ascending: sort === 'oldest' })
    .limit(limit);

  if (statusParam !== 'all' && (STATUSES as readonly string[]).includes(statusParam)) {
    q = q.eq('status', statusParam);
  }
  if (scopeEmail) q = q.eq('from_email', scopeEmail);
  if (search) {
    const pattern = `%${search}%`;
    q = q.or(
      `subject.ilike.${pattern},from_email.ilike.${pattern},from_name.ilike.${pattern},body_text.ilike.${pattern}`
    );
  }

  const { data: roots, error } = await q;
  if (error) {
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  // For each root, fetch reply count + last-message timestamp/preview in a
  // single pass over the replies of all visible threads.
  const rootIds = (roots ?? []).map((r) => r.id);
  const replyMap = new Map<string, { count: number; lastAt: string; lastBody: string | null }>();
  if (rootIds.length > 0) {
    const { data: replies } = await db
      .from('support_requests')
      .select('thread_id, created_at, body_text')
      .in('thread_id', rootIds)
      .order('created_at', { ascending: true });
    for (const r of replies ?? []) {
      const tid = r.thread_id as string;
      const prev = replyMap.get(tid);
      if (!prev) {
        replyMap.set(tid, { count: 1, lastAt: r.created_at, lastBody: r.body_text });
      } else {
        prev.count += 1;
        prev.lastAt = r.created_at;
        prev.lastBody = r.body_text;
      }
    }
  }

  const threads = (roots ?? []).map((r) => {
    const replyInfo = replyMap.get(r.id);
    const messageCount = 1 + (replyInfo?.count ?? 0);
    const lastMessageAt = replyInfo?.lastAt ?? r.created_at;
    const snippetSource = replyInfo?.lastBody ?? r.body_text;
    return {
      id: r.id,
      fromEmail: r.from_email,
      fromName: r.from_name,
      subject: r.subject,
      status: r.status,
      priority: r.priority,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      lastMessageAt,
      messageCount,
      hasReplies: messageCount > 1,
      snippet: plainTextPreview(snippetSource, 140),
    };
  });

  return NextResponse.json({
    threads,
    counts,
    scopedTo: scopeEmail,
    isAdmin: access.isAdmin,
  });
}
