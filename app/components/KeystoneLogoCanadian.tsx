export default function KeystoneLogoCanadian() {
  return (
    <div className="flex items-center gap-4">
      {/* Keystone with Maple Leaf Negative Space */}
      <div className="relative w-14 h-14 flex items-center justify-center">
        <svg
          viewBox="0 0 64 64"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Keystone outline in red */}
          <path
            d="M 32 8 L 48 20 L 44 44 L 20 44 L 16 20 Z"
            fill="#dc2626"
            stroke="none"
          />
          
          {/* Maple Leaf as negative space (white) */}
          <g fill="white">
            {/* Maple leaf simplified shape in center */}
            {/* Stem */}
            <rect x="30" y="28" width="4" height="8" rx="2" />
            
            {/* Center point */}
            <circle cx="32" cy="26" r="3" />
            
            {/* Top point */}
            <path d="M 32 18 L 30 22 L 34 22 Z" />
            
            {/* Left points */}
            <path d="M 20 24 L 24 26 L 22 30 Z" />
            <path d="M 16 28 L 22 28 L 20 34 Z" />
            
            {/* Right points */}
            <path d="M 44 24 L 40 26 L 42 30 Z" />
            <path d="M 48 28 L 42 28 L 44 34 Z" />
            
            {/* Bottom left */}
            <path d="M 24 36 L 26 32 L 30 36 Z" />
            
            {/* Bottom right */}
            <path d="M 40 36 L 38 32 L 34 36 Z" />
          </g>
        </svg>
      </div>

      {/* Text Logo */}
      <div className="flex flex-col leading-tight">
        <div className="text-2xl font-black text-slate-900 tracking-tight">
          KEYSTONE
        </div>
        <div className="text-sm font-medium text-slate-600 tracking-wide">
          Web Design
        </div>
      </div>
    </div>
  );
}
