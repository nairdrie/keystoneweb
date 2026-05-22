import { createAdminClient } from '@/lib/db/supabase-admin';
import Link from 'next/link';
import { STATUS_COLORS, STATUS_LABELS, CHANNEL_LABELS } from '@/lib/marketing/types';
import PendingLaunchActions from './PendingLaunchActions';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export default async function OpsMarketingPage() {
  const db = createAdminClient();

  // Fetch stats in parallel
  const [
    { data: campaigns },
    { count: activeCampaignCount },
    { count: totalCampaignCount },
    { data: spendData },
    { data: pendingLaunchCampaigns },
  ] = await Promise.all([
    db.from('marketing_campaigns')
      .select('*')
      .is('site_id', null)
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(10),
    db.from('marketing_campaigns')
      .select('id', { count: 'exact', head: true })
      .is('site_id', null)
      .eq('status', 'active'),
    db.from('marketing_campaigns')
      .select('id', { count: 'exact', head: true })
      .is('site_id', null)
      .not('status', 'eq', 'cancelled'),
    db.from('marketing_spend')
      .select('ad_spend_cents')
      .is('site_id', null)
      .gte('spend_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
    db.from('marketing_campaigns')
      .select('id, name, channel, campaign_type, daily_budget_cents, approved_at, sites!inner(id, site_slug, design_data, google_ads_customer_id, google_ads_billing_ready, user_id)')
      .eq('status', 'pending_launch')
      .order('approved_at', { ascending: true }),
  ]);

  const allCampaigns = campaigns ?? [];

  // Aggregate performance from campaigns
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalSpentCents = 0;
  for (const c of allCampaigns) {
    totalImpressions += c.impressions || 0;
    totalClicks += c.clicks || 0;
    totalSpentCents += c.spent_cents || 0;
  }
  const overallCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

  // This month's spend from ledger
  const monthlySpend = (spendData ?? []).reduce((sum: number, r: any) => sum + (r.ad_spend_cents || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketing</h1>
          <p className="mt-1 text-sm text-gray-500">
            AI-powered marketing campaigns for KeystoneWeb.
          </p>
        </div>
        <Link
          href="/marketing/create"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          + Create Campaign
        </Link>
      </div>

      {/* Pending Launch Queue (customer campaigns awaiting ops billing setup) */}
      {pendingLaunchCampaigns && pendingLaunchCampaigns.length > 0 && (
        <div className="rounded-lg border border-amber-700/60 bg-amber-950/30 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-base font-bold text-amber-200">
              Pending launch — {pendingLaunchCampaigns.length} customer campaign{pendingLaunchCampaigns.length === 1 ? '' : 's'} awaiting billing setup
            </h2>
          </div>
          <p className="text-xs text-amber-200/70 mb-4">
            For each campaign below: click <em>Open billing</em> to add a payment method to the sub-account in Google Ads,
            then click <em>Launch in Google</em>. Once a site has been launched once, subsequent campaigns from that site
            auto-launch.
          </p>
          <div className="overflow-x-auto rounded-md border border-amber-800/50 bg-gray-950/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-800/50 text-left text-xs text-amber-300/70 uppercase tracking-wider">
                  <th className="px-4 py-2.5">Site</th>
                  <th className="px-4 py-2.5">Campaign</th>
                  <th className="px-4 py-2.5">Channel</th>
                  <th className="px-4 py-2.5 text-right">Daily</th>
                  <th className="px-4 py-2.5">Sub-account</th>
                  <th className="px-4 py-2.5">Approved</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-900/40">
                {pendingLaunchCampaigns.map((c: any) => {
                  const site = Array.isArray(c.sites) ? c.sites[0] : c.sites;
                  const siteName = (site?.design_data as { siteTitle?: string } | null)?.siteTitle
                    || site?.site_slug
                    || 'Untitled';
                  return (
                    <tr key={c.id} className="hover:bg-amber-950/30 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{siteName}</td>
                      <td className="px-4 py-3 text-gray-300">{c.name}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {CHANNEL_LABELS[c.channel as keyof typeof CHANNEL_LABELS] || c.channel}
                        {c.campaign_type ? ` · ${c.campaign_type}` : ''}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">{formatCents(c.daily_budget_cents || 0)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {site?.google_ads_customer_id || <span className="text-red-400">missing</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {c.approved_at ? new Date(c.approved_at).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <PendingLaunchActions
                          campaignId={c.id}
                          googleAdsCustomerId={site?.google_ads_customer_id || null}
                          billingReady={site?.google_ads_billing_ready === true}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Campaigns" value={String(activeCampaignCount ?? 0)} />
        <StatCard label="This Month Spend" value={formatCents(monthlySpend)} />
        <StatCard label="Total Impressions" value={formatNumber(totalImpressions)} />
        <StatCard label="Avg CTR" value={`${overallCtr}%`} />
      </div>

      {/* Quick Links */}
      <div className="flex gap-3 text-sm">
        <Link href="/marketing/campaigns" className="text-sky-400 hover:text-sky-300 transition-colors">
          All Campaigns ({totalCampaignCount ?? 0})
        </Link>
        <span className="text-gray-700">|</span>
        <Link href="/marketing/settings" className="text-sky-400 hover:text-sky-300 transition-colors">
          Settings
        </Link>
      </div>

      {/* Recent Campaigns Table */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Recent Campaigns</h2>
        {allCampaigns.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center">
            <p className="text-gray-500">No campaigns yet.</p>
            <Link
              href="/marketing/create"
              className="mt-3 inline-block text-sm text-emerald-400 hover:text-emerald-300"
            >
              Create your first campaign
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50 text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Budget</th>
                  <th className="px-4 py-3 text-right">Spent</th>
                  <th className="px-4 py-3 text-right">Impressions</th>
                  <th className="px-4 py-3 text-right">Clicks</th>
                  <th className="px-4 py-3 text-right">CTR</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {allCampaigns.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-900/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/marketing/campaigns/${c.id}`}
                        className="font-medium text-white hover:text-emerald-400 transition-colors"
                      >
                        {c.name}
                      </Link>
                      {c.ai_generated && (
                        <span className="ml-2 text-[10px] text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded">
                          AI
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {CHANNEL_LABELS[c.channel as keyof typeof CHANNEL_LABELS] || c.channel}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status as keyof typeof STATUS_COLORS] || ''}`}>
                        {STATUS_LABELS[c.status as keyof typeof STATUS_LABELS] || c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {c.total_budget_cents ? formatCents(c.total_budget_cents) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {c.spent_cents > 0 ? formatCents(c.spent_cents) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {c.impressions > 0 ? formatNumber(c.impressions) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {c.clicks > 0 ? formatNumber(c.clicks) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {c.impressions > 0 ? `${((c.clicks / c.impressions) * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {new Date(c.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
