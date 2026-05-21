import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { ensureKswdInboxAddress, listSiteInboxAddresses } from '@/lib/email/inbox-addresses';

/**
 * GET /api/email/threads?siteId=...&folder=inbox|needs_review|sent|spam|all
 *                       &addressId=...&page=1
 *
 * Returns threads (one row per thread_id) with aggregated metadata for the
 * email-client list view, plus per-folder unread counts.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const siteId = searchParams.get('siteId');
  const folder = (searchParams.get('folder') ?? 'inbox') as 'inbox' | 'needs_review' | 'sent' | 'spam' | 'all';
  const addressId = searchParams.get('addressId');
  const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10), 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  if (!siteId) return NextResponse.json({ error: 'siteId is required' }, { status: 400 });

  // Verify site ownership
  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, published_domain')
    .eq('id', siteId)
    .single();
  if (!site || site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();

  // Make sure the site has at least its kswd address row before we query
  if (site.published_domain) {
    await ensureKswdInboxAddress(db, siteId, site.published_domain);
  }

  // Backfill: any submissions inserted before the primary address row existed
  // would have inbox_address_id=null and be hidden behind every address tab.
  // Move them onto the current primary so they appear in the owner's inbox.
  const { data: primaryForBackfill } = await db
    .from('site_inbox_addresses')
    .select('id')
    .eq('site_id', siteId)
    .eq('is_primary', true)
    .maybeSingle();
  if (primaryForBackfill?.id) {
    await db
      .from('contact_submissions')
      .update({ inbox_address_id: primaryForBackfill.id })
      .eq('site_id', siteId)
      .is('inbox_address_id', null);
  }

  // Pull every message for this site (capped to a sensible window) and
  // aggregate to threads in JS — keeps the SQL simple and avoids a custom view.
  // For higher-volume inboxes this should move to a materialised view.
  let q = db
    .from('contact_submissions')
    .select(
      'id, thread_id, site_id, direction, status, source_type, sender_name, sender_email, ' +
      'subject, message, body_html, ai_classification, ai_confidence, ai_summary, ai_draft_reply, ' +
      'admin_reply, admin_reply_at, inbox_address_id, from_email, from_name, to_emails, ' +
      'created_at, is_read, metadata'
    )
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (addressId) {
    q = q.eq('inbox_address_id', addressId);
  }

  const { data: rows, error } = await q;
  if (error) {
    console.error('[email/threads] query failed:', error);
    return NextResponse.json({ error: 'Failed to fetch threads' }, { status: 500 });
  }

  // Aggregate by thread_id
  type Row = {
    id: string;
    thread_id: string;
    site_id: string;
    direction: 'inbound' | 'outbound';
    status: string;
    source_type: string;
    sender_name: string;
    sender_email: string;
    subject: string | null;
    message: string;
    body_html: string | null;
    ai_classification: string | null;
    ai_confidence: number | null;
    ai_summary: string | null;
    ai_draft_reply: string | null;
    admin_reply: string | null;
    admin_reply_at: string | null;
    inbox_address_id: string | null;
    from_email: string | null;
    from_name: string | null;
    to_emails: string[];
    created_at: string;
    is_read: boolean;
    metadata: Record<string, unknown> | null;
  };
  const typedRows = (rows ?? []) as unknown as Row[];
  const threadMap = new Map<string, {
    thread_id: string;
    address_id: string | null;
    last: Row;
    inbound_count: number;
    outbound_count: number;
    unread_count: number;
    has_inbound_unread: boolean;
    has_needs_review: boolean;
    has_spam: boolean;
    last_inbound: Row | null;
    last_outbound: Row | null;
    participants: Set<string>;
    message_count: number;
    snippet_source: Row;
  }>();

  for (const row of typedRows) {
    const t = row.thread_id ?? row.id;
    const existing = threadMap.get(t);
    if (!existing) {
      threadMap.set(t, {
        thread_id: t,
        address_id: row.inbox_address_id ?? null,
        last: row,
        inbound_count: row.direction === 'inbound' ? 1 : 0,
        outbound_count: row.direction === 'outbound' ? 1 : 0,
        unread_count: row.direction === 'inbound' && !row.is_read ? 1 : 0,
        has_inbound_unread: row.direction === 'inbound' && !row.is_read,
        has_needs_review: row.status === 'needs_review',
        has_spam: row.status === 'spam',
        last_inbound: row.direction === 'inbound' ? row : null,
        last_outbound: row.direction === 'outbound' ? row : null,
        participants: new Set([row.sender_email].filter(Boolean) as string[]),
        message_count: 1,
        snippet_source: row,
      });
    } else {
      if (new Date(row.created_at) > new Date(existing.last.created_at)) {
        existing.last = row;
        existing.snippet_source = row;
      }
      if (row.direction === 'inbound') {
        existing.inbound_count++;
        if (!row.is_read) {
          existing.unread_count++;
          existing.has_inbound_unread = true;
        }
        if (!existing.last_inbound || new Date(row.created_at) > new Date(existing.last_inbound.created_at)) {
          existing.last_inbound = row;
        }
      } else {
        existing.outbound_count++;
        if (!existing.last_outbound || new Date(row.created_at) > new Date(existing.last_outbound.created_at)) {
          existing.last_outbound = row;
        }
      }
      if (row.status === 'needs_review') existing.has_needs_review = true;
      if (row.status === 'spam') existing.has_spam = true;
      // Prefer the inbound message's address — synthesized outbound rows from
      // the migration may have null inbox_address_id and would otherwise hide
      // a thread from the per-address tab counters.
      if (row.direction === 'inbound' && row.inbox_address_id) {
        existing.address_id = row.inbox_address_id;
      } else if (!existing.address_id && row.inbox_address_id) {
        existing.address_id = row.inbox_address_id;
      }
      if (row.sender_email) existing.participants.add(row.sender_email);
      existing.message_count++;
    }
  }

  // Folder filtering
  const allThreads = Array.from(threadMap.values()).sort(
    (a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime()
  );

  const folderThreads = allThreads.filter(t => {
    switch (folder) {
      case 'inbox':
        // any inbound message and not spam-only
        return t.inbound_count > 0 && !t.has_spam;
      case 'needs_review':
        return t.has_needs_review;
      case 'sent':
        return t.outbound_count > 0;
      case 'spam':
        return t.has_spam;
      case 'all':
      default:
        return true;
    }
  });

  const total = folderThreads.length;
  const paged = folderThreads.slice(offset, offset + limit);

  // Compute folder counts (across all addresses for this site, ignoring addressId filter
  // would mean re-fetching — we only show counts for the current address scope).
  const counts = {
    inbox: allThreads.filter(t => t.inbound_count > 0 && !t.has_spam).length,
    needs_review: allThreads.filter(t => t.has_needs_review).length,
    sent: allThreads.filter(t => t.outbound_count > 0).length,
    spam: allThreads.filter(t => t.has_spam).length,
    all: allThreads.length,
    inbox_unread: allThreads.filter(t => t.inbound_count > 0 && !t.has_spam && t.has_inbound_unread).length,
    needs_review_unread: allThreads.filter(t => t.has_needs_review && t.has_inbound_unread).length,
  };

  // Per-address unread counts for the address tabs. We do this from a
  // SEPARATE unfiltered query — `allThreads` was scoped to the active
  // addressId filter (when supplied), so it would otherwise show 0 for
  // every other tab.
  const addresses = await listSiteInboxAddresses(db, siteId);
  const perAddress: Record<string, { unread: number; total: number }> = {};
  for (const a of addresses) perAddress[a.id] = { unread: 0, total: 0 };

  if (addresses.length > 0) {
    const { data: unreadRows } = await db
      .from('contact_submissions')
      .select('inbox_address_id, status')
      .eq('site_id', siteId)
      .eq('direction', 'inbound')
      .eq('is_read', false)
      .neq('status', 'spam');
    for (const r of (unreadRows ?? []) as Array<{ inbox_address_id: string | null; status: string }>) {
      if (!r.inbox_address_id) continue;
      if (perAddress[r.inbox_address_id]) {
        perAddress[r.inbox_address_id].unread += 1;
      }
    }

    const { data: totalCounts } = await db
      .from('contact_submissions')
      .select('inbox_address_id')
      .eq('site_id', siteId);
    for (const r of (totalCounts ?? []) as Array<{ inbox_address_id: string | null }>) {
      if (!r.inbox_address_id) continue;
      if (perAddress[r.inbox_address_id]) {
        perAddress[r.inbox_address_id].total += 1;
      }
    }
  }

  return NextResponse.json({
    threads: paged.map(t => ({
      threadId: t.thread_id,
      addressId: t.address_id,
      lastMessageAt: t.last.created_at,
      messageCount: t.message_count,
      unreadCount: t.unread_count,
      hasNeedsReview: t.has_needs_review,
      hasSpam: t.has_spam,
      hasOutbound: t.outbound_count > 0,
      hasInboundUnread: t.has_inbound_unread,
      participantName: t.last_inbound?.sender_name ?? t.last_outbound?.from_name ?? t.last.sender_name,
      participantEmails: Array.from(t.participants),
      subject: t.last_inbound?.subject ?? t.last_outbound?.subject ?? t.last.subject ?? '(no subject)',
      snippet: (t.last.message ?? '').slice(0, 160),
      aiSummary: t.last_inbound?.ai_summary ?? null,
      aiClassification: t.last_inbound?.ai_classification ?? null,
      hasAiDraft: !!t.last_inbound?.ai_draft_reply,
      sourceType: t.last.source_type,
      metadata: t.last.metadata,
    })),
    total,
    page,
    counts,
    addresses,
    perAddress,
  });
}
