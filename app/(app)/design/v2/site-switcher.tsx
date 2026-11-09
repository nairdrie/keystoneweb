'use client';

/**
 * Site title in the v2 editor's top bar, doubling as a switcher between the
 * owner's sites (same list as the admin dashboard's "Switch site").
 */
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Plus } from 'lucide-react';

interface UserSite { id: string; siteSlug?: string; isPublished?: boolean }

export default function SiteSwitcher({
  siteId,
  title,
  subtitle,
  onSwitch,
}: {
  siteId: string;
  title: string;
  subtitle: string;
  /** Navigate to another site's editor (or any href), after pending saves finish. */
  onSwitch: (href: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sites, setSites] = useState<UserSite[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  useEffect(() => {
    if (!open || sites) return;
    fetch('/api/user/sites', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { sites: [] }))
      .then((d) => setSites(Array.isArray(d?.sites) ? d.sites : []))
      .catch(() => setSites([]));
  }, [open, sites]);

  const go = (href: string) => { setOpen(false); onSwitch(href); };

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-0 max-w-[260px] items-center gap-1.5 rounded-lg px-2 py-1 text-left hover:bg-slate-100"
        title="Switch site"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
          <span className="block truncate text-[11px] text-slate-500">{subtitle}</span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl" role="menu">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Your sites</div>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {!sites ? (
              <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
            ) : (
              sites.map((s) => {
                const active = s.id === siteId;
                const label = active ? title : s.siteSlug || `Site ${s.id.slice(0, 8)}`;
                return (
                  <button
                    key={s.id}
                    role="menuitem"
                    onClick={() => (active ? setOpen(false) : go(`/design?siteId=${encodeURIComponent(s.id)}`))}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${active ? 'bg-blue-50 font-bold text-blue-900' : 'text-slate-700 hover:bg-slate-100'}`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.isPublished ? 'bg-green-500' : 'bg-slate-300'}`} title={s.isPublished ? 'Live' : 'Draft'} />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
          <div className="mx-1 my-1 h-px bg-slate-100" />
          <button role="menuitem" onClick={() => go('/onboarding')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-blue-600 hover:bg-blue-50">
            <Plus className="h-3.5 w-3.5" /> Create new site
          </button>
        </div>
      )}
    </div>
  );
}
