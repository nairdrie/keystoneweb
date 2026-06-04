import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getAuctionsAccess } from '@/lib/auctions/admin-auth';
import { advanceAuction } from '@/lib/auctions/engine';
import { broadcastAuctionEvent } from '@/lib/auctions/realtime';

/**
 * POST /api/admin/auctions/[id]/start
 * Body: { siteId }
 *
 * Transitions a scheduled/draft auction to `live` and starts the first
 * pending lot. Refuses if no lots have been added.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await getAuctionsAccess(request, { siteIdFromBody: body });
  if ('error' in result) return result.error;
  const { access } = result;

  const db = createAdminClient();
  const { data: auction } = await db
    .from('auctions')
    .select('*')
    .eq('id', id)
    .eq('site_id', access.siteId)
    .single();
  if (!auction) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
  if (auction.status === 'live') return NextResponse.json({ ok: true, noop: true });
  if (auction.status === 'ended' || auction.status === 'cancelled') {
    return NextResponse.json({ error: `Cannot start a ${auction.status} auction` }, { status: 400 });
  }

  const { count } = await db
    .from('auction_lots')
    .select('id', { count: 'exact', head: true })
    .eq('auction_id', id)
    .eq('status', 'pending');
  if (!count || count === 0) {
    return NextResponse.json({ error: 'Add at least one lot before starting' }, { status: 400 });
  }

  await broadcastAuctionEvent(id, { type: 'auction_started' });
  const next = await advanceAuction(db, id);
  return NextResponse.json({ ok: true, currentLotId: next.nextLotId });
}
