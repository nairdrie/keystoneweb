// Lucide-style icon primitives used across the marketing kit.
// All icons share stroke-width 2, round caps/joins. Pass size + color as props.

const IconBase = ({ size = 24, color = "currentColor", strokeWidth = 2, children, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    {children}
  </svg>
);

const Sparkles = (p) => (
  <IconBase {...p}>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" />
  </IconBase>
);
const Smartphone = (p) => (<IconBase {...p}><rect width="14" height="20" x="5" y="2" rx="2" /><path d="M12 18h.01" /></IconBase>);
const PenTool = (p) => (<IconBase {...p}><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></IconBase>);
const TrendingUp = (p) => (<IconBase {...p}><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></IconBase>);
const CircleDollarSign = (p) => (<IconBase {...p}><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></IconBase>);
const InfinityIcon = (p) => (<IconBase {...p}><path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" /></IconBase>);
const Shield = (p) => (<IconBase {...p}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></IconBase>);
const Hammer = (p) => (<IconBase {...p}><path d="M15 12c-2.483 0-4.5 2.015-4.5 4.5"/><path d="m13 1 5 5-5 5"/><path d="M2 8a4 4 0 0 1 4-4h12"/><path d="M22 17a4 4 0 0 1-4 4H6"/><path d="m11 23-5-5 5-5"/></IconBase>);
const ChevronDown = (p) => (<IconBase {...p}><path d="m6 9 6 6 6-6" /></IconBase>);
const ArrowRight = (p) => (<IconBase {...p}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></IconBase>);
const Check = (p) => (<IconBase {...p}><path d="M20 6 9 17l-5-5" /></IconBase>);
const Star = (p) => (<IconBase {...p}><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" /></IconBase>);
const PhoneCall = (p) => (<IconBase {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></IconBase>);
const MapPin = (p) => (<IconBase {...p}><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></IconBase>);
const CalendarCheck = (p) => (<IconBase {...p}><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></IconBase>);

Object.assign(window, {
  Sparkles, Smartphone, PenTool, TrendingUp, CircleDollarSign, InfinityIcon,
  Shield, Hammer, ChevronDown, ArrowRight, Check, Star, PhoneCall, MapPin, CalendarCheck,
});
