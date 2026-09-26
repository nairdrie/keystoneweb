'use client';

import { createContext, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState, forwardRef, type ReactNode } from 'react';
import { AlertTriangle, Check, Copy, Landmark, X } from 'lucide-react';
import type { LawRef } from '@/lib/shop/rules';
import type { Tone } from '@/lib/shop/board';
import { ShopApiError } from './api';

// ── Small pieces ────────────────────────────────────────────────────────────

export function Pill({ tone = 'neutral', icon, children, title }: { tone?: Tone; icon?: ReactNode; children: ReactNode; title?: string }) {
  return <span className={`pill ${tone}`} title={title}>{icon}{children}</span>;
}

export function KeyTag({ children, lg }: { children: ReactNode; lg?: boolean }) {
  if (children === null || children === undefined || children === '') return null;
  return <span className={`keytag${lg ? ' lg' : ''}`} title="Key tag">{children}</span>;
}

export function Plate({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <span className="plate">{children}</span>;
}

const COLORS: Record<string, string> = {
  black: '#111827', white: '#f8fafc', silver: '#cbd5e1', grey: '#6b7280', gray: '#6b7280', red: '#dc2626', blue: '#2563eb',
  navy: '#1e3a8a', green: '#16a34a', yellow: '#facc15', orange: '#f97316', brown: '#78350f', beige: '#d6c7a1', gold: '#ca8a04',
  maroon: '#7f1d1d', burgundy: '#7f1d1d', purple: '#7c3aed', tan: '#d2b48c', champagne: '#e8dcc0', charcoal: '#374151',
};
export function ColorDot({ color }: { color: string | null | undefined }) {
  if (!color) return null;
  const key = color.toLowerCase().split(/[\s/-]+/).find(w => COLORS[w]);
  return <span className="dot" style={{ background: key ? COLORS[key] : '#94a3b8' }} title={color} />;
}

export function Avatar({ name }: { name: string | null | undefined }) {
  if (!name) return null;
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return <span className="avatar" title={name}>{initials}</span>;
}

export function CopyButton({ value, label }: { value: string | null | undefined; label?: string }) {
  const [done, setDone] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      className="copy"
      aria-label={`Copy ${label || value}`}
      onClick={e => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }).catch(() => {});
      }}
    >
      {done ? <Check className="i" /> : <Copy className="i" />}
    </button>
  );
}

export function LawNote({ law, children }: { law: LawRef; children?: ReactNode }) {
  return (
    <div className="law">
      <Landmark className="i" />
      <div><b>{law.short}.</b> {children ?? law.text} <span className="cite">{law.cite}</span></div>
    </div>
  );
}

export function Callout({ tone, icon, children }: { tone?: 'warn' | 'ok'; icon?: ReactNode; children: ReactNode }) {
  return <div className={`callout${tone ? ` ${tone}` : ''}`}>{icon}<div>{children}</div></div>;
}

export function Field({ label, required, error, hint, children, htmlFor }: { label: ReactNode; required?: boolean; error?: string | null; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      {htmlFor ? <label htmlFor={htmlFor}>{label}{required && <span className="req"> *</span>}</label> : <span className="lbl">{label}{required && <span className="req"> *</span>}</span>}
      {children}
      {hint && <span className="note">{hint}</span>}
      {error && <span className="err">{error}</span>}
    </div>
  );
}

export function Seg<T extends string>({ options, value, onChange, label }: { options: { value: T; label: ReactNode; disabled?: boolean }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={o.value === value} disabled={o.disabled} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" className="switch" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="track" />{children}
    </button>
  );
}

/** A rule error from the server: the message plus the list of what's missing. */
export function RuleErrors({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const details = error instanceof ShopApiError ? error.details : [];
  return (
    <div className="callout warn" role="alert">
      <AlertTriangle className="i" />
      <div>
        <b>{message}</b>
        {details.length > 0 && <ul className="rule-list">{details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
      </div>
    </div>
  );
}

// ── Dialogs ────────────────────────────────────────────────────────────────

export function Dialog({ title, eyebrow, wide, onClose, children, footer, footLeft, labelId }: {
  title: ReactNode;
  eyebrow?: ReactNode;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  footLeft?: ReactNode;
  labelId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = labelId || 'shop-dialog-title';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([readonly]):not([type=checkbox]), select, textarea');
    setTimeout(() => first?.focus(), 30);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <div className="dlg-head">
          <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h3 id={id}>{title}</h3></div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X className="i" /></button>
        </div>
        <div className="dlg-body">{children}</div>
        {(footer || footLeft) && <div className="dlg-foot">{footLeft && <span className="left">{footLeft}</span>}{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, eyebrow, onClose, children, footer }: { title: ReactNode; eyebrow?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div className="overlay" style={{ justifyContent: 'flex-end', padding: 0 }} onMouseDown={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="shop-drawer-title">
        <div className="dlg-head">
          <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h3 id="shop-drawer-title">{title}</h3></div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X className="i" /></button>
        </div>
        <div className="dlg-body">{children}</div>
        {footer && <div className="dlg-foot">{footer}</div>}
      </aside>
    </>
  );
}

// ── Signature pad ──────────────────────────────────────────────────────────

export interface SignaturePadHandle { clear: () => void }

export const SignaturePad = forwardRef<SignaturePadHandle, { onChange: (dataUrl: string | null) => void; label?: string }>(function SignaturePad({ onChange, label }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ drawing: false, drew: false, last: { x: 0, y: 0 } });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const setup = useCallback(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ratio = window.devicePixelRatio || 1;
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(1, r.width * ratio);
    cv.height = Math.max(1, r.height * ratio);
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  }, []);

  useEffect(() => { setup(); }, [setup]);

  useImperativeHandle(ref, () => ({
    clear: () => {
      const cv = canvas.current;
      if (!cv) return;
      cv.getContext('2d')!.clearRect(0, 0, cv.width, cv.height);
      state.current.drew = false;
      onChangeRef.current(null);
    },
  }), []);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const exportPng = () => {
    // White background so the PNG reads on paper and in dark viewers.
    const cv = canvas.current!;
    const out = document.createElement('canvas');
    out.width = cv.width; out.height = cv.height;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(cv, 0, 0);
    return out.toDataURL('image/png');
  };

  return (
    <div className="sig">
      <canvas
        ref={canvas}
        aria-label={label || 'Signature pad'}
        onPointerDown={e => { state.current.drawing = true; state.current.last = pos(e); canvas.current!.setPointerCapture(e.pointerId); }}
        onPointerMove={e => {
          if (!state.current.drawing) return;
          const p = pos(e);
          const ctx = canvas.current!.getContext('2d')!;
          ctx.beginPath();
          ctx.moveTo(state.current.last.x, state.current.last.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          state.current.last = p;
          state.current.drew = true;
        }}
        onPointerUp={() => { if (!state.current.drawing) return; state.current.drawing = false; if (state.current.drew) onChangeRef.current(exportPng()); }}
        onPointerCancel={() => { state.current.drawing = false; }}
      />
      <span className="sl" /><span className="sx">×</span><span className="sh">Sign with a finger or the mouse</span>
    </div>
  );
});

// ── Toasts ─────────────────────────────────────────────────────────────────

interface ToastItem { id: number; text: string; tone?: 'warn' }
const ToastContext = createContext<(text: string, tone?: 'warn') => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone?: 'warn') => {
    const id = Date.now() + Math.random();
    setItems(list => [...list.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems(list => list.filter(t => t.id !== id)), tone === 'warn' ? 6500 : 4200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map(t => <div key={t.id} className={`toast${t.tone ? ` ${t.tone}` : ''}`}>{t.text}</div>)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ── Formatting ─────────────────────────────────────────────────────────────

export function km(n: number | null | undefined): string {
  return n == null ? '—' : `${n.toLocaleString('en-CA')} km`;
}
