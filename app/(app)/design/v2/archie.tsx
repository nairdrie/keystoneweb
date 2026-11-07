'use client';

/**
 * Archie v2 popover for the agent-built site editor.
 *
 * Opens next to a spot the owner clicked that they can't edit themselves
 * (anchored), or under "Ask for a change" (docked). Requests stream from
 * /api/v2/archie, where Archie edits the site through the MCP tools.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp, Loader2, RotateCcw, Square, X } from 'lucide-react';
import Link from 'next/link';
import ArchieAIIcon from '@/app/components/ArchieAIIcon';

export interface ArchieTarget {
  instance: string | null;
  section: string | null;
  tag: string;
  selector: string | null;
  text: string;
  html: string | null;
  hints: string[];
}

export interface ArchieOpen {
  /** Fixed-position anchor in this window (from a canvas click), or null for the docked panel. */
  anchor: { x: number; y: number } | null;
  target: ArchieTarget | null;
  /** Changes whenever a new spot is picked, to start a fresh conversation. */
  key: number;
}

interface Msg { role: 'user' | 'assistant'; text: string; undoVersionId?: string | null; error?: boolean; upgrade?: boolean }

const CARD_W = 360;

const describe = (t: ArchieTarget, sectionName?: string): string => {
  if (t.tag === 'section' && !t.selector) return sectionName ? `the “${sectionName}” section` : 'this section';
  const what = t.tag === 'svg' ? 'this graphic' : t.tag === 'img' ? 'this image' : t.text ? `“${t.text.slice(0, 40)}${t.text.length > 40 ? '…' : ''}”` : 'this spot';
  return sectionName ? `${what} in ${sectionName}` : what;
};

export default function ArchiePopover({
  siteId,
  pageSlug,
  open,
  sectionName,
  onClose,
  onChanged,
  onUndo,
  onAskTeam,
  onBusyChange,
}: {
  siteId: string;
  pageSlug: string;
  open: ArchieOpen;
  sectionName?: string;
  onClose: () => void;
  onChanged: () => void;
  onUndo: (versionId: string) => Promise<void>;
  onAskTeam: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [target, setTarget] = useState<ArchieTarget | null>(open.target);
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // A new spot starts a new conversation (unless Archie is mid-change).
  useEffect(() => {
    setTarget(open.target);
    setMessages([]);
    setInput('');
    setStatus('');
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Place the card next to the click, kept on screen with room for Archie to peek out on the left.
  useLayoutEffect(() => {
    const place = () => {
      const h = cardRef.current?.offsetHeight || 220;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (!open.anchor) {
        setPos({ left: Math.max(70, vw - CARD_W - 20), top: 66, maxHeight: vh - 86 });
        return;
      }
      let left = open.anchor.x + 18;
      if (left + CARD_W > vw - 12) left = open.anchor.x - CARD_W - 18;
      left = Math.max(70, Math.min(left, vw - CARD_W - 12));
      let top = open.anchor.y - 28;
      top = Math.max(64, Math.min(top, vh - h - 12));
      setPos({ left, top, maxHeight: vh - top - 12 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open.anchor, messages.length, busy]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages, status]);

  // Escape closes; so does clicking elsewhere in the editor when idle and empty.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    const onDown = (e: MouseEvent) => {
      if (busy || input.trim() || cardRef.current?.contains(e.target as Node)) return;
      if ((e.target as HTMLElement | null)?.closest?.('[data-archie-trigger]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown); };
  }, [busy, input, onClose]);

  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { abortRef.current?.abort(); onBusyChange?.(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || busy) return;
    const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: 'user', text: prompt }]);
    setInput('');
    setBusy(true);
    setStatus('Taking a look…');
    const controller = new AbortController();
    abortRef.current = controller;
    let changed = false;
    try {
      const res = await fetch('/api/v2/archie', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, prompt, pageSlug, target, history }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        setMessages((m) => [...m, { role: 'assistant', text: body.error || 'Something went wrong. Please try again.', error: true, upgrade: !!body.upgradeRequired }]);
        return;
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
          let event: { type: string; text?: string; changed?: boolean; undoVersionId?: string | null };
          try { event = JSON.parse(line); } catch { continue; }
          if (event.type === 'status' || event.type === 'tool') setStatus(event.text || '');
          else if (event.type === 'done') {
            changed = !!event.changed;
            setMessages((m) => [...m, { role: 'assistant', text: event.text || 'Done!', undoVersionId: event.undoVersionId || null }]);
          } else if (event.type === 'error') {
            setMessages((m) => [...m, { role: 'assistant', text: event.text || 'Something went wrong.', error: true }]);
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMessages((m) => [...m, { role: 'assistant', text: 'Lost the connection to Archie. Please try again.', error: true }]);
      else setMessages((m) => [...m, { role: 'assistant', text: 'Stopped.', error: true }]);
      changed = true; // anything saved before the stop should show
    } finally {
      abortRef.current = null;
      setBusy(false);
      setStatus('');
      if (changed) onChanged();
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [busy, input, messages, onChanged, pageSlug, siteId, target]);

  const lastUndo = [...messages].reverse().find((m) => m.role === 'assistant' && !m.error);
  const placeholder = messages.length
    ? 'Anything else?'
    : target ? 'What would you like to change here?' : 'What would you like to change?';

  if (!pos) return null;
  return (
    <div
      ref={cardRef}
      className="fixed z-[110] animate-in fade-in zoom-in-95"
      style={{ left: pos.left, top: pos.top, width: CARD_W }}
      role="dialog"
      aria-label="Ask Archie"
    >
      {/* Archie peeks out from behind the left edge of the card. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/archie.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute top-1 -left-[50px] w-[58px] select-none drop-shadow-sm"
        draggable={false}
      />
      <div className="relative flex flex-col overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-2xl ring-1 ring-black/5" style={{ maxHeight: pos.maxHeight }}>
        <div className="flex items-center gap-2 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-3.5 py-2">
          <ArchieAIIcon className="h-4 w-4" />
          <span className="text-[12px] font-bold text-violet-800">Archie</span>
          {target && (
            <span className="flex min-w-0 items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10.5px] font-medium text-violet-700 ring-1 ring-violet-200">
              <span className="truncate">{describe(target, sectionName)}</span>
              {!busy && !messages.length && (
                <button onClick={() => setTarget(null)} className="shrink-0 text-violet-400 hover:text-violet-700" aria-label="Don't point at this spot">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          )}
          <button onClick={onClose} disabled={busy} className="ml-auto rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30" aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-3">
          {!messages.length && !busy && (
            <p className="text-[12px] leading-relaxed text-slate-500">
              {target
                ? "Can't click to edit this one? Tell me what you'd like — new colours, a different shape, move it, remove it — and I'll redesign it."
                : "Hi, I'm Archie! Tell me what you'd like changed — layouts, colours, new sections, anything — and I'll do it."}
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${
                m.role === 'user' ? 'rounded-br-sm bg-violet-600 text-white'
                  : m.error ? 'rounded-bl-sm border border-red-200 bg-red-50 text-red-700'
                  : 'rounded-bl-sm bg-slate-100 text-slate-800'
              }`}>
                {m.text}
                {m.upgrade && <Link href="/pricing" className="mt-1 block font-semibold underline">See plans</Link>}
              </div>
              {m.undoVersionId && m === lastUndo && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    const id = m.undoVersionId!;
                    setMessages((all) => all.map((x) => (x === m ? { ...x, undoVersionId: null } : x)));
                    await onUndo(id);
                  }}
                  className="mt-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium text-slate-500 hover:text-slate-800 disabled:opacity-40"
                >
                  <RotateCcw className="h-2.5 w-2.5" /> Undo
                </button>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 rounded-xl rounded-bl-sm bg-slate-100 px-3 py-2 text-[12px] text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
              <span>{status || 'Working on it…'}</span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="border-t border-slate-100 p-2.5"
          onSubmit={(e) => { e.preventDefault(); void send(); }}
        >
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder={placeholder}
              rows={2}
              disabled={busy}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pr-10 text-[12.5px] text-slate-800 placeholder-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60"
            />
            {busy ? (
              <button type="button" onClick={() => abortRef.current?.abort()} className="absolute bottom-2.5 right-2 rounded-lg bg-slate-700 p-1.5 text-white hover:bg-slate-800" title="Stop">
                <Square className="h-3 w-3 fill-current" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} className="absolute bottom-2.5 right-2 rounded-lg bg-violet-600 p-1.5 text-white hover:bg-violet-700 disabled:opacity-30" aria-label="Send">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between px-1 text-[10.5px] text-slate-400">
            <span>Changes show up right away. Undo anytime in History.</span>
            <button type="button" onClick={onAskTeam} className="font-medium hover:text-slate-600">Ask a human</button>
          </div>
        </form>
      </div>
    </div>
  );
}
