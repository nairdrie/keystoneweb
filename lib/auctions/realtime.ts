import { createAdminClient } from '@/lib/db/supabase-admin';

export type AuctionEvent =
  | { type: 'bid_placed'; lotId: string; amountCents: number; aliasColor: string; aliasAnimal: string; endsAt: string; registrationId: string }
  | { type: 'lot_started'; lotId: string; endsAt: string }
  | { type: 'lot_ended'; lotId: string; outcome: 'sold' | 'passed'; soldPriceCents: number | null; winnerAlias: string | null }
  | { type: 'auction_started' }
  | { type: 'auction_ended' }
  | { type: 'bid_retracted'; bidId: string; lotId: string };

export function auctionChannelName(auctionId: string): string {
  return `auction:${auctionId}`;
}

/**
 * Broadcast an event to all bidders + admin viewing the auction.
 * Fire-and-forget; errors are logged but don't block the caller.
 */
export async function broadcastAuctionEvent(auctionId: string, event: AuctionEvent): Promise<void> {
  try {
    const supabase = createAdminClient();
    const channel = supabase.channel(auctionChannelName(auctionId));
    // Subscribing is required to send. We unsubscribe immediately after.
    await channel.subscribe();
    await channel.send({ type: 'broadcast', event: event.type, payload: event });
    await supabase.removeChannel(channel);
  } catch (err) {
    console.error('[auctions/realtime] broadcast failed:', err);
  }
}
