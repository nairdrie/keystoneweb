'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type OperatorSite = {
  id: string;
  site_slug: string | null;
  business_type: string | null;
  is_published: boolean;
  published_domain: string | null;
  custom_domain: string | null;
};

export default function NewClientButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sites, setSites] = useState<OperatorSite[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [siteId, setSiteId] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setSitesLoading(true);
    fetch('/api/ops/launch')
      .then((r) => r.json())
      .then((data) => setSites(data.sites ?? []))
      .catch(() => setSites([]))
      .finally(() => setSitesLoading(false));
  }, [open]);

  function reset() {
    setName('');
    setEmail('');
    setBusinessName('');
    setSiteId('');
    setError(null);
    setSubmitting(false);
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/ops/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          businessName: businessName || undefined,
          siteId: siteId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Create failed');
        setSubmitting(false);
        return;
      }
      setOpen(false);
      reset();
      router.push(`/ops/launch/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
      >
        + New Client
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => !submitting && (setOpen(false), reset())}
        >
          <div
            className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white">New launch client</h2>
            <p className="mt-1 text-xs text-gray-500">
              Manually add a client to the launch pipeline. Defaults to status &ldquo;Building&rdquo;.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400">Business name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Doe Salon"
                  className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400">
                  Attach a site you&apos;ve built
                </label>
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  disabled={sitesLoading}
                  className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
                >
                  <option value="">{sitesLoading ? 'Loading…' : '— none —'}</option>
                  {sites.map((s) => {
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
                <p className="mt-1 text-[11px] text-gray-600">
                  Only your own sites are listed. You can attach one later from the detail page.
                </p>
              </div>

              {error && (
                <p className="rounded border border-red-900 bg-red-950 px-3 py-2 text-xs text-red-300">
                  {error}
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                disabled={submitting}
                className="rounded-md px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting || !name || !email}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
