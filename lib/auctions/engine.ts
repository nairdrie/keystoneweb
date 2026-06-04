/**
 * Auction state machine helpers. All write paths share these so the sequencing
 * (advance to next lot / close lot / charge winner / end auction) stays
 * consistent whether triggered by the timer-tick endpoint, an admin action,
 * or the bid endpoint.
 */

import { createAdminClient } from '@/lib/db/supabase-admin';
import { getStripe } from '@/lib/auctions/stripe';
import { broadcastAuctionEvent } from '@/lib/auctions/realtime';

type Db = ReturnType<typeof createAdminClient>;

/** Advance to the next pending lot, or end the auction if none remain. */
export async function advanceAuction(db: Db, auctionId: string): Promise<{ nextLotId: string | null }> {
  const { data: auction } = await db.from('auctions').select('*').eq('id', auctionId).single();
  if (!auction) return { nextLotId: null };

  const { data: nextLot } = await db
    .from('auction_lots')
    .select('id, lot_number')
    .eq('auction_id', auctionId)
    .eq('status', 'pending')
    .order('lot_number', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextLot) {
    await db.from('auctions').update({
      status: 'ended',
      current_lot_id: null,
      updated_at: new Date().toISOString(),
    }).eq('id', auctionId);
    await broadcastAuctionEvent(auctionId, { type: 'auction_ended' });
    return { nextLotId: null };
  }

  const endsAt = new Date(Date.now() + auction.initial_lot_seconds * 1000).toISOString();
  const startedAt = new Date().toISOString();

  await db.from('auction_lots').update({
    status: 'live',
    started_at: startedAt,
    ends_at: endsAt,
    updated_at: startedAt,
  }).eq('id', nextLot.id);

  await db.from('auctions').update({
    status: 'live',
    current_lot_id: nextLot.id,
    updated_at: startedAt,
  }).eq('id', auctionId);

  await broadcastAuctionEvent(auctionId, { type: 'lot_started', lotId: nextLot.id, endsAt });
  return { nextLotId: nextLot.id };
}

/**
 * Close the currently-live lot:
 *   - if it has a high bidder → mark sold, kick off the winner charge
 *   - otherwise               → mark passed
 * Idempotent: if the lot has already been closed, this is a no-op.
 */
export async function closeCurrentLot(
  db: Db,
  auctionId: string,
  outcome: 'auto' | 'force' = 'auto',
): Promise<{ closed: boolean; outcome: 'sold' | 'passed' | null }> {
  const { data: lot } = await db
    .from('auction_lots')
    .select('*')
    .eq('auction_id', auctionId)
    .eq('status', 'live')
    .maybeSingle();
  if (!lot) return { closed: false, outcome: null };

  // For 'auto' closure, require the timer to actually have expired.
  if (outcome === 'auto' && lot.ends_at && new Date(lot.ends_at).getTime() > Date.now()) {
    return { closed: false, outcome: null };
  }

  const isSold = lot.current_winner_registration_id && lot.current_bid_cents;
  const newStatus = isSold ? 'sold' : 'passed';
  const endedAt = new Date().toISOString();

  // Use a guarded update so concurrent callers don't double-process this lot.
  const { data: updated } = await db
    .from('auction_lots')
    .update({
      status: newStatus,
      ended_at: endedAt,
      sold_price_cents: isSold ? lot.current_bid_cents : null,
      winner_registration_id: isSold ? lot.current_winner_registration_id : null,
      updated_at: endedAt,
    })
    .eq('id', lot.id)
    .eq('status', 'live')
    .select()
    .maybeSingle();

  if (!updated) return { closed: false, outcome: null };

  if (isSold) {
    // Fire-and-forget; don't block lot advancement on Stripe network IO
    chargeWinner(db, auctionId, lot.id).catch(err => {
      console.error('[engine] chargeWinner failed:', err);
    });
  }

  // Resolve alias for the winner (if any) for the broadcast
  let winnerAlias: string | null = null;
  if (isSold) {
    const { data: reg } = await db
      .from('auction_registrations')
      .select('alias_color, alias_animal')
      .eq('id', lot.current_winner_registration_id)
      .single();
    if (reg) winnerAlias = `${reg.alias_color} ${reg.alias_animal}`;
  }

  await broadcastAuctionEvent(auctionId, {
    type: 'lot_ended',
    lotId: lot.id,
    outcome: isSold ? 'sold' : 'passed',
    soldPriceCents: isSold ? lot.current_bid_cents : null,
    winnerAlias,
  });

  return { closed: true, outcome: isSold ? 'sold' : 'passed' };
}

/**
 * Charge the winner's saved payment method for a sold lot. Records an
 * auction_charges row regardless of outcome so ops can see what happened.
 */
async function chargeWinner(db: Db, auctionId: string, lotId: string): Promise<void> {
  const { data: lot } = await db
    .from('auction_lots')
    .select('id, sold_price_cents, winner_registration_id, auction_id')
    .eq('id', lotId)
    .single();
  if (!lot || !lot.sold_price_cents || !lot.winner_registration_id) return;

  const { data: reg } = await db
    .from('auction_registrations')
    .select('stripe_customer_id, stripe_payment_method_id, site_id')
    .eq('id', lot.winner_registration_id)
    .single();
  if (!reg) return;

  const { data: site } = await db
    .from('sites')
    .select('stripe_account_id')
    .eq('id', reg.site_id)
    .single();
  if (!site?.stripe_account_id) return;

  // Idempotency: only insert charge if not already present for this lot
  const { data: chargeRow, error: chargeInsertErr } = await db
    .from('auction_charges')
    .insert({
      auction_id: auctionId,
      lot_id: lotId,
      registration_id: lot.winner_registration_id,
      site_id: reg.site_id,
      amount_cents: lot.sold_price_cents,
      status: 'pending',
    })
    .select()
    .single();

  // 23505 = unique_violation; means another worker already started this charge
  if (chargeInsertErr || !chargeRow) return;

  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create(
      {
        amount: lot.sold_price_cents,
        currency: 'usd',
        customer: reg.stripe_customer_id,
        payment_method: reg.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `Auction lot ${lotId}`,
        metadata: { auctionId, lotId, registrationId: lot.winner_registration_id },
      },
      { stripeAccount: site.stripe_account_id },
    );

    await db.from('auction_charges').update({
      stripe_payment_intent_id: intent.id,
      status: intent.status === 'succeeded' ? 'succeeded' : 'pending',
      updated_at: new Date().toISOString(),
    }).eq('id', chargeRow.id);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown Stripe error';
    await db.from('auction_charges').update({
      status: 'failed',
      failure_reason: reason,
      updated_at: new Date().toISOString(),
    }).eq('id', chargeRow.id);
  }
}
