'use client';

/**
 * Owner editor for agent-built (engine v2) sites.
 *
 * The page is the real site rendered in a sandboxed iframe (opaque origin), so
 * agent CSS/JS can't reach this window. Clicking text edits it in place;
 * images, links and list items open small dialogs. Everything saves
 * immediately through /api/v2/editor, with restore points in History.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2, Eye, FileText, History, Layers, LayoutDashboard, Loader2, MessageSquare, Monitor, Paintbrush, Palette, PenLine, Rocket, Smartphone, Tablet,
} from 'lucide-react';
import KeystoneLogo from '@/app/components/KeystoneLogo';
import { hasPaidAccess } from '@/lib/subscription/access';
import { editorOp, EditorApiError, loadEditorState, pagePath, type EditorState, type FieldInfo } from './api';
import { BrandPanel, BusinessPanel, PagesPanel, SectionsPanel, type PanelActions } from './panels';
import { ChangeRequestModal, HistoryModal, LinkModal, MediaModal } from './modals';

type Obj = Record<string, unknown>;
type Device = 'desktop' | 'tablet' | 'mobile';
type Tab = 'sections' | 'pages' | 'brand' | 'business';

interface Toast { id: number; text: string; tone: 'ok' | 'warn' | 'error' }

interface PickState {
  kind: 'image' | 'link';
  instance: string;
  path: string;
  field: Partial<FieldInfo> & { type: FieldInfo['type'] };
  current: Obj;
}

const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '820px', mobile: '390px' };

export default function V2Editor({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [state, setState] = useState<EditorState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [pageId, setPageId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('sections');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [device, setDevice] = useState<Device>('desktop');
  const [selected, setSelected] = useState<string | null>(null);
  const [canvasVersion, setCanvasVersion] = useState(0);
  const [pick, setPick] = useState<PickState | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stateRef = useRef<EditorState | null>(null);
  const scrollY = useRef(0);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 3500);
  }, []);

  const refresh = useCallback(async (opts: { canvas?: boolean } = { canvas: true }) => {
    try {
      const next = await loadEditorState(siteId);
      // Update synchronously: the next queued edit reads versions from here
      // before React has re-rendered.
      stateRef.current = next;
      setState(next);
      setPageId((current) => (current && next.pages.some((p) => p.id === current) ? current : next.pages[0]?.id ?? null));
      if (opts.canvas) setCanvasVersion((v) => v + 1);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [siteId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const page = useMemo(() => state?.pages.find((p) => p.id === pageId) || state?.pages[0] || null, [state, pageId]);

  // Edits run one at a time: each is a read-modify-write on the server, so
  // overlapping clicks (hide, then move) must not race each other.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const run = useCallback((fn: () => Promise<unknown>, opts: { canvas?: boolean; success?: string } = {}): Promise<void> => {
    const next = queue.current.then(async () => {
      try {
        await fn();
        await refresh({ canvas: opts.canvas !== false });
        if (opts.success) toast(opts.success);
      } catch (e) {
        const err = e as EditorApiError;
        if (err instanceof EditorApiError && err.isStale) {
          // Someone else (usually the AI designer) changed it first: show the latest version.
          await refresh({ canvas: true });
          toast(err.message || 'This was just changed by someone else. We reloaded it — please make your change again.', 'warn');
          return;
        }
        toast(err.message || 'Something went wrong', 'error');
      }
    });
    queue.current = next;
    return next;
  }, [refresh, toast]);

  // Leaving the editor (logo, Admin): let a text field that is still focused
  // send its last edit, and let queued saves finish, before navigating away.
  // Cmd/Ctrl/middle-click still opens a new tab straight away.
  const leaveTo = useCallback(async (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    await new Promise((r) => setTimeout(r, 150));
    await queue.current.catch(() => {});
    router.push(href);
  }, [router]);

  // Versions are read when a queued edit actually runs, so quick successive
  // clicks never look stale to the server — only someone else's change does.
  const revOf = (instance: string, path: string): number | undefined => {
    const field = path.split('.')[0];
    return stateRef.current?.content.find((c) => c.instance === instance)?.values[field]?.rev;
  };
  const layoutVersionOf = (pageId: string): number | undefined => stateRef.current?.pages.find((p) => p.id === pageId)?.layoutVersion;

  const saveContent = useCallback(async (instance: string, path: string, value: unknown) => {
    const r = await editorOp<{ results?: Array<{ status: string; message?: string }> }>(siteId, 'content', {
      changes: [{ instance, path, value, expected_rev: revOf(instance, path) }],
    });
    const result = r.results?.[0];
    if (result?.status === 'conflict') {
      const typed = typeof value === 'string' ? value : (value as { html?: string; label?: string })?.html || (value as { label?: string })?.label;
      const plain = typed ? String(typed).replace(/<[^>]+>/g, '').slice(0, 140) : '';
      throw new EditorApiError(
        `This was just changed by someone else, so your edit wasn't saved. We reloaded the latest version${plain ? ` — what you typed: “${plain}”` : ''}.`,
        { reason: 'stale' },
        409,
      );
    }
    if (result?.status === 'error') throw new EditorApiError(result.message || 'Could not save');
  }, [siteId]);

  // ── Actions shared by the canvas and the panels ───────────────────────────
  const actions: PanelActions = useMemo(() => ({
    setField: (instance, path, value) => run(() => saveContent(instance, path, value)),
    listOp: (instance, path, op, index, to) => run(() => editorOp(siteId, 'list', { instance, path, listOp: op, index, to, expected_rev: revOf(instance, path) })),
    pickImage: (instance, path, field, current) => setPick({ kind: 'image', instance, path, field, current }),
    pickLink: (instance, path, field, current) => setPick({ kind: 'link', instance, path, field, current }),
  }), [run, saveContent, siteId]);

  const fieldAt = useCallback((instance: string, path: string): FieldInfo | undefined => {
    const content = state?.content.find((c) => c.instance === instance);
    if (!content) return undefined;
    const parts = path.split('.');
    let fields = content.fields;
    let field: FieldInfo | undefined;
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) continue; // list index
      field = fields.find((f) => f.id === parts[i]);
      if (!field) return undefined;
      fields = field.item || [];
    }
    return field;
  }, [state]);

  // ── Messages from the canvas ──────────────────────────────────────────────
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      const d = e.data || {};
      if (d.source !== 'ks-editor') return;
      switch (d.type) {
        case 'ready':
          iframeRef.current.contentWindow?.postMessage({ type: 'ks:scrollTo', y: scrollY.current }, '*');
          if (selected) iframeRef.current.contentWindow?.postMessage({ type: 'ks:highlight', instance: selected }, '*');
          break;
        case 'scroll':
          scrollY.current = Number(d.y) || 0;
          break;
        case 'select':
          setSelected(d.instance);
          setTab('sections');
          break;
        case 'field':
          void run(() => saveContent(d.instance, d.path, d.value), { canvas: false });
          break;
        case 'pick': {
          const field = fieldAt(d.instance, d.path) || { id: d.path, type: d.fieldType };
          if (d.fieldType === 'image' || d.fieldType === 'bg') setPick({ kind: 'image', instance: d.instance, path: d.path, field, current: d.current || {} });
          else if (d.fieldType === 'link') setPick({ kind: 'link', instance: d.instance, path: d.path, field, current: d.current || {} });
          else if (d.fieldType === 'toggle') void actions.setField(d.instance, d.path, false);
          break;
        }
        case 'list':
          void actions.listOp(d.instance, d.path, d.op, d.index, d.to);
          break;
        case 'global':
          setTab(d.binding === '@site.logo' ? 'brand' : 'business');
          toast(d.binding === '@site.logo' ? 'Change your logo in Brand.' : 'This comes from your business info — change it once here and it updates everywhere.');
          break;
        case 'navigate': {
          const slug = String(d.path || '/').replace(/^\//, '').split(/[?#]/)[0] || 'home';
          const target = state?.pages.find((p) => p.slug === slug);
          if (target) { setPageId(target.id); scrollY.current = 0; }
          break;
        }
        case 'collection': {
          const kind = d.kind === 'post' ? 'posts' : String(d.kind);
          const where = kind === 'services' ? 'Admin → Booking' : kind === 'posts' ? 'Admin → Blog' : 'Admin → Store';
          const label = kind === 'posts' ? 'blog posts' : kind;
          toast(d.sample
            ? `These are sample ${label}. Add your real ${label} in ${where} and they'll appear here in this design.`
            : d.kind === 'post'
            ? `This article comes from ${where}. Edit it there and the site updates automatically.`
            : `These ${label} come from ${where}. Edit them there and the site updates automatically.`);
          break;
        }
        case 'notice':
          toast(String(d.message || ''), d.level === 'warning' ? 'warn' : 'ok');
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [actions, fieldAt, run, saveContent, selected, siteId, state, toast]);

  // ── Publish (same flow as the classic editor) ─────────────────────────────
  const publish = async () => {
    if (!state) return;
    const launchToken = new URLSearchParams(window.location.search).get('launchToken')
      || document.cookie.split('; ').find((c) => c.startsWith('ks_launch_token='))?.split('=')[1];
    if (launchToken) { router.push(`/onboarding/launch/${launchToken}?step=payment`); return; }

    setPublishing(true);
    try {
      const report = await editorOp<{ ok: boolean; errors: Array<{ message: string }> }>(siteId, 'validate');
      if (!report.ok) {
        toast(`Your site has ${report.errors.length} problem(s) to fix before publishing. Ask the Keystone team if you're unsure.`, 'error');
        return;
      }
      const res = await fetch('/api/user/subscription', { credentials: 'include' });
      const { subscription } = res.ok ? await res.json() : { subscription: null };
      if (!hasPaidAccess(subscription)) { router.push(`/pricing?action=publish&siteId=${siteId}`); return; }
      if (!state.site.isPublished || !state.site.publishedDomain) {
        router.push(`/publish/domain-select?session_id=existing&siteId=${siteId}`);
        return;
      }
      const pub = await fetch('/api/sites/publish', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, publishedDomain: state.site.publishedDomain }),
      });
      const body = await pub.json().catch(() => ({}));
      if (!pub.ok) throw new Error(body.error || 'Publishing failed');
      toast('Your changes are live!');
      await refresh({ canvas: false });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setPublishing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <div>
          <p className="mb-4 text-slate-700">{loadError}</p>
          <Link href="/admin" className="text-sm font-semibold text-blue-600">Back to admin</Link>
        </div>
      </div>
    );
  }
  if (!state || !page) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  const base = mode === 'edit' ? state.canvas.editBase : state.canvas.previewBase;
  const canvasSrc = `${base}${pagePath(page.slug)}?v=${canvasVersion}`;
  const adminHref = `/admin?siteId=${encodeURIComponent(siteId)}`;

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3">
        <a href={adminHref} onClick={(e) => void leaveTo(e, adminHref)} className="shrink-0" aria-label="Back to admin">
          <KeystoneLogo href={undefined} size="md" showText={false} />
        </a>
        <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-slate-100 p-0.5">
          <span className="flex select-none items-center gap-1 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-sm">
            <Paintbrush className="h-3 w-3" /> Design
          </span>
          <a
            href={adminHref}
            onClick={(e) => void leaveTo(e, adminHref)}
            className="flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-800"
          >
            <LayoutDashboard className="h-3 w-3" /> Admin
          </a>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{state.site.title}</p>
          <p className="truncate text-[11px] text-slate-500">{state.site.isPublished && state.site.domain ? state.site.domain : 'Not published yet'}</p>
        </div>

        <select value={page.id} onChange={(e) => { setPageId(e.target.value); scrollY.current = 0; setSelected(null); }} className="ml-4 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm" aria-label="Page">
          {state.pages.map((p) => <option key={p.id} value={p.id}>{p.template === 'post' ? `Blog article layout (${p.navLabel || p.title})` : p.navLabel || p.title}</option>)}
        </select>

        <div className="mx-auto flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([d, Icon]) => (
            <button key={d} onClick={() => setDevice(d)} className={`rounded-md p-1.5 ${device === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`} aria-label={`${d} view`}>
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          <button onClick={() => setMode('edit')} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 ${mode === 'edit' ? 'bg-white shadow-sm' : 'text-slate-500'}`}><PenLine className="h-3.5 w-3.5" /> Edit</button>
          <button onClick={() => setMode('preview')} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 ${mode === 'preview' ? 'bg-white shadow-sm' : 'text-slate-500'}`}><Eye className="h-3.5 w-3.5" /> Preview</button>
        </div>
        <button onClick={() => setShowHistory(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="History" aria-label="History"><History className="h-4 w-4" /></button>
        <button onClick={() => setShowRequest(true)} className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 md:flex"><MessageSquare className="h-4 w-4" /> Ask for a change</button>
        <button onClick={() => void publish()} disabled={publishing} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
          {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Publish
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
          <nav className="grid grid-cols-4 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
            {([['sections', Layers, 'Sections'], ['pages', FileText, 'Pages'], ['brand', Palette, 'Brand'], ['business', Building2, 'Business']] as const).map(([t, Icon, label]) => (
              <button key={t} onClick={() => setTab(t)} className={`flex flex-col items-center gap-1 py-2.5 ${tab === t ? 'border-b-2 border-blue-600 text-blue-700' : 'hover:text-slate-800'}`}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === 'sections' && (
              <SectionsPanel
                state={state}
                page={page}
                selected={selected}
                actions={actions}
                onSelect={(instance) => {
                  setSelected((s) => (s === instance ? null : instance));
                  iframeRef.current?.contentWindow?.postMessage({ type: 'ks:highlight', instance }, '*');
                }}
                onSectionAction={(action, instance, extra) => run(() => editorOp(siteId, 'section', { page: page.id, action, instance, ...extra, expected_version: layoutVersionOf(page.id) }))}
              />
            )}
            {tab === 'pages' && (
              <PagesPanel
                state={state}
                currentId={page.id}
                onOpen={(id) => { setPageId(id); scrollY.current = 0; setSelected(null); }}
                onUpdate={(id, patch) => run(() => editorOp(siteId, 'page.update', { page: id, patch }), { success: 'Page saved' })}
                onAdd={async ({ title, copyFrom }) => {
                  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'page';
                  await run(async () => {
                    const r = await editorOp<{ page: { id: string } }>(siteId, 'page.add', { slug, title, copyFrom });
                    setPageId(r.page.id);
                  }, { success: 'Page added' });
                }}
                onDelete={(id) => run(() => editorOp(siteId, 'page.delete', { page: id }), { success: 'Page deleted' })}
              />
            )}
            {tab === 'brand' && (
              <BrandPanel
                state={state}
                onSave={(overrides) => run(() => editorOp(siteId, 'brand', { overrides }), { success: 'Brand updated' })}
                onLogo={() => setPick({ kind: 'image', instance: '@site', path: 'logo', field: { id: 'logo', type: 'image' }, current: { src: state.site.logo || '' } })}
              />
            )}
            {tab === 'business' && (
              <BusinessPanel state={state} onSave={(business) => run(() => editorOp(siteId, 'business', { business }), { success: 'Business info saved' })} />
            )}
          </div>
          <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">Changes save automatically. Your live site updates when you publish.</p>
        </aside>

        {/* Canvas */}
        <main className="min-w-0 flex-1 overflow-auto p-4">
          <div className="mx-auto h-full overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200 transition-[width]" style={{ width: DEVICE_WIDTH[device], maxWidth: '100%' }}>
            <iframe
              key={`${mode}-${page.id}`}
              ref={iframeRef}
              src={canvasSrc}
              title="Your site"
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        </main>
      </div>

      {/* Dialogs */}
      {pick?.kind === 'image' && (
        <MediaModal
          siteId={siteId}
          current={{ src: String(pick.current.src || ''), alt: String(pick.current.alt || '') }}
          aspect={pick.field.aspect}
          withAlt={pick.field.type === 'image' && pick.instance !== '@site'}
          onClose={() => setPick(null)}
          onChoose={async (value) => {
            const target = pick;
            setPick(null);
            if (target.instance === '@site') {
              await run(() => editorOp(siteId, 'business', { business: { logo: value.src } }), { success: 'Logo updated' });
              return;
            }
            await actions.setField(target.instance, target.path, { ...target.current, ...value });
          }}
        />
      )}
      {pick?.kind === 'link' && (
        <LinkModal
          pages={state.pages}
          current={pick.current as { href?: string; label?: string; newTab?: boolean }}
          hrefOnly={pick.field.hrefOnly}
          onClose={() => setPick(null)}
          onSave={async (value) => {
            const target = pick;
            setPick(null);
            await actions.setField(target.instance, target.path, { ...target.current, ...value });
          }}
        />
      )}
      {showHistory && <HistoryModal siteId={siteId} onClose={() => setShowHistory(false)} onRestored={() => { setShowHistory(false); void refresh(); toast('Version restored'); }} />}
      {showRequest && (
        <ChangeRequestModal
          siteId={siteId}
          pageSlug={page.slug}
          instance={selected}
          onClose={() => setShowRequest(false)}
          onSent={() => { setShowRequest(false); toast("Sent! We'll get back to you soon."); }}
        />
      )}

      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[120] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${t.tone === 'error' ? 'bg-red-600 text-white' : t.tone === 'warn' ? 'bg-amber-500 text-white' : 'bg-slate-900 text-white'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
