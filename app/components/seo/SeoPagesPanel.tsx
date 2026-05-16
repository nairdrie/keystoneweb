'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, CheckCircle, AlertCircle, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';

interface SeoFields {
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  canonical?: string;
  robotsNoindex?: boolean;
  robotsNofollow?: boolean;
}

interface PageRow {
  id: string;
  slug: string;
  title: string;
  displayName: string;
  updatedAt: string;
  seo: SeoFields;
  publishedSeo: SeoFields;
}

interface SeoPagesPanelProps {
  siteId: string | undefined;
}

export default function SeoPagesPanel({ siteId }: SeoPagesPanelProps) {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SeoFields>({});
  const [draftSlug, setDraftSlug] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const selected = useMemo(() => pages.find(p => p.id === selectedId) ?? null, [pages, selectedId]);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    fetch(`/api/seo/pages?siteId=${siteId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { pages: [] })
      .then(data => {
        setPages(data.pages || []);
        if (data.pages?.length && !selectedId) setSelectedId(data.pages[0].id);
      })
      .finally(() => setLoading(false));
  }, [siteId, selectedId]);

  useEffect(() => {
    if (selected) {
      setDraft(selected.seo || {});
      setDraftSlug(selected.slug);
      setSaveStatus('idle');
      setStatusMessage('');
    }
  }, [selected]);

  if (!siteId) {
    return <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">Select a site to manage SEO.</div>;
  }

  const update = (patch: Partial<SeoFields>) => setDraft(prev => ({ ...prev, ...patch }));

  const saveSeo = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/seo/pages', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, pageId: selected.id, seo: draft }),
      });
      if (!res.ok) throw new Error('save failed');
      setSaveStatus('success');
      setStatusMessage('SEO saved. Publish your site to make changes live.');
      setPages(prev => prev.map(p => p.id === selected.id ? { ...p, seo: draft } : p));
    } catch {
      setSaveStatus('error');
      setStatusMessage('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renameSlug = async () => {
    if (!selected) return;
    const normalized = draftSlug.trim();
    if (!normalized || normalized === selected.slug) return;
    if (selected.slug === 'home') {
      setSaveStatus('error');
      setStatusMessage('The home page slug cannot be changed.');
      return;
    }
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/seo/pages/slug', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, pageId: selected.id, newSlug: normalized, createRedirect: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'rename failed');
      setSaveStatus('success');
      setStatusMessage(
        data.redirectCreated
          ? `Slug renamed to '${data.slug}'. A 301 redirect from /${data.previousSlug} was created automatically.`
          : `Slug renamed to '${data.slug}'.`,
      );
      setPages(prev => prev.map(p => p.id === selected.id ? { ...p, slug: data.slug } : p));
    } catch (err) {
      setSaveStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Failed to rename slug.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Pages</h3>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
            {pages.map(p => {
              const isMissing = !p.seo?.seoTitle || !p.seo?.seoDescription;
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 ${
                      selectedId === p.id ? 'bg-slate-100' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{p.displayName || p.title}</div>
                      <div className="text-xs text-slate-500 font-mono truncate">/{p.slug === 'home' ? '' : p.slug}</div>
                    </div>
                    {isMissing && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-600">Needs SEO</span>}
                  </button>
                </li>
              );
            })}
            {pages.length === 0 && <li className="p-4 text-sm text-slate-500">No pages yet.</li>}
          </ul>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        {!selected ? (
          <div className="p-6 text-sm text-slate-500">Select a page to edit its SEO.</div>
        ) : (
          <div className="p-5 space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{selected.displayName || selected.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">SEO for this page only — site-level defaults apply when a field is blank.</p>
            </div>

            <Field label="URL slug" hint="Renaming creates an automatic 301 redirect from the old slug.">
              <div className="flex items-stretch gap-2">
                <div className="flex items-stretch border border-slate-300 rounded-md overflow-hidden flex-1">
                  <span className="px-2 inline-flex items-center text-xs text-slate-400 font-mono bg-slate-50">/</span>
                  <input
                    type="text"
                    value={draftSlug}
                    onChange={e => setDraftSlug(e.target.value)}
                    disabled={selected.slug === 'home'}
                    className="flex-1 px-2 py-1.5 text-sm focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
                <button
                  onClick={renameSlug}
                  disabled={saving || selected.slug === 'home' || draftSlug.trim() === selected.slug}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  Rename
                </button>
              </div>
            </Field>

            <Field
              label="SEO title"
              counter={`${(draft.seoTitle ?? '').length} / 60`}
              warn={(draft.seoTitle ?? '').length > 60}
            >
              <input
                type="text"
                value={draft.seoTitle ?? ''}
                onChange={e => update({ seoTitle: e.target.value })}
                placeholder="Shown in search results and browser tabs"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </Field>

            <Field
              label="Meta description"
              counter={`${(draft.seoDescription ?? '').length} / 160`}
              warn={(draft.seoDescription ?? '').length > 160}
            >
              <textarea
                value={draft.seoDescription ?? ''}
                onChange={e => update({ seoDescription: e.target.value })}
                rows={3}
                placeholder="Shown beneath your page title in search results"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </Field>

            <Field label="Open Graph image URL" hint="Used for Facebook, LinkedIn and most link unfurls. 1200×630 recommended.">
              <div className="flex items-stretch gap-2">
                <span className="px-2 inline-flex items-center text-slate-400 border border-slate-300 border-r-0 rounded-l-md bg-slate-50">
                  <ImageIcon className="w-4 h-4" />
                </span>
                <input
                  type="url"
                  value={draft.ogImage ?? ''}
                  onChange={e => update({ ogImage: e.target.value })}
                  placeholder="https://…"
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </Field>

            <Field label="Canonical URL override" hint="Leave blank to use the page's natural URL. Set this only if this page duplicates content from elsewhere.">
              <div className="flex items-stretch gap-2">
                <span className="px-2 inline-flex items-center text-slate-400 border border-slate-300 border-r-0 rounded-l-md bg-slate-50">
                  <LinkIcon className="w-4 h-4" />
                </span>
                <input
                  type="url"
                  value={draft.canonical ?? ''}
                  onChange={e => update({ canonical: e.target.value })}
                  placeholder="https://…"
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </Field>

            <div className="border-t border-slate-100 pt-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">Indexing</div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!draft.robotsNoindex}
                    onChange={e => update({ robotsNoindex: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  Hide this page from search engines (<code className="text-xs">noindex</code>)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!draft.robotsNofollow}
                    onChange={e => update({ robotsNofollow: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  Don&rsquo;t pass link authority from this page (<code className="text-xs">nofollow</code>)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                {saveStatus === 'success' && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                {saveStatus === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
                {statusMessage}
              </div>
              <button
                onClick={saveSeo}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save SEO
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  counter,
  warn,
  children,
}: {
  label: string;
  hint?: string;
  counter?: string;
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</label>
        {counter && (
          <span className={`text-[11px] font-mono ${warn ? 'text-amber-600' : 'text-slate-400'}`}>{counter}</span>
        )}
      </div>
      {children}
      {hint && <p className="text-[11px] text-slate-500 leading-relaxed">{hint}</p>}
    </div>
  );
}
