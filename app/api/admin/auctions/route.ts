import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getAuctionsAccess } from '@/lib/auctions/admin-auth';
import { mapAuction } from '@/lib/auctions/types';

/**
 * GET /api/admin/auctions?siteId=xxx
 * List auctions for this site (newest first).
 */
export async function GET(request: NextRequest) {
  const result = await getAuctionsAccess(request);
  if ('error' in result) return result.error;
  const { access } = result;

  const db = createAdminClient();
  const { data, error } = await db
    .from('auctions')
    .select('*, auction_lots(count)')
    .eq('site_id', access.siteId)
    .order('scheduled_start', { ascending: false });

  if (error) {
    console.error('[admin/auctions] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch auctions' }, { status: 500 });
  }

  return NextResponse.json({
    auctions: (data ?? []).map((row: Record<string, unknown>) => ({
      ...mapAuction(row),
      lotCount: ((row.auction_lots as Array<{ count: number }>)?.[0]?.count) ?? 0,
    })),
  });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * POST /api/admin/auctions
 * Create a draft auction.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await getAuctionsAccess(request, { siteIdFromBody: body });
  if ('error' in result) return result.error;
  const { access } = result;

  const { title, description, scheduledStart, softCloseSeconds, initialLotSeconds, autoApproveRegistrations } = body;

  if (!title || !scheduledStart) {
    return NextResponse.json({ error: 'Missing required fields: title, scheduledStart' }, { status: 400 });
  }

  const baseSlug = slugify(title) || 'auction';
  const db = createAdminClient();

  // Ensure slug uniqueness per site
  let slug = baseSlug;
  for (let i = 1; i < 30; i++) {
    const { data: existing } = await db
      .from('auctions')
      .select('id')
      .eq('site_id', access.siteId)
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${i + 1}`;
  }

  const { data, error } = await db
    .from('auctions')
    .insert({
      site_id: access.siteId,
      slug,
      title,
      description: description || null,
      scheduled_start: scheduledStart,
      status: 'draft',
      soft_close_seconds: softCloseSeconds ?? 20,
      initial_lot_seconds: initialLotSeconds ?? 60,
      auto_approve_registrations: autoApproveRegistrations ?? true,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[admin/auctions] POST error:', error);
    return NextResponse.json({ error: 'Failed to create auction' }, { status: 500 });
  }

  return NextResponse.json({ auction: mapAuction(data) }, { status: 201 });
}
