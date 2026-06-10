'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import HealthCheckPanel from './HealthCheckPanel';
import LaunchConfigCard, { type LaunchConfig } from './LaunchConfigCard';
import SendToClientCard from './SendToClientCard';

type LaunchRequest = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  phone: string | null;
  business_name: string | null;
  business_type: string | null;
  sub_category: string | null;
  pages: string[] | null;
  logo_status: string | null;
  domain_status: string | null;
  launch_timing: string | null;
  budget_band: string | null;
  preferred_days: string[] | null;
  preferred_times: string[] | null;
  scheduling_notes: string | null;
  description: string | null;
  referral_source: string | null;
  status: string;
  assignee_user_id: string | null;
  notes: string | null;
  site_id: string | null;
  stripe_checkout_url: string | null;
  stripe_setup_invoice_id: string | null;
  launch_config: LaunchConfig | null;
  launch_service_price_cents: number | null;
  onboarding_token: string | null;
  onboarding_status: string | null;
  changes_requested_text: string | null;
  launched_at: string | null;
  lead_id: string | null;
  assignee?: { id: string; email: string | null; business_name: string | null } | null;
  site?: { id: string; site_slug: string | null } | null;
  lead?: { id: string; business_name: string | null } | null;
  assignee_options?: Array<{ id: string; email: string; business_name: string | null; is_admin: boolean }>;
};

const STATUSES = [
  'new',
  'contacted',
  'scheduled',
  'building',
  'preview_sent',
  'approved',
  'paid',
  'launched',
  'post_launch',
  'closed_won',
  'closed_lost',
];

const STATUS_STYLES: Record<string, string> = {
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

function fmt(value: string | null | undefined): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ');
}

export default function LaunchRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [req, setReq] = useState<LaunchRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [stripeUrl, setStripeUrl] = useState('');

  useEffect(() => {
    fetch(`/api/ops/launch/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: LaunchRequest) => {
        setReq(data);
        setNotes(data.notes ?? '');
        setStripeUrl(data.stripe_checkout_url ?? '');
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message ?? 'Failed to load');
        setLoading(false);
      });
  }, [id]);

  async function update(patch: Partial<LaunchRequest>) {
    if (!req) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/ops/launch/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Update failed');
      }
      const updated = await res.json();
      setReq((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-gray-400 text-sm">Loading…</div>;
  }

  if (!req) {
    return (
      <div className="space-y-4">
        <Link href="/launch" className="text-sm text-gray-400 hover:text-white">&larr; Back</Link>
        <p className="text-sm text-red-400">{error ?? 'Not found.'}</p>
      </div>
    );
  }

  const previewUrl = req.site_id ? `https://keystoneweb.ca/preview?siteId=${req.site_id}` : null;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/launch" className="text-sm text-gray-400 hover:text-white">&larr; Back to requests</Link>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">{req.business_name || req.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Submitted {new Date(req.created_at).toLocaleString('en-CA')}
          </p>
        </div>
        <span className={`rounded border px-3 py-1 text-xs font-medium ${STATUS_STYLES[req.status] ?? STATUS_STYLES.new}`}>
          {fmt(req.status)}
        </span>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: intake fields */}
        <div className="lg:col-span-2 space-y-4">
          <Card title="Contact">
            <Field label="Name">{req.name}</Field>
            <Field label="Email"><a href={`mailto:${req.email}`} className="text-sky-400 hover:underline">{req.email}</a></Field>
            <Field label="Phone">{req.phone ? <a href={`tel:${req.phone}`} className="text-sky-400 hover:underline">{req.phone}</a> : '—'}</Field>
            <Field label="Business">{req.business_name ?? '—'}</Field>
            {req.lead && (
              <Field label="From lead">
                <Link href={`/leads/${req.lead.id}`} className="text-sky-400 hover:underline">
                  {req.lead.business_name || 'View lead'}
                </Link>
              </Field>
            )}
          </Card>

          <Card title="Project">
            <Field label="Business type">{fmt(req.business_type)}{req.sub_category ? ` · ${req.sub_category}` : ''}</Field>
            <Field label="Pages">
              {req.pages && req.pages.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {req.pages.map((p) => (
                    <span key={p} className="text-[11px] bg-gray-800 text-gray-300 rounded px-1.5 py-0.5">{p}</span>
                  ))}
                </div>
              ) : '—'}
            </Field>
            <Field label="Logo">{fmt(req.logo_status)}</Field>
            <Field label="Domain">{fmt(req.domain_status)}</Field>
            <Field label="Launch timing">{fmt(req.launch_timing)}</Field>
            <Field label="Budget band">{fmt(req.budget_band)}</Field>
          </Card>

          <Card title="Scheduling">
            <Field label="Preferred days">
              {req.preferred_days && req.preferred_days.length > 0 ? req.preferred_days.join(', ') : '—'}
            </Field>
            <Field label="Preferred times">
              {req.preferred_times && req.preferred_times.length > 0 ? req.preferred_times.join(', ') : '—'}
            </Field>
            <Field label="Notes">{req.scheduling_notes ?? '—'}</Field>
          </Card>

          <Card title="Description">
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{req.description ?? '—'}</p>
            {req.referral_source && (
              <p className="mt-3 text-xs text-gray-500">Heard about us via: {req.referral_source}</p>
            )}
          </Card>

          {req.site_id && <HealthCheckPanel siteId={req.site_id} />}

          {req.site_id && (
            <LaunchConfigCard
              launchRequestId={req.id}
              initial={req.launch_config}
              initialPriceCents={req.launch_service_price_cents ?? 39900}
              onSaved={(config, priceCents) =>
                setReq((prev) =>
                  prev
                    ? { ...prev, launch_config: config, launch_service_price_cents: priceCents }
                    : prev,
                )
              }
            />
          )}

          {req.site_id && req.launch_config && (
            <SendToClientCard
              launchRequest={req}
              onUpdated={(next) => setReq((prev) => (prev ? { ...prev, ...next } : prev))}
            />
          )}
        </div>

        {/* Right: pipeline controls */}
        <div className="space-y-4">
          <Card title="Status">
            <select
              value={req.status}
              onChange={(e) => update({ status: e.target.value })}
              disabled={saving}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{fmt(s)}</option>
              ))}
            </select>
          </Card>

          <Card title="Assignee">
            <select
              value={req.assignee_user_id ?? ''}
              onChange={(e) => update({ assignee_user_id: e.target.value || null })}
              disabled={saving}
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            >
              <option value="">Unassigned</option>
              {(req.assignee_options ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.business_name || a.email}{a.is_admin ? ' · admin' : ''}
                </option>
              ))}
            </select>
          </Card>

          <Card title="Build site">
            {req.site ? (
              <div className="space-y-2 text-sm">
                <p className="text-gray-300">
                  <span className="text-gray-500">Site:</span> {req.site.site_slug || req.site.id}
                </p>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sky-400 hover:underline break-all"
                  >
                    {previewUrl}
                  </a>
                )}
                <button
                  onClick={() => update({ site_id: null })}
                  disabled={saving}
                  className="text-xs text-red-400 hover:text-red-300 mt-2"
                >
                  Unlink
                </button>
              </div>
            ) : (
              <SiteLinker onLink={(siteId) => update({ site_id: siteId })} disabled={saving} />
            )}
          </Card>

          <Card title="Stripe payment link">
            <input
              type="url"
              value={stripeUrl}
              onChange={(e) => setStripeUrl(e.target.value)}
              placeholder="https://buy.stripe.com/..."
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            <button
              onClick={() => update({ stripe_checkout_url: stripeUrl.trim() || null })}
              disabled={saving || stripeUrl === (req.stripe_checkout_url ?? '')}
              className="mt-2 w-full rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              Save link
            </button>
            {req.stripe_checkout_url && (
              <a
                href={req.stripe_checkout_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block text-xs text-sky-400 hover:underline break-all"
              >
                Current: {req.stripe_checkout_url}
              </a>
            )}
          </Card>

          <Card title="Internal notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              placeholder="Private notes for the team…"
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
            />
            <button
              onClick={() => update({ notes: notes.trim() || null })}
              disabled={saving || notes === (req.notes ?? '')}
              className="mt-2 w-full rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              Save notes
            </button>
          </Card>
        </div>
      </div>
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
    <div className="grid grid-cols-[110px_1fr] gap-3 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200">{children}</span>
    </div>
  );
}

function SiteLinker({ onLink, disabled }: { onLink: (siteId: string) => void; disabled: boolean }) {
  const [val, setVal] = useState('');
  return (
    <div>
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Site UUID…"
        className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
      />
      <button
        onClick={() => val.trim() && onLink(val.trim())}
        disabled={disabled || !val.trim()}
        className="mt-2 w-full rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 text-xs font-medium text-white transition-colors"
      >
        Link site
      </button>
      <p className="mt-2 text-[11px] text-gray-500">
        Set this once you scaffold the site in the internal build account. The preview link becomes available here.
      </p>
    </div>
  );
}
