'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Target } from 'lucide-react';
import type { ConversionEventType } from '@/lib/marketing/conversions';

interface Status {
  conversionId: string | null;
  labels: Partial<Record<ConversionEventType, string>>;
  active: boolean;
  hasCustomerId: boolean;
}

const EVENT_LABELS: Record<ConversionEventType, string> = {
  call: 'Phone calls',
  lead_form: 'Lead forms',
  booking: 'Bookings',
  order: 'Orders',
  signup: 'Signups',
};

export default function ConversionTrackingPanel({ campaignId }: { campaignId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [acting, setActing] = useState(false);
  const [manual, setManual] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}/conversion-setup`, { credentials: 'include' });
    if (res.ok) setStatus(await res.json());
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function submit(mode: 'auto' | 'manual') {
    setErr(null);
    setActing(true);
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}/conversion-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(mode === 'manual' ? { mode, conversionId: manual } : { mode }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Setup failed'); return; }
      setShowManual(false);
      setManual('');
      await refresh();
    } finally {
      setActing(false);
    }
  }

  if (!status) {
    return <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-400">Loading conversion tracking…</div>;
  }

  const trackedEvents = Object.keys(status.labels || {}) as ConversionEventType[];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Conversion tracking</h2>
        {status.active ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active
          </span>
        ) : (
          <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
            Not set up
          </span>
        )}
      </div>

      {status.active ? (
        <>
          <p className="text-sm text-slate-600">
            The Google tag <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{status.conversionId}</span> is
            live on this customer&apos;s site. Conversions flow to Google Ads and the campaign dashboard above.
          </p>
          {trackedEvents.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {trackedEvents.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                  <Target className="w-3.5 h-3.5 text-teal-600" /> {EVENT_LABELS[t]}
                </span>
              ))}
            </div>
          )}
          {trackedEvents.length === 0 && (
            <p className="text-xs text-amber-700">
              Base tag only (no event labels). Run automatic setup to track calls &amp; form submits explicitly.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-500">
          No conversion tag on this site yet, so Google Ads shows it as &ldquo;not set up.&rdquo; Set it up to track
          phone-call clicks and form submissions — the tag is injected into the published site automatically.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={acting}
          onClick={() => submit('auto')}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3.5 py-2 rounded-md text-sm font-bold"
        >
          {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {status.active ? 'Re-run setup' : 'Set up automatically'}
        </button>
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="text-sm text-slate-600 hover:text-slate-900 px-2 py-2"
        >
          Enter tag manually
        </button>
      </div>

      {!status.hasCustomerId && (
        <p className="text-xs text-amber-700">
          No Google Ads account is linked to this site yet — automatic setup needs one (launch a campaign first), or paste the tag id.
        </p>
      )}

      {showManual && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3">
          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Google Ads tag id</span>
            <input
              type="text"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="AW-18264425836"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-500 bg-white"
            />
          </label>
          <p className="text-[11px] text-slate-500">
            Injects the base tag so Google marks the account as set up. For explicit call/form tracking, use automatic setup.
          </p>
          <button
            type="button"
            disabled={acting || !manual.trim()}
            onClick={() => submit('manual')}
            className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-3.5 py-2 rounded-md text-sm font-bold"
          >
            {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Save tag
          </button>
        </div>
      )}

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{err}</div>}
    </div>
  );
}
