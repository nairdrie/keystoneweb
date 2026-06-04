import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getCurrentMemberFromRequest } from '@/lib/membership/current-member';
import { broadcastAuctionEvent } from '@/lib/auctions/realtime';

/**
 * POST /api/auctions/[id]/bid
 * Body: { lotId, amountCents }
 *
 * Defers all validation + soft-close timer extension to the
 * place_auction_bid() SQL function, which holds a row-level lock on the lot
 * for the duration of the transaction. Broadcasts on success.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { lotId, amountCents } = body as { lotId?: string; amountCents?: number };

  if (!lotId || typeof amountCents !== 'number' || amountCents <= 0) {
    return NextResponse.json({ error: 'Invalid bid' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: auction } = await db.from('auctions').select('site_id, status').eq('id', id).single();
  if (!auction || auction.status !== 'live') {
    return NextResponse.json({ error: 'Auction is not live' }, { status: 400 });
  }

  const member = await getCurrentMemberFromRequest(request, auction.site_id);
  if (!member) {
    return NextResponse.json({ error: 'You must be signed in to bid' }, { status: 401 });
  }

  const { data: registration } = await db
    .from('auction_registrations')
    .select('id, status, alias_color, alias_animal')
    .eq('auction_id', id)
    .eq('member_id', member.memberId)
    .maybeSingle();

  if (!registration) {
    return NextResponse.json({ error: 'You are not registered for this auction' }, { status: 403 });
  }
  if (registration.status !== 'approved') {
    return NextResponse.json({ error: `Registration is ${registration.status}` }, { status: 403 });
  }

  const { data, error } = await db.rpc('place_auction_bid', {
    p_lot_id: lotId,
    p_registration_id: registration.id,
    p_amount_cents: amountCents,
  });

  if (error) {
    console.error('[auctions/bid] rpc error:', error);
    return NextResponse.json({ error: 'Failed to place bid' }, { status: 500 });
  }

  const result = data as { ok: boolean; error?: string; ends_at?: string; min_cents?: number; bid_id?: string };
  if (!result.ok) {
    return NextResponse.json({ error: result.error, minCents: result.min_cents }, { status: 400 });
  }

  await broadcastAuctionEvent(id, {
    type: 'bid_placed',
    lotId,
    amountCents,
    aliasColor: registration.alias_color,
    aliasAnimal: registration.alias_animal,
    endsAt: result.ends_at!,
    registrationId: registration.id,
  });

  return NextResponse.json({
    ok: true,
    bidId: result.bid_id,
    endsAt: result.ends_at,
    amountCents,
  });
}
