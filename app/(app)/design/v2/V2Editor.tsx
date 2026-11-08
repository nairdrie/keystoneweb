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
  Building2, Eye, FileText, History, LayoutDashboard, Loader2, Monitor, Paintbrush, Palette, PenLine, Rocket, Share2, Smartphone, Tablet,
} from 'lucide-react';
import KeystoneLogo from '@/app/components/KeystoneLogo';
import { hasPaidAccess } from '@/lib/subscription/access';
import { editorOp, EditorApiError, loadEditorState, pagePath, type EditorState, type FieldInfo } from './api';
import { BrandPanel, BusinessPanel, PagesPanel, type PanelActions, type RemoveKind } from './panels';
import { AddSectionModal, ChangeRequestModal, HistoryModal, LinkModal, MediaModal, SectionContentModal, SharePreviewModal } from './modals';
import ArchiePopover, { useArchie, type ArchieOpen } from './archie';
import ArchieAIIcon from '@/app/components/ArchieAIIcon';
import EditorLoadingScreen from '@/app/components/EditorLoadingScreen';

type Obj = Record<string, unknown>;
type Device = 'desktop' | 'tablet' | 'mobile';
type Tab = 'brand' | 'pages' | 'business';
type SectionAction = 'add' | 'move' | 'duplicate' | 'remove' | 'hide' | 'show';

interface Toast { id: number; text: string; tone: 'ok' | 'warn' | 'error'; action?: { label: string; run: () => void } }

interface PickState {
  kind: 'image' | 'link';
  instance: string;
  path: string;
  field: Partial<FieldInfo> & { type: FieldInfo['type'] };
  current: Obj;
}

const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '820px', mobile: '390px' };
/** Canvas links are signed for 12 hours; reuse them for 6 so the canvas URL stays put. */
const CANVAS_LINK_REUSE_MS = 6 * 3600 * 1000;

interface CanvasFrame { key: number; src: string }

export default function V2Editor({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [state, setState] = useState<EditorState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [pageId, setPageId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('brand');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [device, setDevice] = useState<Device>('desktop');
  const [selected, setSelected] = useState<string | null>(null);
  const [canvasVersion, setCanvasVersion] = useState(0);
  const [pick, setPick] = useState<PickState | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [addAt, setAddAt] = useState<number | null>(null);
  const [contentOf, setContentOf] = useState<string | null>(null);
  const [archie, setArchie] = useState<ArchieOpen | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [saving, setSaving] = useState(0);
  const stateRef = useRef<EditorState | null>(null);
  const scrollY = useRef(0);
  const canvasIssuedAt = useRef(0);

  // ── Canvas frames ─────────────────────────────────────────────────────────
  // The visible canvas is never torn down to show a change. A new render loads
  // in a hidden frame behind it and replaces it once it's ready and scrolled
  // to the same spot, so there's no blank flash. Most edits don't need a new
  // render at all: they're applied to the visible canvas directly (ks:apply).
  const [frames, setFrames] = useState<{ active: CanvasFrame | null; pending: CanvasFrame | null }>({ active: null, pending: null });
  const framesRef = useRef(frames);
  const frameEls = useRef(new Map<number, HTMLIFrameElement>());
  const frameSeq = useRef(0);
  // Read by the message handler and iframeRef; kept current during render, not after it.
  framesRef.current = frames;
  const iframeRef = useMemo(() => ({
    get current(): HTMLIFrameElement | null {
      const active = framesRef.current.active;
      return active ? frameEls.current.get(active.key) ?? null : null;
    },
  }), []);
  const promote = useCallback((key: number) => {
    setFrames((f) => (f.pending?.key === key ? { active: f.pending, pending: null } : f));
  }, []);
  /** Apply an edit to the visible canvas right away (the save runs in the background). */
  const applyInCanvas = useCallback((change: Obj) => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'ks:apply', change }, '*');
  }, [iframeRef]);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok', action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone, action }]);
    setTimeout(() => dismissToast(id), action ? 8000 : tone === 'error' ? 7000 : 3500);
  }, [dismissToast]);

  const refresh = useCallback(async (opts: { canvas?: boolean } = { canvas: true }) => {
    try {
      const next = await loadEditorState(siteId);
      // Every load signs fresh canvas links. Keep the ones we have (they last
      // 12 hours) so the canvas URL only changes when we mean to re-render it.
      const prev = stateRef.current;
      if (prev && Date.now() - canvasIssuedAt.current < CANVAS_LINK_REUSE_MS) next.canvas = prev.canvas;
      else canvasIssuedAt.current = Date.now();
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

  // Archie's saved work for this site; runs keep going if the popover closes or the page reloads.
  const archieApi = useArchie(siteId, { onChanged: () => { void refresh(); }, toast });

  const page = useMemo(() => state?.pages.find((p) => p.id === pageId) || state?.pages[0] || null, [state, pageId]);

  const closeArchie = useCallback(() => {
    setArchie(null);
    iframeRef.current?.contentWindow?.postMessage({ type: 'ks:ask-clear' }, '*');
  }, [iframeRef]);
  useEffect(() => { setArchie(null); }, [pageId, mode]);

  // Edits run one at a time: each is a read-modify-write on the server, so
  // overlapping clicks (hide, then move) must not race each other.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // `canvas: false` means the canvas already shows the change (typed in place
  // or applied with ks:apply); if the save fails it's re-rendered from the server.
  const run = useCallback((fn: () => Promise<unknown>, opts: { canvas?: boolean; success?: string } = {}): Promise<void> => {
    setSaving((n) => n + 1);
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
        if (opts.canvas === false) await refresh({ canvas: true });
        toast(err.message || 'Something went wrong', 'error');
      } finally {
        setSaving((n) => n - 1);
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

  // Current stored value at a content path like "stats.2.label".
  const valueAt = useCallback((instance: string, path: string): unknown => {
    const parts = path.split('.');
    let value: unknown = stateRef.current?.content.find((c) => c.instance === instance)?.values[parts[0]]?.value;
    for (let i = 1; i < parts.length; i += 2) {
      const items = (value as { items?: unknown[] } | undefined)?.items;
      const item = Array.isArray(items) ? items[Number(parts[i])] : undefined;
      value = parts[i + 1] !== undefined ? (item as Record<string, unknown> | undefined)?.[parts[i + 1]] : item;
    }
    return value;
  }, []);

  // Remove: stored as hidden: true (a background keeps its element and loses only its
  // image). The canvas drops it at once; Undo in the toast is the way back.
  const removePart = useCallback((instance: string, path: string, kind: RemoveKind) => {
    let value: unknown;
    let undo: unknown;
    if (kind === 'toggle') {
      value = false;
      undo = true;
    } else {
      const current = valueAt(instance, path);
      const base = current && typeof current === 'object' ? { ...(current as Obj) } : typeof current === 'string' ? { html: current } : {};
      value = { ...base, hidden: true };
      undo = { ...base, hidden: false };
    }
    const show = (hidden: boolean, v: unknown) => applyInCanvas(kind === 'bg'
      ? { op: 'field', instance, path, value: v }
      : { op: 'visibility', instance, path, kind: kind === 'list' ? 'list' : 'field', hidden });
    show(true, value);
    void run(() => saveContent(instance, path, value), { canvas: false });
    toast(kind === 'bg' ? 'Background image removed' : kind === 'list' ? 'List removed' : 'Removed', 'ok', {
      label: 'Undo',
      run: () => {
        show(false, undo);
        void run(() => saveContent(instance, path, undo), { canvas: false });
      },
    });
  }, [applyInCanvas, run, saveContent, toast, valueAt]);

  // ── Actions shared by the canvas and the panels ───────────────────────────
  const actions: PanelActions = useMemo(() => ({
    setField: (instance, path, value) => {
      applyInCanvas({ op: 'field', instance, path, value });
      return run(() => saveContent(instance, path, value), { canvas: false });
    },
    listOp: (instance, path, op, index, to) => {
      // A new item needs the designer's template filled in: that one re-renders.
      const inPlace = op !== 'add';
      if (inPlace) applyInCanvas({ op: 'list', instance, path, action: op, index, to });
      return run(() => editorOp(siteId, 'list', { instance, path, listOp: op, index, to, expected_rev: revOf(instance, path) }), { canvas: !inPlace });
    },
    pickImage: (instance, path, field, current) => setPick({ kind: 'image', instance, path, field, current }),
    pickLink: (instance, path, field, current) => setPick({ kind: 'link', instance, path, field, current }),
    remove: removePart,
  }), [applyInCanvas, removePart, run, saveContent, siteId]);

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

  const sectionAction = useCallback((action: SectionAction, instance?: string, extra?: Obj) => {
    if (!page) return Promise.resolve();
    const success = action === 'remove' ? 'Section deleted. You can bring it back from History.' : action === 'add' ? 'Section added' : undefined;
    const send = () => editorOp<{ created?: string }>(siteId, 'section', { page: page.id, action, instance, ...extra, expected_version: layoutVersionOf(page.id) });
    // A new section has to be rendered by the server; everything else is shown right away.
    if (action === 'add') return run(send, { success });
    if (action === 'duplicate') {
      // The copy needs the id the server gives it before it can be edited.
      return run(async () => {
        const r = await send();
        if (r.created) applyInCanvas({ op: 'section', action, instance, created: r.created });
        else throw new EditorApiError('Could not duplicate the section');
      }, { canvas: false, success });
    }
    applyInCanvas({ op: 'section', action, instance, ...extra });
    return run(send, { canvas: false, success });
  }, [applyInCanvas, page, run, siteId]);

  // ── Messages from the canvas ──────────────────────────────────────────────
  useEffect(() => {
    const init = (win: Window) => {
      win.postMessage({ type: 'ks:scrollTo', y: scrollY.current }, '*');
      win.postMessage({
        type: 'ks:meta',
        names: Object.fromEntries((state?.sections || []).map((s) => [s.key, s.name])),
        colors: (state?.theme.tokens || []).filter((t) => t.type === 'color').map((t) => ({ name: t.name, label: t.label || t.name })),
      }, '*');
      if (selected) win.postMessage({ type: 'ks:highlight', instance: selected }, '*');
    };
    const onMessage = (e: MessageEvent) => {
      const d = e.data || {};
      if (d.source !== 'ks-editor') return;
      // A re-render loading behind the canvas: set it up, then show it.
      const pending = framesRef.current.pending;
      const pendingWin = pending ? frameEls.current.get(pending.key)?.contentWindow : null;
      if (pending && pendingWin && e.source === pendingWin) {
        if (d.type === 'ready') {
          init(pendingWin);
          requestAnimationFrame(() => requestAnimationFrame(() => promote(pending.key)));
        }
        return;
      }
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      switch (d.type) {
        case 'ready':
          init(iframeRef.current.contentWindow!);
          break;
        case 'reload':
          // The canvas couldn't show a change in place: re-render once saves finish.
          void run(async () => {}, { canvas: true });
          break;
        case 'scroll': {
          const y = Number(d.y) || 0;
          const delta = y - scrollY.current;
          scrollY.current = y;
          // Keep Archie next to the spot it's pointing at while the page scrolls.
          if (delta) {
            setArchie((a) => (a?.rect ? {
              ...a,
              rect: { ...a.rect, top: a.rect.top - delta, bottom: a.rect.bottom - delta },
              point: a.point ? { x: a.point.x, y: a.point.y - delta } : null,
            } : a));
          }
          break;
        }
        case 'ask': {
          // Canvas coordinates → this window. Archie sits beside the clicked element.
          const frame = iframeRef.current.getBoundingClientRect();
          scrollY.current = Number(d.scrollY) || scrollY.current;
          const r = d.rect as { top: number; left: number; right: number; bottom: number } | null;
          setArchie({
            rect: r
              ? { top: frame.top + r.top, left: frame.left + r.left, right: frame.left + r.right, bottom: frame.top + r.bottom }
              : { top: frame.top + Number(d.y), left: frame.left + Number(d.x), right: frame.left + Number(d.x), bottom: frame.top + Number(d.y) },
            point: { x: frame.left + (Number(d.x) || 0), y: frame.top + (Number(d.y) || 0) },
            target: d.target || null,
            key: Date.now(),
          });
          break;
        }
        case 'select':
          setSelected(d.instance);
          break;
        case 'section': {
          const action = String(d.action) as SectionAction;
          if (!['move', 'duplicate', 'remove', 'hide', 'show'].includes(action)) break;
          if (action === 'remove') {
            const inst = page?.sections.find((s) => s.id === d.instance);
            const name = state?.sections.find((s) => s.key === inst?.section)?.name;
            if (!confirm(`Delete the ${name ? `“${name}” ` : ''}section from this page? You can bring it back from History.`)) break;
          }
          void sectionAction(action, d.instance, action === 'move' ? { to: Number(d.to) } : undefined);
          break;
        }
        case 'section-ask': {
          // Archie sits beside the toolbar's sparkle button.
          const frame = iframeRef.current.getBoundingClientRect();
          scrollY.current = Number(d.scrollY) || scrollY.current;
          const x = frame.left + (Number(d.x) || 0);
          const y = frame.top + (Number(d.y) || 0);
          const b = d.rect as { top: number; left: number; right: number; bottom: number } | null;
          setArchie({
            rect: b ? { top: frame.top + b.top, left: frame.left + b.left, right: frame.left + b.right, bottom: frame.top + b.bottom } : { top: y, left: x, right: x, bottom: y },
            point: { x, y },
            target: { instance: d.instance || null, section: d.section || null, tag: 'section', selector: null, text: '', html: null, hints: ['The owner picked the whole section from its toolbar, not one element in it.'] },
            key: Date.now(),
          });
          break;
        }
        case 'section-content':
          if (state?.content.some((c) => c.instance === d.instance)) setContentOf(d.instance);
          break;
        case 'add-section':
          setAddAt(Math.max(0, Number(d.index) || 0));
          break;
        case 'remove':
          if (['field', 'list', 'toggle', 'bg'].includes(d.kind)) removePart(d.instance, d.path, d.kind as RemoveKind);
          break;
        case 'field':
          void run(() => saveContent(d.instance, d.path, d.value), { canvas: false });
          break;
        case 'pick': {
          const field = fieldAt(d.instance, d.path) || { id: d.path, type: d.fieldType };
          if (d.fieldType === 'image' || d.fieldType === 'bg') setPick({ kind: 'image', instance: d.instance, path: d.path, field, current: d.current || {} });
          else if (d.fieldType === 'link') setPick({ kind: 'link', instance: d.instance, path: d.path, field, current: d.current || {} });
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
  }, [actions, applyInCanvas, fieldAt, iframeRef, page, promote, removePart, run, saveContent, sectionAction, selected, siteId, state, toast, valueAt]);

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

  // ── Canvas source → frames ────────────────────────────────────────────────
  const canvasSrc = state && page
    ? `${mode === 'edit' ? state.canvas.editBase : state.canvas.previewBase}${pagePath(page.slug)}?v=${canvasVersion}`
    : null;
  useEffect(() => {
    if (!canvasSrc) return;
    setFrames((f) => {
      if ((f.pending ?? f.active)?.src === canvasSrc) return f;
      const frame = { key: ++frameSeq.current, src: canvasSrc };
      return f.active ? { active: f.active, pending: frame } : { active: frame, pending: null };
    });
  }, [canvasSrc]);

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
    return <EditorLoadingScreen />;
  }

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
        <span className={`flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-500 transition-opacity ${saving > 0 ? 'opacity-100' : 'opacity-0'}`} role="status" aria-live="polite">
          <Loader2 className="h-3 w-3 animate-spin" /> {saving > 0 ? 'Saving…' : ''}
        </span>

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
        <button
          data-archie-trigger
          onClick={() => { iframeRef.current?.contentWindow?.postMessage({ type: 'ks:ask-clear' }, '*'); setArchie((a) => (a && !a.rect ? null : { rect: null, point: null, target: null, key: Date.now() })); }}
          className={`hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium md:flex ${archie && !archie.rect ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'}`}
          title={archieApi.busy ? 'Archie is working on a change' : undefined}
        >
          {archieApi.busy ? <Loader2 className="h-4 w-4 animate-spin text-violet-500" /> : <ArchieAIIcon className="h-4 w-4" />}
          {archieApi.busy ? 'Archie is working…' : 'Ask for a change'}
        </button>
        <button onClick={() => setShowShare(true)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" title="Share a preview link without publishing">
          <Share2 className="h-4 w-4" /> <span className="hidden lg:inline">Share</span>
        </button>
        <button onClick={() => void publish()} disabled={publishing} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
          {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Publish
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white">
          <nav className="grid grid-cols-3 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
            {([['brand', Palette, 'Brand'], ['pages', FileText, 'Pages'], ['business', Building2, 'Business']] as const).map(([t, Icon, label]) => (
              <button key={t} onClick={() => setTab(t)} className={`flex flex-col items-center gap-1 py-2.5 ${tab === t ? 'border-b-2 border-blue-600 text-blue-700' : 'hover:text-slate-800'}`}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
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
          <div className="relative mx-auto h-full overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200 transition-[width]" style={{ width: DEVICE_WIDTH[device], maxWidth: '100%' }}>
            {/* Always [active, pending] in this order: promoting the pending frame
                only removes the old one, so the new iframe is never moved (moving reloads it). */}
            {[frames.active, frames.pending].map((frame) => frame && (
              <iframe
                key={frame.key}
                ref={(el) => { if (el) frameEls.current.set(frame.key, el); else frameEls.current.delete(frame.key); }}
                src={frame.src}
                title={frame === frames.active ? 'Your site' : 'Your site (updating)'}
                aria-hidden={frame !== frames.active || undefined}
                tabIndex={frame !== frames.active ? -1 : undefined}
                onLoad={() => {
                  // Preview pages have no editor script to say "ready"; edit pages say it before load.
                  if (framesRef.current.pending?.key === frame.key) setTimeout(() => promote(frame.key), mode === 'edit' ? 1500 : 0);
                }}
                className={`absolute inset-0 h-full w-full border-0 ${frame === frames.active ? (frames.pending ? 'pointer-events-none' : '') : 'pointer-events-none invisible'}`}
                sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              />
            ))}
            {frames.pending && (
              <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-slate-900/85 px-2.5 py-1 text-[11px] font-medium text-white shadow">
                <Loader2 className="h-3 w-3 animate-spin" /> Updating…
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Dialogs */}
      {addAt !== null && (
        <AddSectionModal
          designs={state.sections.filter((s) => s.key !== state.theme.header && s.key !== state.theme.footer)}
          usedOnPage={new Set(page.sections.map((s) => s.section))}
          onClose={() => setAddAt(null)}
          onChoose={(section) => {
            const index = addAt;
            setAddAt(null);
            void sectionAction('add', undefined, { section, index });
          }}
          onAskArchie={() => {
            setAddAt(null);
            iframeRef.current?.contentWindow?.postMessage({ type: 'ks:ask-clear' }, '*');
            setArchie({ rect: null, point: null, target: null, key: Date.now() });
          }}
        />
      )}
      {contentOf && (() => {
        const content = state.content.find((c) => c.instance === contentOf);
        if (!content) return null;
        const name = state.sections.find((s) => s.key === content.section)?.name || 'Section';
        return <SectionContentModal name={name} content={content} actions={actions} onClose={() => setContentOf(null)} />;
      })()}
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
            // A new background image brings a removed background back.
            await actions.setField(target.instance, target.path, { ...target.current, ...value, ...(target.field.type === 'bg' ? { hidden: false } : {}) });
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
            // A new background image brings a removed background back.
            await actions.setField(target.instance, target.path, { ...target.current, ...value, ...(target.field.type === 'bg' ? { hidden: false } : {}) });
          }}
        />
      )}
      {showHistory && <HistoryModal siteId={siteId} onClose={() => setShowHistory(false)} onRestored={() => { setShowHistory(false); void refresh(); toast('Version restored'); }} />}
      {archie && (
        <ArchiePopover
          key={archie.key}
          api={archieApi}
          pageSlug={page.slug}
          open={archie}
          sectionName={archie.target?.section ? state.sections.find((s) => s.key === archie.target?.section)?.name : undefined}
          onClose={closeArchie}
          onAskTeam={() => { closeArchie(); setShowRequest(true); }}
        />
      )}
      {showShare && <SharePreviewModal siteId={siteId} appUrl={state.appUrl} page={page} onClose={() => setShowShare(false)} />}
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
            {t.action && (
              <button
                onClick={() => { t.action!.run(); dismissToast(t.id); }}
                className="ml-3 rounded-md bg-white/15 px-2 py-0.5 text-sm font-semibold text-white hover:bg-white/25"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
