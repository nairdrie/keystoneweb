'use client';

import { useEffect, useRef, useState } from 'react';
import { Monitor, Tablet, Smartphone, ChevronDown, Check } from 'lucide-react';

export type PreviewDevice = 'auto' | 'desktop' | 'tablet' | 'mobile';

const OPTIONS: { id: PreviewDevice; label: string; Icon: typeof Monitor; sublabel?: string }[] = [
  { id: 'auto', label: 'Auto', Icon: Monitor, sublabel: 'Match my screen' },
  { id: 'desktop', label: 'Desktop', Icon: Monitor, sublabel: '≥1024px' },
  { id: 'tablet', label: 'Tablet', Icon: Tablet, sublabel: '768px' },
  { id: 'mobile', label: 'Mobile', Icon: Smartphone, sublabel: '390px' },
];

export default function DevicePreviewSelect({
  value,
  onChange,
  className = '',
}: {
  value: PreviewDevice;
  onChange: (device: PreviewDevice) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const active = OPTIONS.find((o) => o.id === value) ?? OPTIONS[0];
  const ActiveIcon = active.Icon;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={`Preview: ${active.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-xs font-medium transition-colors ${
          value !== 'auto'
            ? 'bg-blue-500 text-white border border-blue-400'
            : 'bg-white/20 text-white border border-transparent hover:bg-white/25'
        }`}
      >
        <ActiveIcon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{active.label}</span>
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden z-[200]"
        >
          {OPTIONS.map(({ id, label, Icon, sublabel }) => {
            const isActive = id === value;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onChange(id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">
                  <span className="font-semibold block leading-tight">{label}</span>
                  {sublabel && <span className="text-[11px] text-slate-500">{sublabel}</span>}
                </span>
                {isActive && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
