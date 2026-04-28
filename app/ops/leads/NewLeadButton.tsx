'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { LEAD_SOURCES, LEAD_SOURCE_LABELS, type LeadSource } from '@/lib/ops/leads';

const INPUT_CLASSES =
  'w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500';

export default function NewLeadButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contactName, setContactName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState<LeadSource>('cold_call');
  const [sourceDetail, setSourceDetail] = useState('');

  function reset() {
    setContactName('');
    setBusinessName('');
    setEmail('');
    setPhone('');
    setSource('cold_call');
    setSourceDetail('');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/ops/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: contactName.trim() || null,
          business_name: businessName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          source,
          source_detail: sourceDetail.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Create failed');
      }
      const lead = await res.json();
      reset();
      setOpen(false);
      router.push(`/leads/${lead.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
      >
        + New lead
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
                <h3 className="text-sm font-semibold text-white">New lead</h3>
                <button
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  className="text-gray-500 hover:text-white text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
                <Field label="Contact name">
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Jane Doe"
                    className={INPUT_CLASSES}
                  />
                </Field>

                <Field label="Business name">
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Doe Plumbing Co."
                    className={INPUT_CLASSES}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@doeplumbing.com"
                      className={INPUT_CLASSES}
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className={INPUT_CLASSES}
                    />
                  </Field>
                </div>

                <Field label="Source">
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as LeadSource)}
                    className={INPUT_CLASSES}
                  >
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {LEAD_SOURCE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Source detail (campaign, event, referrer…)">
                  <input
                    type="text"
                    value={sourceDetail}
                    onChange={(e) => setSourceDetail(e.target.value)}
                    placeholder="e.g. Chamber meetup 2026-04, referred by Aaron"
                    className={INPUT_CLASSES}
                  />
                </Field>

                {error && (
                  <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2">
                    {error}
                  </p>
                )}

                <p className="text-[11px] text-gray-500">
                  Provide at least one of contact name, business, email, or phone. You can fill in research on the next screen.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      reset();
                    }}
                    className="rounded-md bg-gray-800 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Creating…' : 'Create lead'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
