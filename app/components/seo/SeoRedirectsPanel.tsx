'use client';

import { useEffect, useState } from 'react';
import { Loader2, Trash2, Plus, ArrowRight, AlertCircle, CheckCircle, Wand2 } from 'lucide-react';

interface Redirect {
  id: string;
  from_path: string;
  to_path: string;
  status_code: number;
  source: 'manual' | 'auto_slug_rename' | 'ai_suggested';
  hit_count: number;
  last_hit_at: string | null;
  created_at: string;
}

interface Log404 {
  id: string;
  path: string;
  hit_count: number;
  last_hit_at: string;
  referrer_sample: string | null;
  resolved: boolean;
}

interface PageRow {
  id: string;
  slug: string;
  title: string;
  displayName: string;
}

interface SeoRedirectsPanelProps {
  siteId: string | undefined;
}

const SOURCE_LABEL: Record<Redirect['source'], string> = {
  manual: 'Manual',
  auto_slug_rename: 'Auto (slug rename)',
  ai_suggested: 'AI suggested',
};

export default function SeoRedirectsPanel({ siteId }: SeoRedirectsPanelProps) {
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [logs, setLogs] = useState<Log404[]>([]);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestingFor, setSuggestingFor] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ logPath: string; toPath: string; reason: string } | null>(null);

  const refresh = async () => {
    if (!siteId) return;
    setLoading(true);
    const [r, l, p] = await Promise.all([
      fetch(`/api/seo/redirects?siteId=${siteId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { redirects: [] }),
      fetch(`/api/seo/404-logs?siteId=${siteId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { logs: [] }),
      fetch(`/api/seo/pages?siteId=${siteId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { pages: [] }),
    ]);
    setRedirects(r.redirects || []);
    setLogs(l.logs || []);
    setPages(p.pages || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/seo/redirects?siteId=${siteId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { redirects: [] }),
      fetch(`/api/seo/404-logs?siteId=${siteId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { logs: [] }),
      fetch(`/api/seo/pages?siteId=${siteId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : { pages: [] }),
    ]).then(([r, l, p]) => {
      if (cancelled) return;
      setRedirects(r.redirects || []);
      setLogs(l.logs || []);
      setPages(p.pages || []);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [siteId]);

  if (!siteId) {
    return <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">Select a site to manage redirects.</div>;
  }

  const handleAdd = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!from.trim() || !to.trim()) return;
    setBusy(true);
    setStatus('idle');
    try {
      const res = await fetch('/api/seo/redirects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, fromPath: from, toPath: to, source: 'manual' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      setFrom('');
      setTo('');
      setStatus('success');
      setStatusMessage('Redirect saved.');
      await refresh();
    } catch (err) {
      setStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Failed to save redirect.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/seo/redirects?id=${id}&siteId=${siteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('delete failed');
      setRedirects(prev => prev.filter(r => r.id !== id));
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async (id: string) => {
    setBusy(true);
    try {
      await fetch('/api/seo/404-logs', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, id, resolved: true }),
      });
      setLogs(prev => prev.filter(l => l.id !== id));
    } finally {
      setBusy(false);
    }
  };

  const suggestForLog = async (log: Log404) => {
    setSuggestingFor(log.id);
    setAiSuggestion(null);
    try {
      const res = await fetch('/api/seo/redirects/suggest', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, path: log.path }),
      });
      if (!res.ok) throw new Error('AI suggestion failed');
      const data = await res.json();
      setAiSuggestion({ logPath: log.path, toPath: data.toPath, reason: data.reason });
    } catch (err) {
      setAiSuggestion({
        logPath: log.path,
        toPath: '',
        reason: err instanceof Error ? err.message : 'Could not generate a suggestion.',
      });
    } finally {
      setSuggestingFor(null);
    }
  };

  const applySuggestion = async () => {
    if (!aiSuggestion || !aiSuggestion.toPath) return;
    setBusy(true);
    try {
      await fetch('/api/seo/redirects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          fromPath: aiSuggestion.logPath,
          toPath: aiSuggestion.toPath,
          source: 'ai_suggested',
        }),
      });
      setAiSuggestion(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const populateFromPath = (path: string) => {
    setFrom(path);
    document.getElementById('redirect-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <form
        id="redirect-form"
        onSubmit={handleAdd}
        className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-3"
      >
        <h3 className="text-sm font-bold text-slate-900">Add a redirect</h3>
        <p className="text-xs text-slate-500">
          When a visitor hits the &ldquo;from&rdquo; path on your site, they&rsquo;ll be 301-redirected to the &ldquo;to&rdquo; destination.
          The destination can be a path on this site (e.g. <code className="font-mono">/contact</code>) or a full URL on
          another site (e.g. <code className="font-mono">https://kswd.ca</code>).
        </p>
        <div className="flex items-stretch gap-2 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-1">From</label>
            <input
              type="text"
              value={from}
              onChange={e => setFrom(e.target.value)}
              placeholder="/contact-us"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600 mb-1">To</label>
            <input
              type="text"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="/contact or https://example.com"
              list="ks-pages-datalist"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <datalist id="ks-pages-datalist">
              {pages.map(p => <option key={p.id} value={p.slug === 'home' ? '/' : `/${p.slug}`}>{p.displayName || p.title}</option>)}
            </datalist>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={busy || !from.trim() || !to.trim()}
              className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>
        {status !== 'idle' && (
          <div className={`text-xs flex items-center gap-1.5 ${status === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
            {status === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {statusMessage}
          </div>
        )}
      </form>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Active redirects</h3>
          <span className="text-[11px] text-slate-400">{redirects.length} total</span>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : redirects.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">No redirects yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {redirects.map(r => (
              <li key={r.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <code className="text-xs font-mono text-slate-700 px-2 py-1 bg-slate-50 rounded border border-slate-200">{r.from_path}</code>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                <code className="text-xs font-mono text-slate-700 px-2 py-1 bg-slate-50 rounded border border-slate-200">{r.to_path}</code>
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{r.status_code}</span>
                <span className="text-[11px] text-slate-400 ml-auto">{SOURCE_LABEL[r.source]}</span>
                <span className="text-[11px] text-slate-500 font-mono">{r.hit_count.toLocaleString()} hits</span>
                <button
                  onClick={() => handleDelete(r.id)}
                  disabled={busy}
                  className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                  aria-label="Delete redirect"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Recent 404s</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Dead URLs visitors are hitting on your site. Create a redirect or dismiss.</p>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : logs.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">No unresolved 404s. Nice work.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map(log => (
              <li key={log.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <code className="text-xs font-mono text-slate-700 px-2 py-1 bg-slate-50 rounded border border-slate-200">{log.path}</code>
                  <span className="text-[11px] text-slate-500 font-mono">{log.hit_count.toLocaleString()} hits</span>
                  <span className="text-[11px] text-slate-400 ml-auto">{new Date(log.last_hit_at).toLocaleString()}</span>
                  <button
                    onClick={() => populateFromPath(log.path)}
                    className="text-xs text-slate-600 hover:text-slate-900 underline"
                  >
                    Redirect this
                  </button>
                  <button
                    onClick={() => suggestForLog(log)}
                    disabled={suggestingFor === log.id || busy}
                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50"
                  >
                    {suggestingFor === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    AI suggest
                  </button>
                  <button
                    onClick={() => handleResolve(log.id)}
                    disabled={busy}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Dismiss
                  </button>
                </div>
                {aiSuggestion?.logPath === log.path && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3 text-xs space-y-2">
                    {aiSuggestion.toPath ? (
                      <>
                        <div className="text-indigo-900">
                          AI suggests redirecting to <code className="font-mono font-bold">{aiSuggestion.toPath}</code>
                        </div>
                        <div className="text-indigo-700 italic">{aiSuggestion.reason}</div>
                        <div className="flex gap-2">
                          <button
                            onClick={applySuggestion}
                            className="px-3 py-1 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700"
                          >
                            Apply
                          </button>
                          <button
                            onClick={() => setAiSuggestion(null)}
                            className="px-3 py-1 text-indigo-600 text-xs font-semibold hover:underline"
                          >
                            Dismiss
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-rose-700">{aiSuggestion.reason}</div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
