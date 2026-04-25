// Lucide-style primitives used in the builder kit.

const Base = ({ size = 20, color = "currentColor", strokeWidth = 2, children, style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    {children}
  </svg>
);

const ESparkles = (p) => (<Base {...p}><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></Base>);
const EMenu = (p) => (<Base {...p}><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></Base>);
const EClose = (p) => (<Base {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></Base>);
const EChevronDown = (p) => (<Base {...p}><path d="m6 9 6 6 6-6"/></Base>);
const ESave = (p) => (<Base {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></Base>);
const EUndo = (p) => (<Base {...p}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></Base>);
const ERedo = (p) => (<Base {...p}><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/></Base>);
const ESmartphone = (p) => (<Base {...p}><rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/></Base>);
const EMonitor = (p) => (<Base {...p}><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></Base>);
const EPlay = (p) => (<Base {...p}><polygon points="6 3 20 12 6 21 6 3"/></Base>);
const ELoader = (p) => (<Base {...p}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></Base>);
const EPlus = (p) => (<Base {...p}><path d="M5 12h14"/><path d="M12 5v14"/></Base>);
const EArrowUp = (p) => (<Base {...p}><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></Base>);
const EImage = (p) => (<Base {...p}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></Base>);
const EType = (p) => (<Base {...p}><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></Base>);
const EPalette = (p) => (<Base {...p}><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></Base>);
const EFile = (p) => (<Base {...p}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><polyline points="14 2 14 8 20 8"/></Base>);
const EGlobe = (p) => (<Base {...p}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></Base>);
const ECheck = (p) => (<Base {...p}><path d="M20 6 9 17l-5-5"/></Base>);
const EArrowRight = (p) => (<Base {...p}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></Base>);
const EHammer = (p) => (<Base {...p}><path d="M15 12c-2.483 0-4.5 2.015-4.5 4.5"/><path d="m13 1 5 5-5 5"/><path d="M2 8a4 4 0 0 1 4-4h12"/><path d="M22 17a4 4 0 0 1-4 4H6"/><path d="m11 23-5-5 5-5"/></Base>);

Object.assign(window, {
  ESparkles, EMenu, EClose, EChevronDown, ESave, EUndo, ERedo, ESmartphone,
  EMonitor, EPlay, ELoader, EPlus, EArrowUp, EImage, EType, EPalette,
  EFile, EGlobe, ECheck, EArrowRight, EHammer,
});
