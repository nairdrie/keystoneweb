import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getAuctionsAccess } from '@/lib/auctions/admin-auth';
import { mapAuction, mapLot, mapRegistration } from '@/lib/auctions/types';

async function loadOwnedAuction(auctionId: string, siteId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from('auctions')
    .select('*')
    .eq('id', auctionId)
    .eq('site_id', siteId)
    .single();
  return data;
}

/**
 * GET /api/admin/auctions/[id]?siteId=xxx
 * Fetch one auction along with its lots and registration count.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAuctionsAccess(request);
  if ('error' in result) return result.error;
  const { access } = result;

  const auctionRow = await loadOwnedAuction(id, access.siteId);
  if (!auctionRow) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });

  const db = createAdminClient();
  const [{ data: lotRows }, { data: regRows }] = await Promise.all([
    db.from('auction_lots').select('*').eq('auction_id', id).order('lot_number', { ascending: true }),
    db.from('auction_registrations').select('*').eq('auction_id', id).order('created_at', { ascending: true }),
  ]);

  return NextResponse.json({
    auction: mapAuction(auctionRow),
    lots: (lotRows ?? []).map(mapLot),
    registrations: (regRows ?? []).map(mapRegistration),
  });
}

/**
 * PATCH /api/admin/auctions/[id]
 * Update editable fields (title, description, scheduled_start, settings, status).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const result = await getAuctionsAccess(request, { siteIdFromBody: body });
  if ('error' in result) return result.error;
  const { access } = result;

  const auctionRow = await loadOwnedAuction(id, access.siteId);
  if (!auctionRow) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === 'string') update.title = body.title;
  if ('description' in body) update.description = body.description || null;
  if (typeof body.scheduledStart === 'string') update.scheduled_start = body.scheduledStart;
  if (typeof body.softCloseSeconds === 'number') update.soft_close_seconds = body.softCloseSeconds;
  if (typeof body.initialLotSeconds === 'number') update.initial_lot_seconds = body.initialLotSeconds;
  if (typeof body.autoApproveRegistrations === 'boolean') update.auto_approve_registrations = body.autoApproveRegistrations;
  if (typeof body.status === 'string') {
    const allowed = ['draft', 'scheduled', 'ended', 'cancelled'];
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status transition. Use /start for live.' }, { status: 400 });
    }
    update.status = body.status;
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('auctions')
    .update(update)
    .eq('id', id)
    .eq('site_id', access.siteId)
    .select()
    .single();

  if (error || !data) {
    console.error('[admin/auctions/id] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update auction' }, { status: 500 });
  }

  return NextResponse.json({ auction: mapAuction(data) });
}

/**
 * DELETE /api/admin/auctions/[id]
 * Allowed only for draft or cancelled auctions. Cascades to lots/registrations/bids.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAuctionsAccess(request);
  if ('error' in result) return result.error;
  const { access } = result;

  const auctionRow = await loadOwnedAuction(id, access.siteId);
  if (!auctionRow) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
  if (!['draft', 'cancelled'].includes(auctionRow.status)) {
    return NextResponse.json({ error: 'Only draft or cancelled auctions can be deleted' }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db.from('auctions').delete().eq('id', id).eq('site_id', access.siteId);
  if (error) {
    return NextResponse.json({ error: 'Failed to delete auction' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
