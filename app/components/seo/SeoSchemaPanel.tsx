'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Code2, Copy, Check } from 'lucide-react';

interface SchemaEntry {
  key: string;
  type: string;
  source: string;
  data: Record<string, unknown>;
}

interface PageRow {
  id: string;
  slug: string;
  title: string;
  displayName: string;
}

interface SeoSchemaPanelProps {
  siteId: string | undefined;
}

export default function SeoSchemaPanel({ siteId }: SeoSchemaPanelProps) {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [pageId, setPageId] = useState<string | null>(null);
  const [entries, setEntries] = useState<SchemaEntry[]>([]);
  const [pageUrl, setPageUrl] = useState<string>('');
  const [loadingPages, setLoadingPages] = useState<boolean>(!!siteId);
  const [loadingEntries, setLoadingEntries] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    fetch(`/api/seo/pages?siteId=${siteId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { pages: [] })
      .then(data => {
        if (cancelled) return;
        setPages(data.pages || []);
        if (data.pages?.length) {
          const home = data.pages.find((p: PageRow) => p.slug === 'home') || data.pages[0];
          setPageId(home.id);
        }
      })
      .finally(() => { if (!cancelled) setLoadingPages(false); });
    return () => { cancelled = true; };
  }, [siteId]);

  useEffect(() => {
    if (!siteId || !pageId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingEntries(true);
    fetch(`/api/seo/schema-preview?siteId=${siteId}&pageId=${pageId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { entries: [] })
      .then(data => {
        if (cancelled) return;
        setEntries(data.entries || []);
        setPageUrl(data.pageUrl || '');
      })
      .finally(() => { if (!cancelled) setLoadingEntries(false); });
    return () => { cancelled = true; };
  }, [siteId, pageId]);

  const grouped = useMemo(() => {
    const m = new Map<string, SchemaEntry[]>();
    for (const e of entries) {
      const arr = m.get(e.type) || [];
      arr.push(e);
      m.set(e.type, arr);
    }
    return Array.from(m.entries());
  }, [entries]);

  const copy = async (entry: SchemaEntry) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry.data, null, 2));
      setCopiedKey(entry.key);
      setTimeout(() => setCopiedKey(k => (k === entry.key ? null : k)), 1500);
    } catch {
      /* ignored */
    }
  };

  if (!siteId) {
    return <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">Select a site to view its structured data.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-slate-400" /> Structured data preview
            </h3>
            <p className="text-xs text-slate-500 mt-1">Every JSON-LD block your site emits, per page. Test live with Google&rsquo;s <a href="https://search.google.com/test/rich-results" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Rich Results Test</a>.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Page</label>
            <select
              value={pageId ?? ''}
              onChange={e => setPageId(e.target.value)}
              disabled={loadingPages}
              className="text-sm border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {pages.map(p => (
                <option key={p.id} value={p.id}>
                  {p.displayName || p.title} {p.slug === 'home' ? '(home)' : `(/${p.slug})`}
                </option>
              ))}
            </select>
          </div>
        </div>
        {pageUrl && <div className="text-[11px] font-mono text-slate-500 mt-2 truncate">{pageUrl}</div>}
      </div>

      {loadingEntries ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Computing schema…
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500 text-center">
          No schema is emitted on this page yet. Add a business profile or content blocks (FAQ, Services) to populate it.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([type, list]) => (
            <div key={type} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">{type}</h4>
                <span className="text-[11px] text-slate-400">{list.length} {list.length === 1 ? 'entry' : 'entries'}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {list.map(entry => (
                  <div key={entry.key} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs text-slate-600 italic">{entry.source}</p>
                      <button
                        onClick={() => copy(entry)}
                        className="shrink-0 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                      >
                        {copiedKey === entry.key ? (
                          <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" /> Copy</>
                        )}
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono bg-slate-900 text-slate-100 rounded-md p-3 overflow-x-auto leading-relaxed">
{JSON.stringify(entry.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 leading-relaxed">
        <strong className="text-slate-700">How this works:</strong> structured data is auto-generated from your business profile,
        social links, testimonials, and content blocks (FAQ, Services). Add an FAQ block to a page to emit FAQPage schema; add a
        Services block to emit Service schemas. Site-wide LocalBusiness data is set in the <em>Site</em> tab.
      </div>
    </div>
  );
}
