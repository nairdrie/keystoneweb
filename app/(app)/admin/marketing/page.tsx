'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, TrendingUp, Wallet, Megaphone, Activity, AlertCircle } from 'lucide-react';
import { useAdminContext } from '../admin-context';
import { STATUS_LABELS, STATUS_COLORS, CHANNEL_LABELS } from '@/lib/marketing/types';
import type { Campaign } from '@/lib/marketing/types';
import { formatCents } from '@/lib/marketing/pricing';

interface WalletInfo {
  balance_cents: number;
  lifetime_credited_cents: number;
  lifetime_debited_cents: number;
}

export default function MarketingOverviewPage() {
  const { siteId, site } = useAdminContext();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/admin/marketing/campaigns?siteId=${siteId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { campaigns: [] }),
      fetch(`/api/admin/marketing/wallet?siteId=${siteId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { wallet: null }),
    ])
      .then(([c, w]) => {
        if (cancelled) return;
        setCampaigns(c.campaigns || []);
        setWallet(w.wallet || null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [siteId]);

  if (!site?.marketingEnabled) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Marketing isn&apos;t enabled yet</h2>
        <p className="text-sm text-slate-500 mt-2">
          Contact Keystone Web Design support to enable AI-powered marketing on this site.
        </p>
      </div>
    );
  }

  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  const draftCampaigns = campaigns.filter(c => c.status === 'draft' || c.status === 'suggested');
  const balance = wallet?.balance_cents ?? 0;
  const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + (c.clicks || 0), 0);
  const overallCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

  const lowBalance = balance > 0 && balance <= 500;
  const emptyBalance = balance <= 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Marketing</h1>
          <p className="text-sm text-slate-500 mt-1">Run AI-built ad campaigns to grow your business.</p>
        </div>
        <Link
          href={`/admin/marketing/campaigns/new?siteId=${siteId}`}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> New campaign
        </Link>
      </div>

      {(emptyBalance || lowBalance) && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${emptyBalance ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
          <AlertCircle className={`w-5 h-5 flex-shrink-0 ${emptyBalance ? 'text-red-600' : 'text-amber-600'}`} />
          <div className="flex-1 text-sm">
            <p className={`font-bold ${emptyBalance ? 'text-red-900' : 'text-amber-900'}`}>
              {emptyBalance ? 'Wallet empty — campaigns paused' : `Low balance (${formatCents(balance)})`}
            </p>
            <p className={emptyBalance ? 'text-red-800 mt-0.5' : 'text-amber-800 mt-0.5'}>
              {emptyBalance
                ? 'Top up to resume your campaigns.'
                : 'Top up to avoid your campaigns pausing.'}
            </p>
          </div>
          <Link
            href={`/admin/marketing/budget?siteId=${siteId}`}
            className="text-sm font-bold underline hover:no-underline"
            style={{ color: emptyBalance ? '#b91c1c' : '#92400e' }}
          >
            Top up
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Wallet"
          value={formatCents(balance)}
          icon={<Wallet className="w-4 h-4 text-emerald-600" />}
          link={`/admin/marketing/budget?siteId=${siteId}`}
          linkLabel="Top up"
        />
        <StatCard
          label="Active"
          value={String(activeCampaigns.length)}
          icon={<Activity className="w-4 h-4 text-sky-600" />}
        />
        <StatCard
          label="Impressions"
          value={totalImpressions.toLocaleString('en-US')}
          icon={<TrendingUp className="w-4 h-4 text-violet-600" />}
        />
        <StatCard
          label="Avg. CTR"
          value={`${overallCtr}%`}
          icon={<TrendingUp className="w-4 h-4 text-amber-600" />}
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-slate-400">Loading campaigns…</div>
      ) : campaigns.length === 0 ? (
        <EmptyState siteId={siteId!} />
      ) : (
        <>
          {draftCampaigns.length > 0 && (
            <CampaignSection
              title="Drafts awaiting approval"
              campaigns={draftCampaigns}
              siteId={siteId!}
            />
          )}
          <CampaignSection
            title={activeCampaigns.length > 0 ? 'Active campaigns' : 'Campaigns'}
            campaigns={campaigns.filter(c => c.status !== 'draft' && c.status !== 'suggested')}
            siteId={siteId!}
          />
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, link, linkLabel }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  link?: string;
  linkLabel?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
      {link && linkLabel && (
        <Link href={link} className="text-xs text-emerald-700 hover:text-emerald-600 font-bold mt-2 inline-block">
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

function CampaignSection({ title, campaigns, siteId }: { title: string; campaigns: Campaign[]; siteId: string }) {
  if (campaigns.length === 0) return null;
  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 mb-3">{title}</h2>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2.5 text-left">Name</th>
              <th className="px-4 py-2.5 text-left">Channel</th>
              <th className="px-4 py-2.5 text-left">Status</th>
              <th className="px-4 py-2.5 text-right">Daily</th>
              <th className="px-4 py-2.5 text-right">Spent</th>
              <th className="px-4 py-2.5 text-right">Clicks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campaigns.map(c => (
              <tr key={c.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/marketing/campaigns/${c.id}?siteId=${siteId}`}
                    className="font-bold text-slate-900 hover:text-emerald-600"
                  >
                    {c.name}
                  </Link>
                  {c.ai_generated && (
                    <span className="ml-2 text-[10px] uppercase font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
                      AI
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{CHANNEL_LABELS[c.channel]}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_COLORS[c.status]}`}>
                    {STATUS_LABELS[c.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {c.daily_budget_cents ? formatCents(c.daily_budget_cents) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {c.spent_cents > 0 ? formatCents(c.spent_cents) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {c.clicks > 0 ? c.clicks.toLocaleString('en-US') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ siteId }: { siteId: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
      <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-slate-900">No campaigns yet</h3>
      <p className="text-sm text-slate-500 mt-1 mb-6 max-w-md mx-auto">
        Let AI build a complete ad campaign from your site&apos;s content. Review, edit, and launch in minutes.
      </p>
      <Link
        href={`/admin/marketing/campaigns/new?siteId=${siteId}`}
        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors"
      >
        <Plus className="w-4 h-4" /> Create first campaign
      </Link>
    </div>
  );
}
