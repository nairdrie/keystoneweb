import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/ops/moderation
 * Record a review decision on a moderation event.
 * Body: { id: string, action: 'approved' | 'removed' | 'escalated', notes?: string }
 */
export async function POST(request: NextRequest) {
  const access = await getOpsAccessContext();
  if (!access || (!access.isAdmin && !access.isAgent)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, action, notes } = body as {
    id: string;
    action: 'approved' | 'removed' | 'escalated';
    notes?: string;
  };

  if (!id || !['approved', 'removed', 'escalated'].includes(action)) {
    return NextResponse.json({ error: 'Missing or invalid id / action' }, { status: 400 });
  }

  const db = createAdminClient();

  const { error } = await db
    .from('moderation_events')
    .update({
      reviewed_by:   access.userId,
      reviewed_at:   new Date().toISOString(),
      review_action: action,
      notes:         notes ?? null,
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update moderation event:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
