'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Gavel, Clock, Loader2, CheckCircle2, XCircle, Package } from 'lucide-react';
import { supabase } from '@/lib/db/supabase';
import { auctionChannelName, type AuctionEvent } from '@/lib/auctions/realtime';
import { formatCents } from '@/lib/auctions/stripe';
import type { Auction, AuctionLot } from '@/lib/auctions/types';

interface MyRegistration {
  id: string;
  status: string;
  aliasColor: string;
  aliasAnimal: string;
}

interface StateSnapshot {
  auction: Auction;
  currentLot: AuctionLot | null;
  nextLot: AuctionLot | null;
  upcomingLotCount: number;
  totalLots: number;
  recentBids: Array<{
    id: string;
    amountCents: number;
    createdAt: string;
    aliasColor: string;
    aliasAnimal: string;
    registrationId: string;
  }>;
  serverTime: string;
}

export default function LiveBidderView({ auctionId, myRegistration }: { auctionId: string; myRegistration: MyRegistration }) {
  const [snapshot, setSnapshot] = useState<StateSnapshot | null>(null);
  const [bidding, setBidding] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const tickedRef = useRef<string | null>(null);

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/auctions/${auctionId}/state`, { credentials: 'include' });
    if (res.ok) setSnapshot(await res.json());
  }, [auctionId]);

  // Initial load
  useEffect(() => { void fetchState(); }, [fetchState]);

  // 1Hz tick for the countdown. First update lands after ~1s; the timer
  // displays "—" until then to avoid impure render reads of Date.now().
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Subscribe to real-time events
  useEffect(() => {
    const channel = supabase.channel(auctionChannelName(auctionId));
    channel.on('broadcast', { event: 'bid_placed' }, (msg) => {
      const e = msg.payload as Extract<AuctionEvent, { type: 'bid_placed' }>;
      setSnapshot(prev => {
        if (!prev || !prev.currentLot || prev.currentLot.id !== e.lotId) return prev;
        return {
          ...prev,
          currentLot: {
            ...prev.currentLot,
            currentBidCents: e.amountCents,
            currentWinnerRegistrationId: e.registrationId,
            endsAt: e.endsAt,
          },
          recentBids: [
            {
              id: 'rt-' + Date.now(),
              amountCents: e.amountCents,
              createdAt: new Date().toISOString(),
              aliasColor: e.aliasColor,
              aliasAnimal: e.aliasAnimal,
              registrationId: e.registrationId,
            },
            ...prev.recentBids,
          ].slice(0, 20),
        };
      });
    });
    channel.on('broadcast', { event: 'lot_started' }, () => { fetchState(); });
    channel.on('broadcast', { event: 'lot_ended' }, () => { fetchState(); });
    channel.on('broadcast', { event: 'auction_ended' }, () => { fetchState(); });
    channel.on('broadcast', { event: 'bid_retracted' }, () => { fetchState(); });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [auctionId, fetchState]);

  // When the countdown hits 0, ping /tick to advance state. Guard against
  // sending duplicate ticks for the same lot.
  useEffect(() => {
    if (!snapshot?.currentLot?.endsAt) return;
    const msLeft = new Date(snapshot.currentLot.endsAt).getTime() - now;
    if (msLeft > 0) return;
    if (tickedRef.current === snapshot.currentLot.id) return;
    tickedRef.current = snapshot.currentLot.id;
    fetch(`/api/auctions/${auctionId}/tick`, { method: 'POST', credentials: 'include' })
      .then(() => fetchState())
      .catch(() => { /* swallow */ });
  }, [auctionId, now, snapshot?.currentLot?.endsAt, snapshot?.currentLot?.id, fetchState]);

  const auction = snapshot?.auction;
  const currentLot = snapshot?.currentLot;
  const recentBids = snapshot?.recentBids ?? [];

  // ─── Render ──────────────────────────────────────────────────────────────
  if (!snapshot) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (auction?.status === 'ended') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Gavel className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Auction ended</h1>
          <p className="text-sm text-slate-400">Thanks for joining. If you won a lot, you&apos;ll receive a receipt from the organiser shortly.</p>
        </div>
      </div>
    );
  }

  if (!currentLot) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Waiting for the next lot…</p>
        </div>
      </div>
    );
  }

  const isWinning = currentLot.currentWinnerRegistrationId === myRegistration.id;
  const endsAtMs = currentLot.endsAt ? new Date(currentLot.endsAt).getTime() : null;
  const secondsLeft = endsAtMs ? Math.max(0, Math.ceil((endsAtMs - now) / 1000)) : null;
  const urgent = secondsLeft !== null && secondsLeft <= 5;

  const minBidCents = currentLot.currentBidCents == null
    ? currentLot.startingBidCents
    : currentLot.currentBidCents + currentLot.bidIncrementCents;

  const canBid = myRegistration.status === 'approved' && !isWinning && (secondsLeft ?? 1) > 0;

  async function placeBid() {
    if (!currentLot || bidding) return;
    setBidError(null);
    setBidding(true);
    try {
      const res = await fetch(`/api/auctions/${auctionId}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ lotId: currentLot.id, amountCents: minBidCents }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Bid failed');
      // Broadcast will populate the UI; no need to update state here
    } catch (err) {
      setBidError(err instanceof Error ? err.message : 'Bid failed');
    } finally {
      setBidding(false);
    }
  }

  return (
    <div className="min-h-screen pb-24 md:pb-12">
      {/* Top bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> Live
            </span>
            <span className="text-sm font-medium truncate">{auction?.title}</span>
          </div>
          <div className="text-xs text-slate-400 hidden sm:block">
            Lot {currentLot.lotNumber} of {snapshot.totalLots}
          </div>
          <div className="text-xs font-mono text-amber-300">
            {myRegistration.aliasColor} {myRegistration.aliasAnimal}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 md:py-10 grid md:grid-cols-5 gap-6">
        {/* Lot detail (left, larger column on desktop) */}
        <section className="md:col-span-3 space-y-4">
          <div className="aspect-[4/3] rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
            {currentLot.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentLot.imageUrl} alt={currentLot.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-700">
                <Package className="w-16 h-16" />
              </div>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Lot {currentLot.lotNumber}</p>
            <h2 className="text-2xl font-bold">{currentLot.title}</h2>
            {currentLot.description && (
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">{currentLot.description}</p>
            )}
          </div>
          {snapshot.nextLot && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 flex items-center gap-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Next</div>
              <div className="text-xs text-slate-400 truncate">
                Lot {snapshot.nextLot.lotNumber} · {snapshot.nextLot.title} · from {formatCents(snapshot.nextLot.startingBidCents)}
              </div>
            </div>
          )}
        </section>

        {/* Bid panel (right) */}
        <section className="md:col-span-2 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Current bid</p>
            <p className="font-mono text-5xl font-bold tabular-nums text-slate-100">
              {currentLot.currentBidCents != null ? formatCents(currentLot.currentBidCents) : formatCents(currentLot.startingBidCents)}
            </p>
            {currentLot.currentBidCents == null && (
              <p className="text-xs text-slate-500 mt-1">Opening bid</p>
            )}

            {/* Winning/Outbid banner */}
            {currentLot.currentBidCents != null && (
              isWinning ? (
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5" /> You&apos;re winning
                </div>
              ) : (
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 text-red-300 text-xs font-bold uppercase tracking-wider">
                  <XCircle className="w-3.5 h-3.5" /> Outbid
                </div>
              )
            )}
          </div>

          {/* Timer */}
          <div className={`rounded-2xl border p-6 text-center transition ${
            urgent ? 'border-red-500/50 bg-red-500/10' : 'border-slate-800 bg-slate-900/60'
          }`}>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Closing in
            </p>
            <p className={`font-mono text-4xl font-bold tabular-nums ${urgent ? 'text-red-300 animate-pulse' : 'text-slate-100'}`}>
              {secondsLeft != null ? `${secondsLeft}s` : '—'}
            </p>
          </div>

          {/* Bid button */}
          <button
            onClick={placeBid}
            disabled={!canBid || bidding}
            className="hidden md:flex w-full items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-lg px-4 py-5 rounded-2xl transition shadow-lg shadow-amber-500/20"
          >
            {bidding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gavel className="w-5 h-5" />}
            BID {formatCents(minBidCents)}
          </button>
          {bidError && <div className="text-xs text-red-300 text-center">{bidError}</div>}
          {!canBid && !isWinning && myRegistration.status !== 'approved' && (
            <div className="text-xs text-amber-300 text-center">Your registration is {myRegistration.status}.</div>
          )}

          {/* Activity feed */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Activity</p>
            {recentBids.length === 0 ? (
              <p className="text-xs text-slate-500">No bids yet — be the first.</p>
            ) : (
              <ul className="space-y-1.5">
                {recentBids.map(bid => {
                  const mine = bid.registrationId === myRegistration.id;
                  return (
                    <li key={bid.id} className={`flex items-center justify-between text-xs ${mine ? 'text-amber-300' : 'text-slate-300'}`}>
                      <span className="font-mono truncate">{bid.aliasColor} {bid.aliasAnimal}{mine && ' (you)'}</span>
                      <span className="font-mono font-bold tabular-nums">{formatCents(bid.amountCents)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </main>

      {/* Mobile fixed bid bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950 border-t border-slate-800 px-4 py-3 safe-area-inset-bottom">
        <button
          onClick={placeBid}
          disabled={!canBid || bidding}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-base px-4 py-4 rounded-xl transition"
        >
          {bidding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gavel className="w-5 h-5" />}
          BID {formatCents(minBidCents)}
        </button>
        {bidError && <div className="text-[11px] text-red-300 text-center mt-2">{bidError}</div>}
      </div>
    </div>
  );
}
