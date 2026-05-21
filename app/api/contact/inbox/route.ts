import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';

/**
 * GET /api/contact/inbox?siteId=...&status=...&page=...
 *
 * Returns paginated contact submissions for the authenticated user's site.
 * Auth: must own the site.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const siteId = searchParams.get('siteId');
  const statusFilter = searchParams.get('status') ?? 'all';
  const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10), 1);
  const limit = 40;
  const offset = (page - 1) * limit;

  try {
    await requireSiteAccess(siteId, request);
  } catch (e) {
    return siteAccessErrorResponse(e);
  }

  const db = createAdminClient();

  // Legacy endpoint: only return inbound submissions so the synthesized
  // outbound rows from migration 068 don't pollute the list shown to any
  // older surface that still queries this route.
  let query = db
    .from('contact_submissions')
    .select(
      'id, sender_name, sender_email, sender_phone, message, status, ai_classification, ai_confidence, ai_summary, ai_draft_reply, ai_auto_sent, admin_reply, admin_reply_at, created_at, metadata, source_type',
      { count: 'exact' }
    )
    .eq('site_id', siteId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: submissions, count, error } = await query;

  if (error) {
    console.error('[contact/inbox] Query failed:', error);
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
  }

  // Unread count: any inbound message that hasn't been opened, excluding spam.
  const { count: unreadCount } = await db
    .from('contact_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('direction', 'inbound')
    .eq('is_read', false)
    .neq('status', 'spam');

  return NextResponse.json({
    submissions: submissions ?? [],
    total: count ?? 0,
    page,
    unread: unreadCount ?? 0,
  });
}
