import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getCurrentMemberFromRequest } from '@/lib/membership/current-member';
import { mapAuction, mapLot } from '@/lib/auctions/types';

/**
 * GET /api/auctions/[id]/state
 *
 * Snapshot of the auction's live state for the bidder + supervisor pages:
 *   - auction header
 *   - current lot + its top bid
 *   - upcoming lot preview
 *   - recent bids on the current lot (last 20), with anonymous aliases
 *   - the caller's own registration (if signed in)
 *
 * Acts as a fallback / initial-load companion to the Realtime broadcast.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: auction } = await db.from('auctions').select('*').eq('id', id).single();
  if (!auction || auction.status === 'draft') {
    return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
  }

  // Lots — pending + current + sold (for history)
  const { data: lotRows } = await db
    .from('auction_lots')
    .select('*')
    .eq('auction_id', id)
    .order('lot_number', { ascending: true });

  const lots = (lotRows ?? []).map(mapLot);
  const currentLot = lots.find(l => l.status === 'live') ?? null;
  const nextLot = lots.find(l => l.status === 'pending') ?? null;

  // Recent bids on the current lot, joined with the bidder's alias
  let recentBids: Array<{
    id: string;
    amountCents: number;
    createdAt: string;
    aliasColor: string;
    aliasAnimal: string;
    registrationId: string;
  }> = [];

  if (currentLot) {
    const { data: bidRows } = await db
      .from('auction_bids')
      .select('id, amount_cents, created_at, registration_id, status, auction_registrations(alias_color, alias_animal)')
      .eq('lot_id', currentLot.id)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(20);

    recentBids = (bidRows ?? []).map((r: Record<string, unknown>) => {
      const reg = r.auction_registrations as { alias_color: string; alias_animal: string } | null;
      return {
        id: r.id as string,
        amountCents: r.amount_cents as number,
        createdAt: r.created_at as string,
        aliasColor: reg?.alias_color ?? 'Unknown',
        aliasAnimal: reg?.alias_animal ?? 'Bidder',
        registrationId: r.registration_id as string,
      };
    });
  }

  // Caller's registration
  const member = await getCurrentMemberFromRequest(request, auction.site_id);
  let myRegistration: { id: string; status: string; aliasColor: string; aliasAnimal: string } | null = null;
  if (member) {
    const { data: reg } = await db
      .from('auction_registrations')
      .select('id, status, alias_color, alias_animal')
      .eq('auction_id', id)
      .eq('member_id', member.memberId)
      .maybeSingle();
    if (reg) {
      myRegistration = {
        id: reg.id,
        status: reg.status,
        aliasColor: reg.alias_color,
        aliasAnimal: reg.alias_animal,
      };
    }
  }

  return NextResponse.json({
    auction: mapAuction(auction),
    currentLot,
    nextLot,
    upcomingLotCount: lots.filter(l => l.status === 'pending').length,
    totalLots: lots.length,
    recentBids,
    myRegistration,
    serverTime: new Date().toISOString(),
  });
}
