'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  STATUS_COLORS, STATUS_LABELS, CHANNEL_LABELS, CAMPAIGN_TYPE_LABELS,
} from '@/lib/marketing/types';
import type { GoogleSearchContent, MetaAdContent, EmailContent } from '@/lib/marketing/types';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCampaign();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchCampaign() {
    try {
      const res = await fetch(`/api/ops/marketing/campaigns/${id}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setCampaign(data.campaign);
      setLogs(data.logs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    setActionLoading('approve');
    try {
      const res = await fetch(`/api/ops/marketing/campaigns/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve');
      await fetchCampaign();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading('');
    }
  }

  async function handlePause() {
    setActionLoading('pause');
    try {
      const res = await fetch(`/api/ops/marketing/campaigns/${id}/pause`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to pause');
      await fetchCampaign();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading('');
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel this campaign? This cannot be undone.')) return;
    setActionLoading('cancel');
    try {
      const res = await fetch(`/api/ops/marketing/campaigns/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to cancel');
      router.push('/marketing/campaigns');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading('');
    }
  }

  if (loading) {
    return <div className="text-gray-500 py-20 text-center">Loading campaign...</div>;
  }

  if (error || !campaign) {
    return (
      <div className="py-20 text-center">
        <p className="text-red-400">{error || 'Campaign not found'}</p>
        <Link href="/marketing/campaigns" className="mt-4 inline-block text-sm text-sky-400">
          Back to campaigns
        </Link>
      </div>
    );
  }

  const canApprove = ['draft', 'suggested', 'failed'].includes(campaign.status);
  const canPause = campaign.status === 'active';
  const canCancel = !['completed', 'cancelled'].includes(campaign.status);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/marketing/campaigns" className="text-sm text-gray-500 hover:text-gray-300 mb-2 inline-block">
            &larr; All Campaigns
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            {campaign.name}
            {campaign.ai_generated && (
              <span className="text-xs text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded">AI Generated</span>
            )}
          </h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
            <span>{CHANNEL_LABELS[campaign.channel as keyof typeof CHANNEL_LABELS]}</span>
            <span>&middot;</span>
            <span>{CAMPAIGN_TYPE_LABELS[campaign.campaign_type as keyof typeof CAMPAIGN_TYPE_LABELS]}</span>
            <span>&middot;</span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[campaign.status as keyof typeof STATUS_COLORS]}`}>
              {STATUS_LABELS[campaign.status as keyof typeof STATUS_LABELS]}
            </span>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {canApprove && (
            <button
              onClick={handleApprove}
              disabled={!!actionLoading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'approve' ? 'Launching...' : 'Approve & Launch'}
            </button>
          )}
          {canPause && (
            <button
              onClick={handlePause}
              disabled={!!actionLoading}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'pause' ? 'Pausing...' : 'Pause'}
            </button>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={!!actionLoading}
              className="rounded-lg bg-red-600/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-600/30 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Performance Stats (if active/completed) */}
      {(campaign.impressions > 0 || campaign.clicks > 0 || campaign.spent_cents > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MiniStat label="Impressions" value={campaign.impressions.toLocaleString()} />
          <MiniStat label="Clicks" value={campaign.clicks.toLocaleString()} />
          <MiniStat label="Conversions" value={campaign.conversions.toLocaleString()} />
          <MiniStat label="CTR" value={campaign.impressions > 0 ? `${((campaign.clicks / campaign.impressions) * 100).toFixed(2)}%` : '—'} />
          <MiniStat label="Spent" value={formatCents(campaign.spent_cents)} />
        </div>
      )}

      {/* Budget */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Budget & Schedule</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Daily Budget</span>
            <p className="text-white font-medium">{campaign.daily_budget_cents ? formatCents(campaign.daily_budget_cents) : '—'}</p>
          </div>
          <div>
            <span className="text-gray-500">Total Budget</span>
            <p className="text-white font-medium">{campaign.total_budget_cents ? formatCents(campaign.total_budget_cents) : '—'}</p>
          </div>
          <div>
            <span className="text-gray-500">Start Date</span>
            <p className="text-white font-medium">{campaign.start_date || '—'}</p>
          </div>
          <div>
            <span className="text-gray-500">End Date</span>
            <p className="text-white font-medium">{campaign.end_date || '—'}</p>
          </div>
        </div>
      </div>

      {/* AI Rationale */}
      {campaign.ai_rationale && (
        <div className="rounded-lg border border-violet-800/30 bg-violet-900/10 p-5">
          <h2 className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-2">AI Rationale</h2>
          <p className="text-sm text-gray-300">{campaign.ai_rationale}</p>
        </div>
      )}

      {/* Content Preview */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Campaign Content</h2>
        {campaign.channel === 'google_ads' && <GooglePreview content={campaign.content} />}
        {campaign.channel === 'meta_ads' && <MetaPreview content={campaign.content} />}
        {campaign.channel === 'email' && <EmailPreviewBlock content={campaign.content} />}
      </div>

      {/* Targeting */}
      {campaign.targeting && Object.keys(campaign.targeting).length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Targeting</h2>
          <pre className="text-xs text-gray-400 bg-gray-950 rounded p-3 overflow-x-auto">
            {JSON.stringify(campaign.targeting, null, 2)}
          </pre>
        </div>
      )}

      {/* Activity Log */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Activity Log</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-600">No activity recorded.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 text-sm">
                <time className="shrink-0 text-xs text-gray-600 w-28">
                  {new Date(log.created_at).toLocaleString('en-CA', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </time>
                <span className="text-gray-400">
                  <span className="font-medium text-gray-300">{log.action}</span>
                  {' by '}
                  <span className="text-gray-500">{log.actor}</span>
                  {(() => {
                    const details = (log.details || {}) as Record<string, unknown>;
                    const warnings = Array.isArray(details.calibration_warnings) ? details.calibration_warnings as string[] : [];
                    // Show calibration notes as a friendly list; JSON-dump the rest.
                    const rest = Object.fromEntries(Object.entries(details).filter(([k]) => k !== 'calibration_warnings'));
                    return (
                      <>
                        {Object.keys(rest).length > 0 && (
                          <span className="text-gray-600"> — {JSON.stringify(rest)}</span>
                        )}
                        {warnings.length > 0 && (
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-amber-300/80">
                            {warnings.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        )}
                      </>
                    );
                  })()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function GooglePreview({ content }: { content: any }) {
  const c = content as GoogleSearchContent;
  return (
    <div className="space-y-4">
      {/* Google Search Ad Preview */}
      <div className="rounded-lg border border-gray-700 bg-white p-4 max-w-xl">
        <p className="text-xs text-green-700">{c.finalUrl || 'keystoneweb.ca'}</p>
        <p className="text-lg text-blue-800 font-medium leading-tight">
          {(c.headlines || []).slice(0, 3).join(' | ')}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          {(c.descriptions || []).slice(0, 2).join(' ')}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500 text-xs uppercase mb-1">All Headlines</p>
          <ul className="space-y-0.5">
            {(c.headlines || []).map((h: string, i: number) => (
              <li key={i} className="text-gray-300 text-xs">{h} <span className="text-gray-600">({h.length}ch)</span></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-gray-500 text-xs uppercase mb-1">Keywords</p>
          <div className="flex flex-wrap gap-1">
            {(c.keywords || []).map((kw: string, i: number) => (
              <span key={i} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{kw}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaPreview({ content }: { content: any }) {
  const c = content as MetaAdContent;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 max-w-sm">
        <p className="text-sm text-gray-300 mb-2">{c.primaryText}</p>
        {c.imageUrl && (
          <div className="bg-gray-700 rounded h-48 flex items-center justify-center text-gray-500 text-xs mb-2">
            [Image: {c.imageUrl}]
          </div>
        )}
        <p className="text-sm font-semibold text-white">{c.headline}</p>
        {c.description && <p className="text-xs text-gray-400">{c.description}</p>}
        <button className="mt-2 rounded bg-blue-600 px-3 py-1 text-xs text-white">
          {(c.callToAction || 'LEARN_MORE').replace(/_/g, ' ')}
        </button>
      </div>
      <div className="text-xs text-gray-500">
        Placements: {(c.placements || []).join(', ')}
      </div>
    </div>
  );
}

function EmailPreviewBlock({ content }: { content: any }) {
  const c = content as EmailContent;
  return (
    <div className="space-y-3">
      <div className="text-sm">
        <span className="text-gray-500">Subject: </span>
        <span className="text-white font-medium">{c.subject}</span>
      </div>
      {c.preheader && (
        <div className="text-sm">
          <span className="text-gray-500">Preheader: </span>
          <span className="text-gray-400">{c.preheader}</span>
        </div>
      )}
      <div className="rounded-lg border border-gray-700 bg-white p-4 max-w-xl">
        <div
          className="text-sm text-gray-800 [&_a]:text-blue-600 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-2"
          dangerouslySetInnerHTML={{ __html: c.bodyHtml || '<p>No content</p>' }}
        />
      </div>
    </div>
  );
}
