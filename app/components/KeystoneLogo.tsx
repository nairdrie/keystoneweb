export default function KeystoneLogo() {
  return (
    <div className="flex items-center gap-4">
      {/* Keystone Icon */}
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg
          viewBox="0 0 64 64"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Keystone shape - pentagon-like */}
          <defs>
            <linearGradient id="keystoneGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#60a5fa', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          
          {/* Main keystone body */}
          <path
            d="M 32 8 L 48 20 L 44 44 L 20 44 L 16 20 Z"
            fill="url(#keystoneGradient)"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1"
          />
          
          {/* Inner highlight for glass effect */}
          <path
            d="M 32 12 L 44 22 L 41 40 L 23 40 L 20 22 Z"
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="2"
            opacity="0.7"
          />
          
          {/* Subtle inner glow */}
          <circle cx="32" cy="28" r="8" fill="rgba(255,255,255,0.1)" />
        </svg>
      </div>

      {/* Text Logo */}
      <div className="flex flex-col">
        <div className="text-2xl font-black bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
          KEYSTONE
        </div>
        <div className="text-xs font-light text-slate-400 tracking-widest">
          web design
        </div>
      </div>
    </div>
  );
}
