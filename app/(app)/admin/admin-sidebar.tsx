'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User as UserIcon, Settings, LogOut, Paintbrush, LayoutDashboard,
  Eye, EyeOff, HelpCircle, ChevronRight, X,
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
}

const RAIL_WIDTH_PX = 56;

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
}: AdminSidebarProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [hovered, setHovered] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarErrored, setAvatarErrored] = useState(false);
  const railRef = useRef<HTMLElement | null>(null);

  const expanded = hovered || profileOpen;

  // Close profile panel when clicking outside the rail (desktop only).
  useEffect(() => {
    if (!profileOpen) return;
    function handleClick(e: MouseEvent) {
      if (railRef.current && !railRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileOpen]);

  // Close profile panel on Escape.
  useEffect(() => {
    if (!profileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setProfileOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [profileOpen]);

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
    onMobileClose();
  }

  // Avatar element used both in collapsed rail and expanded sidebar.
  const avatar = (size: 'sm' | 'md') => {
    const cls = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
    return (
      <div className={`${cls} rounded-full overflow-hidden bg-slate-200 flex items-center justify-center text-slate-500 shrink-0`}>
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
  };

  // The content rendered inside the sidebar (shared between desktop overlay and mobile drawer).
  // `forceExpanded` = always render labels (mobile drawer or desktop expanded state).
  // This is a render helper (not a child component) so its state stays in this parent.
  function renderBody(forceExpanded: boolean, isMobile: boolean) {
    const showLabels = forceExpanded;

    return (
      <div className="h-full flex flex-col">
        {/* ── Top: profile + (mobile only) close ── */}
        <div className={`flex items-center gap-2 px-2.5 pt-3 pb-2 ${showLabels ? '' : 'justify-center'}`}>
          <button
            onClick={() => {
              if (isMobile) return;
              setProfileOpen(v => !v);
            }}
            className={`flex items-center gap-2.5 rounded-full transition-colors ${
              showLabels ? 'flex-1 p-1 hover:bg-slate-100' : 'p-1 hover:bg-slate-100'
            }`}
            title={isMobile ? userDisplayName : (profileOpen ? 'Hide profile menu' : 'Open profile menu')}
            aria-label="Profile menu"
          >
            {avatar('sm')}
            {showLabels && (
              <div className="min-w-0 flex-1 text-left">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {userDisplayName || 'Account'}
                </div>
                {user?.email && userDisplayName !== user.email && (
                  <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
                )}
              </div>
            )}
            {showLabels && !isMobile && (
              <ChevronRight
                className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 mr-1 ${profileOpen ? 'rotate-90' : ''}`}
              />
            )}
          </button>
          {isMobile && (
            <button
              onClick={onMobileClose}
              className="p-2 -mr-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg shrink-0"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Profile expanded panel (desktop only when profileOpen, mobile always shown) */}
        {showLabels && (profileOpen || isMobile) && (
          <div className="px-2 pb-2 border-b border-slate-100 space-y-1">
            <div className="flex gap-1.5 px-1">
              <Link
                href="/design"
                onClick={() => { setProfileOpen(false); onMobileClose(); }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-bold text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 rounded-md transition-colors"
              >
                <Paintbrush className="w-3 h-3" />
                Design
              </Link>
              <span
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-bold bg-red-600 text-white border border-red-600 rounded-md select-none"
              >
                <LayoutDashboard className="w-3 h-3" />
                Admin
              </span>
            </div>
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
        )}

        {/* ── Tabs ── */}
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

        {/* ── Bottom: toggle + help ── */}
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
      </div>
    );
  }

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          DESKTOP: thin icon rail, expands as overlay on hover.
          The aside grows from 56→240px on hover. Because the main
          content has a fixed md:pl-14 (56px) gutter, the expanded
          width overlays content rather than reflowing it.
         ───────────────────────────────────────────────────────────── */}
      <aside
        ref={railRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-40 bg-white border-r border-slate-200 transition-[width,box-shadow] duration-200 ease-out ${
          expanded ? 'shadow-2xl' : ''
        }`}
        style={{ width: expanded ? 240 : RAIL_WIDTH_PX }}
        aria-label="Admin navigation"
      >
        {/* Logo strip */}
        <div className="h-12 flex items-center justify-center border-b border-slate-200 shrink-0">
          <Link href="/" aria-label="Keystone home">
            <KeystoneLogo href={undefined} size="md" showText={false} />
          </Link>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0">
          {renderBody(expanded, false)}
        </div>
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
          <div className="h-12 flex items-center px-3 border-b border-slate-200 shrink-0">
            <Link
              href="/"
              onClick={onMobileClose}
              className="flex items-center gap-2"
              aria-label="Keystone home"
            >
              <KeystoneLogo href={undefined} size="md" showText={false} />
              <span className="text-sm font-black text-slate-900">Keystone</span>
            </Link>
          </div>
          <div className="flex-1 min-h-0">
            {renderBody(true, true)}
          </div>
        </aside>
      </div>
    </>
  );
}

export { RAIL_WIDTH_PX };
