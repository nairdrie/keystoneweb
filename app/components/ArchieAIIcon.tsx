'use client';

interface ArchieAIIconProps {
  className?: string;
}

/**
 * Clean four-point AI sparkle mark — the iconography most readers
 * already associate with generative AI tools — drawn with a violet→
 * pink gradient so it sits inside the AI Builder's brand surface.
 * A second small sparkle adds a flash of motion without leaning on
 * mascot art.
 */
export default function ArchieAIIcon({ className = 'w-4 h-4' }: ArchieAIIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="archie-ai-grad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>

      {/* Primary four-point sparkle — concave sides for that polished AI mark feel. */}
      <path
        d="M13 2 C13 6.5 14 7.5 22 11 C14 14.5 13 15.5 13 22 C13 15.5 12 14.5 4 11 C12 7.5 13 6.5 13 2 Z"
        fill="url(#archie-ai-grad)"
        transform="translate(-1.5 0)"
      />

      {/* Accent sparkle (top-right) */}
      <path
        d="M20 3 C20 4.6 20.3 4.9 22 5.5 C20.3 6.1 20 6.4 20 8 C20 6.4 19.7 6.1 18 5.5 C19.7 4.9 20 4.6 20 3 Z"
        fill="url(#archie-ai-grad)"
        opacity="0.9"
      />
    </svg>
  );
}
