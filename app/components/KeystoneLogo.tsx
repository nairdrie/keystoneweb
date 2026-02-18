export default function KeystoneLogo() {
  return (
    <div className="flex items-center gap-4">
      {/* Keystone Icon with Maple Leaf */}
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg
          viewBox="0 0 64 64"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="keystoneGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#06b6d4', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#0ea5e9', stopOpacity: 1 }} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Outer ring - keystone frame */}
          <circle cx="32" cy="32" r="30" fill="rgba(6,182,212,0.1)" stroke="url(#keystoneGradient)" strokeWidth="2" opacity="0.6" />
          
          {/* Inner glow circle */}
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(6,182,212,0.2)" strokeWidth="1" />
          
          {/* Maple Leaf - white, center */}
          <g transform="translate(32, 32) scale(0.7)">
            {/* Maple leaf SVG - classic Canada maple leaf */}
            <path
              d="M 0,-20 L 4,-8 L 14,-10 L 6,-2 L 10,8 L 0,2 L -10,8 L -6,-2 L -14,-10 L -4,-8 Z"
              fill="white"
              filter="url(#glow)"
            />
            
            {/* Leaf stem */}
            <line x1="0" y1="2" x2="0" y2="12" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
          </g>
          
          {/* Highlight accent on top-left for glass effect */}
          <ellipse cx="18" cy="18" rx="8" ry="8" fill="rgba(255,255,255,0.15)" opacity="0.5" />
        </svg>
      </div>

      {/* Text Logo */}
      <div className="flex flex-col">
        <div className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          KEYSTONE
        </div>
        <div className="text-xs font-light text-slate-400 tracking-widest">
          web design
        </div>
      </div>
    </div>
  );
}
