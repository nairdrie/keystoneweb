import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';

/**
 * GET /api/contact/inbox?siteId=...&status=...&page=...
 *
 * Returns paginated contact submissions for the authenticated user's site.
 * Auth: must own the site.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const siteId = searchParams.get('siteId');
  const statusFilter = searchParams.get('status') ?? 'all';
  const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10), 1);
  const limit = 40;
  const offset = (page - 1) * limit;

  if (!siteId) {
    return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
  }

  // Verify ownership
  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id')
    .eq('id', siteId)
    .single();

  if (!site || site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();

  let query = db
    .from('contact_submissions')
    .select(
      'id, sender_name, sender_email, sender_phone, message, status, ai_classification, ai_confidence, ai_summary, ai_draft_reply, ai_auto_sent, admin_reply, admin_reply_at, created_at, metadata, source_type',
      { count: 'exact' }
    )
    .eq('site_id', siteId)
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

  // Unread count (new + needs_review, excluding spam/ai_handled/replied)
  const { count: unreadCount } = await db
    .from('contact_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .in('status', ['new', 'needs_review']);

  return NextResponse.json({
    submissions: submissions ?? [],
    total: count ?? 0,
    page,
    unread: unreadCount ?? 0,
  });
}
