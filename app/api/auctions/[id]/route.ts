import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { mapAuction, mapLot } from '@/lib/auctions/types';
import { getCurrentMemberFromRequest } from '@/lib/membership/current-member';

/**
 * GET /api/auctions/[id]
 * Public read of an auction's metadata + its lot list. Returns the caller's
 * registration if they're logged in as a member of this site.
 *
 * Drafts are hidden from the public.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: auction } = await db.from('auctions').select('*').eq('id', id).single();
  if (!auction) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
  if (auction.status === 'draft') {
    return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
  }

  const [{ data: lotRows }, { data: site }] = await Promise.all([
    db.from('auction_lots').select('*').eq('auction_id', id).order('lot_number', { ascending: true }),
    db.from('sites').select('id, site_slug, stripe_account_id, auctions_enabled').eq('id', auction.site_id).single(),
  ]);

  if (!site?.auctions_enabled) {
    return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
  }

  // Member's own registration (so the UI knows if they're already enrolled)
  const member = await getCurrentMemberFromRequest(request, auction.site_id);
  let registration: { id: string; status: string; aliasColor: string; aliasAnimal: string } | null = null;
  if (member) {
    const { data: reg } = await db
      .from('auction_registrations')
      .select('id, status, alias_color, alias_animal')
      .eq('auction_id', id)
      .eq('member_id', member.memberId)
      .maybeSingle();
    if (reg) {
      registration = {
        id: reg.id,
        status: reg.status,
        aliasColor: reg.alias_color,
        aliasAnimal: reg.alias_animal,
      };
    }
  }

  return NextResponse.json({
    auction: mapAuction(auction),
    lots: (lotRows ?? []).map(mapLot).map(l => ({
      // Hide bid details for not-yet-live lots, except for the leading lot which the UI needs
      ...l,
      currentBidCents: l.status === 'pending' ? null : l.currentBidCents,
    })),
    site: { id: site.id, slug: site.site_slug },
    registration,
    isLoggedIn: !!member,
  });
}
