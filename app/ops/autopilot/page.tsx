'use client';

// Ops Autopilot dashboard — the command center for automated lead conversion.
//
//   • "On the hook" — leads that replied or showed interest; autopilot has
//     paused itself and a human should take over now.
//   • Generated sites — every lead the operator clicked "Generate site" on,
//     with preview/editor links and one-click autopilot enrollment.
//   • Enrollments — touches sent, next action, and Claude's last decision.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface GenerationRow {
  id: string;
  lead_id: string;
  site_id: string | null;
  launch_request_id: string | null;
  status: 'generating' | 'succeeded' | 'failed';
  prompt: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  enrichment: {
    place?: { rating?: number | null; reviewCount?: number | null; phone?: string | null } | null;
    photoUrls?: string[] | null;
    branding?: { styleKeywords?: string[] } | null;
  } | null;
}

interface EnrollmentRow {
  id: string;
  lead_id: string;
  status: 'active' | 'paused' | 'hooked' | 'stopped' | 'converted';
  channels: { email?: boolean; sms?: boolean } | null;
  max_touches: number;
  touches_sent: number;
  next_action_at: string | null;
  last_action_at: string | null;
  hook_reason: string | null;
  stop_reason: string | null;
  last_decision: { action?: string; reason?: string } | null;
  updated_at: string;
}

interface EventRow {
  autopilot_id: string;
  lead_id: string;
  kind: string;
  summary: string | null;
  created_at: string;
}

interface LeadSummary {
  id: string;
  business_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  industry: string | null;
  status: string;
}

interface DashboardData {
  generations: GenerationRow[];
  enrollments: EnrollmentRow[];
  recentEvents: EventRow[];
  leads: LeadSummary[];
}

const ENROLLMENT_STATUS_STYLES: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  hooked: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  paused: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  stopped: 'text-gray-500 bg-gray-800 border-gray-700',
  converted: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
};

export default function OpsAutopilotPage() {
  const pathname = usePathname();
  const opsBasePath = pathname?.startsWith('/ops') ? '/ops' : '';

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ops/autopilot', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load autopilot data');
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const leadById = useMemo(() => {
    const map = new Map<string, LeadSummary>();
    for (const lead of data?.leads ?? []) map.set(lead.id, lead);
    return map;
  }, [data]);

  const enrollmentByLead = useMemo(() => {
    const map = new Map<string, EnrollmentRow>();
    for (const enrollment of data?.enrollments ?? []) map.set(enrollment.lead_id, enrollment);
    return map;
  }, [data]);

  const hooked = (data?.enrollments ?? []).filter((e) => e.status === 'hooked');
  const active = (data?.enrollments ?? []).filter((e) => e.status === 'active');
  const others = (data?.enrollments ?? []).filter((e) => e.status === 'paused' || e.status === 'stopped');

  const act = useCallback(async (leadId: string, action: string, channels?: { email?: boolean; sms?: boolean }) => {
    setActionBusy(`${leadId}:${action}`);
    try {
      const res = await fetch('/api/ops/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ leadId, action, channels }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Action failed');
      }
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionBusy(null);
    }
  }, [load]);

  const leadName = (leadId: string) => {
    const lead = leadById.get(leadId);
    return lead?.business_name || lead?.contact_name || 'Unknown lead';
  };

  if (loading) {
    return <div className="py-24 text-center text-gray-500 text-sm">Loading autopilot…</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Autopilot</h1>
          <p className="mt-1 text-sm text-gray-500">
            AI-generated sites and automated follow-ups. Enroll a lead and Claude handles outreach until there&apos;s a fish on the hook.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="rounded-md bg-gray-800 hover:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="On the hook" value={String(hooked.length)} highlight={hooked.length > 0} />
        <SummaryCard label="Active enrollments" value={String(active.length)} />
        <SummaryCard
          label="Touches sent"
          value={String((data?.enrollments ?? []).reduce((sum, e) => sum + (e.touches_sent || 0), 0))}
        />
        <SummaryCard label="Sites generated" value={String((data?.generations ?? []).filter((g) => g.status === 'succeeded').length)} />
      </div>

      {/* On the hook */}
      {hooked.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-amber-400">🐟 On the hook — take over now</h2>
          <div className="space-y-2">
            {hooked.map((enrollment) => {
              const lead = leadById.get(enrollment.lead_id);
              return (
                <div key={enrollment.id} className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`${opsBasePath}/leads/${enrollment.lead_id}`} className="font-medium text-white hover:text-amber-300">
                      {leadName(enrollment.lead_id)}
                    </Link>
                    <p className="text-sm text-amber-200/80 mt-0.5">{enrollment.hook_reason || 'Flagged for human follow-up.'}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {lead?.email && <span className="mr-3">{lead.email}</span>}
                      {lead?.phone && <span>{lead.phone}</span>}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        await act(enrollment.lead_id, 'takeover');
                        window.location.href = `${opsBasePath}/leads/${enrollment.lead_id}`;
                      }}
                      disabled={actionBusy === `${enrollment.lead_id}:takeover`}
                      className="rounded-md bg-amber-400 px-3 py-1.5 text-sm font-medium text-gray-950 hover:bg-amber-300 transition-colors disabled:opacity-60"
                    >
                      Take over
                    </button>
                    <button
                      onClick={() => act(enrollment.lead_id, 'resume')}
                      disabled={actionBusy === `${enrollment.lead_id}:resume`}
                      className="rounded-md bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      Resume autopilot
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Generated sites */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Generated sites</h2>
        {(data?.generations ?? []).length === 0 ? (
          <EmptyState message="No sites generated yet. Open a lead and hit “Generate site with AI”." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Enrichment</th>
                  <th className="px-4 py-3">Generated</th>
                  <th className="px-4 py-3">Site</th>
                  <th className="px-4 py-3">Autopilot</th>
                </tr>
              </thead>
              <tbody>
                {(data?.generations ?? []).map((generation) => {
                  const lead = leadById.get(generation.lead_id);
                  const enrollment = enrollmentByLead.get(generation.lead_id);
                  const place = generation.enrichment?.place;
                  const photoCount = generation.enrichment?.photoUrls?.length ?? 0;
                  return (
                    <tr key={generation.id} className="border-b border-gray-800/60 last:border-0 hover:bg-gray-900/50">
                      <td className="px-4 py-3">
                        <Link href={`${opsBasePath}/leads/${generation.lead_id}`} className="font-medium text-white hover:text-emerald-300">
                          {leadName(generation.lead_id)}
                        </Link>
                        <div className="text-xs text-gray-500">{lead?.city || ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <GenerationStatusBadge status={generation.status} error={generation.error} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {place?.rating ? <span className="mr-2">★ {place.rating} ({place.reviewCount})</span> : null}
                        {photoCount > 0 ? <span className="mr-2">{photoCount} photos</span> : null}
                        {generation.enrichment?.branding?.styleKeywords?.length
                          ? <span className="text-gray-500">{generation.enrichment.branding.styleKeywords.slice(0, 3).join(', ')}</span>
                          : null}
                        {!place && photoCount === 0 ? <span className="text-gray-600">—</span> : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatWhen(generation.created_at)}</td>
                      <td className="px-4 py-3">
                        {generation.site_id ? (
                          <div className="flex gap-2 text-xs">
                            <a
                              href={`https://keystoneweb.ca/preview?siteId=${generation.site_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:text-emerald-300"
                            >
                              Preview
                            </a>
                            <a
                              href={`https://keystoneweb.ca/editor?siteId=${generation.site_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-gray-400 hover:text-white"
                            >
                              Editor
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {enrollment ? (
                          <span className={`inline-block rounded border px-2 py-0.5 text-xs ${ENROLLMENT_STATUS_STYLES[enrollment.status] || ''}`}>
                            {enrollment.status}
                          </span>
                        ) : lead?.email || lead?.phone ? (
                          <button
                            onClick={() => act(generation.lead_id, 'enroll')}
                            disabled={actionBusy === `${generation.lead_id}:enroll` || generation.status !== 'succeeded'}
                            className="rounded-md bg-emerald-500/10 border border-emerald-400/40 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
                          >
                            Enroll in autopilot
                          </button>
                        ) : (
                          <span className="text-xs text-gray-600" title="Lead needs an email or phone first">No contact info</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Enrollments */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Enrollments</h2>
        {(data?.enrollments ?? []).length === 0 ? (
          <EmptyState message="Nothing enrolled yet. Generate a site, then enroll the lead and autopilot starts reaching out." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Touches</th>
                  <th className="px-4 py-3">Next action</th>
                  <th className="px-4 py-3">Last decision</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...hooked, ...active, ...others].map((enrollment) => (
                  <tr key={enrollment.id} className="border-b border-gray-800/60 last:border-0 hover:bg-gray-900/50">
                    <td className="px-4 py-3">
                      <Link href={`${opsBasePath}/leads/${enrollment.lead_id}`} className="font-medium text-white hover:text-emerald-300">
                        {leadName(enrollment.lead_id)}
                      </Link>
                      <div className="text-xs text-gray-500">
                        {enrollment.channels?.email !== false ? 'email' : ''}
                        {enrollment.channels?.sms ? ' + sms' : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded border px-2 py-0.5 text-xs ${ENROLLMENT_STATUS_STYLES[enrollment.status] || ''}`}>
                        {enrollment.status}
                      </span>
                      {enrollment.stop_reason && enrollment.status === 'stopped' && (
                        <div className="text-xs text-gray-600 mt-1 max-w-[220px]">{enrollment.stop_reason}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{enrollment.touches_sent} / {enrollment.max_touches}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {enrollment.status === 'active' ? formatWhen(enrollment.next_action_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[280px]">
                      {enrollment.last_decision?.action ? (
                        <>
                          <span className="text-gray-300">{enrollment.last_decision.action}</span>
                          {enrollment.last_decision.reason ? ` — ${enrollment.last_decision.reason}` : ''}
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {enrollment.status === 'active' && (
                          <ActionButton label="Pause" busy={actionBusy === `${enrollment.lead_id}:pause`} onClick={() => act(enrollment.lead_id, 'pause')} />
                        )}
                        {(enrollment.status === 'paused' || enrollment.status === 'stopped' || enrollment.status === 'hooked') && (
                          <ActionButton label="Resume" busy={actionBusy === `${enrollment.lead_id}:resume`} onClick={() => act(enrollment.lead_id, enrollment.status === 'stopped' ? 'enroll' : 'resume')} />
                        )}
                        {enrollment.status !== 'stopped' && (
                          <ActionButton label="Stop" busy={actionBusy === `${enrollment.lead_id}:stop`} onClick={() => act(enrollment.lead_id, 'stop')} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent activity */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Recent activity</h2>
        {(data?.recentEvents ?? []).length === 0 ? (
          <EmptyState message="No autopilot activity yet." />
        ) : (
          <div className="rounded-lg border border-gray-800 divide-y divide-gray-800/60">
            {(data?.recentEvents ?? []).slice(0, 30).map((event, index) => (
              <div key={index} className="px-4 py-2.5 flex items-start gap-3 text-sm">
                <span className="text-xs text-gray-600 whitespace-nowrap mt-0.5 w-32 shrink-0">{formatWhen(event.created_at)}</span>
                <span className={`text-xs rounded border px-1.5 py-0.5 shrink-0 ${eventKindStyle(event.kind)}`}>{event.kind}</span>
                <span className="text-gray-400 min-w-0">
                  <Link href={`${opsBasePath}/leads/${event.lead_id}`} className="text-gray-300 hover:text-white">{leadName(event.lead_id)}</Link>
                  {event.summary ? ` — ${event.summary}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'border-amber-400/40 bg-amber-400/5' : 'border-gray-800 bg-gray-900/50'}`}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</div>
    </div>
  );
}

function GenerationStatusBadge({ status, error }: { status: string; error: string | null }) {
  if (status === 'succeeded') {
    return <span className="inline-block rounded border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-400">succeeded</span>;
  }
  if (status === 'failed') {
    return (
      <span className="inline-block rounded border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-xs text-red-400" title={error ?? undefined}>
        failed
      </span>
    );
  }
  return <span className="inline-block rounded border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-xs text-sky-400">generating…</span>;
}

function ActionButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="rounded-md bg-gray-800 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
    >
      {busy ? '…' : label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-800 px-4 py-10 text-center text-sm text-gray-600">{message}</div>
  );
}

function eventKindStyle(kind: string): string {
  if (kind === 'hooked') return 'border-amber-400/30 text-amber-400';
  if (kind === 'email_sent' || kind === 'sms_sent') return 'border-emerald-400/30 text-emerald-400';
  if (kind === 'error' || kind === 'stopped') return 'border-red-400/30 text-red-400';
  return 'border-gray-700 text-gray-500';
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
