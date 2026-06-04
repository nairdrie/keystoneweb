'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Package, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatCents } from '@/lib/auctions/stripe';
import { supabase } from '@/lib/db/supabase';
import { auctionChannelName } from '@/lib/auctions/realtime';
import type { Auction, AuctionLot } from '@/lib/auctions/types';

interface Props {
  auction: Auction;
  lots: AuctionLot[];
  alias: { color: string; animal: string };
  registrationStatus: string;
}

function fmtDelta(ms: number): { d: number; h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

export default function LobbyView({ auction, lots, alias, registrationStatus }: Props) {
  const router = useRouter();
  const startMs = new Date(auction.scheduledStart).getTime();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Subscribe to auction_started broadcast so the page jumps to /live the moment
  // the admin starts the auction.
  useEffect(() => {
    const channel = supabase.channel(auctionChannelName(auction.id));
    channel.on('broadcast', { event: 'auction_started' }, () => {
      router.push(`/auctions/${auction.id}/live`);
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [auction.id, router]);

  const delta = fmtDelta(startMs - now);
  const isStartingSoon = startMs - now < 60_000 && startMs - now > 0;

  return (
    <div className="min-h-screen px-4 py-12 max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <p className="text-xs uppercase tracking-[0.25em] text-amber-400 mb-2">You&apos;re in</p>
        <h1 className="text-3xl font-bold mb-2">{auction.title}</h1>
        {auction.description && (
          <p className="text-sm text-slate-400 max-w-xl mx-auto">{auction.description}</p>
        )}
      </div>

      {/* Alias card */}
      <div className="mb-10 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-slate-900 p-6 text-center">
        <p className="text-xs uppercase tracking-wider text-amber-300 mb-2">Your anonymous alias</p>
        <p className="font-mono text-4xl font-bold tracking-tight">
          <span className="text-amber-400">{alias.color}</span> {alias.animal}
        </p>
        <p className="text-xs text-slate-500 mt-3">Other bidders only ever see this name.</p>
      </div>

      {/* Registration status banner */}
      {registrationStatus !== 'approved' && (
        <div className={`mb-8 rounded-xl border px-4 py-3 flex items-start gap-3 ${
          registrationStatus === 'pending'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            : 'bg-red-500/10 border-red-500/30 text-red-200'
        }`}>
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">
              {registrationStatus === 'pending' ? 'Awaiting admin approval' : `Registration ${registrationStatus}`}
            </p>
            <p className="text-xs mt-0.5 opacity-90">
              {registrationStatus === 'pending'
                ? 'You\'ll be notified when the organiser approves your registration.'
                : 'You won\'t be able to bid. Contact the organiser if this is a mistake.'}
            </p>
          </div>
        </div>
      )}

      {registrationStatus === 'approved' && (
        <div className="mb-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 flex items-start gap-3 text-emerald-200">
          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">You&apos;re ready to bid</p>
            <p className="text-xs mt-0.5 opacity-90">
              Stay on this page — you&apos;ll be sent to the live view automatically when the auction starts.
            </p>
          </div>
        </div>
      )}

      {/* Countdown */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 mb-10 text-center">
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Auction starts in
        </p>
        {startMs - now <= 0 ? (
          <p className="text-3xl font-bold text-amber-400">Starting any moment…</p>
        ) : (
          <div className={`font-mono text-5xl md:text-6xl font-bold tabular-nums ${isStartingSoon ? 'text-amber-400 animate-pulse' : 'text-slate-100'}`}>
            {delta.d > 0 && <span>{delta.d}d </span>}
            {String(delta.h).padStart(2, '0')}:
            {String(delta.m).padStart(2, '0')}:
            {String(delta.s).padStart(2, '0')}
          </div>
        )}
        <p className="text-xs text-slate-500 mt-3">
          {new Date(auction.scheduledStart).toLocaleString()}
        </p>
      </div>

      {/* Lots preview */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
          <Package className="w-4 h-4" /> {lots.length} {lots.length === 1 ? 'lot' : 'lots'} coming up
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lots.map(lot => (
            <div key={lot.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex items-center gap-3">
              <div className="text-xs font-mono text-slate-500 w-8">#{lot.lotNumber}</div>
              {lot.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lot.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-slate-800" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-100 truncate text-sm">{lot.title}</div>
                <div className="text-xs text-slate-500">Starts at {formatCents(lot.startingBidCents)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
