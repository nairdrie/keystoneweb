import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getAuctionsAccess } from '@/lib/auctions/admin-auth';
import { mapLot } from '@/lib/auctions/types';

/**
 * POST /api/admin/auctions/[id]/lots
 * Add a lot to the auction. Auto-assigns the next lot_number.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const result = await getAuctionsAccess(request, { siteIdFromBody: body });
  if ('error' in result) return result.error;
  const { access } = result;

  const { title, description, imageUrl, startingBidCents, bidIncrementCents } = body;

  if (!title || typeof startingBidCents !== 'number') {
    return NextResponse.json({ error: 'Missing required fields: title, startingBidCents' }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: auction } = await db
    .from('auctions')
    .select('id, status')
    .eq('id', id)
    .eq('site_id', access.siteId)
    .single();
  if (!auction) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
  if (!['draft', 'scheduled'].includes(auction.status)) {
    return NextResponse.json({ error: 'Cannot add lots to a live or ended auction' }, { status: 400 });
  }

  const { data: maxRow } = await db
    .from('auction_lots')
    .select('lot_number')
    .eq('auction_id', id)
    .order('lot_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = (maxRow?.lot_number ?? 0) + 1;

  const { data, error } = await db
    .from('auction_lots')
    .insert({
      auction_id: id,
      lot_number: nextNumber,
      title,
      description: description || null,
      image_url: imageUrl || null,
      starting_bid_cents: startingBidCents,
      bid_increment_cents: bidIncrementCents ?? 100,
      status: 'pending',
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[admin/auctions/lots] POST error:', error);
    return NextResponse.json({ error: 'Failed to create lot' }, { status: 500 });
  }

  return NextResponse.json({ lot: mapLot(data) }, { status: 201 });
}
