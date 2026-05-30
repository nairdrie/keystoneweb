'use client';

interface ArchieAIIconProps {
  className?: string;
  /** Static (no animation) — used in tiny rail icons. */
  static?: boolean;
}

/**
 * Stylized "Archie" mark — matches the Archie mascot identity (rounded head
 * silhouette + glowing antenna) but rendered as a flat, brand-tinted icon
 * suitable for sidebar use. Gradient + sparkle accents give it a flashy AI
 * feel without leaning on the heavy character art.
 */
export default function ArchieAIIcon({ className = 'w-4 h-4', static: isStatic = false }: ArchieAIIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="archie-ai-body" x1="4" y1="6" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <radialGradient id="archie-ai-dot" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fecaca" />
          <stop offset="60%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#b91c1c" />
        </radialGradient>
      </defs>

      {/* antenna */}
      <line x1="12" y1="3.2" x2="12" y2="6.4" stroke="url(#archie-ai-body)" strokeWidth="1.5" strokeLinecap="round" />
      {/* antenna glow dot */}
      <circle cx="12" cy="2.6" r="1.6" fill="url(#archie-ai-dot)">
        {!isStatic && (
          <animate attributeName="r" values="1.4;1.9;1.4" dur="1.8s" repeatCount="indefinite" />
        )}
      </circle>

      {/* head/body capsule */}
      <rect x="4.2" y="6.4" width="15.6" height="12.4" rx="5.2" fill="url(#archie-ai-body)" />

      {/* eyes */}
      <circle cx="9.4" cy="12.4" r="1.5" fill="white" />
      <circle cx="14.6" cy="12.4" r="1.5" fill="white" />
      <circle cx="9.4" cy="12.4" r="0.7" fill="#1e293b" />
      <circle cx="14.6" cy="12.4" r="0.7" fill="#1e293b" />

      {/* smile */}
      <path d="M9.6 15.4 Q12 17.2 14.4 15.4" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* sparkle accent — the "AI flash" */}
      <g transform="translate(19 6.5)">
        <path
          d="M0 -2.2 L0.7 -0.7 L2.2 0 L0.7 0.7 L0 2.2 L-0.7 0.7 L-2.2 0 L-0.7 -0.7 Z"
          fill="#fde047"
        >
          {!isStatic && (
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1;1.25;1"
              dur="1.6s"
              repeatCount="indefinite"
              additive="sum"
            />
          )}
        </path>
      </g>
    </svg>
  );
}
