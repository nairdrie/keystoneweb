import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getAuctionsAccess } from '@/lib/auctions/admin-auth';
import { closeCurrentLot } from '@/lib/auctions/engine';
import { broadcastAuctionEvent } from '@/lib/auctions/realtime';

/**
 * POST /api/admin/auctions/[id]/end
 * Body: { siteId }
 *
 * Force-ends the auction. Closes the current live lot (if any) and marks
 * every remaining pending lot as skipped.
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
  if (!auction) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });

  if (auction.status === 'live') {
    await closeCurrentLot(db, id, 'force');
  }

  await db.from('auction_lots').update({ status: 'skipped', updated_at: new Date().toISOString() })
    .eq('auction_id', id)
    .eq('status', 'pending');

  await db.from('auctions').update({
    status: 'ended',
    current_lot_id: null,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  await broadcastAuctionEvent(id, { type: 'auction_ended' });
  return NextResponse.json({ ok: true });
}
