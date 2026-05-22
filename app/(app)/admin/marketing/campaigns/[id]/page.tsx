'use client';

import { useEffect, useState, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Pause, Play, Trash2, CheckCircle2,
  TrendingUp, MousePointerClick, Eye, DollarSign, Loader2,
  Activity, ExternalLink, ShoppingBag, Calendar, Mail, Users,
  Sparkles, AlertCircle, Wallet,
} from 'lucide-react';
import { useAdminContext } from '../../../admin-context';
import { STATUS_LABELS, STATUS_COLORS, CHANNEL_LABELS, CAMPAIGN_TYPE_LABELS } from '@/lib/marketing/types';
import type { Campaign } from '@/lib/marketing/types';
import { formatCents } from '@/lib/marketing/pricing';
import { AdPreview } from '../../_components/AdPreview';

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { siteId, siteTitle } = useAdminContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justLaunched = searchParams.get('just') === 'launched';
  const arrivedNeedingFunds = searchParams.get('needsFunds') === '1';

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [conversions, setConversions] = useState<Conversions | null>(null);
  const [walletBalanceCents, setWalletBalanceCents] = useState<number | null>(null);
  const [needsFunds, setNeedsFunds] = useState<{ balanceCents: number; requiredCents: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [campRes, actRes, walletRes] = await Promise.all([
        fetch(`/api/admin/marketing/campaigns/${id}?siteId=${siteId}`, { credentials: 'include' }),
        fetch(`/api/admin/marketing/campaigns/${id}/activity?siteId=${siteId}`, { credentials: 'include' }),
        fetch(`/api/admin/marketing/wallet?siteId=${siteId}`, { credentials: 'include' }),
      ]);
      if (cancelled) return;
      let camp: Campaign | null = null;
      if (campRes.ok) {
        const d = await campRes.json();
        camp = d.campaign;
        setCampaign(camp);
      }
      if (actRes.ok) {
        const a = await actRes.json();
        setActivity(a.activity || []);
        setConversions(a.conversions || null);
      }
      let balance: number | null = null;
      if (walletRes.ok) {
        const w = await walletRes.json();
        balance = w.wallet?.balance_cents ?? 0;
        setWalletBalanceCents(balance);
      }
      // Surface a needs-funds banner if the user just arrived from a failed launch,
      // or if they're sitting on a draft they can't approve at current balance.
      if (camp && balance !== null) {
        const required = camp.daily_budget_cents || 0;
        const isApprovable = camp.status === 'draft' || camp.status === 'suggested' || camp.status === 'failed';
        if (isApprovable && (arrivedNeedingFunds || balance < required)) {
          setNeedsFunds({ balanceCents: balance, requiredCents: required });
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, siteId, arrivedNeedingFunds]);

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

  async function doApprove() {
    setErr(null);
    setNeedsFunds(null);
    setActing(true);
    const res = await fetch(`/api/admin/marketing/campaigns/${id}/approve`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 402) {
        setNeedsFunds({
          balanceCents: typeof data.walletBalanceCents === 'number' ? data.walletBalanceCents : (walletBalanceCents ?? 0),
          requiredCents: typeof data.requiredCents === 'number' ? data.requiredCents : (campaign?.daily_budget_cents ?? 0),
        });
      } else {
        setErr(data.error || 'Failed to approve campaign');
      }
      setActing(false);
      return;
    }
    if (data.campaign) {
      setCampaign(data.campaign);
    }
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

      {needsFunds && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-bold text-red-900">Not enough funds to launch</p>
            <p className="text-red-800 mt-0.5">
              Your draft is saved. Wallet balance is{' '}
              <strong>{formatCents(needsFunds.balanceCents)}</strong>, but at least{' '}
              <strong>{formatCents(needsFunds.requiredCents)}</strong>/day is required to launch this campaign.
              Top up your wallet and come back here to approve & launch.
            </p>
          </div>
          <Link
            href={`/admin/marketing/budget?siteId=${siteId}`}
            className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg text-sm font-bold flex-shrink-0"
          >
            <Wallet className="w-3.5 h-3.5" /> Top up wallet
          </Link>
        </div>
      )}

      {!needsFunds && (campaign.status === 'draft' || campaign.status === 'suggested') && walletBalanceCents !== null && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-slate-500 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-bold text-slate-900">Draft saved</p>
            <p className="text-slate-700 mt-0.5">
              Review the details below, then approve & launch when you&apos;re ready. Your wallet balance is{' '}
              <strong>{formatCents(walletBalanceCents)}</strong>.
            </p>
          </div>
        </div>
      )}

      {campaign.status === 'pending_launch' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <Loader2 className="w-5 h-5 text-amber-600 flex-shrink-0 animate-spin" />
          <div className="text-sm">
            <p className="font-bold text-amber-900">Your campaign is being set up</p>
            <p className="text-amber-800 mt-0.5">
              Our team is activating your campaign on Google. This usually takes a few hours.
              You&apos;ll get an email as soon as your ads go live.
            </p>
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
          {(campaign.status === 'draft' || campaign.status === 'suggested' || campaign.status === 'failed') && (
            <button
              type="button"
              disabled={acting}
              onClick={doApprove}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Approve & launch
            </button>
          )}
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
          {(campaign.status === 'active' || campaign.status === 'paused' || campaign.status === 'draft' || campaign.status === 'suggested' || campaign.status === 'failed') && (
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

      {campaign.channel === 'google_ads' && (
        <AdPreview
          channel={campaign.channel}
          campaignType={campaign.campaign_type}
          content={campaign.content as unknown as Record<string, unknown>}
          businessName={siteTitle}
        />
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

      <ConversionsPanel conversions={conversions} />

      <ActivityFeedPanel activity={activity} campaignActive={campaign.status === 'active'} />

      <TargetingPanel campaign={campaign} />

      <TransparencyPanel campaign={campaign} businessName={siteTitle} />

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

function TargetingPanel({ campaign }: { campaign: Campaign }) {
  const t = campaign.targeting || {};
  const hasAnything = (t.locations?.length || t.radius || t.ageMin || t.ageMax || t.interests?.length || t.audienceType);
  if (!hasAnything) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Targeting</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        {t.locations && t.locations.length > 0 && (
          <div>
            <dt className="text-xs text-slate-500">
              {t.radius ? `Within ${t.radius.radiusKm} km of` : 'Locations'}
            </dt>
            <dd className="font-medium text-slate-900 mt-0.5">
              {t.locations.join(', ')}
            </dd>
          </div>
        )}
        {t.audienceType && (
          <div>
            <dt className="text-xs text-slate-500">Audience</dt>
            <dd className="font-medium text-slate-900 mt-0.5 capitalize">{t.audienceType}</dd>
          </div>
        )}
        {(t.ageMin || t.ageMax) && (
          <div>
            <dt className="text-xs text-slate-500">Age range</dt>
            <dd className="font-medium text-slate-900 mt-0.5">
              {t.ageMin || '18'} – {t.ageMax || '65+'}
            </dd>
          </div>
        )}
        {t.interests && t.interests.length > 0 && (
          <div>
            <dt className="text-xs text-slate-500">Interests</dt>
            <dd className="font-medium text-slate-900 mt-0.5">{t.interests.join(', ')}</dd>
          </div>
        )}
      </dl>
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

// ── Transparency: Activity Feed + Conversions + Public Verification ─────────

interface ActivityItem {
  occurred_at: string;
  city: string | null;
  region: string | null;
  device: string | null;
  clicks: number;
  impressions: number;
  cost_cents: number;
}

interface Conversions {
  bookings: { count: number; revenueCents: number };
  orders: { count: number; revenueCents: number };
  members: { count: number };
  contacts: { count: number };
  totalCount: number;
  totalRevenueCents: number;
}

function ConversionsPanel({ conversions }: { conversions: Conversions | null }) {
  if (!conversions) return null;
  const hasAny = conversions.totalCount > 0;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Conversions from this campaign</h2>
        {conversions.totalRevenueCents > 0 && (
          <span className="text-xs text-emerald-700 font-bold">
            {formatCents(conversions.totalRevenueCents)} in revenue
          </span>
        )}
      </div>
      {!hasAny ? (
        <p className="text-sm text-slate-500">
          No conversions attributed yet. We tag every ad click with this campaign&apos;s ID so any booking,
          order, signup or contact form submission from those visitors gets counted here.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ConversionStat
            icon={<Calendar className="w-4 h-4 text-sky-600" />}
            label="Bookings"
            value={conversions.bookings.count}
            revenue={conversions.bookings.revenueCents}
          />
          <ConversionStat
            icon={<ShoppingBag className="w-4 h-4 text-emerald-600" />}
            label="Orders"
            value={conversions.orders.count}
            revenue={conversions.orders.revenueCents}
          />
          <ConversionStat
            icon={<Users className="w-4 h-4 text-violet-600" />}
            label="New members"
            value={conversions.members.count}
          />
          <ConversionStat
            icon={<Mail className="w-4 h-4 text-amber-600" />}
            label="Contact requests"
            value={conversions.contacts.count}
          />
        </div>
      )}
    </div>
  );
}

function ConversionStat({ icon, label, value, revenue }: {
  icon: React.ReactNode; label: string; value: number; revenue?: number;
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">{label}</span>
      </div>
      <p className="text-xl font-black text-slate-900 leading-none">{value}</p>
      {revenue && revenue > 0 ? (
        <p className="text-[11px] text-slate-500 mt-1 font-medium">{formatCents(revenue)}</p>
      ) : null}
    </div>
  );
}

function ActivityFeedPanel({ activity, campaignActive }: { activity: ActivityItem[]; campaignActive: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 flex items-center gap-2">
        <Activity className="w-4 h-4 text-emerald-600" />
        Live activity
      </h2>
      {activity.length === 0 ? (
        <p className="text-sm text-slate-500">
          {campaignActive
            ? 'No activity yet. Hourly geo & device data appears here once Google starts serving impressions (usually within a few hours of launch).'
            : 'No activity recorded for this campaign.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {activity.map((a, i) => (
            <li key={i} className="py-2 flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <time className="text-xs text-slate-400 font-mono shrink-0 w-24">
                  {formatHour(a.occurred_at)}
                </time>
                <span className="text-slate-700 truncate">
                  {a.clicks > 0 ? (
                    <><strong className="text-emerald-700">{a.clicks}</strong> click{a.clicks === 1 ? '' : 's'}</>
                  ) : (
                    <><strong className="text-slate-600">{a.impressions.toLocaleString('en-US')}</strong> impression{a.impressions === 1 ? '' : 's'}</>
                  )}
                  {(a.city || a.region) && (
                    <span className="text-slate-500"> · {a.city || a.region}</span>
                  )}
                  {a.device && a.device !== 'UNSPECIFIED' && (
                    <span className="text-slate-400 text-xs"> · {humanDevice(a.device)}</span>
                  )}
                </span>
              </div>
              {a.cost_cents > 0 && (
                <span className="text-xs text-slate-500 font-mono shrink-0">{formatCents(a.cost_cents)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatHour(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return iso;
  }
}

function humanDevice(d: string): string {
  const lower = d.toLowerCase();
  if (lower.includes('mobile')) return 'mobile';
  if (lower.includes('tablet')) return 'tablet';
  if (lower.includes('desktop')) return 'desktop';
  if (lower.includes('connected_tv') || lower.includes('tv')) return 'TV';
  return lower;
}

function TransparencyPanel({ campaign, businessName }: { campaign: Campaign; businessName: string }) {
  if (campaign.channel !== 'google_ads' && campaign.channel !== 'meta_ads') return null;
  const isMeta = campaign.channel === 'meta_ads';

  // Google's public Ad Transparency Center: search by advertiser name.
  const googleLink = `https://adstransparency.google.com/?region=anywhere&q=${encodeURIComponent(businessName)}`;
  // Meta's Ad Library: search by page name (or use ad_id if we had it).
  const metaLink = campaign.external_ad_id
    ? `https://www.facebook.com/ads/library/?id=${campaign.external_ad_id}`
    : `https://www.facebook.com/ads/library/?q=${encodeURIComponent(businessName)}`;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
      <h2 className="text-sm font-bold text-slate-900">Verify your ads are running</h2>
      <p className="text-xs text-slate-600 mt-1">
        Your ads are usually filtered out of your own search results so you won&apos;t see them on Google.
        Use {isMeta ? "Meta's" : "Google's"} public ad transparency tool to see what&apos;s actually being shown:
      </p>
      <a
        href={isMeta ? metaLink : googleLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 mt-3 text-sm font-bold text-emerald-700 hover:text-emerald-600"
      >
        {isMeta ? 'Open Meta Ad Library' : "Open Google's Ad Transparency Center"}
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
