import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { mapAuction, mapLot } from '@/lib/auctions/types';
import { getCurrentMember } from '@/lib/membership/current-member';
import LobbyView from './LobbyView';

export default async function LobbyPage({ params }: { params: Promise<{ id: string }> }) {
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
  if (auction.status === 'live') redirect(`/auctions/${id}/live`);

  const { data: lotRows } = await db
    .from('auction_lots')
    .select('*')
    .eq('auction_id', id)
    .order('lot_number', { ascending: true });

  return (
    <LobbyView
      auction={auction}
      lots={(lotRows ?? []).map(mapLot)}
      alias={{ color: regRow.alias_color, animal: regRow.alias_animal }}
      registrationStatus={regRow.status}
    />
  );
}
