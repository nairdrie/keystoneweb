'use client';

import { useEffect, useState, useRef, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, SkipForward, Square, Loader2, Trash2, Gavel, Users, Clock, Package } from 'lucide-react';
import { useAdminContext } from '../../../admin-context';
import { supabase } from '@/lib/db/supabase';
import { auctionChannelName } from '@/lib/auctions/realtime';
import { formatCents } from '@/lib/auctions/stripe';
import { STATUS_LABELS, STATUS_COLORS, type Auction, type AuctionLot } from '@/lib/auctions/types';

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

export default function SupervisorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { siteId } = useAdminContext();

  const [snapshot, setSnapshot] = useState<StateSnapshot | null>(null);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tickedRef = useRef<string | null>(null);

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/auctions/${id}/state`, { credentials: 'include' });
    if (res.ok) setSnapshot(await res.json());
  }, [id]);

  useEffect(() => { void fetchState(); }, [fetchState]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase.channel(auctionChannelName(id));
    channel.on('broadcast', { event: '*' }, () => { fetchState(); });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, fetchState]);

  // Auto-tick when timer expires
  useEffect(() => {
    if (!snapshot?.currentLot?.endsAt) return;
    const msLeft = new Date(snapshot.currentLot.endsAt).getTime() - now;
    if (msLeft > 0) return;
    if (tickedRef.current === snapshot.currentLot.id) return;
    tickedRef.current = snapshot.currentLot.id;
    fetch(`/api/auctions/${id}/tick`, { method: 'POST', credentials: 'include' })
      .then(() => fetchState());
  }, [id, now, snapshot?.currentLot?.endsAt, snapshot?.currentLot?.id, fetchState]);

  async function action(name: 'start' | 'skip' | 'end', body: Record<string, unknown> = {}) {
    if (!siteId || busy) return;
    setBusy(name);
    setError(null);
    try {
      const res = await fetch(`/api/admin/auctions/${id}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId, ...body }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Failed to ${name}`);
      await fetchState();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${name}`);
    } finally {
      setBusy(null);
    }
  }

  async function retractBid(bidId: string) {
    if (!siteId) return;
    const reason = prompt('Reason for retracting this bid?');
    if (reason === null) return;
    setBusy('retract');
    setError(null);
    try {
      const res = await fetch(`/api/admin/auctions/${id}/retract-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId, bidId, reason }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to retract');
      await fetchState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retract');
    } finally {
      setBusy(null);
    }
  }

  if (!snapshot) {
    return <div className="px-4 py-8 text-sm text-slate-500"><Loader2 className="w-4 h-4 inline animate-spin mr-2" />Loading…</div>;
  }

  const { auction, currentLot, nextLot } = snapshot;
  const endsAtMs = currentLot?.endsAt ? new Date(currentLot.endsAt).getTime() : null;
  const secondsLeft = endsAtMs ? Math.max(0, Math.ceil((endsAtMs - now) / 1000)) : null;
  const urgent = secondsLeft !== null && secondsLeft <= 5;

  const canStart = (auction.status === 'draft' || auction.status === 'scheduled') && snapshot.totalLots > 0;
  const isLive = auction.status === 'live';
  const isEnded = auction.status === 'ended';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <Link
          href={`/admin/auctions/${id}?siteId=${siteId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to auction
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-slate-900">Supervisor</h1>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[auction.status]}`}>
                {STATUS_LABELS[auction.status]}
              </span>
            </div>
            <p className="text-sm text-slate-500">{auction.title}</p>
          </div>
        </div>
      </div>

      {/* Control strip */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-2">
        {!isLive && !isEnded && (
          <button
            onClick={() => action('start')}
            disabled={!canStart || busy === 'start'}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white px-4 py-2 rounded-lg text-sm font-bold"
            title={!canStart ? 'Add at least one lot first' : ''}
          >
            {busy === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Start auction
          </button>
        )}
        {isLive && (
          <>
            <button
              onClick={() => action('skip')}
              disabled={busy === 'skip' || !currentLot}
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-300 text-white px-4 py-2 rounded-lg text-sm font-bold"
            >
              {busy === 'skip' ? <Loader2 className="w-4 h-4 animate-spin" /> : <SkipForward className="w-4 h-4" />}
              Close lot now
            </button>
            <button
              onClick={() => { if (confirm('End the entire auction? Pending lots will be skipped.')) action('end'); }}
              disabled={busy === 'end'}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-red-300 text-white px-4 py-2 rounded-lg text-sm font-bold"
            >
              {busy === 'end' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
              End auction
            </button>
          </>
        )}
        <div className="text-xs text-slate-500 ml-auto flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><Package className="w-3.5 h-3.5" />Lot {currentLot?.lotNumber ?? '—'} of {snapshot.totalLots}</span>
          <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{snapshot.upcomingLotCount} pending</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Live state */}
      {!currentLot ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          {isEnded ? (
            <>
              <Gavel className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">Auction ended</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Waiting for a lot to start.</p>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-5">
          {/* Lot card */}
          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex gap-4">
              {currentLot.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentLot.imageUrl} alt="" className="w-32 h-32 rounded-lg object-cover" />
              ) : (
                <div className="w-32 h-32 rounded-lg bg-slate-100" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Lot {currentLot.lotNumber}</p>
                <h2 className="text-lg font-bold text-slate-900 truncate">{currentLot.title}</h2>
                {currentLot.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-3">{currentLot.description}</p>
                )}
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="text-2xl font-mono font-bold tabular-nums text-slate-900">
                    {currentLot.currentBidCents != null ? formatCents(currentLot.currentBidCents) : formatCents(currentLot.startingBidCents)}
                  </span>
                  <span className="text-xs text-slate-500">{currentLot.currentBidCents != null ? 'current bid' : 'opening'}</span>
                </div>
              </div>
            </div>
            {nextLot && (
              <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                <span className="font-mono uppercase tracking-wider text-slate-400">Next:</span> Lot {nextLot.lotNumber} · {nextLot.title} · from {formatCents(nextLot.startingBidCents)}
              </div>
            )}
          </div>

          {/* Timer */}
          <div className={`rounded-xl border p-5 text-center ${urgent ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Closes in
            </p>
            <p className={`font-mono text-5xl font-bold tabular-nums ${urgent ? 'text-red-600 animate-pulse' : 'text-slate-900'}`}>
              {secondsLeft != null ? `${secondsLeft}s` : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-2">Soft-close: {auction.softCloseSeconds}s per bid</p>
          </div>
        </div>
      )}

      {/* Activity */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Activity</h3>
        </div>
        {snapshot.recentBids.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">No bids yet on this lot.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {snapshot.recentBids.map(bid => (
              <li key={bid.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                <span className="font-mono text-slate-700 flex-1 truncate">{bid.aliasColor} {bid.aliasAnimal}</span>
                <span className="font-mono font-bold tabular-nums text-slate-900">{formatCents(bid.amountCents)}</span>
                <span className="text-[11px] text-slate-400 w-20 text-right">{new Date(bid.createdAt).toLocaleTimeString()}</span>
                <button
                  onClick={() => retractBid(bid.id)}
                  disabled={busy === 'retract'}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                  title="Retract bid"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
