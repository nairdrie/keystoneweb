'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import Link from 'next/link';
import {
  Paintbrush, LayoutDashboard,
  Eye, EyeOff, HelpCircle, X,
} from 'lucide-react';
import KeystoneLogo from '@/app/components/KeystoneLogo';
import ProfileDropdown from '@/app/components/ProfileDropdown';

export interface AdminSidebarTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  comingSoon?: boolean;
}

interface AdminSidebarProps {
  tabs: AdminSidebarTab[];
  activeTabId: string;
  inboxUnread: number;
  showAllFeatures: boolean;
  onToggleShowAllFeatures: () => void;
  onOpenWalkthrough: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onNavigate: (path: string) => void;
  currentSiteId: string | null;
}

const RAIL_WIDTH_PX = 56;
// Fallback expanded width — overridden once we measure the natural header width.
const EXPANDED_WIDTH_FALLBACK_PX = 280;
// SSR / no-window guard for useLayoutEffect.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function AdminSidebar({
  tabs,
  activeTabId,
  inboxUnread,
  showAllFeatures,
  onToggleShowAllFeatures,
  onOpenWalkthrough,
  mobileOpen,
  onMobileClose,
  onNavigate,
  currentSiteId,
}: AdminSidebarProps) {
  const [hovered, setHovered] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [expandedWidth, setExpandedWidth] = useState<number>(EXPANDED_WIDTH_FALLBACK_PX);
  const railRef = useRef<HTMLElement | null>(null);
  const headerMeasureRef = useRef<HTMLDivElement | null>(null);

  const expanded = hovered || profileOpen;

  // Measure just the left-group (logo + switcher) natural width and compute the panel width
  // from that plus the fixed avatar + padding budget. This avoids double-spacing from a flex
  // `gap-*` plus explicit spacers and ends up narrower than the designer's sidebar, which is
  // what we want for a compact admin overlay.
  useIsoLayoutEffect(() => {
    if (!headerMeasureRef.current) return;
    const leftGroup = Math.ceil(headerMeasureRef.current.getBoundingClientRect().width);
    // 12 (left pad) + leftGroup + 16 (min gap to avatar) + 32 (avatar w-8) + 12 (right pad)
    const total = 12 + leftGroup + 16 + 32 + 12;
    if (total > RAIL_WIDTH_PX) setExpandedWidth(total);
  }, []);

  function handleTabClick(path: string) {
    onNavigate(path);
    setProfileOpen(false);
    onMobileClose();
  }

  // Header row: collapsed = just profile (centered); expanded = logo + switcher (left) + profile (right).
  // The profile is anchored at `right: 12px`. With avatar w-8 (32px) inside a 56px rail, that
  // resolves to left:12px = centered. When the rail grows to its measured expanded width the
  // profile slides right with the panel's right edge.
  function renderHeader(showLabels: boolean, isMobile: boolean) {
    return (
      <div className="relative h-12 shrink-0 border-b border-slate-100">
        {/* Logo + Design/Admin switcher — only visible when expanded */}
        <div
          className={`absolute inset-y-0 left-3 flex items-center gap-2 transition-opacity duration-200 ${
            showLabels ? 'opacity-100 delay-75' : 'opacity-0 pointer-events-none'
          }`}
        >
          <Link href="/" aria-label="Keystone home" className="shrink-0">
            <KeystoneLogo href={undefined} size="md" showText={false} />
          </Link>
          <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-full">
            <Link
              href={`/design${currentSiteId ? `?siteId=${currentSiteId}` : ''}`}
              onClick={() => { setProfileOpen(false); onMobileClose(); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-white/70 transition-colors whitespace-nowrap"
            >
              <Paintbrush className="w-3 h-3" />
              Design
            </Link>
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white shadow-sm text-slate-800 select-none whitespace-nowrap">
              <LayoutDashboard className="w-3 h-3" />
              Admin
            </span>
          </div>
        </div>

        {/* Profile avatar — always rendered. Anchored to right edge so it slides with the panel. */}
        <div className="absolute top-1/2 -translate-y-1/2" style={{ right: 12 }}>
          <ProfileDropdown
            showSwitcher={false}
            onOpenChange={setProfileOpen}
            buttonClassName="w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-slate-300 text-slate-500 hover:text-slate-700 rounded-full transition-colors flex-shrink-0 overflow-hidden ring-2 ring-white shadow-sm"
          />
        </div>

        {/* Mobile-only close button stays near the right */}
        {isMobile && (
          <button
            onClick={onMobileClose}
            className="absolute top-1/2 -translate-y-1/2 right-12 p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  // Hidden mirror: only the left group (logo + switcher) in its natural layout. The total
  // expanded width is computed from this measurement plus the fixed avatar + padding budget
  // in useIsoLayoutEffect above.
  const headerMeasureMirror = (
    <div
      ref={headerMeasureRef}
      aria-hidden
      className="invisible pointer-events-none fixed -left-[9999px] top-0 inline-flex items-center gap-2 whitespace-nowrap"
    >
      <KeystoneLogo href={undefined} size="md" showText={false} />
      <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-full">
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold">
          <Paintbrush className="w-3 h-3" />
          Design
        </span>
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold">
          <LayoutDashboard className="w-3 h-3" />
          Admin
        </span>
      </div>
    </div>
  );

  function renderTabsAndBottom(showLabels: boolean) {
    return (
      <>
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-0.5">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTabId === tab.id;
            const badge = tab.id === 'inbox' && inboxUnread > 0 ? inboxUnread : null;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.path)}
                title={showLabels ? undefined : tab.label}
                className={`group relative w-full flex items-center ${showLabels ? 'gap-2.5 px-2.5' : 'justify-center px-0'} py-2 rounded-lg text-xs font-bold transition-colors ${
                  isActive
                    ? 'bg-red-50 text-red-700'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-red-600" />
                )}
                <Icon className="w-4 h-4 shrink-0" />
                {showLabels && (
                  <span className="truncate flex-1 text-left">{tab.label}</span>
                )}
                {showLabels && tab.comingSoon && (
                  <span className="px-1 py-px text-[8px] font-black uppercase tracking-wide bg-slate-100 text-slate-400 rounded-full">
                    Soon
                  </span>
                )}
                {badge !== null && (
                  showLabels ? (
                    <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-black px-1">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  ) : (
                    <span className="absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-black px-0.5 ring-2 ring-white">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex-none border-t border-slate-100 p-2 space-y-0.5">
          <button
            onClick={() => { onToggleShowAllFeatures(); }}
            title={showLabels ? undefined : (showAllFeatures ? 'Showing all features' : 'Showing active only')}
            className={`w-full flex items-center ${showLabels ? 'gap-2.5 px-2.5' : 'justify-center px-0'} py-2 rounded-lg text-xs font-bold transition-colors ${
              showAllFeatures
                ? 'text-slate-700 hover:bg-slate-100'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            {showAllFeatures ? <Eye className="w-4 h-4 shrink-0" /> : <EyeOff className="w-4 h-4 shrink-0" />}
            {showLabels && (
              <span className="truncate text-left">
                {showAllFeatures ? 'All features' : 'Active only'}
              </span>
            )}
          </button>
          <button
            onClick={() => { onOpenWalkthrough(); onMobileClose(); }}
            title={showLabels ? undefined : 'Show walkthrough'}
            className={`w-full flex items-center ${showLabels ? 'gap-2.5 px-2.5' : 'justify-center px-0'} py-2 rounded-lg text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors`}
          >
            <HelpCircle className="w-4 h-4 shrink-0" />
            {showLabels && <span className="truncate text-left">Help</span>}
          </button>
        </div>
      </>
    );
  }

  function renderBody(showLabels: boolean, isMobile: boolean) {
    return (
      <div className="h-full flex flex-col">
        {renderHeader(showLabels, isMobile)}
        {renderTabsAndBottom(showLabels)}
      </div>
    );
  }

  return (
    <>
      {/* Off-screen mirror used to size the expanded panel to its natural content width. */}
      {headerMeasureMirror}

      {/* ─────────────────────────────────────────────────────────────
          DESKTOP: thin icon rail, expands to overlay on hover.
         ───────────────────────────────────────────────────────────── */}
      <aside
        ref={railRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-40 bg-white border-r border-slate-200 transition-[width,box-shadow] duration-200 ease-out ${
          expanded ? 'shadow-2xl' : ''
        }`}
        style={{ width: expanded ? expandedWidth : RAIL_WIDTH_PX }}
        aria-label="Admin navigation"
      >
        {renderBody(expanded, false)}
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          MOBILE: slide-in drawer.
         ───────────────────────────────────────────────────────────── */}
      <div
        className={`md:hidden fixed inset-0 z-50 ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-200 ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={onMobileClose}
        />
        <aside
          role="dialog"
          aria-label="Admin navigation"
          className={`absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderBody(true, true)}
        </aside>
      </div>
    </>
  );
}

export { RAIL_WIDTH_PX };
