'use client';

import { useEffect, useState, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Pause, Play, Trash2, CheckCircle2,
  TrendingUp, MousePointerClick, Eye, DollarSign, Loader2,
} from 'lucide-react';
import { useAdminContext } from '../../../admin-context';
import { STATUS_LABELS, STATUS_COLORS, CHANNEL_LABELS, CAMPAIGN_TYPE_LABELS } from '@/lib/marketing/types';
import type { Campaign } from '@/lib/marketing/types';
import { formatCents } from '@/lib/marketing/pricing';

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { siteId } = useAdminContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justLaunched = searchParams.get('just') === 'launched';

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/marketing/campaigns/${id}?siteId=${siteId}`, { credentials: 'include' });
      if (cancelled) return;
      if (res.ok) {
        const d = await res.json();
        setCampaign(d.campaign);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, siteId]);

  async function doAction(action: 'pause' | 'resume') {
    setErr(null);
    setActing(true);
    const res = await fetch(`/api/admin/marketing/campaigns/${id}/${action}`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || `Failed to ${action}`);
      setActing(false);
      return;
    }
    setCampaign(data.campaign);
    setActing(false);
  }

  async function doDelete() {
    if (!confirm('Cancel this campaign? This cannot be undone.')) return;
    setErr(null);
    setActing(true);
    const res = await fetch(`/api/admin/marketing/campaigns/${id}?siteId=${siteId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      router.push(`/admin/marketing?siteId=${siteId}`);
    } else {
      const d = await res.json();
      setErr(d.error || 'Failed to cancel');
      setActing(false);
    }
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-12 text-center text-sm text-slate-400">Loading…</div>;
  }
  if (!campaign) {
    return <div className="max-w-4xl mx-auto px-4 py-12 text-center text-sm text-slate-500">Campaign not found.</div>;
  }

  const ctr = campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2) : '0.00';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link
          href={`/admin/marketing?siteId=${siteId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Marketing
        </Link>
      </div>

      {justLaunched && campaign.status === 'active' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-bold text-emerald-900">Campaign launched</p>
            <p className="text-emerald-800">Your ads are live. Performance data updates daily.</p>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_COLORS[campaign.status]}`}>
              {STATUS_LABELS[campaign.status]}
            </span>
            <span className="text-xs text-slate-500">
              {CHANNEL_LABELS[campaign.channel]} · {CAMPAIGN_TYPE_LABELS[campaign.campaign_type]}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-2">{campaign.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === 'active' && (
            <button
              type="button"
              disabled={acting}
              onClick={() => doAction('pause')}
              className="inline-flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />} Pause
            </button>
          )}
          {campaign.status === 'paused' && (
            <button
              type="button"
              disabled={acting}
              onClick={() => doAction('resume')}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Resume
            </button>
          )}
          {(campaign.status === 'active' || campaign.status === 'paused' || campaign.status === 'draft') && (
            <button
              type="button"
              disabled={acting}
              onClick={doDelete}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{err}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric icon={<Eye className="w-4 h-4 text-violet-600" />} label="Impressions" value={campaign.impressions.toLocaleString('en-US')} />
        <Metric icon={<MousePointerClick className="w-4 h-4 text-sky-600" />} label="Clicks" value={campaign.clicks.toLocaleString('en-US')} />
        <Metric icon={<TrendingUp className="w-4 h-4 text-emerald-600" />} label="CTR" value={`${ctr}%`} />
        <Metric icon={<DollarSign className="w-4 h-4 text-amber-600" />} label="Spent" value={formatCents(campaign.spent_cents)} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Budget</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Daily budget</dt>
            <dd className="font-bold text-slate-900 mt-0.5">{campaign.daily_budget_cents ? formatCents(campaign.daily_budget_cents) : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Launched</dt>
            <dd className="font-bold text-slate-900 mt-0.5">
              {campaign.launched_at
                ? new Date(campaign.launched_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {campaign.ai_rationale && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-700">AI strategy</p>
          <p className="text-sm text-violet-900 mt-1">{campaign.ai_rationale}</p>
        </div>
      )}

      <ContentPreview campaign={campaign} />
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
    </div>
  );
}

function ContentPreview({ campaign }: { campaign: Campaign }) {
  const c = campaign.content as unknown as {
    headlines?: string[]; descriptions?: string[]; keywords?: string[]; finalUrl?: string;
    primaryText?: string; headline?: string; description?: string;
    subject?: string; preheader?: string;
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Ad content</h2>
      {campaign.channel === 'google_ads' && (
        <>
          {(c.headlines?.length ?? 0) > 0 && <ListBlock label="Headlines" items={c.headlines!} />}
          {(c.descriptions?.length ?? 0) > 0 && <ListBlock label="Descriptions" items={c.descriptions!} />}
          {(c.keywords?.length ?? 0) > 0 && <ListBlock label="Keywords" items={c.keywords!} />}
          {c.finalUrl && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Landing URL</p>
              <a href={c.finalUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-700 hover:text-emerald-600 break-all">
                {c.finalUrl}
              </a>
            </div>
          )}
        </>
      )}
      {campaign.channel === 'meta_ads' && (
        <>
          {c.primaryText && <KV label="Primary text" value={c.primaryText} />}
          {c.headline && <KV label="Headline" value={c.headline} />}
          {c.description && <KV label="Description" value={c.description} />}
        </>
      )}
      {campaign.channel === 'email' && (
        <>
          {c.subject && <KV label="Subject" value={c.subject} />}
          {c.preheader && <KV label="Preheader" value={c.preheader} />}
        </>
      )}
    </div>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">{label}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-slate-700 bg-slate-50 px-3 py-1.5 rounded">{it}</li>
        ))}
      </ul>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
