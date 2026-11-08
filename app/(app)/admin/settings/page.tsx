'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Loader2, Send, Trash2 } from 'lucide-react';
import { useAdminContext } from '../admin-context';
import SiteLimitModal from '@/app/components/SiteLimitModal';

// Site-level lifecycle actions: hand the site to someone else, copy it, or
// delete it. These used to live in the v1 editor's settings drawer; the v2
// editor is content-only, so they live here in Admin now.
export default function AdminSettingsPage() {
  const router = useRouter();
  const { siteId, site, siteTitle } = useAdminContext();
  const customDomain = site?.customDomain;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900">Site Settings</h2>
        <p className="text-sm text-slate-500 mt-1">Transfer, copy, or delete this site.</p>
      </div>

      <TransferCard siteId={siteId} customDomain={customDomain} />
      <DuplicateCard siteId={siteId} onDone={(id) => router.push(`/editor?siteId=${encodeURIComponent(id)}`)} onManageSites={() => router.push('/admin')} />
      <DeleteCard siteId={siteId} siteTitle={siteTitle} customDomain={customDomain} onDone={() => router.push('/')} />
    </div>
  );
}

function Card({ title, description, danger, children }: { title: string; description: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border bg-white p-5 ${danger ? 'border-red-200' : 'border-slate-200'}`}>
      <h3 className={`text-sm font-bold ${danger ? 'text-red-700' : 'text-slate-900'}`}>{title}</h3>
      <p className="text-sm text-slate-500 mt-1 mb-4">{description}</p>
      {children}
    </section>
  );
}

function TransferCard({ siteId, customDomain }: { siteId: string | null; customDomain?: string }) {
  const [email, setEmail] = useState('');
  const [includeDomain, setIncludeDomain] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId || !email.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/sites/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId, recipientEmail: email.trim(), includeDomain: Boolean(customDomain) && includeDomain }),
      });
      if (res.ok) {
        setSentTo(email.trim());
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Failed to send transfer.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card
      title="Transfer ownership"
      description="Send this site to someone else. They'll get an email with a link to claim it, which expires in 7 days. You keep the site until they accept."
    >
      {sentTo ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-1">
          <p className="text-sm font-semibold text-green-800">Transfer email sent</p>
          <p className="text-sm text-green-700">We emailed <strong>{sentTo}</strong>. They have 7 days to claim the site.</p>
          <button
            type="button"
            onClick={() => { setSentTo(null); setEmail(''); setIncludeDomain(false); setError(null); }}
            className="text-sm text-green-700 underline hover:no-underline"
          >
            Send to someone else
          </button>
        </div>
      ) : (
        <form onSubmit={send} className="space-y-3">
          <label className="block">
            <span className="sr-only">Recipient email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </label>
          {customDomain && (
            <label className="flex cursor-pointer select-none items-center gap-2">
              <input type="checkbox" checked={includeDomain} onChange={(e) => setIncludeDomain(e.target.checked)} className="h-4 w-4 accent-blue-600" />
              <span className="text-sm text-slate-600">
                Include the domain <span className="font-mono text-slate-800">{customDomain}</span>
              </span>
            </label>
          )}
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={sending || !email.trim() || !siteId}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Sending…' : 'Send transfer email'}
          </button>
        </form>
      )}
    </Card>
  );
}

function DuplicateCard({ siteId, onDone, onManageSites }: { siteId: string | null; onDone: (newSiteId: string) => void; onManageSites: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<{ plan: string; limit: number } | null>(null);

  const duplicate = async () => {
    if (!siteId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/sites/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.siteId) {
        onDone(data.siteId);
        return;
      }
      if (data?.siteLimitReached) setLimit({ plan: data.plan, limit: data.limit });
      else setError(data?.error || 'Failed to duplicate site.');
    } catch {
      setError('An unexpected error occurred.');
    }
    setBusy(false);
  };

  return (
    <Card
      title="Duplicate site"
      description="Create a copy of this site as a new draft, including its pages and content. Domains and published status are not copied."
    >
      {error && <p className="mb-3 text-sm text-red-600" role="alert">{error}</p>}
      <button
        type="button"
        onClick={duplicate}
        disabled={busy || !siteId}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
        {busy ? 'Duplicating…' : 'Duplicate site'}
      </button>
      {limit && (
        <SiteLimitModal
          plan={limit.plan}
          limit={limit.limit}
          onDismiss={() => setLimit(null)}
          onManageSites={() => { setLimit(null); onManageSites(); }}
        />
      )}
    </Card>
  );
}

function DeleteCard({ siteId, siteTitle, customDomain, onDone }: { siteId: string | null; siteTitle: string; customDomain?: string; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phrase = siteTitle || 'delete';

  const remove = async () => {
    if (!siteId || text !== phrase) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/sites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteId }),
      });
      if (res.ok) {
        onDone();
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error || 'Failed to delete site.');
    } catch {
      setError('An unexpected error occurred.');
    }
    setBusy(false);
  };

  return (
    <Card danger title="Delete site" description="Permanently delete this site, all its pages, and all associated data. This cannot be undone.">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!siteId}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" /> Delete site
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
          {customDomain && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm font-medium text-blue-800">
                Your domain <strong className="font-mono">{customDomain}</strong> stays yours.
              </p>
              <p className="mt-0.5 text-xs text-blue-600">
                It remains in your account until your current billing cycle ends. You can reassign it to another site from Account Settings.
              </p>
            </div>
          )}
          <label className="block">
            <span className="text-sm text-red-700">Type <strong>{phrase}</strong> to confirm:</span>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={phrase}
              autoFocus
              className="mt-1 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </label>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setConfirming(false); setText(''); setError(null); }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy || text !== phrase}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
