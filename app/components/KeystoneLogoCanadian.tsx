export default function KeystoneLogoCanadian() {
  return (
    <div className="flex items-center gap-4">
      {/* Keystone Icon with Proper Maple Leaf */}
      <div className="relative w-14 h-14 flex items-center justify-center">
        <svg
          viewBox="0 0 64 64"
          className="w-full h-full drop-shadow-md"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Red Keystone Background */}
          <defs>
            <linearGradient id="keystoneRed" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#dc2626', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#b91c1c', stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          
          {/* Main Keystone Shape */}
          <path
            d="M 32 6 L 50 18 L 46 48 L 18 48 L 14 18 Z"
            fill="url(#keystoneRed)"
            stroke="#991b1b"
            strokeWidth="0.5"
          />
          
          {/* Keystone highlight for depth */}
          <path
            d="M 32 10 L 46 20 L 43 44 L 21 44 L 18 20 Z"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.5"
          />
          
          {/* White Maple Leaf - Centered and Clean */}
          <g transform="translate(32, 28)">
            {/* Leaf outline with proper points */}
            <path
              d="M 0,-10 L 2,-5 L 6,-6 L 3,-1 L 6,3 L 2,1 L 0,6 L -2,1 L -6,3 L -3,-1 L -6,-6 L -2,-5 Z"
              fill="white"
              stroke="none"
            />
            
            {/* Leaf details/veins */}
            <path
              d="M 0,-10 L 0,5"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="0.5"
              fill="none"
              opacity="0.7"
            />
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
