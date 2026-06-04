import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { closeCurrentLot, advanceAuction } from '@/lib/auctions/engine';

/**
 * POST /api/auctions/[id]/tick
 *
 * Anyone watching the auction (bidder or admin) calls this when their
 * countdown reaches 0. Idempotent: if the current lot's timer hasn't actually
 * expired, this is a no-op.
 *
 * On expiry: close the current lot (charges winner async) and start the next
 * pending lot. Broadcasts both events.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: auction } = await db.from('auctions').select('id, status').eq('id', id).single();
  if (!auction || auction.status !== 'live') {
    return NextResponse.json({ ok: true, noop: true });
  }

  const closed = await closeCurrentLot(db, id, 'auto');
  if (!closed.closed) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const next = await advanceAuction(db, id);
  return NextResponse.json({ ok: true, closed: true, nextLotId: next.nextLotId });
}
