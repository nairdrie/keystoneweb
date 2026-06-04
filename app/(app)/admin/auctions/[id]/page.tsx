'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, ExternalLink, Loader2, Radio } from 'lucide-react';
import { useAdminContext } from '../../admin-context';
import { STATUS_LABELS, STATUS_COLORS, type Auction, type AuctionLot, type AuctionRegistration } from '@/lib/auctions/types';
import { formatCents } from '@/lib/auctions/stripe';

type RegistrationRow = AuctionRegistration & { memberName: string | null; memberEmail: string | null };

export default function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { siteId } = useAdminContext();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [lots, setLots] = useState<AuctionLot[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'lots' | 'registrations' | 'settings'>('lots');

  const reload = useCallback(async () => {
    if (!siteId) return;
    const [a, r] = await Promise.all([
      fetch(`/api/admin/auctions/${id}?siteId=${siteId}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/admin/auctions/${id}/registrations?siteId=${siteId}`, { credentials: 'include' }).then(r => r.json()),
    ]);
    if (a.auction) {
      setAuction(a.auction);
      setLots(a.lots || []);
    } else {
      setError(a.error || 'Failed to load');
    }
    if (r.registrations) setRegistrations(r.registrations);
    setLoading(false);
  }, [id, siteId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void reload(); }, [reload]);

  if (loading) return <div className="px-4 py-8 text-sm text-slate-500">Loading…</div>;
  if (error || !auction) return <div className="px-4 py-8 text-sm text-red-700">{error || 'Not found'}</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link
          href={`/admin/auctions?siteId=${siteId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> All auctions
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-slate-900 truncate">{auction.title}</h1>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[auction.status]}`}>
                {STATUS_LABELS[auction.status]}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Starts {new Date(auction.scheduledStart).toLocaleString()} · {lots.length} {lots.length === 1 ? 'lot' : 'lots'} · {registrations.length} bidders
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/auctions/${auction.id}/live?siteId=${siteId}`}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            >
              <Radio className="w-4 h-4" /> Open supervisor view
            </Link>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {(['lots', 'registrations', 'settings'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'lots' && ` (${lots.length})`}
              {t === 'registrations' && ` (${registrations.length})`}
            </button>
          ))}
        </div>
      </div>

      {tab === 'lots' && (
        <LotsTab auctionId={auction.id} siteId={siteId!} status={auction.status} lots={lots} onChange={reload} />
      )}
      {tab === 'registrations' && (
        <RegistrationsTab auctionId={auction.id} siteId={siteId!} registrations={registrations} onChange={reload} />
      )}
      {tab === 'settings' && (
        <SettingsTab auction={auction} siteId={siteId!} onChange={reload} />
      )}
    </div>
  );
}

// ─── Lots tab ────────────────────────────────────────────────────────────────

function LotsTab({ auctionId, siteId, status, lots, onChange }: {
  auctionId: string;
  siteId: string;
  status: string;
  lots: AuctionLot[];
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const canEdit = status === 'draft' || status === 'scheduled';

  async function deleteLot(lotId: string) {
    if (!confirm('Delete this lot?')) return;
    const res = await fetch(`/api/admin/auctions/${auctionId}/lots/${lotId}?siteId=${siteId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) onChange();
    else alert((await res.json()).error || 'Failed to delete');
  }

  return (
    <div className="space-y-3">
      {lots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No lots yet. Add at least one before the auction starts.
        </div>
      ) : (
        lots.map(lot => (
          <div key={lot.id} className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-4">
            <div className="text-xs font-mono text-slate-400 w-8">#{lot.lotNumber}</div>
            {lot.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lot.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-slate-100" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 truncate">{lot.title}</div>
              <div className="text-xs text-slate-500">
                Start {formatCents(lot.startingBidCents)} · increment {formatCents(lot.bidIncrementCents)} · {lot.status}
              </div>
            </div>
            {canEdit && lot.status === 'pending' && (
              <button
                onClick={() => deleteLot(lot.id)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Delete lot"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))
      )}

      {canEdit && (
        adding ? (
          <AddLotForm
            auctionId={auctionId}
            siteId={siteId}
            onDone={() => { setAdding(false); onChange(); }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-400 bg-white text-sm font-medium text-slate-600 py-3 inline-flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4" /> Add lot
          </button>
        )
      )}
    </div>
  );
}

function AddLotForm({ auctionId, siteId, onDone, onCancel }: {
  auctionId: string; siteId: string; onDone: () => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [startingBid, setStartingBid] = useState('50');
  const [increment, setIncrement] = useState('5');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/admin/auctions/${auctionId}/lots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        siteId,
        title,
        description: description || null,
        imageUrl: imageUrl || null,
        startingBidCents: Math.round(parseFloat(startingBid || '0') * 100),
        bidIncrementCents: Math.round(parseFloat(increment || '0') * 100),
      }),
    });
    if (res.ok) {
      onDone();
    } else {
      setError((await res.json()).error || 'Failed to add lot');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        required
        placeholder="Lot title"
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      />
      <input
        type="url"
        value={imageUrl}
        onChange={e => setImageUrl(e.target.value)}
        placeholder="Image URL (optional)"
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-slate-700">
          Starting bid ($)
          <input
            type="number"
            min="0"
            step="0.01"
            value={startingBid}
            onChange={e => setStartingBid(e.target.value)}
            required
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-700">
          Increment ($)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={increment}
            onChange={e => setIncrement(e.target.value)}
            required
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </label>
      </div>
      {error && <div className="text-xs text-red-700">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-lg">Cancel</button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white px-3 py-1.5 rounded-lg text-sm font-bold"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Add lot
        </button>
      </div>
    </form>
  );
}

// ─── Registrations tab ───────────────────────────────────────────────────────

function RegistrationsTab({ auctionId, siteId, registrations, onChange }: {
  auctionId: string; siteId: string; registrations: RegistrationRow[]; onChange: () => void;
}) {
  async function setStatus(registrationId: string, status: 'approved' | 'rejected' | 'banned') {
    const res = await fetch(`/api/admin/auctions/${auctionId}/registrations`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ siteId, registrationId, status }),
    });
    if (res.ok) onChange();
    else alert((await res.json()).error || 'Failed');
  }

  if (registrations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No registrations yet. Share the auction link with prospective bidders.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {registrations.map(r => (
        <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-slate-900 truncate">{r.memberName || r.memberEmail}</div>
            <div className="text-xs text-slate-500">
              Alias: <span className="font-mono">{r.aliasColor} {r.aliasAnimal}</span> · {r.memberEmail}
            </div>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            r.status === 'approved' ? 'bg-emerald-100 text-emerald-700'
            : r.status === 'pending' ? 'bg-amber-100 text-amber-700'
            : 'bg-red-100 text-red-700'
          }`}>
            {r.status}
          </span>
          {r.status !== 'approved' && (
            <button onClick={() => setStatus(r.id, 'approved')} className="text-xs font-medium text-emerald-700 hover:underline">Approve</button>
          )}
          {r.status !== 'banned' && (
            <button onClick={() => setStatus(r.id, 'banned')} className="text-xs font-medium text-red-600 hover:underline">Ban</button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Settings tab ────────────────────────────────────────────────────────────

function SettingsTab({ auction, siteId, onChange }: { auction: Auction; siteId: string; onChange: () => void }) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(auction.status);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/auctions/${auction.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ siteId, status }),
    });
    if (res.ok) onChange();
    else setError((await res.json()).error || 'Failed');
    setSaving(false);
  }

  const publicUrl = `/auctions/${auction.slug}/register?siteId=${siteId}`;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900 mb-1">Share with bidders</h3>
        <p className="text-xs text-slate-500 mb-3">Send this link to prospective bidders so they can register.</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={typeof window !== 'undefined' ? window.location.origin + publicUrl : publicUrl}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono bg-slate-50"
          />
          <Link
            href={publicUrl}
            target="_blank"
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-xs font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Status</h3>
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={e => setStatus(e.target.value as Auction['status'])}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="draft">Draft (hidden)</option>
            <option value="scheduled">Scheduled (open for registration)</option>
            <option value="ended">Ended</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={save}
            disabled={saving || status === auction.status}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white px-3 py-2 rounded-lg text-sm font-bold"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {error && <div className="text-xs text-red-700 mt-2">{error}</div>}
        <p className="text-xs text-slate-500 mt-3">
          The auction goes live from the supervisor view. Use &ldquo;Scheduled&rdquo; to open registration.
        </p>
      </div>
    </div>
  );
}
