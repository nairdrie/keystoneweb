'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import EmailComposer from '@/app/ops/email/EmailComposer';
import {
  CONTACT_EVENT_KIND_LABELS,
  CONTACT_EVENT_KINDS,
  CONTACT_EVENT_OUTCOMES,
  LEAD_INDUSTRIES,
  LEAD_INDUSTRY_LABELS,
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_STYLES,
  formatLabel,
  type ContactEventKind,
  type LeadIndustry,
  type LeadSource,
  type LeadStatus,
} from '@/lib/ops/leads';

type Lead = {
  id: string;
  created_at: string;
  updated_at: string;
  contact_name: string | null;
  person_role: string | null;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  has_existing_website: boolean | null;
  business_type: string | null;
  business_subcategory: string | null;
  industry: LeadIndustry | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postal_code: string | null;
  source: LeadSource;
  source_detail: string | null;
  referred_by_user_id: string | null;
  status: LeadStatus;
  lost_reason: string | null;
  assignee_user_id: string | null;
  converted_user_id: string | null;
  converted_at: string | null;
  onboarding_amount_cents: number | null;
  notes: string | null;
  tags: string[];
  image_storage_path: string | null;
  image_url: string | null;
  assignee: { id: string; email: string | null; business_name: string | null } | null;
  referred_by: { id: string; email: string | null; business_name: string | null } | null;
  converted_user: { id: string; email: string | null; business_name: string | null } | null;
  converted_subscription: {
    subscription_plan: string | null;
    subscription_status: string | null;
    subscription_started_at: string | null;
  } | null;
  email_match_candidates: Array<{
    id: string;
    email: string | null;
    business_name: string | null;
    created_at: string;
  }>;
  prospect_audit: {
    id: string;
    audit_status: string;
    audit_completed_at: string | null;
    perf_score: number | null;
    seo_score: number | null;
    best_practices_score: number | null;
    accessibility_score: number | null;
    mobile_load_seconds: number | null;
    uses_https: boolean | null;
    failed_audits: string[] | null;
    cms: string | null;
    cms_confidence: string | null;
    pitch_angles: string[] | null;
    pitch_strength: number | null;
  } | null;
  contact_events: Array<{
    id: string;
    kind: ContactEventKind;
    occurred_at: string;
    outcome: string | null;
    notes: string | null;
    created_at: string;
    created_by: { email: string | null; business_name: string | null } | null;
  }>;
  messages: Array<
    | {
        id: string;
        direction: 'outbound';
        kind: 'email';
        subject: string | null;
        from_email: string;
        to_email: string;
        sent_by: { email: string | null; business_name: string | null } | null;
        created_at: string;
      }
    | {
        id: string;
        direction: 'inbound';
        kind: 'email';
        subject: string | null;
        from_email: string;
        from_name: string | null;
        body_preview: string | null;
        support_status: string;
        created_at: string;
      }
  >;
  assignee_options: Array<{ id: string; email: string; business_name: string | null; is_admin: boolean }>;
  template_sites: Array<{
    id: string;
    site_slug: string | null;
    business_type: string | null;
    is_published: boolean | null;
  }>;
  launch_request: {
    id: string;
    status: string;
    site_id: string | null;
    created_at: string;
  } | null;
};

const INPUT =
  'w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500';

// Mirrors the launch pipeline status colors in app/ops/launch/[id]/page.tsx.
const LAUNCH_STATUS_STYLES: Record<string, string> = {
  new: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  contacted: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  scheduled: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  building: 'text-violet-400 bg-violet-400/10 border-violet-400/30',
  preview_sent: 'text-violet-400 bg-violet-400/10 border-violet-400/30',
  approved: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  paid: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  launched: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  post_launch: 'text-gray-300 bg-gray-800 border-gray-700',
  closed_won: 'text-gray-500 bg-gray-800 border-gray-700',
  closed_lost: 'text-gray-500 bg-gray-800 border-gray-700',
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [opsBasePath, setOpsBasePath] = useState('');
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [emailSenders, setEmailSenders] = useState<{ from_emails: string[]; senderName: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  // Locally-edited buffers for free-form text fields
  const [notesDraft, setNotesDraft] = useState('');
  const [lostReasonDraft, setLostReasonDraft] = useState('');
  const [onboardingDollars, setOnboardingDollars] = useState('');
  const [manualUserId, setManualUserId] = useState('');
  const [templateSiteId, setTemplateSiteId] = useState('');
  const [building, setBuilding] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/ops/leads/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Lead = await res.json();
      setLead(data);
      setNotesDraft(data.notes ?? '');
      setLostReasonDraft(data.lost_reason ?? '');
      setOnboardingDollars(
        data.onboarding_amount_cents !== null ? String(data.onboarding_amount_cents / 100) : '',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const path = window.location.pathname;
    setOpsBasePath(path === '/ops' || path.startsWith('/ops/') ? '/ops' : '');
  }, []);

  async function update(patch: Record<string, unknown>) {
    if (!lead) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/ops/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Update failed');
      }
      // After a patch we refetch so joined fields (assignee, converted_user, etc.) refresh too.
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead() {
    if (!lead) return;
    if (!confirm('Delete this lead and all its contact events? This cannot be undone.')) return;
    const res = await fetch(`/api/ops/leads/${lead.id}`, { method: 'DELETE' });
    if (res.ok) {
      window.location.href = `${opsBasePath}/leads`;
    } else {
      alert('Delete failed');
    }
  }

  async function openEmailModal() {
    if (!emailSenders) {
      try {
        const res = await fetch('/api/ops/email/send');
        const data = await res.json();
        setEmailSenders({ from_emails: data.from_emails ?? [], senderName: '' });
      } catch {
        setEmailSenders({ from_emails: [], senderName: '' });
      }
    }
    setShowEmail(true);
  }

  async function copyForAdvancedAiModel() {
    if (!lead) return;
    try {
      await copyTextToClipboard(buildAdvancedAiModelPrompt(lead));
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 2500);
    } catch {
      setCopyStatus('error');
      window.setTimeout(() => setCopyStatus('idle'), 3500);
    }
  }

  async function buildFromTemplate() {
    if (!lead || !templateSiteId) return;
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch(`/api/ops/leads/${lead.id}/build-from-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: templateSiteId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Build failed');
      setTemplateSiteId('');
      // Refetch so the lead moves to "building" and the linked launch request
      // (with the new site) shows up in place of the build form.
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Build failed');
    } finally {
      setBuilding(false);
    }
  }

  if (loading) return <div className="text-gray-400 text-sm">Loading…</div>;

  if (!lead) {
    return (
      <div className="space-y-4">
        <Link href={`${opsBasePath}/leads`} className="text-sm text-gray-400 hover:text-white">&larr; Back</Link>
        <p className="text-sm text-red-400">{error ?? 'Not found.'}</p>
      </div>
    );
  }

  const headline = lead.business_name || lead.contact_name || lead.email || 'Unnamed lead';
  const showLostReason = lead.status === 'lost';
  const isConverted = Boolean(lead.converted_user_id);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <Link href={`${opsBasePath}/leads`} className="text-sm text-gray-400 hover:text-white">&larr; Back to leads</Link>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">{headline}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Created {new Date(lead.created_at).toLocaleString('en-CA')} · Updated {new Date(lead.updated_at).toLocaleString('en-CA')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lead.email && (
            <button
              onClick={openEmailModal}
              className="rounded-md bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              Send email
            </button>
          )}
          <button
            onClick={deleteLead}
            className="rounded-md bg-red-900/40 hover:bg-red-900/60 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors"
          >
            Delete
          </button>
          <span
            className={`rounded border px-3 py-1 text-xs font-medium ${
              LEAD_STATUS_STYLES[lead.status] ?? LEAD_STATUS_STYLES.new
            }`}
          >
            {formatLabel(lead.status)}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — research, business, conversation history */}
        <div className="lg:col-span-2 space-y-4">
          {lead.image_url && (
            <Card title="Source image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lead.image_url}
                alt="Lead source (uploaded photo)"
                className="w-full max-h-96 object-contain rounded bg-gray-950"
              />
            </Card>
          )}

          <Card title="Contact">
            <EditableField
              label="Name"
              value={lead.contact_name}
              onSave={(v) => update({ contact_name: v })}
            />
            <EditableField
              label="Role"
              value={lead.person_role}
              onSave={(v) => update({ person_role: v })}
              placeholder="e.g. owner, manager"
            />
            <EditableField
              label="Email"
              value={lead.email}
              onSave={(v) => update({ email: v })}
              type="email"
            />
            <EditableField
              label="Phone"
              value={lead.phone}
              onSave={(v) => update({ phone: v })}
              type="tel"
            />
            <EditableField
              label="Website"
              value={lead.website}
              onSave={(v) => update({ website: v })}
              type="url"
            />
          </Card>

          <Card title="Business">
            <EditableField
              label="Business name"
              value={lead.business_name}
              onSave={(v) => update({ business_name: v })}
            />
            <EditableField
              label="Business type"
              value={lead.business_type}
              onSave={(v) => update({ business_type: v })}
              placeholder="e.g. plumber, restaurant"
            />
            <EditableField
              label="Subcategory"
              value={lead.business_subcategory}
              onSave={(v) => update({ business_subcategory: v })}
            />
            <Field label="Industry">
              <select
                value={lead.industry ?? ''}
                onChange={(e) => update({ industry: e.target.value || null })}
                disabled={saving}
                className={INPUT}
              >
                <option value="">— unset —</option>
                {LEAD_INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {LEAD_INDUSTRY_LABELS[i]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Existing site">
              <select
                value={lead.has_existing_website === null ? '' : String(lead.has_existing_website)}
                onChange={(e) =>
                  update({
                    has_existing_website:
                      e.target.value === '' ? null : e.target.value === 'true',
                  })
                }
                disabled={saving}
                className={INPUT}
              >
                <option value="">— unknown —</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </Field>
            <EditableField
              label="Address"
              value={lead.address}
              onSave={(v) => update({ address: v })}
            />
            <div className="grid grid-cols-2 gap-2">
              <EditableField
                label="City"
                value={lead.city}
                onSave={(v) => update({ city: v })}
              />
              <EditableField
                label="Region"
                value={lead.region}
                onSave={(v) => update({ region: v })}
              />
              <EditableField
                label="Country"
                value={lead.country}
                onSave={(v) => update({ country: v })}
              />
              <EditableField
                label="Postal"
                value={lead.postal_code}
                onSave={(v) => update({ postal_code: v })}
              />
            </div>
          </Card>

          <Card title="Research notes">
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={6}
              placeholder="What you've learned about this lead — pain points, decision criteria, competitors, hours, etc."
              className={`${INPUT} resize-y`}
            />
            <button
              onClick={() => update({ notes: notesDraft.trim() || null })}
              disabled={saving || notesDraft === (lead.notes ?? '')}
              className="mt-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              Save notes
            </button>
          </Card>

          <Card title="Conversation history">
            <LogContactEventForm leadId={lead.id} onLogged={refresh} />
            <Timeline contactEvents={lead.contact_events} messages={lead.messages} />
          </Card>
        </div>

        {/* Right column — pipeline */}
        <div className="space-y-4">
          {lead.launch_request ? (
            <Card title="Launch service request">
              <p className="text-xs leading-5 text-gray-500">
                This lead is in the launch pipeline.
              </p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span
                  className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
                    LAUNCH_STATUS_STYLES[lead.launch_request.status] ?? LAUNCH_STATUS_STYLES.new
                  }`}
                >
                  {formatLabel(lead.launch_request.status)}
                </span>
                <span className="text-[11px] text-gray-500">
                  opened {new Date(lead.launch_request.created_at).toLocaleDateString('en-CA')}
                </span>
              </div>
              {lead.launch_request.site_id && (
                <a
                  href={`https://keystoneweb.ca/preview?siteId=${lead.launch_request.site_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-xs text-sky-400 hover:underline break-all"
                >
                  Preview site in progress
                </a>
              )}
              <Link
                href={`${opsBasePath}/launch/${lead.launch_request.id}`}
                className="mt-3 block w-full rounded-md bg-violet-600 hover:bg-violet-500 px-3 py-2 text-center text-xs font-medium text-white transition-colors"
              >
                View launch request
              </Link>
            </Card>
          ) : (
            <Card title="Build from template">
              <p className="text-xs leading-5 text-gray-500">
                Duplicate one of your sites as a starting point. The copy is renamed to the
                lead&apos;s business name (in the site header/footer and slug) and added to the
                launch pipeline.
              </p>
              <select
                value={templateSiteId}
                onChange={(e) => setTemplateSiteId(e.target.value)}
                disabled={building}
                className={`${INPUT} mt-2`}
              >
                <option value="">— choose a site —</option>
                {lead.template_sites.map((s) => {
                  const label = [
                    s.site_slug || '(untitled)',
                    s.business_type ? `· ${s.business_type}` : '',
                    s.is_published ? '· published' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <option key={s.id} value={s.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
              {lead.template_sites.length === 0 && (
                <p className="mt-2 text-[11px] text-gray-600">
                  You have no sites to use as a template yet.
                </p>
              )}
              {!lead.business_name && (
                <p className="mt-2 text-[11px] text-amber-400">
                  Add a business name above before building.
                </p>
              )}
              <button
                onClick={buildFromTemplate}
                disabled={building || !templateSiteId || !lead.business_name}
                className="mt-2 w-full rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-3 py-2 text-xs font-medium text-white transition-colors"
              >
                {building ? 'Building…' : 'Build from template'}
              </button>
            </Card>
          )}

          <Card title="Advanced AI build">
            <p className="text-xs leading-5 text-gray-500">
              Copy a lead-to-site prompt for the internal advanced AI model workflow.
            </p>
            <button
              onClick={copyForAdvancedAiModel}
              className="mt-2 w-full rounded-md bg-violet-600 hover:bg-violet-500 px-3 py-2 text-xs font-medium text-white transition-colors"
            >
              {copyStatus === 'copied' ? 'Copied' : 'Copy for Advanced AI Model'}
            </button>
            {copyStatus === 'error' && (
              <p className="text-[11px] text-red-400">
                Copy failed. Try again or copy the lead fields manually.
              </p>
            )}
          </Card>

          <Card title="Status">
            <select
              value={lead.status}
              onChange={(e) => update({ status: e.target.value })}
              disabled={saving}
              className={INPUT}
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatLabel(s)}
                </option>
              ))}
            </select>
            {showLostReason && (
              <div className="mt-3">
                <label className="block text-[11px] text-gray-500 mb-1">Lost reason</label>
                <input
                  type="text"
                  value={lostReasonDraft}
                  onChange={(e) => setLostReasonDraft(e.target.value)}
                  onBlur={() => {
                    if (lostReasonDraft !== (lead.lost_reason ?? '')) {
                      update({ lost_reason: lostReasonDraft.trim() || null });
                    }
                  }}
                  placeholder="Why we lost"
                  className={INPUT}
                />
              </div>
            )}
          </Card>

          <Card title="Assignee">
            <select
              value={lead.assignee_user_id ?? ''}
              onChange={(e) => update({ assignee_user_id: e.target.value || null })}
              disabled={saving}
              className={INPUT}
            >
              <option value="">Unassigned</option>
              {lead.assignee_options.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.business_name || a.email}{a.is_admin ? ' · admin' : ''}
                </option>
              ))}
            </select>
          </Card>

          <Card title="Acquisition">
            <Field label="Source">
              <select
                value={lead.source}
                onChange={(e) => update({ source: e.target.value })}
                disabled={saving}
                className={INPUT}
              >
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <EditableField
              label="Detail"
              value={lead.source_detail}
              onSave={(v) => update({ source_detail: v })}
              placeholder="campaign, event, referrer name"
            />
          </Card>

          <Card title="Conversion">
            {isConverted && lead.converted_user ? (
              <div className="space-y-2 text-sm">
                <p className="text-gray-300">
                  <span className="text-gray-500">Account: </span>
                  <span className="font-mono text-xs">{lead.converted_user.email}</span>
                </p>
                {lead.converted_subscription?.subscription_plan && (
                  <p>
                    <span className="text-gray-500 text-xs">Plan: </span>
                    <span className="rounded bg-emerald-400/10 text-emerald-400 px-1.5 py-0.5 text-[11px] uppercase font-medium">
                      {lead.converted_subscription.subscription_plan}
                    </span>
                    {lead.converted_subscription.subscription_status && (
                      <span className="ml-1 text-[11px] text-gray-500">
                        ({lead.converted_subscription.subscription_status})
                      </span>
                    )}
                  </p>
                )}
                {lead.converted_at && (
                  <p className="text-xs text-gray-500">
                    Converted {new Date(lead.converted_at).toLocaleDateString('en-CA')}
                  </p>
                )}
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1 mt-2">
                    Onboarding amount ($)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={onboardingDollars}
                      onChange={(e) => setOnboardingDollars(e.target.value)}
                      placeholder="500"
                      className={INPUT}
                    />
                    <button
                      onClick={() => {
                        const n = parseFloat(onboardingDollars);
                        update({
                          onboarding_amount_cents: Number.isFinite(n) ? Math.round(n * 100) : null,
                        });
                      }}
                      disabled={
                        saving ||
                        (lead.onboarding_amount_cents !== null
                          ? Number(onboardingDollars) === lead.onboarding_amount_cents / 100
                          : onboardingDollars === '')
                      }
                      className="rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 text-xs text-white transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Unlink converted account? Status will revert to "qualified".')) {
                      update({
                        converted_user_id: null,
                        converted_at: null,
                        status: 'qualified',
                      });
                    }
                  }}
                  className="text-xs text-red-400 hover:text-red-300 mt-2"
                >
                  Unlink account
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {lead.email_match_candidates.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Matching account by email</p>
                    {lead.email_match_candidates.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded border border-gray-800 bg-gray-950 p-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">
                            {c.business_name || c.email}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            joined {new Date(c.created_at).toLocaleDateString('en-CA')}
                          </p>
                        </div>
                        <button
                          onClick={() => update({ converted_user_id: c.id })}
                          disabled={saving}
                          className="rounded bg-emerald-600 hover:bg-emerald-500 px-2 py-1 text-[11px] font-medium text-white transition-colors disabled:opacity-50"
                        >
                          Link
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">
                    No matching Keystone account by email yet.
                  </p>
                )}

                <details className="text-xs text-gray-400">
                  <summary className="cursor-pointer hover:text-white">
                    Link by user id manually
                  </summary>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={manualUserId}
                      onChange={(e) => setManualUserId(e.target.value)}
                      placeholder="user UUID…"
                      className={INPUT}
                    />
                    <button
                      onClick={() => {
                        if (manualUserId.trim()) {
                          update({ converted_user_id: manualUserId.trim() });
                          setManualUserId('');
                        }
                      }}
                      disabled={saving || !manualUserId.trim()}
                      className="rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 text-xs text-white transition-colors"
                    >
                      Link
                    </button>
                  </div>
                </details>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Email modal */}
      {showEmail &&
        emailSenders &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4 overflow-y-auto py-8">
            <div className="w-full max-w-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white">
                  Email {lead.contact_name ? `${lead.contact_name} <${lead.email}>` : lead.email}
                </h3>
                <button
                  onClick={() => setShowEmail(false)}
                  className="text-gray-400 hover:text-white text-xl leading-none"
                >
                  &times;
                </button>
              </div>
              {emailSenders.from_emails.length === 0 ? (
                <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-sm text-gray-400">
                  No sender email available for your account.
                </div>
              ) : (
                <EmailComposer
                  availableFromEmails={emailSenders.from_emails}
                  senderName={emailSenders.senderName}
                  defaultTo={lead.email ?? ''}
                  defaultSubject={
                    lead.business_name ? `Following up — ${lead.business_name}` : ''
                  }
                  onSent={() => {
                    refresh();
                  }}
                />
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('Copy failed');
}

function buildAdvancedAiModelPrompt(lead: Lead): string {
  const auditWeaknesses = buildAuditWeaknesses(lead);
  const recentTouches = lead.contact_events.slice(0, 5).map((event) => {
    const outcome = event.outcome ? ` (${formatLabel(event.outcome)})` : '';
    const notes = event.notes ? ` - ${event.notes}` : '';
    return `${CONTACT_EVENT_KIND_LABELS[event.kind]}${outcome}${notes}`;
  });
  const recentMessages = lead.messages.slice(0, 5).map((message) => {
    if (message.direction === 'outbound') {
      return `Outbound email: ${message.subject || '(no subject)'}`;
    }
    return `Inbound reply from ${message.from_name || message.from_email}: ${message.subject || '(no subject)'}`;
  });

  return `Use the advanced AI model workflow. Do not use Keystone's in-product AI Builder or /api/ai/builder.

Goal:
Build a draft Keystone website for this lead that we can preview and later attach to the launch pipeline.

Lead:
- Business name: ${blankable(lead.business_name)}
- Contact name / role: ${joinParts([lead.contact_name, lead.person_role], ' / ')}
- Email / phone: ${joinParts([lead.email, lead.phone], ' / ')}
- Website: ${blankable(lead.website)}
- Existing website: ${formatExistingWebsite(lead)}
- Business type: ${blankable(lead.business_type)}
- Industry: ${lead.industry ? LEAD_INDUSTRY_LABELS[lead.industry] ?? formatLabel(lead.industry) : ''}
- Subcategory: ${blankable(lead.business_subcategory)}
- City / region: ${joinParts([lead.city, lead.region], ' / ')}
- Address: ${joinParts([lead.address, lead.postal_code, lead.country], ', ')}
- Source: ${LEAD_SOURCE_LABELS[lead.source] ?? formatLabel(lead.source)}
- Source detail: ${blankable(lead.source_detail)}
- Status: ${formatLabel(lead.status)}
- Tags: ${formatArray(lead.tags)}
- Notes: ${blankable(lead.notes)}
- Pitch angles: ${formatArray(lead.prospect_audit?.pitch_angles)}
- Existing site weaknesses: ${formatArray(auditWeaknesses)}
- Source image: ${lead.image_storage_path ? 'Uploaded in Ops lead record (private storage path not copied)' : ''}
- Recent contact context: ${formatArray([...recentTouches, ...recentMessages])}

Website/audit context:
- Audit status: ${blankable(lead.prospect_audit?.audit_status)}
- Performance score: ${blankable(lead.prospect_audit?.perf_score)}
- SEO score: ${blankable(lead.prospect_audit?.seo_score)}
- Best practices score: ${blankable(lead.prospect_audit?.best_practices_score)}
- Accessibility score: ${blankable(lead.prospect_audit?.accessibility_score)}
- Mobile load seconds: ${blankable(lead.prospect_audit?.mobile_load_seconds)}
- Uses HTTPS: ${formatBoolean(lead.prospect_audit?.uses_https)}
- CMS: ${formatCms(lead)}

Site requirements:
- Primary CTA:
- Pages wanted:
- Features needed:
- Visual style:
- Tone:
- Must include:
- Avoid:

Output:
1. Create a concise site build brief.
2. Choose the Keystone page/block structure.
3. Draft tailored copy.
4. If implementation is enabled, create/update the draft site in Keystone's repo/data model and return the preview path or site ID.`;
}

function buildAuditWeaknesses(lead: Lead): string[] {
  const weaknesses: string[] = [];
  if (lead.has_existing_website === false) weaknesses.push('No existing website recorded');
  if (lead.prospect_audit?.uses_https === false) weaknesses.push('Website does not use HTTPS');
  if (typeof lead.prospect_audit?.mobile_load_seconds === 'number') {
    weaknesses.push(`Mobile load time ${lead.prospect_audit.mobile_load_seconds}s`);
  }
  if (typeof lead.prospect_audit?.perf_score === 'number' && lead.prospect_audit.perf_score < 70) {
    weaknesses.push(`Low performance score (${lead.prospect_audit.perf_score}/100)`);
  }
  if (typeof lead.prospect_audit?.seo_score === 'number' && lead.prospect_audit.seo_score < 80) {
    weaknesses.push(`SEO score needs work (${lead.prospect_audit.seo_score}/100)`);
  }
  if (typeof lead.prospect_audit?.accessibility_score === 'number' && lead.prospect_audit.accessibility_score < 80) {
    weaknesses.push(`Accessibility score needs work (${lead.prospect_audit.accessibility_score}/100)`);
  }
  if (Array.isArray(lead.prospect_audit?.failed_audits)) {
    weaknesses.push(...lead.prospect_audit.failed_audits);
  }
  return Array.from(new Set(weaknesses.filter(Boolean)));
}

function blankable(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return String(value);
}

function joinParts(values: Array<string | null | undefined>, separator: string): string {
  return values.map((value) => value?.trim()).filter(Boolean).join(separator);
}

function formatArray(values: string[] | null | undefined): string {
  if (!values || values.length === 0) return '';
  return values.filter(Boolean).join('; ');
}

function formatBoolean(value: boolean | null | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '';
}

function formatExistingWebsite(lead: Lead): string {
  if (lead.has_existing_website === true) return 'Yes';
  if (lead.has_existing_website === false) return 'No';
  return lead.website ? 'Likely yes (website field present)' : '';
}

function formatCms(lead: Lead): string {
  if (!lead.prospect_audit?.cms) return '';
  return lead.prospect_audit.cms_confidence
    ? `${lead.prospect_audit.cms} (${lead.prospect_audit.cms_confidence} confidence)`
    : lead.prospect_audit.cms;
}

function EditableField({
  label,
  value,
  onSave,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string | null;
  onSave: (next: string | null) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'url';
}) {
  // React docs pattern for syncing local state to a changing prop without
  // triggering an effect: track the prop's last seen value and reset during
  // render when it changes. Avoids cascading renders.
  const [draft, setDraft] = useState(value ?? '');
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value ?? '');
  }

  return (
    <Field label={label}>
      <input
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() === (value ?? '').trim()) return;
          onSave(draft.trim() || null);
        }}
        placeholder={placeholder}
        className={INPUT}
      />
    </Field>
  );
}

function LogContactEventForm({ leadId, onLogged }: { leadId: string; onLogged: () => void }) {
  const [kind, setKind] = useState<ContactEventKind>('call');
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!notes.trim() && !outcome.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ops/leads/${leadId}/contact-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          outcome: outcome.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (res.ok) {
        setOutcome('');
        setNotes('');
        onLogged();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded border border-gray-800 bg-gray-950 p-3 space-y-2 mb-3">
      <div className="flex gap-2 flex-wrap">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ContactEventKind)}
          className="rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-gray-500"
        >
          {CONTACT_EVENT_KINDS.filter((k) => k !== 'email_sent' && k !== 'email_received').map(
            (k) => (
              <option key={k} value={k}>
                {CONTACT_EVENT_KIND_LABELS[k]}
              </option>
            ),
          )}
        </select>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-gray-500"
        >
          <option value="">— outcome —</option>
          {CONTACT_EVENT_OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {formatLabel(o)}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="What happened on this touch?"
        className={`${INPUT} text-xs resize-y`}
      />
      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={submitting || (!notes.trim() && !outcome.trim())}
          className="rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1 text-xs font-medium text-white transition-colors"
        >
          {submitting ? 'Logging…' : 'Log touch'}
        </button>
      </div>
    </div>
  );
}

function Timeline({
  contactEvents,
  messages,
}: {
  contactEvents: Lead['contact_events'];
  messages: Lead['messages'];
}) {
  type TimelineItem =
    | {
        kind: 'event';
        when: string;
        eventKind: ContactEventKind;
        outcome: string | null;
        notes: string | null;
        author: { email: string | null; business_name: string | null } | null;
      }
    | {
        kind: 'message_outbound';
        when: string;
        subject: string | null;
        from_email: string;
        sent_by: { email: string | null; business_name: string | null } | null;
      }
    | {
        kind: 'message_inbound';
        when: string;
        subject: string | null;
        from_email: string;
        from_name: string | null;
        body_preview: string | null;
        support_status: string;
      };

  const items: TimelineItem[] = [];
  for (const ev of contactEvents) {
    items.push({
      kind: 'event',
      when: ev.occurred_at,
      eventKind: ev.kind,
      outcome: ev.outcome,
      notes: ev.notes,
      author: ev.created_by,
    });
  }
  for (const m of messages) {
    if (m.direction === 'outbound') {
      items.push({
        kind: 'message_outbound',
        when: m.created_at,
        subject: m.subject,
        from_email: m.from_email,
        sent_by: m.sent_by,
      });
    } else {
      items.push({
        kind: 'message_inbound',
        when: m.created_at,
        subject: m.subject,
        from_email: m.from_email,
        from_name: m.from_name,
        body_preview: m.body_preview,
        support_status: m.support_status,
      });
    }
  }
  items.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

  if (items.length === 0) {
    return (
      <p className="text-xs text-gray-600 text-center py-6">No touches yet. Log a call, meeting, or send an email above.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="rounded border border-gray-800 bg-gray-950 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {it.kind === 'event' && (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-medium text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded">
                      {CONTACT_EVENT_KIND_LABELS[it.eventKind]}
                    </span>
                    {it.outcome && (
                      <span className="text-[11px] text-gray-400">{formatLabel(it.outcome)}</span>
                    )}
                    {it.author && (
                      <span className="text-[11px] text-gray-600">
                        by {it.author.business_name || it.author.email}
                      </span>
                    )}
                  </div>
                  {it.notes && (
                    <p className="mt-1.5 text-sm text-gray-300 whitespace-pre-wrap">{it.notes}</p>
                  )}
                </>
              )}
              {it.kind === 'message_outbound' && (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-medium text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded">
                      Email sent
                    </span>
                    <span className="text-[11px] text-gray-600">
                      from {it.from_email}
                      {it.sent_by && ` · ${it.sent_by.email}`}
                    </span>
                  </div>
                  {it.subject && (
                    <p className="mt-1.5 text-sm text-gray-300 truncate">{it.subject}</p>
                  )}
                </>
              )}
              {it.kind === 'message_inbound' && (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                      Reply received
                    </span>
                    <span className="text-[11px] text-gray-600">
                      from {it.from_name || it.from_email}
                    </span>
                  </div>
                  {it.subject && (
                    <p className="mt-1.5 text-sm text-gray-300 truncate">{it.subject}</p>
                  )}
                  {it.body_preview && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-3 whitespace-pre-wrap">
                      {it.body_preview}
                    </p>
                  )}
                </>
              )}
            </div>
            <time className="shrink-0 text-[11px] text-gray-600">
              {new Date(it.when).toLocaleString('en-CA', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
