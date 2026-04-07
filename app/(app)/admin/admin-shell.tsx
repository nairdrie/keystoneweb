'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { ChevronDown, Plus, Paintbrush, LayoutDashboard, ExternalLink, Pencil, Check, X, BarChart3, Globe, ShoppingBag, Calendar, Loader2, Menu, Mail, HelpCircle, TrendingUp, Search, Package, CalendarDays, MessageSquare, Link2, Eye, EyeOff, BookOpen, UtensilsCrossed, FileImage, Users } from 'lucide-react';
import KeystoneLogo from '@/app/components/KeystoneLogo';
import ProfileDropdown from '@/app/components/ProfileDropdown';
import AlertModal from '@/app/components/ui/AlertModal';
import EditorLoadingScreen from '@/app/components/EditorLoadingScreen';
import WalkthroughModal, { WalkthroughStep } from '@/app/components/WalkthroughModal';
import { AdminContext, AdminSiteData, UsageData, UsagePlan, SiteUsageBreakdown } from './admin-context';

interface Site {
  id: string;
  siteSlug?: string;
  selectedTemplateId: string;
  businessType: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  isPublished?: boolean;
}

interface TabDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  core?: boolean;
  requiresBlock?: string;
  comingSoon?: boolean;
}

const ALL_TABS: TabDef[] = [
  // Core — always visible
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/admin/analytics', core: true },
  { id: 'seo',       label: 'SEO',       icon: Globe,     path: '/admin/seo',       core: true },
  { id: 'domains',   label: 'Domains',   icon: Link2,     path: '/admin/domains',   core: true },
  // Optional — shown when site has the matching block, or when "show all" is on
  { id: 'booking',   label: 'Booking',   icon: Calendar,  path: '/admin/booking',   requiresBlock: 'booking' },
  { id: 'ecommerce', label: 'Ecommerce', icon: ShoppingBag, path: '/admin/ecommerce', requiresBlock: 'productGrid' },
  { id: 'inbox',     label: 'Inbox',     icon: Mail,      path: '/admin/inbox' },
  { id: 'media',    label: 'Media',     icon: FileImage, path: '/admin/media', core: true },
  // Coming soon — only appear when "show all" is on
  { id: 'events', label: 'Events', icon: CalendarDays, path: '/admin/events', requiresBlock: 'events' },
  { id: 'blog',   label: 'Blog',   icon: BookOpen,    path: '/admin/blog',   requiresBlock: 'blog' },
  { id: 'menu',   label: 'Menu',   icon: UtensilsCrossed, path: '/admin/menu', requiresBlock: 'menu' },
  { id: 'membership', label: 'Members', icon: Users, path: '/admin/membership', requiresBlock: 'membershipGate' },
];

const SHOW_ALL_KEY = 'ks_admin_show_all_features';

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const siteId = searchParams.get('siteId');

  const [site, setSite] = useState<AdminSiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteTitle, setSiteTitle] = useState('My Website');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [showSiteSwitcher, setShowSiteSwitcher] = useState(false);
  const [userSites, setUserSites] = useState<Site[]>([]);
  const [isProUser, setIsProUser] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title?: string; message: string; type?: 'success' | 'error' | 'info' }>({ isOpen: false, message: '' });
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [inboxUnread, setInboxUnread] = useState(0);

  function refreshInboxUnread() {
    const id = siteId;
    if (!id) return;
    fetch(`/api/contact/inbox?siteId=${id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.unread != null) setInboxUnread(d.unread); })
      .catch(() => {});
  }
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [usagePlan, setUsagePlan] = useState<UsagePlan | null>(null);
  const [siteBreakdown, setSiteBreakdown] = useState<SiteUsageBreakdown[]>([]);
  const [siteBlockTypes, setSiteBlockTypes] = useState<Set<string>>(new Set());
  const [showAllFeatures, setShowAllFeatures] = useState(true);

  const hasFetchedRef = useRef<string | null>(null);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);

  const ADMIN_WALKTHROUGH_KEY = 'ks_seen_admin_walkthrough';

  // Load persisted toggle preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SHOW_ALL_KEY);
      // default is true; only false if explicitly stored as '0'
      setShowAllFeatures(stored !== '0');
    }
  }, []);

  function toggleShowAllFeatures() {
    setShowAllFeatures(prev => {
      const next = !prev;
      localStorage.setItem(SHOW_ALL_KEY, next ? '1' : '0');
      return next;
    });
  }

  const adminSteps: WalkthroughStep[] = [
    {
      icon: <TrendingUp className="w-7 h-7" />,
      title: 'Analytics',
      description: 'See how many visitors your site gets, where they come from, and which pages they view most.',
    },
    {
      icon: <Search className="w-7 h-7" />,
      title: 'SEO',
      description: 'Update your page titles, meta descriptions, and social previews to rank better in search results.',
    },
    {
      icon: <Package className="w-7 h-7" />,
      title: 'Ecommerce',
      description: 'Set up your online store, manage products, and track orders — all from one place.',
    },
    {
      icon: <CalendarDays className="w-7 h-7" />,
      title: 'Booking',
      description: 'Enable appointment booking so customers can schedule time with you directly from your site.',
    },
    {
      icon: <Link2 className="w-7 h-7" />,
      title: 'Domains',
      description: 'Manage your custom domain, check DNS status, and configure domain settings for this site.',
    },
    {
      icon: <MessageSquare className="w-7 h-7" />,
      title: 'Inbox',
      description: 'Read and reply to messages sent through your site\'s contact form.',
    },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(ADMIN_WALKTHROUGH_KEY)) {
      setShowWalkthrough(true);
    }
  }, []);

  function handleCloseWalkthrough() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ADMIN_WALKTHROUGH_KEY, '1');
    }
    setShowWalkthrough(false);
    setWalkthroughStep(0);
  }

  function openWalkthrough() {
    setWalkthroughStep(0);
    setShowWalkthrough(true);
  }

  const palette = { primary: '#dc2626', secondary: '#1e293b', accent: '#f1f5f9' };

  // Auth guard with returnTo
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      router.push(`/signin?returnTo=${returnTo}`);
      return;
    }
    if (siteId && hasFetchedRef.current !== siteId) {
      hasFetchedRef.current = siteId;
      fetchSite(siteId);
    } else if (!siteId && !hasFetchedRef.current) {
      hasFetchedRef.current = '__redirecting__';
      redirectToLatest();
    }
  }, [user, authLoading, siteId]);

  // Fetch user sites for switcher
  useEffect(() => {
    if (!user) return;
    fetch('/api/user/sites', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.sites) setUserSites(d.sites.map((s: any) => ({
          ...s,
          isPublished: s.isPublished ?? false,
        })));
      })
      .catch(() => {});
  }, [user]);

  // Subscription check
  useEffect(() => {
    if (!user) return;
    fetch('/api/user/subscription', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.subscription?.subscription_status === 'active') {
          if (d.subscription.subscription_plan?.toLowerCase().includes('pro')) setIsProUser(true);
        }
      })
      .catch(() => {});
  }, [user]);

  // Usage data fetch
  useEffect(() => {
    if (!user) return;
    fetch('/api/user/usage', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.hasSubscription && d.usage) {
          setUsage(d.usage);
          setUsagePlan(d.plan);
          setSiteBreakdown(d.siteBreakdown || []);
        }
      })
      .catch(() => {});
  }, [user]);

  async function redirectToLatest() {
    try {
      const res = await fetch('/api/user/latest-site', { credentials: 'include' });
      if (res.ok) {
        const { siteId: id } = await res.json();
        if (id) {
          const tab = ALL_TABS.find(t => pathname.startsWith(t.path))?.path ?? '/admin/analytics';
          router.replace(`${tab}?siteId=${id}`);
          return;
        }
      }
    } catch {}
    router.push('/onboarding');
  }

  async function fetchSite(id: string) {
    setLoading(true);
    try {
      // Fetch site data and pages concurrently
      const [siteRes, pagesRes] = await Promise.all([
        fetch(`/api/sites?id=${id}`, { credentials: 'include' }),
        fetch(`/api/pages?siteId=${id}`, { credentials: 'include' }),
      ]);
      if (!siteRes.ok) { router.push('/onboarding'); return; }
      const data = await siteRes.json();
      setSite(data);
      setSiteTitle(data.siteSlug || data.designData?.siteTitle || 'My Website');

      // Detect which block types exist in this site's pages
      if (pagesRes.ok) {
        const pagesData = await pagesRes.json();
        const pages: any[] = pagesData.pages || pagesData || [];
        const blockTypes = new Set<string>();
        for (const page of pages) {
          const blocks: any[] = page.design_data?.blocks ?? page.design_data?.__blocks ?? [];
          for (const block of blocks) {
            if (block?.type) blockTypes.add(block.type);
          }
        }
        setSiteBlockTypes(blockTypes);
      }

      // Fetch inbox unread count
      fetch(`/api/contact/inbox?siteId=${id}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.unread != null) setInboxUnread(d.unread); })
        .catch(() => {});
    } catch {
      router.push('/onboarding');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveTitle() {
    if (!site || !renameDraft.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/sites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteId: site.id,
          title: renameDraft.trim(),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSite(updated.site || updated);
        setSiteTitle(renameDraft.trim());
        setIsRenaming(false);
      }
    } catch {}
    finally { setSaving(false); }
  }

  function navigateTab(path: string) {
    router.push(`${path}${siteId ? `?siteId=${siteId}` : ''}`);
  }

  function navigateSite(newSiteId: string) {
    setShowSiteSwitcher(false);
    const tab = ALL_TABS.find(t => pathname.startsWith(t.path))?.path ?? '/admin/analytics';
    router.push(`${tab}?siteId=${newSiteId}`);
  }

  if (loading || authLoading) return <EditorLoadingScreen />;
  if (!site) return null;

  // Determine which tabs to show
  const visibleTabs = ALL_TABS.filter(tab => {
    if (tab.core) return true;
    if (tab.id === 'inbox') {
      // Inbox is visible if the site has a contact form block OR a published subdomain
      // (emails can arrive via {subdomain}@kswd.ca even without a contact form)
      return showAllFeatures || siteBlockTypes.has('contact_form') || !!site.publishedDomain;
    }
    if (showAllFeatures) return true;
    if (tab.requiresBlock) return siteBlockTypes.has(tab.requiresBlock);
    return false; // coming-soon tabs without a block: only visible with showAllFeatures
  });

  const activeTabId = ALL_TABS.find(t => pathname.startsWith(t.path))?.id ?? 'analytics';
  const liveUrl = site.customDomain
    ? `https://${site.customDomain}`
    : site.publishedDomain
    ? `https://${site.publishedDomain}.kswd.ca`
    : null;
  const displayDomain = site.customDomain || (site.publishedDomain ? `${site.publishedDomain}.kswd.ca` : null);

  return (
    <AdminContext.Provider value={{ siteId, site, siteTitle, setSiteTitle, isProUser, palette, usage, usagePlan, siteBreakdown, siteBlockTypes, refreshInboxUnread }}>
      <div className="fixed inset-0 flex flex-col overflow-hidden bg-slate-50">

        {/* ── Top Bar ── */}
        <div className="flex-none flex items-center justify-between px-3 h-12 bg-white border-b border-slate-200 z-10 shrink-0">
          <div className="flex items-center gap-2">
            <div onClick={() => router.push('/')} className="cursor-pointer shrink-0">
              <KeystoneLogo href={undefined} size="md" showText={false} />
            </div>

            {/* Design / Admin switcher */}
            <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-full">
              <button
                onClick={() => router.push(`/design${siteId ? `?siteId=${siteId}` : ''}`)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-white/70 transition-colors"
              >
                <Paintbrush className="w-3 h-3" />
                Design
              </button>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white shadow-sm text-slate-800 select-none">
                <LayoutDashboard className="w-3 h-3" />
                Admin
              </span>
            </div>
          </div>

          <button
            onClick={openWalkthrough}
            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Show walkthrough"
            aria-label="Show walkthrough"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <ProfileDropdown buttonClassName="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-full transition-colors flex-shrink-0 overflow-hidden" />
        </div>

        {/* ── Hero / Site Header ── */}
        <div className="flex-none bg-white border-b border-slate-200 px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
          {/* Site name row */}
          <div className="flex items-start justify-between gap-2 sm:gap-4">
            <div className="min-w-0">
              {isRenaming ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={e => setRenameDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setIsRenaming(false); }}
                    className="text-xl sm:text-2xl font-black text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-1 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none w-48 sm:w-80"
                    placeholder="Site name"
                  />
                  <button onClick={handleSaveTitle} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors shrink-0">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  </button>
                  <button onClick={() => setIsRenaming(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                    {siteTitle || 'Untitled Site'} <span className="text-slate-400 font-light hidden sm:inline">Dashboard</span>
                  </h1>
                  <button
                    onClick={() => { setRenameDraft(siteTitle); setIsRenaming(true); }}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0 mt-0.5"
                  >
                    <Pencil className="w-3 h-3" />
                    <span className="hidden sm:inline">Rename</span>
                  </button>
                </div>
              )}

              {/* Site URL + switcher */}
              {!isRenaming && (
                <div className="flex items-center gap-2 mt-1">
                  {liveUrl ? (
                    <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
                      {displayDomain} ↗
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Not yet published</span>
                  )}
                  <span className="text-slate-200">·</span>
                  <div className="relative">
                    <button
                      onClick={() => setShowSiteSwitcher(v => !v)}
                      className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
                    >
                      Switch site
                      <ChevronDown className={`w-3 h-3 transition-transform ${showSiteSwitcher ? 'rotate-180' : ''}`} />
                    </button>

                    {showSiteSwitcher && (
                      <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-[9999] animate-in fade-in slide-in-from-top-2 w-64">
                        <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                          {userSites.length > 0 ? (
                            <>
                              <div className="px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Your Sites</div>
                              {userSites.map(s => {
                                const isActive = siteId === s.id;
                                const label = s.siteSlug || `Site ${s.id.slice(0, 8)}`;
                                return (
                                  <div
                                    key={s.id}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-all text-sm flex items-center justify-between gap-2 ${isActive ? 'bg-red-50 text-red-900 font-semibold border border-red-100' : 'text-slate-700 hover:bg-slate-100'}`}
                                  >
                                    <button
                                      onClick={() => navigateSite(s.id)}
                                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                    >
                                      <span
                                        className={`shrink-0 w-2 h-2 rounded-full ${s.isPublished ? 'bg-green-500' : 'bg-slate-300'}`}
                                        title={s.isPublished ? 'Live' : 'Draft'}
                                      />
                                      <span className="truncate">{label}</span>
                                    </button>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                                      {s.isPublished && (
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (!confirm('Unpublish this site? It will go offline.')) return;
                                            await fetch('/api/sites/unpublish', {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              credentials: 'include',
                                              body: JSON.stringify({ siteId: s.id }),
                                            });
                                            setUserSites(prev => prev.map(site => site.id === s.id ? { ...site, isPublished: false } : site));
                                          }}
                                          title="Unpublish"
                                          className="p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                          <EyeOff className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              <div className="h-px bg-slate-100 my-1 mx-1" />
                            </>
                          ) : (
                            <div className="px-3 py-4 text-sm text-slate-500 text-center">No other sites</div>
                          )}
                          <button
                            onClick={() => { setShowSiteSwitcher(false); router.push('/onboarding'); }}
                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-2 text-red-600 hover:bg-red-50 font-medium"
                          >
                            <Plus className="w-4 h-4" />
                            Create New Site
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {liveUrl ? (
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">View Live</span>
                </a>
              ) : (
                <button
                  onClick={() => router.push(`/design?siteId=${siteId}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-bold rounded-lg transition-colors hover:brightness-110"
                  style={{ backgroundColor: 'var(--brand-primary, #dc2626)' }}
                >
                  Go Live
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabs (desktop) / Hamburger (mobile) ── */}
        <div className="flex-none bg-white border-b border-slate-200">
          {/* Mobile: current tab + hamburger */}
          <div className="sm:hidden flex items-center justify-between px-4 py-2">
            {(() => {
              const activeTab = ALL_TABS.find(t => t.id === activeTabId);
              const Icon = activeTab?.icon;
              return (
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {activeTab?.label}
                </span>
              );
            })()}
            <button
              onClick={() => setShowMobileMenu(v => !v)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Toggle navigation menu"
            >
              {showMobileMenu ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>

          {/* Mobile dropdown menu */}
          {showMobileMenu && (
            <div className="sm:hidden border-t border-slate-100 px-2 pb-2 space-y-0.5">
              {visibleTabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTabId === tab.id;
                const badge = tab.id === 'inbox' && inboxUnread > 0 ? inboxUnread : null;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { navigateTab(tab.path); setShowMobileMenu(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    {tab.comingSoon && (
                      <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide bg-slate-100 text-slate-400 rounded-full">
                        Soon
                      </span>
                    )}
                    {badge !== null && (
                      <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-black px-1">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Toggle — mobile */}
              <div className="pt-1 mt-1 border-t border-slate-100">
                <button
                  onClick={toggleShowAllFeatures}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all ${
                    showAllFeatures ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {showAllFeatures ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {showAllFeatures ? 'Showing all features' : 'Showing active only'}
                </button>
              </div>
            </div>
          )}

          {/* Desktop: regular tabs + toggle */}
          <div className="hidden sm:flex items-center justify-between px-4 py-2">
            <div className="flex gap-1.5 flex-wrap">
              {visibleTabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTabId === tab.id;
                const badge = tab.id === 'inbox' && inboxUnread > 0 ? inboxUnread : null;
                return (
                  <button
                    key={tab.id}
                    onClick={() => navigateTab(tab.path)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {tab.comingSoon && (
                      <span className={`px-1 py-px text-[8px] font-black uppercase tracking-wide rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                      }`}>
                        Soon
                      </span>
                    )}
                    {badge !== null && (
                      <span className="ml-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-black px-1">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Toggle — desktop, right side */}
            <button
              onClick={toggleShowAllFeatures}
              title={showAllFeatures ? 'Hide unused features' : 'Show all features'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0 ml-2 ${
                showAllFeatures
                  ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              {showAllFeatures ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{showAllFeatures ? 'All features' : 'Active only'}</span>
            </button>
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        <AlertModal
          isOpen={alertConfig.isOpen}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          onClose={() => setAlertConfig(p => ({ ...p, isOpen: false }))}
        />

        <WalkthroughModal
          isOpen={showWalkthrough}
          onClose={handleCloseWalkthrough}
          steps={adminSteps}
          currentStep={walkthroughStep}
          onNext={() => setWalkthroughStep(s => Math.min(s + 1, adminSteps.length - 1))}
          onPrev={() => setWalkthroughStep(s => Math.max(s - 1, 0))}
          title="Dashboard Guide"
        />
      </div>
    </AdminContext.Provider>
  );
}
