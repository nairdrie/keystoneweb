import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getAuctionsAccess } from '@/lib/auctions/admin-auth';
import { closeCurrentLot, advanceAuction } from '@/lib/auctions/engine';

/**
 * POST /api/admin/auctions/[id]/skip
 * Body: { siteId }
 *
 * Admin-forced close of the current lot, regardless of its remaining timer.
 * If the lot has a high bidder it sells at the current top bid; otherwise it
 * passes. Then advances to the next pending lot (or ends the auction).
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
    .select('id, status')
    .eq('id', id)
    .eq('site_id', access.siteId)
    .single();
  if (!auction || auction.status !== 'live') {
    return NextResponse.json({ error: 'Auction is not live' }, { status: 400 });
  }

  const closed = await closeCurrentLot(db, id, 'force');
  const next = await advanceAuction(db, id);

  return NextResponse.json({ ok: true, outcome: closed.outcome, nextLotId: next.nextLotId });
}
