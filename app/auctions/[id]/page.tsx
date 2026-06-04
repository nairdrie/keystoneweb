import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getCurrentMember } from '@/lib/membership/current-member';

/**
 * Smart entry point. Routes the visitor to the right step:
 *  - not signed in or not registered → /register
 *  - registered, auction not live yet → /lobby
 *  - registered, auction live          → /live
 */
export default async function AuctionEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: auction } = await db.from('auctions').select('id, site_id, status').eq('id', id).single();
  if (!auction || auction.status === 'draft' || auction.status === 'cancelled') {
    redirect('/');
  }

  const member = await getCurrentMember(auction.site_id);
  if (!member) redirect(`/auctions/${id}/register`);

  const { data: reg } = await db
    .from('auction_registrations')
    .select('status')
    .eq('auction_id', id)
    .eq('member_id', member.memberId)
    .maybeSingle();

  if (!reg) redirect(`/auctions/${id}/register`);
  if (auction.status === 'live') redirect(`/auctions/${id}/live`);
  redirect(`/auctions/${id}/lobby`);
}
