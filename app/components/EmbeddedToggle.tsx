'use client';

import { Eye, Pencil } from 'lucide-react';

interface EmbeddedToggleProps {
  isActive: boolean;
  onToggle: (active: boolean) => void;
  activeLabel: string;
  inactiveLabel: string;
  className?: string;
}

export default function EmbeddedToggle({
  isActive,
  onToggle,
  activeLabel,
  inactiveLabel,
  className = '',
}: EmbeddedToggleProps) {
  return (
    <button
      onClick={() => onToggle(!isActive)}
      className={`relative inline-flex items-center h-8 w-[136px] rounded-full p-1 text-xs font-medium transition-colors duration-200 ${isActive
        ? 'bg-slate-800 border border-slate-700'
        : 'bg-white/20 border border-transparent'
        } ${className}`}
    >
      {/* Sliding Pill Background */}
      <div
        className={`absolute top-1 bottom-1 w-[64px] bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out`}
        style={{ transform: isActive ? 'translateX(62px)' : 'translateX(0)' }}
      />

      {/* Floating Labels Overlay */}
      <div className="relative flex items-center justify-between w-full z-10">
        <span
          className={`flex items-center justify-center gap-1.5 w-[64px] transition-colors duration-200 ${!isActive ? 'text-slate-900' : 'text-white'
            }`}
        >
          <Eye className="w-3 h-3" />
          {inactiveLabel}
        </span>
        <span
          className={`flex items-center justify-center gap-1.5 w-[64px] transition-colors duration-200 ${isActive ? 'text-slate-900' : 'text-white'
            }`}
        >
          <Pencil className="w-3 h-3" />
          {activeLabel}
        </span>
      </div>
    </button>
  );
}
