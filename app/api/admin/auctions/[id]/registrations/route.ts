import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getAuctionsAccess } from '@/lib/auctions/admin-auth';
import { mapRegistration } from '@/lib/auctions/types';

/**
 * GET /api/admin/auctions/[id]/registrations?siteId=xxx
 * List registrations for this auction including the member's name + email.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAuctionsAccess(request);
  if ('error' in result) return result.error;
  const { access } = result;

  const db = createAdminClient();
  const { data, error } = await db
    .from('auction_registrations')
    .select('*, members(id, name, email)')
    .eq('auction_id', id)
    .eq('site_id', access.siteId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
  }

  return NextResponse.json({
    registrations: (data ?? []).map((row: Record<string, unknown>) => {
      const member = row.members as { id: string; name: string | null; email: string } | null;
      return {
        ...mapRegistration(row),
        memberName: member?.name ?? null,
        memberEmail: member?.email ?? null,
      };
    }),
  });
}

/**
 * PATCH /api/admin/auctions/[id]/registrations
 * Update a registration's status (approve / reject / ban).
 * Body: { registrationId, status }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const result = await getAuctionsAccess(request, { siteIdFromBody: body });
  if ('error' in result) return result.error;
  const { access } = result;

  const { registrationId, status } = body;
  if (!registrationId || !['approved', 'rejected', 'banned'].includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const db = createAdminClient();
  const update: Record<string, unknown> = { status };
  if (status === 'approved') update.approved_at = new Date().toISOString();

  const { data, error } = await db
    .from('auction_registrations')
    .update(update)
    .eq('id', registrationId)
    .eq('auction_id', id)
    .eq('site_id', access.siteId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update registration' }, { status: 500 });
  }
  return NextResponse.json({ registration: mapRegistration(data) });
}
