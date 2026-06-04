'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Gavel, Calendar, Package } from 'lucide-react';
import { useAdminContext } from '../admin-context';
import { STATUS_LABELS, STATUS_COLORS, type Auction } from '@/lib/auctions/types';

type AuctionRow = Auction & { lotCount: number };

export default function AuctionsListPage() {
  const { siteId, site } = useAdminContext();
  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    fetch(`/api/admin/auctions?siteId=${siteId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { auctions: [] })
      .then(j => {
        if (cancelled) return;
        setAuctions(j.auctions || []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [siteId]);

  if (!site?.auctionsEnabled) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <Gavel className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Auctions aren&apos;t enabled yet</h2>
        <p className="text-sm text-slate-500 mt-2">
          Contact Keystone Web Design support to enable live auctions on this site.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Auctions</h1>
          <p className="text-sm text-slate-500 mt-1">
            Schedule and run live auctions. Bidders sign up in advance, drop a card on file, and join at the scheduled start time.
          </p>
        </div>
        <Link
          href={`/admin/auctions/new?siteId=${siteId}`}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> New auction
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : auctions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Gavel className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-900">No auctions yet</h3>
          <p className="text-sm text-slate-500 mt-1">Schedule your first auction to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {auctions.map(a => (
            <Link
              key={a.id}
              href={`/admin/auctions/${a.id}?siteId=${siteId}`}
              className="block rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="font-semibold text-slate-900 truncate">{a.title}</h3>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status]}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </div>
                  {a.description && (
                    <p className="text-sm text-slate-500 line-clamp-1 mb-2">{a.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(a.scheduledStart).toLocaleString()}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      {a.lotCount} {a.lotCount === 1 ? 'lot' : 'lots'}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
