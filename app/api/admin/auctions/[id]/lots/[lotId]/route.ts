import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getAuctionsAccess } from '@/lib/auctions/admin-auth';
import { mapLot } from '@/lib/auctions/types';

async function loadLot(auctionId: string, lotId: string, siteId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from('auction_lots')
    .select('*, auctions!inner(site_id, status)')
    .eq('id', lotId)
    .eq('auction_id', auctionId)
    .single();
  if (!data) return null;
  // Type assertion: the joined "auctions" relation comes back as an object.
  const joined = data.auctions as unknown as { site_id: string; status: string };
  if (joined.site_id !== siteId) return null;
  return { lot: data, auctionStatus: joined.status };
}

/**
 * PATCH /api/admin/auctions/[id]/lots/[lotId]
 * Update lot details — only allowed while the lot is pending (not yet live/sold).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lotId: string }> }
) {
  const { id, lotId } = await params;
  const body = await request.json();
  const result = await getAuctionsAccess(request, { siteIdFromBody: body });
  if ('error' in result) return result.error;
  const { access } = result;

  const loaded = await loadLot(id, lotId, access.siteId);
  if (!loaded) return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
  if (loaded.lot.status !== 'pending') {
    return NextResponse.json({ error: 'Lot cannot be edited once it has started' }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === 'string') update.title = body.title;
  if ('description' in body) update.description = body.description || null;
  if ('imageUrl' in body) update.image_url = body.imageUrl || null;
  if (typeof body.startingBidCents === 'number') update.starting_bid_cents = body.startingBidCents;
  if (typeof body.bidIncrementCents === 'number') update.bid_increment_cents = body.bidIncrementCents;

  const db = createAdminClient();
  const { data, error } = await db
    .from('auction_lots')
    .update(update)
    .eq('id', lotId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update lot' }, { status: 500 });
  }
  return NextResponse.json({ lot: mapLot(data) });
}

/**
 * DELETE /api/admin/auctions/[id]/lots/[lotId]
 * Allowed only while the lot is still pending.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lotId: string }> }
) {
  const { id, lotId } = await params;
  const result = await getAuctionsAccess(request);
  if ('error' in result) return result.error;
  const { access } = result;

  const loaded = await loadLot(id, lotId, access.siteId);
  if (!loaded) return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
  if (loaded.lot.status !== 'pending') {
    return NextResponse.json({ error: 'Cannot delete a started lot' }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db.from('auction_lots').delete().eq('id', lotId);
  if (error) {
    return NextResponse.json({ error: 'Failed to delete lot' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
