'use client';

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
      className={`relative inline-flex items-center h-7 rounded-full px-1 transition-colors duration-200 ${
        isActive
          ? 'bg-blue-600 hover:bg-blue-700'
          : 'bg-slate-300 hover:bg-slate-400'
      } ${className}`}
    >
      {/* Sliding ball */}
      <div
        className={`absolute w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
          isActive ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
      
      {/* Labels inside toggle */}
      <div className="relative flex items-center justify-between w-16 px-1 text-xs font-medium">
        <span
          className={`transition-opacity duration-200 ${
            !isActive ? 'text-white opacity-100' : 'opacity-0'
          }`}
        >
          {inactiveLabel}
        </span>
        <span
          className={`transition-opacity duration-200 ${
            isActive ? 'text-white opacity-100' : 'opacity-0'
          }`}
        >
          {activeLabel}
        </span>
      </div>
    </button>
  );
}
