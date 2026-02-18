export default function KeystoneLogoLight() {
  return (
    <div className="flex items-center gap-3">
      {/* Simplified Keystone Icon */}
      <div className="relative w-10 h-10 flex items-center justify-center">
        <svg
          viewBox="0 0 64 64"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Simple solid keystone shape */}
          <path
            d="M 32 8 L 48 20 L 44 44 L 20 44 L 16 20 Z"
            fill="#2563eb"
            stroke="none"
          />
          
          {/* Subtle highlight */}
          <path
            d="M 32 12 L 44 22 L 41 40 L 23 40 Z"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* Text Logo */}
      <div className="flex flex-col leading-tight">
        <div className="text-xl font-black text-slate-900 tracking-tight">
          KEYSTONE
        </div>
        <div className="text-xs font-light text-slate-500 tracking-widest">
          web design
        </div>
      </div>
    </div>
  );
}
