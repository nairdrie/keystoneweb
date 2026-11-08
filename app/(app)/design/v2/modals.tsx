'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, History, ImageIcon, Link2, List, Loader2, MessageSquare, Plus, RotateCcw, Search, Share2, Upload, X } from 'lucide-react';
import ArchieAIIcon from '@/app/components/ArchieAIIcon';
import { editorOp, type InstanceContent, type PageInfo } from './api';
import { ContentForm, type PanelActions } from './panels';

export function Modal({ title, icon, onClose, children, wide }: { title: string; icon?: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-[90vh] w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}>
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3.5">
          {icon}
          <h2 className="flex-1 text-[15px] font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

// ── Image picker ─────────────────────────────────────────────────────────────

interface Photo { id: string; urls: { small: string; regular: string }; alt: string; photographer?: { name: string }; downloadEndpoint?: string }

export function MediaModal({
  siteId,
  current,
  aspect,
  withAlt,
  onClose,
  onChoose,
}: {
  siteId: string;
  current?: { src?: string; alt?: string };
  aspect?: string;
  withAlt: boolean;
  onClose: () => void;
  onChoose: (value: { src: string; alt?: string }) => Promise<void> | void;
}) {
  const [tab, setTab] = useState<'upload' | 'library' | 'stock'>('upload');
  const [src, setSrc] = useState(current?.src || '');
  const [alt, setAlt] = useState(current?.alt || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [library, setLibrary] = useState<Array<{ name: string; url: string }> | null>(null);
  const [query, setQuery] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab !== 'library' || library) return;
    fetch(`/api/sites/upload-image?siteId=${siteId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setLibrary(Array.isArray(d.images) ? d.images : []))
      .catch(() => setLibrary([]));
  }, [tab, library, siteId]);

  const upload = async (form: FormData) => {
    setBusy(true);
    setError('');
    try {
      form.set('siteId', siteId);
      const res = await fetch('/api/sites/upload-image', { method: 'POST', body: form, credentials: 'include' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Upload failed');
      setSrc(body.imageUrl);
      return body.imageUrl as string;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/unsplash?query=${encodeURIComponent(query)}&per_page=24`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Search failed');
      setPhotos(body.photos || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const chooseStock = async (photo: Photo) => {
    const form = new FormData();
    form.set('imageUrl', photo.urls.regular);
    const url = await upload(form);
    if (url && !alt) setAlt(photo.alt || '');
    if (photo.downloadEndpoint) {
      fetch('/api/unsplash/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ downloadEndpoint: photo.downloadEndpoint }),
      }).catch(() => {});
    }
  };

  return (
    <Modal title="Choose an image" icon={<ImageIcon className="h-4 w-4 text-slate-500" />} onClose={onClose} wide>
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
        {(['upload', 'library', 'stock'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-md px-3 py-1.5 ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {t === 'upload' ? 'Upload' : t === 'library' ? 'Your images' : 'Free photos'}
          </button>
        ))}
      </div>

      {tab === 'upload' && (
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-10 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600"
        >
          <Upload className="h-6 w-6" />
          Click to upload a photo (JPG, PNG, WebP — up to 10MB)
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const form = new FormData();
              form.set('file', file);
              void upload(form);
            }}
          />
        </button>
      )}

      {tab === 'library' && (
        <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {library === null && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
          {library?.length === 0 && <p className="col-span-4 text-sm text-slate-500">No uploaded images yet.</p>}
          {library?.map((img) => (
            <button key={img.url} onClick={() => setSrc(img.url)} className={`aspect-square overflow-hidden rounded-lg border-2 ${src === img.url ? 'border-blue-500' : 'border-transparent'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {tab === 'stock' && (
        <div>
          <form onSubmit={(e) => { e.preventDefault(); void search(); }} className="mb-3 flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search free photos, e.g. roofing crew" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button className="rounded-lg bg-slate-900 px-3 text-white" aria-label="Search"><Search className="h-4 w-4" /></button>
          </form>
          <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {photos.map((p) => (
              <button key={p.id} onClick={() => void chooseStock(p)} title={p.photographer?.name ? `Photo by ${p.photographer.name} on Unsplash` : undefined} className="aspect-square overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.urls.small} alt={p.alt} className="h-full w-full object-cover transition hover:scale-105" />
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex items-start gap-4 border-t border-slate-100 pt-4">
        <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100" style={aspect ? { aspectRatio: aspect.replace('/', ' / '), height: 'auto' } : undefined}>
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          {withAlt && (
            <label className="block text-xs font-medium text-slate-600">
              Describe the image (for search engines and screen readers)
              <input value={alt} onChange={(e) => setAlt(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
            </label>
          )}
          {aspect && <p className="text-xs text-slate-400">This spot is designed for a {aspect} image; it will be cropped to fit.</p>}
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
        <button
          disabled={!src || busy}
          onClick={async () => {
            setBusy(true);
            await onChoose({ src, ...(withAlt ? { alt } : {}) });
            setBusy(false);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Use this image
        </button>
      </div>
    </Modal>
  );
}

// ── Link editor ──────────────────────────────────────────────────────────────

export function LinkModal({
  pages,
  current,
  hrefOnly,
  onClose,
  onSave,
}: {
  pages: PageInfo[];
  current: { href?: string; label?: string; newTab?: boolean };
  hrefOnly?: boolean;
  onClose: () => void;
  onSave: (value: { href: string; label?: string; newTab: boolean }) => Promise<void> | void;
}) {
  const pageHref = (slug: string) => (slug === 'home' ? '/' : `/${slug}`);
  const initialHref = (current.href || '').replace(/^\/v2r\/draft\/[^/]+/, '') || '/';
  const matched = pages.find((p) => pageHref(p.slug) === initialHref);
  const [mode, setMode] = useState<'page' | 'url'>(matched || initialHref.startsWith('/') ? 'page' : 'url');
  const [page, setPage] = useState(matched?.slug || 'home');
  const [url, setUrl] = useState(matched ? '' : initialHref);
  const [label, setLabel] = useState(current.label ? current.label.replace(/<[^>]+>/g, '') : '');
  const [newTab, setNewTab] = useState(!!current.newTab);
  const [busy, setBusy] = useState(false);

  return (
    <Modal title="Edit link" icon={<Link2 className="h-4 w-4 text-slate-500" />} onClose={onClose}>
      {!hrefOnly && (
        <label className="mb-4 block text-sm font-medium text-slate-700">
          Button text
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
        </label>
      )}
      <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
        <button onClick={() => setMode('page')} className={`flex-1 rounded-md px-3 py-1.5 ${mode === 'page' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>A page on this site</button>
        <button onClick={() => setMode('url')} className={`flex-1 rounded-md px-3 py-1.5 ${mode === 'url' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Web address, phone or email</button>
      </div>
      {mode === 'page' ? (
        <select value={page} onChange={(e) => setPage(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {pages.map((p) => <option key={p.id} value={p.slug}>{p.navLabel || p.title}</option>)}
        </select>
      ) : (
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… or tel:… or mailto:…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      )}
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={newTab} onChange={(e) => setNewTab(e.target.checked)} /> Open in a new tab
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            let href = mode === 'page' ? pageHref(page) : url.trim();
            if (mode === 'url' && href && !/^(https?:|mailto:|tel:|\/|#)/i.test(href)) href = `https://${href}`;
            await onSave({ href: href || '#', ...(hrefOnly ? {} : { label }), newTab });
            setBusy(false);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save link
        </button>
      </div>
    </Modal>
  );
}

// ── History ──────────────────────────────────────────────────────────────────

interface Version { id: string; kind: 'publish' | 'snapshot'; label: string | null; created_at: string; created_by: string | null; isLive: boolean }

function who(createdBy: string | null): string {
  if (!createdBy) return 'Unknown';
  const [type, ...rest] = createdBy.split(':');
  const label = rest.join(':');
  if (type === 'owner') return 'You';
  if (type === 'agent') return `AI designer${label ? ` (${label.split(' · ')[0]})` : ''}`;
  return 'Keystone team';
}

export function HistoryModal({ siteId, onClose, onRestored }: { siteId: string; onClose: () => void; onRestored: () => void }) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    editorOp<{ versions: Version[] }>(siteId, 'versions')
      .then((d) => setVersions(d.versions))
      .catch((e) => setError(e.message));
  }, [siteId]);

  return (
    <Modal title="History" icon={<History className="h-4 w-4 text-slate-500" />} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-500">Keystone saves a restore point before changes. Restoring brings that version back into the editor; your live site only changes when you publish.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!versions && !error && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
      <ul className="divide-y divide-slate-100">
        {versions?.map((v) => (
          <li key={v.id} className="flex items-center gap-3 py-2.5">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">
                {v.kind === 'publish' ? 'Published' : v.label || 'Restore point'}
                {v.isLive && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Live</span>}
              </p>
              <p className="text-xs text-slate-500">{new Date(v.created_at).toLocaleString()} · {who(v.created_by)}</p>
            </div>
            <button
              disabled={!!busy}
              onClick={async () => {
                if (!confirm('Bring back this version? Your current draft is saved as a restore point first.')) return;
                setBusy(v.id);
                try {
                  await editorOp(siteId, 'restore', { versionId: v.id });
                  onRestored();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(null);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              {busy === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restore
            </button>
          </li>
        ))}
        {versions?.length === 0 && <li className="py-3 text-sm text-slate-500">No saved versions yet.</li>}
      </ul>
    </Modal>
  );
}

// ── Add a section ────────────────────────────────────────────────────────────

export function AddSectionModal({
  designs,
  usedOnPage,
  onClose,
  onChoose,
  onAskArchie,
}: {
  designs: Array<{ key: string; name: string }>;
  usedOnPage: Set<string>;
  onClose: () => void;
  onChoose: (sectionKey: string) => void;
  onAskArchie: () => void;
}) {
  return (
    <Modal title="Add a section" icon={<Plus className="h-4 w-4 text-slate-500" />} onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500">These sections were designed for your site. Pick one to add it here, then change its words and pictures on the page.</p>
      <div className="grid gap-1.5">
        {designs.map((s) => (
          <button key={s.key} onClick={() => onChoose(s.key)} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:border-blue-400 hover:bg-blue-50/50">
            {s.name}
            {usedOnPage.has(s.key) && <span className="text-xs font-normal text-slate-400">On this page</span>}
          </button>
        ))}
        {designs.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No section designs yet.</p>}
      </div>
      <button onClick={onAskArchie} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-50 px-3 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-100">
        <ArchieAIIcon className="h-4 w-4" /> Need something different? Ask Archie to design it
      </button>
    </Modal>
  );
}

// ── All content of one section (for things you can't click on the page) ────

export function SectionContentModal({ name, content, actions, onClose }: { name: string; content: InstanceContent; actions: PanelActions; onClose: () => void }) {
  return (
    <Modal title={name} icon={<List className="h-4 w-4 text-slate-500" />} onClose={onClose}>
      <p className="mb-4 text-xs text-slate-500">Everything you can change in this section, including things that only show on phones, in menus or in slideshows. Changes save as you go.</p>
      <ContentForm content={content} actions={actions} />
    </Modal>
  );
}

// ── Request a change ─────────────────────────────────────────────────────────

// ── Share draft preview ──────────────────────────────────────────────────────

/**
 * /preview?siteId=… never expires: each visit redirects to a fresh signed
 * /v2r/draft link (app/preview/page.tsx), so the shared URL keeps working.
 */
export function SharePreviewModal({ siteId, appUrl, page, onClose }: { siteId: string; appUrl: string; page: PageInfo; onClose: () => void }) {
  const canLinkPage = page.slug !== 'home' && page.template !== 'post';
  const [scope, setScope] = useState<'page' | 'site'>(canLinkPage ? 'page' : 'site');
  const [copied, setCopied] = useState(false);
  const origin = (appUrl || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const url = `${origin}/preview?siteId=${encodeURIComponent(siteId)}${scope === 'page' ? `&pageId=${encodeURIComponent(page.id)}` : ''}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal title="Share a preview" icon={<Share2 className="h-4 w-4 text-slate-500" />} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-500">
        Anyone with this link can see your latest changes before you publish. They don&apos;t need an account, and the link always shows the current draft.
      </p>
      {canLinkPage && (
        <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          <button onClick={() => setScope('page')} className={`flex-1 rounded-md px-2.5 py-1 ${scope === 'page' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>
            This page ({page.navLabel || page.title})
          </button>
          <button onClick={() => setScope('site')} className={`flex-1 rounded-md px-2.5 py-1 ${scope === 'site' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>
            Home page
          </button>
        </div>
      )}
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="mb-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600"
        aria-label="Preview link"
      />
      <div className="flex gap-2">
        <button onClick={() => void copy()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied!' : 'Copy link'}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
          <ExternalLink className="h-4 w-4" /> Open preview
        </a>
      </div>
    </Modal>
  );
}

export function ChangeRequestModal({ siteId, pageSlug, instance, onClose, onSent }: { siteId: string; pageSlug?: string; instance?: string | null; onClose: () => void; onSent: () => void }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal title="Ask the Keystone team" icon={<MessageSquare className="h-4 w-4 text-slate-500" />} onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500">Need something bigger — a new section, a layout change, a new page design? Tell us and our designers will take care of it.</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        placeholder="e.g. Add a section with our three service packages and prices."
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        autoFocus
      />
      {(pageSlug || instance) && <p className="mt-2 text-xs text-slate-400">We&apos;ll include the page{instance ? ' and section' : ''} you&apos;re on.</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
        <button
          disabled={busy || message.trim().length < 5}
          onClick={async () => {
            setBusy(true);
            try {
              await editorOp(siteId, 'change-request', { message, pageSlug, instance });
              onSent();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send request
        </button>
      </div>
    </Modal>
  );
}
