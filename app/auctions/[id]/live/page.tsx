import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { mapAuction } from '@/lib/auctions/types';
import { getCurrentMember } from '@/lib/membership/current-member';
import LiveBidderView from './LiveBidderView';

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: auctionRow } = await db.from('auctions').select('*').eq('id', id).single();
  if (!auctionRow || auctionRow.status === 'draft') notFound();
  const auction = mapAuction(auctionRow);

  const member = await getCurrentMember(auction.siteId);
  if (!member) redirect(`/auctions/${id}/register`);

  const { data: regRow } = await db
    .from('auction_registrations')
    .select('*')
    .eq('auction_id', id)
    .eq('member_id', member.memberId)
    .maybeSingle();

  if (!regRow) redirect(`/auctions/${id}/register`);

  return (
    <LiveBidderView
      auctionId={auction.id}
      myRegistration={{
        id: regRow.id,
        status: regRow.status,
        aliasColor: regRow.alias_color,
        aliasAnimal: regRow.alias_animal,
      }}
    />
  );
}
