'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User as UserIcon, Settings, LogOut, Paintbrush, LayoutDashboard,
  Eye, EyeOff, HelpCircle, ChevronDown, Plus, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import KeystoneLogo from '@/app/components/KeystoneLogo';

export interface AdminSidebarTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  comingSoon?: boolean;
}

export interface SidebarSite {
  id: string;
  siteSlug?: string;
  isPublished?: boolean;
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
  // Site switcher
  currentSiteId: string | null;
  currentSiteLabel: string;
  userSites: SidebarSite[];
  onNavigateSite: (siteId: string) => void;
  onUnpublishSite: (siteId: string) => void;
  onCreateNewSite: () => void;
}

const RAIL_WIDTH_PX = 56;
const EXPANDED_WIDTH_PX = 280;

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
  currentSiteLabel,
  userSites,
  onNavigateSite,
  onUnpublishSite,
  onCreateNewSite,
}: AdminSidebarProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [hovered, setHovered] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [siteSwitcherOpen, setSiteSwitcherOpen] = useState(false);
  const [avatarErrored, setAvatarErrored] = useState(false);
  const railRef = useRef<HTMLElement | null>(null);

  const expanded = hovered || profileOpen || siteSwitcherOpen;

  // Close menus when clicking outside the rail.
  useEffect(() => {
    if (!profileOpen && !siteSwitcherOpen) return;
    function handleClick(e: MouseEvent) {
      if (railRef.current && !railRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
        setSiteSwitcherOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileOpen, siteSwitcherOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!profileOpen && !siteSwitcherOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setProfileOpen(false);
        setSiteSwitcherOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [profileOpen, siteSwitcherOpen]);

  const userDisplayName = user
    ? ((user.user_metadata?.full_name || user.user_metadata?.name || user.email) as string)
    : '';
  const userAvatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const handleAvatarError = useCallback(() => setAvatarErrored(true), []);

  function handleSignOut() {
    setProfileOpen(false);
    onMobileClose();
    signOut().then(() => router.push('/'));
  }

  function handleTabClick(path: string) {
    onNavigate(path);
    setProfileOpen(false);
    setSiteSwitcherOpen(false);
    onMobileClose();
  }

  const avatarEl = (
    <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center text-slate-500 shrink-0 ring-2 ring-white shadow-sm">
      {userAvatarUrl && !avatarErrored ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={userAvatarUrl}
          alt={userDisplayName}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={handleAvatarError}
        />
      ) : (
        <UserIcon className="w-4 h-4" />
      )}
    </div>
  );

  // Header row: collapsed = just profile (centered); expanded = logo + switcher (left) + profile (right).
  // The profile is anchored at `right: 12px`. With avatar w-8 (32px) inside a 56px rail, that
  // resolves to left:12px which is centered — and when the rail grows to 240px the profile
  // naturally slides right with the panel's right edge.
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
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-500 hover:text-slate-800 hover:bg-white/70 transition-colors"
            >
              <Paintbrush className="w-3 h-3" />
              Design
            </Link>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white shadow-sm text-slate-800 select-none">
              <LayoutDashboard className="w-3 h-3" />
              Admin
            </span>
          </div>
        </div>

        {/* Profile avatar — always rendered. Anchored to right edge so it slides with the panel. */}
        <button
          onClick={() => {
            if (isMobile) return;
            setProfileOpen(v => !v);
            setSiteSwitcherOpen(false);
          }}
          className="absolute top-1/2 -translate-y-1/2 rounded-full hover:ring-2 hover:ring-slate-200 transition-shadow"
          style={{ right: 12 }}
          title={isMobile ? userDisplayName : (profileOpen ? 'Hide profile menu' : 'Open profile menu')}
          aria-label="Profile menu"
        >
          {avatarEl}
        </button>

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

  function renderProfilePanel(isMobile: boolean) {
    return (
      <div className="px-2 pt-2 pb-2 border-b border-slate-100 space-y-1 bg-slate-50">
        <div className="px-2 pb-1">
          <div className="text-xs font-bold text-slate-900 truncate">{userDisplayName || 'Account'}</div>
          {user?.email && userDisplayName !== user.email && (
            <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
          )}
        </div>
        {/* On mobile we still need a Design/Admin switcher in this panel since the header
            row hides them when there's no space. On desktop the switcher already lives in the header. */}
        {isMobile && (
          <div className="flex gap-1.5 px-1">
            <Link
              href="/design"
              onClick={() => { setProfileOpen(false); onMobileClose(); }}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-bold text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 rounded-md transition-colors"
            >
              <Paintbrush className="w-3 h-3" />
              Design
            </Link>
            <span className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-bold bg-red-600 text-white border border-red-600 rounded-md select-none">
              <LayoutDashboard className="w-3 h-3" />
              Admin
            </span>
          </div>
        )}
        <Link
          href="/settings"
          onClick={() => { setProfileOpen(false); onMobileClose(); }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded-md transition-colors text-left"
        >
          <LogOut className="w-3.5 h-3.5" />
          Log out
        </button>
      </div>
    );
  }

  function renderSiteSwitcher() {
    return (
      <div className="px-2 pt-2 pb-1 shrink-0 border-b border-slate-100">
        <div className="relative">
          <button
            onClick={() => { setSiteSwitcherOpen(v => !v); setProfileOpen(false); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            title="Switch site"
          >
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 shrink-0">Site</span>
            <span className="truncate flex-1 text-left">{currentSiteLabel || 'Current site'}</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform shrink-0 ${siteSwitcherOpen ? 'rotate-180' : ''}`} />
          </button>
          {siteSwitcherOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-[60] animate-in fade-in slide-in-from-top-2">
              <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                {userSites.length > 0 ? (
                  <>
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Sites</div>
                    {userSites.map(s => {
                      const isActive = currentSiteId === s.id;
                      const label = s.siteSlug || `Site ${s.id.slice(0, 8)}`;
                      return (
                        <div
                          key={s.id}
                          className={`w-full text-left px-2 py-1.5 rounded-md transition-colors text-xs flex items-center justify-between gap-1.5 ${
                            isActive ? 'bg-red-50 text-red-900 font-bold' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <button
                            onClick={() => { setSiteSwitcherOpen(false); onMobileClose(); onNavigateSite(s.id); }}
                            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                          >
                            <span
                              className={`shrink-0 w-1.5 h-1.5 rounded-full ${s.isPublished ? 'bg-green-500' : 'bg-slate-300'}`}
                              title={s.isPublished ? 'Live' : 'Draft'}
                            />
                            <span className="truncate">{label}</span>
                          </button>
                          {s.isPublished && !isActive && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!confirm('Unpublish this site? It will go offline.')) return;
                                onUnpublishSite(s.id);
                              }}
                              title="Unpublish"
                              className="p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <EyeOff className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <div className="h-px bg-slate-100 my-1 mx-1" />
                  </>
                ) : (
                  <div className="px-2 py-3 text-xs text-slate-500 text-center">No other sites</div>
                )}
                <button
                  onClick={() => { setSiteSwitcherOpen(false); onMobileClose(); onCreateNewSite(); }}
                  className="w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center gap-1.5 text-red-600 hover:bg-red-50 font-bold"
                >
                  <Plus className="w-3 h-3" />
                  Create New Site
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

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
        {/* Profile expanded panel — slides in below the header when toggled (or always on mobile). */}
        {showLabels && (profileOpen || isMobile) && renderProfilePanel(isMobile)}
        {/* Site switcher — only visible when expanded */}
        {showLabels && renderSiteSwitcher()}
        {renderTabsAndBottom(showLabels)}
      </div>
    );
  }

  return (
    <>
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
        style={{ width: expanded ? EXPANDED_WIDTH_PX : RAIL_WIDTH_PX }}
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
