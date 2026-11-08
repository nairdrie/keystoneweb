'use client';

/**
 * Archie v2 for the agent-built site editor.
 *
 * - useArchie(): Archie's saved work for the site (runs), the live run being
 *   streamed, polling for a run that is still going (e.g. after a refresh),
 *   stop and undo. Lives in the editor so closing the popover loses nothing.
 * - <ArchiePopover>: placed beside a spot the owner clicked that they can't
 *   edit themselves (anchored), or under "Ask for a change" (docked, with the
 *   recent history).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, Loader2, RotateCcw, Square, X } from 'lucide-react';
import ArchieAIIcon from '@/app/components/ArchieAIIcon';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ArchieTarget {
  label?: string | null;
  instance: string | null;
  section: string | null;
  tag: string;
  selector: string | null;
  text: string;
  html: string | null;
  hints: string[];
}

export interface Box { top: number; left: number; right: number; bottom: number }

export interface ArchieOpen {
  /** The clicked element's box in this window's coordinates, or null for the docked panel. */
  rect: Box | null;
  /** Where the click landed (used when the element is too big to sit beside). */
  point: { x: number; y: number } | null;
  target: ArchieTarget | null;
  /** Changes whenever a new spot is picked, to start a fresh thread. */
  key: number;
}

export interface ArchieRun {
  id: string;
  createdAt: string;
  prompt: string;
  pageSlug: string | null;
  target: { label: string | null; instance: string | null; section: string | null } | null;
  status: 'running' | 'done' | 'error' | 'stopped';
  progress: string | null;
  reply: string | null;
  changed: boolean;
  undoVersionId: string | null;
  undone?: boolean;
}

interface LiveRun { id: string | null; prompt: string; target: ArchieRun['target']; progress: string }

// ── State hook ───────────────────────────────────────────────────────────────

export function useArchie(siteId: string, opts: { onChanged: () => void; toast: (text: string, tone?: 'ok' | 'warn' | 'error') => void }) {
  const [runs, setRuns] = useState<ArchieRun[]>([]);
  const [live, setLive] = useState<LiveRun | null>(null);
  const liveRef = useRef<LiveRun | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const runsRef = useRef<ArchieRun[]>([]);

  const reload = useCallback(async (): Promise<ArchieRun[]> => {
    try {
      const res = await fetch(`/api/v2/archie?siteId=${encodeURIComponent(siteId)}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return runsRef.current;
      const { runs: next } = (await res.json()) as { runs: ArchieRun[] };
      // A run that finished while we were only watching it (e.g. after a refresh).
      for (const r of next) {
        const before = runsRef.current.find((x) => x.id === r.id);
        if (before?.status === 'running' && r.status !== 'running' && !liveRef.current) {
          if (r.changed) optsRef.current.onChanged();
          optsRef.current.toast(r.status === 'done' ? 'Archie finished your change.' : r.status === 'stopped' ? 'Archie stopped.' : "Archie couldn't finish.", r.status === 'done' ? 'ok' : 'warn');
        }
      }
      runsRef.current = next;
      setRuns(next);
      return next;
    } catch {
      return runsRef.current;
    }
  }, [siteId]);

  useEffect(() => { void reload(); }, [reload]);

  // Watch a run that is going on without a live stream here.
  const watching = !live && runs.some((r) => r.status === 'running');
  useEffect(() => {
    if (!watching) return;
    const t = setInterval(() => { void reload(); }, 2500);
    return () => clearInterval(t);
  }, [watching, reload]);

  const setLiveBoth = (v: LiveRun | null) => { liveRef.current = v; setLive(v); };

  const send = useCallback(async (prompt: string, target: ArchieTarget | null, pageSlug: string): Promise<{ runId?: string; error?: string; upgrade?: boolean }> => {
    const summary = target ? { label: target.label ?? null, instance: target.instance, section: target.section } : null;
    setLiveBoth({ id: null, prompt, target: summary, progress: 'Taking a look…' });
    let runId: string | undefined;
    let changed = false;
    try {
      const res = await fetch('/api/v2/archie', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, prompt, pageSlug, target }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        return { error: body.error || 'Something went wrong. Please try again.', upgrade: !!body.upgradeRequired };
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let event: { type: string; id?: string; text?: string; changed?: boolean };
          try { event = JSON.parse(line); } catch { continue; }
          if (event.type === 'run' && event.id) { runId = event.id; setLiveBoth({ ...liveRef.current!, id: event.id }); }
          else if ((event.type === 'status' || event.type === 'tool') && liveRef.current) setLiveBoth({ ...liveRef.current, progress: event.text || '' });
          else if (event.type === 'done') changed = !!event.changed;
        }
      }
      return { runId };
    } catch {
      // Lost the live view (network, sleep…). The run carries on server-side; polling picks it up.
      return { runId };
    } finally {
      setLiveBoth(null);
      await reload();
      if (changed) optsRef.current.onChanged();
    }
  }, [reload, siteId]);

  const stop = useCallback(async (runId: string | null) => {
    const id = runId || runsRef.current.find((r) => r.status === 'running')?.id;
    if (!id) return;
    if (liveRef.current) setLiveBoth({ ...liveRef.current, progress: 'Stopping…' });
    await fetch('/api/v2/archie', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, op: 'stop', runId: id }),
    }).catch(() => {});
    void reload();
  }, [reload, siteId]);

  const undo = useCallback(async (runId: string) => {
    const res = await fetch('/api/v2/archie', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, op: 'undo', runId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) optsRef.current.toast(body.error || 'Could not undo that change', 'error');
    else { optsRef.current.toast("Undid Archie's change"); optsRef.current.onChanged(); }
    await reload();
  }, [reload, siteId]);

  const running = runs.find((r) => r.status === 'running') || null;
  return { runs, live, running, busy: !!live || !!running, send, stop, undo };
}

export type ArchieApi = ReturnType<typeof useArchie>;

// ── Placement ────────────────────────────────────────────────────────────────

const CARD_W = 360;
const GAP = 12;
const ROBOT = 52; // Archie peeks out this far left of the card
const MARGIN = 12;
const TOP_MIN = 64; // below the editor's top bar

type Side = 'below' | 'above' | 'right' | 'left' | 'point';

function place(rect: Box, point: { x: number; y: number } | null, h: number, prefer: Side | null): { left: number; top: number; side: Side } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.max(ROBOT + MARGIN, Math.min(x, vw - CARD_W - MARGIN));
  const clampY = (y: number) => Math.max(TOP_MIN, Math.min(y, vh - h - MARGIN));
  const options: Record<Side, () => { left: number; top: number } | null> = {
    below: () => (rect.bottom + GAP + h <= vh - MARGIN && rect.bottom >= TOP_MIN ? { left: clampX(rect.left), top: rect.bottom + GAP } : null),
    above: () => (rect.top - GAP - h >= TOP_MIN && rect.top <= vh ? { left: clampX(rect.left), top: rect.top - GAP - h } : null),
    right: () => (rect.right + ROBOT + CARD_W <= vw - MARGIN ? { left: rect.right + ROBOT, top: clampY(rect.top) } : null),
    left: () => (rect.left - GAP - CARD_W >= ROBOT + MARGIN ? { left: rect.left - GAP - CARD_W, top: clampY(rect.top) } : null),
    // Element too big to sit beside (a whole section): stay near the click instead.
    point: () => ({ left: clampX((point?.x ?? rect.left) + 24), top: clampY((point?.y ?? rect.top) + 24) }),
  };
  const order: Side[] = ['below', 'above', 'right', 'left', 'point'];
  for (const side of prefer ? [prefer, ...order] : order) {
    const p = options[side]();
    if (p) return { ...p, side };
  }
  return { ...options.point()!, side: 'point' };
}

// ── Popover ──────────────────────────────────────────────────────────────────

const timeLabel = (iso: string): string => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export function describeTarget(t: ArchieTarget, sectionName?: string): string {
  // Opened from a section's toolbar: the request is about the whole section.
  if (t.tag === 'section' && !t.selector) return sectionName ? `the “${sectionName}” section` : 'this section';
  const what = t.tag === 'svg' ? 'this graphic' : t.tag === 'img' ? 'this image' : t.text ? `“${t.text.slice(0, 40)}${t.text.length > 40 ? '…' : ''}”` : 'this spot';
  return sectionName ? `${what} in ${sectionName}` : what;
}

export default function ArchiePopover({
  api,
  pageSlug,
  open,
  sectionName,
  onClose,
  onAskTeam,
}: {
  api: ArchieApi;
  pageSlug: string;
  open: ArchieOpen;
  sectionName?: string;
  onClose: () => void;
  onAskTeam: () => void;
}) {
  const docked = !open.rect;
  // Remounted per clicked spot (key), so each spot starts its own thread.
  const [input, setInput] = useState('');
  const [target, setTarget] = useState<ArchieTarget | null>(() => (open.target ? { ...open.target, label: describeTarget(open.target, sectionName) } : null));
  const [threadIds, setThreadIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ text: string; upgrade?: boolean } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  const sideRef = useRef<Side | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30); }, []);

  // Docked: the recent history. Anchored: this spot's thread, plus anything still running.
  const shown = useMemo(
    () => (docked ? api.runs : api.runs.filter((r) => threadIds.includes(r.id) || r.status === 'running')).filter((r) => r.id !== api.live?.id),
    [api.runs, api.live?.id, docked, threadIds],
  );
  const lastRun = api.runs[api.runs.length - 1];

  // Sit beside the clicked element (below, above, right or left — whichever fits), never on top of it.
  useLayoutEffect(() => {
    const compute = () => {
      const h = cardRef.current?.offsetHeight || 230;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (!open.rect) {
        setPos({ left: Math.max(ROBOT + MARGIN, vw - CARD_W - 20), top: 66, maxHeight: vh - 86 });
        return;
      }
      const p = place(open.rect, open.point, h, sideRef.current);
      sideRef.current = p.side;
      setPos({ left: p.left, top: p.top, maxHeight: vh - p.top - MARGIN });
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [open.rect, open.point, shown.length, api.live, notice]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [shown.length, api.live?.progress, notice]);

  // Escape closes; so does clicking elsewhere in the editor when nothing is typed. Closing never stops Archie.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: MouseEvent) => {
      if (input.trim() || cardRef.current?.contains(e.target as Node)) return;
      if ((e.target as HTMLElement | null)?.closest?.('[data-archie-trigger]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown); };
  }, [input, onClose]);

  const send = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || api.busy) return;
    setInput('');
    setNotice(null);
    const r = await api.send(prompt, target, pageSlug);
    if (r.runId) setThreadIds((ids) => [...ids, r.runId!]);
    if (r.error) { setNotice({ text: r.error, upgrade: r.upgrade }); setInput(prompt); }
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [api, input, pageSlug, target]);

  const activeId = api.live?.id || api.running?.id || null;
  const placeholder = api.busy
    ? 'Archie is working on your last request…'
    : shown.length ? 'Anything else?' : target ? 'What would you like to change here?' : 'What would you like to change?';

  if (!pos) return null;
  return (
    <div ref={cardRef} className="fixed z-[110] animate-in fade-in zoom-in-95" style={{ left: pos.left, top: pos.top, width: CARD_W }} role="dialog" aria-label="Ask Archie">
      {/* Archie peeks out from behind the left edge of the card. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/archie.png" alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute top-1 -left-[50px] w-[58px] select-none drop-shadow-sm" />
      <div className="relative flex flex-col overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-2xl ring-1 ring-black/5" style={{ maxHeight: pos.maxHeight }}>
        <div className="flex items-center gap-2 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-3.5 py-2">
          <ArchieAIIcon className="h-4 w-4 shrink-0" />
          <span className="text-[12px] font-bold text-violet-800">Archie</span>
          {docked && api.runs.length > 0 && <span className="text-[10.5px] font-medium text-violet-500">Recent work</span>}
          {target && (
            <span className="flex min-w-0 items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10.5px] font-medium text-violet-700 ring-1 ring-violet-200">
              <span className="truncate">{target.label}</span>
              {!threadIds.length && !api.live && (
                <button onClick={() => setTarget(null)} className="shrink-0 text-violet-400 hover:text-violet-700" aria-label="Don't point at this spot">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          )}
          <button onClick={onClose} className="ml-auto rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700" aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
          {!shown.length && !api.live && (
            <p className="text-[12px] leading-relaxed text-slate-500">
              {target
                ? "Tell me what you'd like — new colours, a different shape, move it, remove it — and I'll redesign it."
                : "Hi, I'm Archie! Tell me what you'd like changed — layouts, colours, new sections, anything — and I'll do it."}
            </p>
          )}
          {shown.map((r) => (
            <div key={r.id} className="space-y-1.5">
              <div className="flex flex-col items-end">
                {docked && (
                  <span className="mb-0.5 text-[10px] text-slate-400">
                    {timeLabel(r.createdAt)}{r.target?.label ? ` · ${r.target.label}` : r.pageSlug ? ` · ${r.pageSlug === 'home' ? 'Home' : `/${r.pageSlug}`}` : ''}
                  </span>
                )}
                <div className="max-w-[88%] whitespace-pre-wrap rounded-xl rounded-br-sm bg-violet-600 px-3 py-2 text-[12.5px] leading-relaxed text-white">{r.prompt}</div>
              </div>
              <div className="flex flex-col items-start">
                {r.status === 'running' ? (
                  <Working text={r.progress || 'Working on it…'} onStop={() => void api.stop(r.id)} />
                ) : (
                  <div className={`max-w-[88%] whitespace-pre-wrap rounded-xl rounded-bl-sm px-3 py-2 text-[12.5px] leading-relaxed ${
                    r.status === 'error' ? 'border border-red-200 bg-red-50 text-red-700' : r.status === 'stopped' ? 'bg-slate-50 text-slate-500 ring-1 ring-slate-200' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {r.reply || (r.status === 'stopped' ? 'Stopped.' : 'Done.')}
                  </div>
                )}
                {r.id === lastRun?.id && r.changed && r.undoVersionId && !r.undone && r.status !== 'running' && (
                  <button
                    disabled={api.busy}
                    onClick={() => void api.undo(r.id)}
                    className="mt-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium text-slate-500 hover:text-slate-800 disabled:opacity-40"
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> Undo
                  </button>
                )}
                {r.undone && <span className="mt-1 px-1.5 text-[10.5px] text-slate-400">Undone</span>}
              </div>
            </div>
          ))}
          {api.live && (
            <div className="space-y-1.5">
              <div className="flex justify-end">
                <div className="max-w-[88%] whitespace-pre-wrap rounded-xl rounded-br-sm bg-violet-600 px-3 py-2 text-[12.5px] leading-relaxed text-white">{api.live.prompt}</div>
              </div>
              <Working text={api.live.progress} onStop={() => void api.stop(api.live?.id || null)} />
            </div>
          )}
          {notice && (
            <div className="max-w-[88%] rounded-xl rounded-bl-sm border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] leading-relaxed text-red-700">
              {notice.text}
              {notice.upgrade && <Link href="/pricing" className="mt-1 block font-semibold underline">See plans</Link>}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form className="border-t border-slate-100 p-2.5" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder={placeholder}
              rows={2}
              disabled={api.busy}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pr-10 text-[12.5px] text-slate-800 placeholder-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60"
            />
            {api.busy ? (
              <button type="button" onClick={() => void api.stop(activeId)} className="absolute bottom-2.5 right-2 rounded-lg bg-slate-700 p-1.5 text-white hover:bg-slate-800" title="Stop Archie">
                <Square className="h-3 w-3 fill-current" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} className="absolute bottom-2.5 right-2 rounded-lg bg-violet-600 p-1.5 text-white hover:bg-violet-700 disabled:opacity-30" aria-label="Send">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between px-1 text-[10.5px] text-slate-400">
            <span>{api.busy ? 'You can close this — Archie keeps going.' : 'Changes show up right away.'}</span>
            <button type="button" onClick={onAskTeam} className="font-medium hover:text-slate-600">Ask a human</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Working({ text, onStop }: { text: string; onStop: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl rounded-bl-sm bg-slate-100 px-3 py-2 text-[12px] text-slate-500">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
      <span>{text}</span>
      <button type="button" onClick={onStop} className="ml-1 text-[10.5px] font-semibold text-slate-400 hover:text-slate-700">Stop</button>
    </div>
  );
}
