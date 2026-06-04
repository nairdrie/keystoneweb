import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getAuctionsAccess } from '@/lib/auctions/admin-auth';
import { broadcastAuctionEvent } from '@/lib/auctions/realtime';

/**
 * POST /api/admin/auctions/[id]/retract-bid
 * Body: { siteId, bidId, reason? }
 *
 * Retracts a bid (e.g. fraudulent or accidental). If the retracted bid was
 * the current high bid, the lot rolls back to the previous accepted bid (or
 * to "no bids" if it was the only one). Timer is left untouched.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const result = await getAuctionsAccess(request, { siteIdFromBody: body });
  if ('error' in result) return result.error;
  const { access } = result;

  const { bidId, reason } = body as { bidId?: string; reason?: string };
  if (!bidId) return NextResponse.json({ error: 'Missing bidId' }, { status: 400 });

  const db = createAdminClient();

  const { data: bid } = await db
    .from('auction_bids')
    .select('id, lot_id, auction_id, amount_cents, registration_id, status')
    .eq('id', bidId)
    .eq('auction_id', id)
    .single();
  if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
  if (bid.status === 'retracted') return NextResponse.json({ ok: true, noop: true });

  // Confirm the auction belongs to the site
  const { data: auction } = await db
    .from('auctions')
    .select('site_id')
    .eq('id', id)
    .single();
  if (!auction || auction.site_id !== access.siteId) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  await db.from('auction_bids').update({
    status: 'retracted',
    retracted_at: new Date().toISOString(),
    retracted_by: access.userId,
    retracted_reason: reason || null,
  }).eq('id', bidId);

  // If this was the current high bid on the lot, recompute the leader
  const { data: lot } = await db
    .from('auction_lots')
    .select('current_bid_cents, current_winner_registration_id')
    .eq('id', bid.lot_id)
    .single();

  if (lot && lot.current_bid_cents === bid.amount_cents
      && lot.current_winner_registration_id === bid.registration_id) {
    const { data: prevBid } = await db
      .from('auction_bids')
      .select('amount_cents, registration_id')
      .eq('lot_id', bid.lot_id)
      .eq('status', 'accepted')
      .order('amount_cents', { ascending: false })
      .limit(1)
      .maybeSingle();

    await db.from('auction_lots').update({
      current_bid_cents: prevBid?.amount_cents ?? null,
      current_winner_registration_id: prevBid?.registration_id ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', bid.lot_id);
  }

  await broadcastAuctionEvent(id, { type: 'bid_retracted', bidId, lotId: bid.lot_id });
  return NextResponse.json({ ok: true });
}
