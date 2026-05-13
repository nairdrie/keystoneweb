'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import Link from 'next/link';
import { ExternalLink, X, BarChart3, Globe, ShoppingBag, Calendar, Loader2, Menu, Mail, TrendingUp, Search, Package, CalendarDays, MessageSquare, Link2, BookOpen, UtensilsCrossed, FileImage, Users, Minimize2, Paintbrush, ChevronDown, EyeOff, Plus } from 'lucide-react';
import AlertModal from '@/app/components/ui/AlertModal';
import EditorLoadingScreen from '@/app/components/EditorLoadingScreen';
import WalkthroughModal, { WalkthroughStep } from '@/app/components/WalkthroughModal';
import AdminSidebar from './admin-sidebar';
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
  requiresAnyBlock?: string[];
  comingSoon?: boolean;
}

const ALL_TABS: TabDef[] = [
  // Core — always visible
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/admin/analytics', core: true },
  { id: 'seo',       label: 'SEO',       icon: Globe,     path: '/admin/seo',       core: true },
  { id: 'domains',   label: 'Domains',   icon: Link2,     path: '/admin/domains',   core: true },
  { id: 'inbox',     label: 'Email',     icon: Mail,      path: '/admin/inbox',     core: true },
  // Optional — shown when site has any matching block, or when "show all" is on
  { id: 'booking',   label: 'Booking',   icon: Calendar,  path: '/admin/booking',   requiresAnyBlock: ['booking'] },
  { id: 'ecommerce', label: 'Ecommerce', icon: ShoppingBag, path: '/admin/ecommerce', requiresAnyBlock: ['productGrid'] },
  { id: 'media',    label: 'Media',     icon: FileImage, path: '/admin/media', core: true },
  // Coming soon — only appear when "show all" is on
  { id: 'events', label: 'Events', icon: CalendarDays, path: '/admin/events', requiresAnyBlock: ['events'] },
  { id: 'blog',   label: 'Blog',   icon: BookOpen,    path: '/admin/blog',   requiresAnyBlock: ['blog'] },
  { id: 'menu',   label: 'Menu',   icon: UtensilsCrossed, path: '/admin/menu', requiresAnyBlock: ['menu'] },
  // Users tab covers both membership subscribers and ecommerce customers
  // captured at checkout — surfaced whenever either block exists.
  { id: 'membership', label: 'Users', icon: Users, path: '/admin/membership', requiresAnyBlock: ['membershipGate', 'productGrid'] },
  { id: 'chat-support', label: 'Chat Support', icon: MessageSquare, path: '/admin/chat-support', requiresAnyBlock: ['chatSupport'] },
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
  const [siteTitle, setSiteTitle] = useState('My Website');
  const [userSites, setUserSites] = useState<Site[]>([]);
  const [isProUser, setIsProUser] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title?: string; message: string; type?: 'success' | 'error' | 'info' }>({ isOpen: false, message: '' });
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [goingLive, setGoingLive] = useState(false);
  const [focusMode, setFocusModeState] = useState(false);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [showSiteSwitcher, setShowSiteSwitcher] = useState(false);

  const FOCUS_MODE_KEY = 'ks_admin_focus_mode';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setFocusModeState(localStorage.getItem(FOCUS_MODE_KEY) === '1');
  }, []);

  function setFocusMode(v: boolean) {
    setFocusModeState(v);
    if (typeof window !== 'undefined') {
      localStorage.setItem(FOCUS_MODE_KEY, v ? '1' : '0');
    }
  }

  const handleGoLive = async () => {
    if (!siteId || goingLive) return;
    setGoingLive(true);
    try {
      const res = await fetch('/api/user/subscription', { credentials: 'include' });
      if (res.ok) {
        const { subscription } = await res.json();
        if (subscription && subscription.subscription_status === 'active') {
          router.push(`/publish/domain-select?session_id=existing&siteId=${siteId}`);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to check subscription before go live:', err);
    } finally {
      setGoingLive(false);
    }
    router.push(`/pricing?action=publish&siteId=${siteId}`);
  };

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
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  const hasFetchedRef = useRef<string | null>(null);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);

  const ADMIN_WALKTHROUGH_KEY = 'ks_seen_admin_walkthrough';

  // Load persisted toggle preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SHOW_ALL_KEY);
      // default is false (active-only); only true if user explicitly toggled on
      setShowAllFeatures(stored === '1');
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
      icon: <Mail className="w-7 h-7" />,
      title: 'Email',
      description: 'A full email client for your site — read, reply, compose, and manage AI drafts in one place.',
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
        const { site: data } = await res.json();
        if (data?.id) {
          const tab = ALL_TABS.find(t => pathname.startsWith(t.path))?.path ?? '/admin/analytics';
          router.replace(`${tab}?siteId=${data.id}`);
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
      setSiteTitle(data.siteSlug || 'My Website');

      // Detect which block types exist in this site's pages + whether there are unpublished changes
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

        // Unpublished changes: only meaningful once the site has been published at least once.
        // Compare site.designData vs site.publishedData and each page's design_data vs published_data.
        // Strip internal __meta keys to match the editor's behavior.
        const stripMeta = (obj: unknown): unknown => {
          if (!obj || typeof obj !== 'object') return obj;
          const cleaned: Record<string, unknown> = {};
          for (const k of Object.keys(obj as Record<string, unknown>)) {
            if (!k.startsWith('__')) cleaned[k] = (obj as Record<string, unknown>)[k];
          }
          return cleaned;
        };
        const sameJson = (a: unknown, b: unknown) =>
          JSON.stringify(stripMeta(a) ?? {}) === JSON.stringify(stripMeta(b) ?? {});
        if (data.isPublished) {
          let differs = !sameJson(data.designData, data.publishedData);
          if (!differs) {
            for (const p of pages) {
              if (!sameJson(p.design_data, p.published_data)) { differs = true; break; }
            }
          }
          setHasUnpublishedChanges(differs);
        } else {
          setHasUnpublishedChanges(false);
        }
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

  function navigateTab(path: string) {
    router.push(`${path}${siteId ? `?siteId=${siteId}` : ''}`);
  }

  function navigateSite(newSiteId: string) {
    const tab = ALL_TABS.find(t => pathname.startsWith(t.path))?.path ?? '/admin/analytics';
    router.push(`${tab}?siteId=${newSiteId}`);
  }

  async function unpublishSite(targetSiteId: string) {
    await fetch('/api/sites/unpublish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ siteId: targetSiteId }),
    });
    setUserSites(prev => prev.map(s => s.id === targetSiteId ? { ...s, isPublished: false } : s));
  }

  if (loading || authLoading) return <EditorLoadingScreen />;
  if (!site) return null;

  // Determine which tabs to show
  const visibleTabs = ALL_TABS.filter(tab => {
    if (tab.core) return true;
    if (showAllFeatures) return true;
    if (tab.requiresAnyBlock) return tab.requiresAnyBlock.some(b => siteBlockTypes.has(b));
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
    <AdminContext.Provider value={{ siteId, site, siteTitle, setSiteTitle, isProUser, palette, usage, usagePlan, siteBreakdown, siteBlockTypes, refreshInboxUnread, focusMode, setFocusMode }}>
      <div className="fixed inset-0 overflow-hidden bg-slate-50">

        {/* Persistent admin sidebar (desktop rail + mobile drawer) */}
        {!focusMode && (
          <AdminSidebar
            tabs={visibleTabs}
            activeTabId={activeTabId}
            inboxUnread={inboxUnread}
            showAllFeatures={showAllFeatures}
            onToggleShowAllFeatures={toggleShowAllFeatures}
            onOpenWalkthrough={openWalkthrough}
            mobileOpen={showMobileMenu}
            onMobileClose={() => setShowMobileMenu(false)}
            onNavigate={navigateTab}
            currentSiteId={siteId}
          />
        )}

        {/* Main content column — offset on desktop by the rail width (pl-14 = 56px = RAIL_WIDTH_PX) */}
        <div className={`h-full flex flex-col ${focusMode ? '' : 'md:pl-14'}`}>

        {/* Focus mode: slim exit bar replaces all the header rows */}
        {focusMode && (
          <div className="flex-none flex items-center justify-between gap-2 px-3 h-8 bg-slate-900 text-white text-[11px] font-bold border-b border-slate-800 shrink-0">
            <span className="flex items-center gap-1.5 truncate">
              <Minimize2 className="w-3 h-3" />
              Focus mode — header hidden to maximize email view
            </span>
            <button
              onClick={() => setFocusMode(false)}
              className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors shrink-0"
              title="Exit focus mode"
            >
              <X className="w-3 h-3" />
              Exit focus mode
            </button>
          </div>
        )}

        {/* ── Mobile top bar (hamburger only) ── */}
        <div className={`${focusMode ? 'hidden' : 'flex'} md:hidden flex-none items-center justify-between px-2 h-12 bg-white border-b border-slate-200 z-10 shrink-0`}>
          <button
            onClick={() => setShowMobileMenu(true)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
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
          <div className="w-9" aria-hidden />
        </div>

        {/* ── Hero / Site Header ── */}
        <div className={`${focusMode ? 'hidden' : 'block'} flex-none bg-white border-b border-slate-200 px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4`}>
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            {/* Site title — big, no rename / help. Switch-site lives just below it. */}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                {siteTitle || 'Untitled Site'}
                <span className="text-slate-400 font-light hidden sm:inline"> Dashboard</span>
              </h1>
              <div className="relative mt-0.5">
                <button
                  onClick={() => setShowSiteSwitcher(v => !v)}
                  className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
                >
                  Switch site
                  <ChevronDown className={`w-3 h-3 transition-transform ${showSiteSwitcher ? 'rotate-180' : ''}`} />
                </button>
                {showSiteSwitcher && (
                  <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-[60] animate-in fade-in slide-in-from-top-2 w-64">
                    <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                      {userSites.length > 0 ? (
                        <>
                          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Sites</div>
                          {userSites.map(s => {
                            const isActive = siteId === s.id;
                            const label = s.siteSlug || `Site ${s.id.slice(0, 8)}`;
                            return (
                              <div
                                key={s.id}
                                className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-xs flex items-center justify-between gap-2 ${
                                  isActive ? 'bg-red-50 text-red-900 font-bold' : 'text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                <button
                                  onClick={() => { setShowSiteSwitcher(false); navigateSite(s.id); }}
                                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
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
                                      unpublishSite(s.id);
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
                        <div className="px-3 py-3 text-xs text-slate-500 text-center">No other sites</div>
                      )}
                      <button
                        onClick={() => { setShowSiteSwitcher(false); router.push('/onboarding'); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 text-red-600 hover:bg-red-50 font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create New Site
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right side: live status indicator + primary action */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {site.isPublished && liveUrl ? (
                <>
                  {/* Animated status light + domain link (lifted from designer) */}
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg">
                    <span className="relative flex h-2.5 w-2.5">
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          hasUnpublishedChanges ? 'bg-amber-400' : 'bg-green-400'
                        }`}
                      />
                      <span
                        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                          hasUnpublishedChanges ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                      />
                    </span>
                    <div className="flex flex-col leading-tight">
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider ${
                          hasUnpublishedChanges ? 'text-amber-700' : 'text-slate-700'
                        }`}
                      >
                        {hasUnpublishedChanges ? 'Unpublished changes' : 'Live'}
                      </span>
                      {displayDomain && (
                        <a
                          href={liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-slate-500 hover:text-slate-900 truncate max-w-[180px] transition-colors"
                        >
                          {displayDomain} ↗
                        </a>
                      )}
                    </div>
                  </div>

                  {hasUnpublishedChanges ? (
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/design${siteId ? `?siteId=${siteId}` : ''}`}
                        className="hidden md:inline text-[11px] font-semibold text-slate-500 hover:text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900 transition-colors"
                      >
                        View changes in Design
                      </Link>
                      <Link
                        href={`/design${siteId ? `?siteId=${siteId}` : ''}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                        title="Publish your unpublished changes"
                      >
                        <Paintbrush className="w-3.5 h-3.5" />
                        Publish Site
                      </Link>
                    </div>
                  ) : (
                    <a
                      href={liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-bold rounded-lg transition-colors hover:brightness-110"
                      style={{ backgroundColor: 'var(--brand-primary, #dc2626)' }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">View Live</span>
                    </a>
                  )}
                </>
              ) : (
                <button
                  onClick={handleGoLive}
                  disabled={goingLive}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-bold rounded-lg transition-colors hover:brightness-110 disabled:opacity-60"
                  style={{ backgroundColor: 'var(--brand-primary, #dc2626)' }}
                >
                  {goingLive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Go Live
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
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
