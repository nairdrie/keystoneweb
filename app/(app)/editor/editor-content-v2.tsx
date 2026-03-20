'use client';

import { useState, useEffect, Suspense, createElement, useRef, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Save, Smartphone, Monitor, Play, Loader2, Undo, Redo } from 'lucide-react';
import FloatingToolbar from '@/app/components/FloatingToolbar';
import { EditorProvider, BlockData, NavItem } from '@/lib/editor-context';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import { useAuth } from '@/lib/auth/context';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { useChangeTracking } from '@/lib/hooks/useChangeTracking';
import AlertModal from '@/app/components/ui/AlertModal';
import EditorLoadingScreen from '@/app/components/EditorLoadingScreen';
import PageSelector from '@/app/components/PageSelector';
import EmbeddedToggle from '@/app/components/EmbeddedToggle';
import { usePages } from '@/lib/hooks/usePages';
import { useAIBuilder } from '@/lib/hooks/useAIBuilder';
import { CartProvider } from '@/app/components/ecommerce/CartProvider';
import CartDrawer from '@/app/components/ecommerce/CartDrawer';
import CartButton from '@/app/components/ecommerce/CartButton';
import PreviewProductPage from '@/app/components/ecommerce/PreviewProductPage';


export interface SiteData {
  id: string;
  userId: string | null;
  selectedTemplateId: string;
  businessType: string;
  category: string;
  designData: Record<string, any>;
  publishedData?: Record<string, any>;
  isPublished: boolean;
  publishedDomain?: string;
  siteSlug?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EditorContentProps {
  publicSiteData?: SiteData;
  isPublicView?: boolean;
  precomputedPalette?: Record<string, string>;
  children?: React.ReactNode;
}

export default function EditorContent({ publicSiteData, isPublicView = false, precomputedPalette, children }: EditorContentProps = {}) {
  // If in pure public viewer mode, render the pre-fetched template directly without hooks
  // This allows full SSR and instant load times, bypassing all Editor UI and loading screens
  if (isPublicView) {
    const pubDesign = publicSiteData?.designData || {};
    return (
      <CartProvider siteId={publicSiteData?.id || ''}>
        {/* Dynamic favicon for published site */}
        {pubDesign.siteLogo && (
          <link rel="icon" href={`/api/sites/favicon?siteId=${publicSiteData?.id}`} />
        )}
        <EditorProvider
          value={{
            content: pubDesign,
            siteContent: pubDesign,
            updateSiteContent: () => { },
            navItems: pubDesign.__navItems || [],
            updateNavItems: () => { },
            isEditMode: false,
            updateContent: () => { },
            palette: precomputedPalette || {},
            availablePalettes: [],
            siteId: publicSiteData?.id,
            uploadImage: async () => { return ''; },
            setPalette: () => { },
            blocks: pubDesign.blocks || [],
            pages: pubDesign.__pages || [],
            isProUser: false,
          }}
        >
          <div className="w-full min-h-screen">
            {children}
          </div>
        </EditorProvider>
        <CartDrawer siteId={publicSiteData?.id || ''} palette={precomputedPalette || {}} />
        <CartButton accentColor={(precomputedPalette as any)?.secondary} />
      </CartProvider>
    );
  }

  const router = useRouter();
  const searchParams = useSearchParams();
  const previewProductId = searchParams.get('productId');
  const { user, loading: authLoading } = useAuth();

  const [site, setSite] = useState<SiteData | null>(null);
  const [templateComponent, setTemplateComponent] = useState<React.ComponentType<any> | null>(null);
  const [selectedPaletteKey, setSelectedPaletteKey] = useState<string>('default');
  const [availablePalettes, setAvailablePalettes] = useState<Record<string, Record<string, string>>>({});
  const [paletteData, setPaletteData] = useState<Record<string, string>>({});
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title?: string; message: string; type?: 'success' | 'error' | 'info' }>({ isOpen: false, message: '' });
  const [editMode, setEditMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  // Auto-expand sidebar on large screens when editor loads
  const hasInitSidebarRef = useRef(false);
  useEffect(() => {
    if (!hasInitSidebarRef.current) {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      }
      hasInitSidebarRef.current = true;
    }
  }, []);
  const [editableContent, setEditableContent] = useState<Record<string, any>>({});
  const [siteContent, setSiteContent] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteTitle, setSiteTitle] = useState('My Website');
  const [error, setError] = useState<string | null>(null);
  const initialSiteContentRef = useRef<Record<string, any>>({});

  // Change tracking
  // Multi-page support
  const pagesHook = usePages(site?.id || "");
  const { pages, currentPageId, setCurrentPageId, fetchPages, currentPage, updatePage, createPage, deletePage, loading: pagesLoading } = pagesHook;
  const changesHook = useChangeTracking();
  const pageIdFromUrl = searchParams.get('pageId');
  const { addChange, clearChanges } = changesHook;

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (changesHook.changes.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [changesHook.changes.length]);

  const initialTitleRef = useRef<string>('My Website');
  const initialPaletteRef = useRef<string>('default');
  const initialContentRef = useRef<Record<string, any>>({});

  const siteId = searchParams.get('siteId');
  const { uploadImage } = useImageUpload(siteId || '');

  // Subscription check for AI Builder
  const [isProUser, setIsProUser] = useState(false);
  const [isBasicUser, setIsBasicUser] = useState(false);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  useEffect(() => {
    if (!user) return;
    fetch('/api/user/subscription', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.subscription?.subscription_status === 'active') {
          const plan = data.subscription.subscription_plan?.toLowerCase() || '';
          if (plan.includes('pro')) {
            setIsProUser(true);
          } else {
            setIsBasicUser(true);
          }
        }
        setSubscriptionLoaded(true);
      })
      .catch(() => { setSubscriptionLoaded(true); });
  }, [user]);
  // Free: authenticated but not on any paid plan
  const isFreeUser = !!user && subscriptionLoaded && !isProUser && !isBasicUser;

  // Compute if all draft content matches the published content
  const isSynced = useMemo(() => {
    if (!site?.isPublished) return false;
    if (changesHook.changes.length > 0) return false;

    // Helper for deep equality immune to key sorting issues
    const isDeepEqual = (a: any, b: any): boolean => {
      if (a === b) return true;
      if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
      if (Array.isArray(a) !== Array.isArray(b)) return false;

      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key) || !isDeepEqual(a[key], b[key])) return false;
      }
      return true;
    };

    if (!isDeepEqual(site.designData || {}, site.publishedData || {})) return false;

    for (const page of pages) {
      if (!isDeepEqual(page.design_data || {}, page.published_data || {})) return false;
    }

    return true;
  }, [site, pages, changesHook.changes]);

  // Auth check and site loading (ONLY for editor mode)
  // Use a ref to prevent re-fetching on tab-switch (Supabase auth token refresh
  // fires onAuthStateChange which creates a new user object reference)
  const hasFetchedSiteRef = useRef<string | null>(null);
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push(`/onboarding${siteId ? `?siteId=${siteId}` : ''}`);
      return;
    }

    if (siteId) {
      // Only fetch if we haven't already loaded this specific site
      if (hasFetchedSiteRef.current !== siteId) {
        hasFetchedSiteRef.current = siteId;
        fetchSite(siteId);
      }
    } else {
      if (!hasFetchedSiteRef.current) {
        hasFetchedSiteRef.current = '__redirecting__';
        redirectToLatestSite();
      }
    }
  }, [user, authLoading, siteId, router, isPublicView, publicSiteData]);

  // Load template component and metadata when site changes
  useEffect(() => {
    if (!site?.selectedTemplateId) return;

    loadTemplateComponent(site.selectedTemplateId, site.designData?.__selectedPalette);
  }, [site?.selectedTemplateId]);
  // Fetch pages when site loads
  useEffect(() => {
    if (!site?.id) return;
    fetchPages();
  }, [site?.id, fetchPages]);

  // Sync current page with URL `pageId` param
  // This handles both initial load and internal navigation (e.g. clicking NavMenu links)
  useEffect(() => {
    if (pages.length === 0 || !pageIdFromUrl) return;

    // Only update if the URL pageId differs from our current state
    if (pageIdFromUrl !== currentPageId) {
      const targetPage = pages.find(p => p.id === pageIdFromUrl);
      if (targetPage) {
        setCurrentPageId(pageIdFromUrl);
      }
    }
  }, [pages, pageIdFromUrl, currentPageId, setCurrentPageId]);

  // Update URL when currentPageId changes (write-only, no feedback loop)
  useEffect(() => {
    if (!currentPageId || !siteId) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('pageId') !== currentPageId) {
      url.searchParams.set('pageId', currentPageId);
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [currentPageId, siteId, router]);

  // Load page-specific content when page changes
  useEffect(() => {
    if (!currentPage) return;

    let content = currentPage.design_data || {};
    // Backward compatibility & seamless migration (home page only):
    // If the home page has no design data yet, fall back to the global site design data
    if (Object.keys(content).length === 0 && currentPage.slug === 'home' && site?.designData) {
      content = site.designData;
    }

    setEditableContent(content);
    initialContentRef.current = { ...content };
    clearChanges();
  }, [currentPage, clearChanges, site?.designData]);
  // Ensure selectedPaletteKey is valid once palettes are loaded
  useEffect(() => {
    const keys = Object.keys(availablePalettes);
    if (keys.length > 0 && selectedPaletteKey !== 'custom' && !keys.includes(selectedPaletteKey)) {
      setSelectedPaletteKey(keys[0]);
    }
  }, [availablePalettes, selectedPaletteKey]);

  // Synchronize paletteData with selectedPaletteKey and current content
  useEffect(() => {
    if (selectedPaletteKey === 'custom') {
      setPaletteData({
        primary: siteContent.__customPalette_primary || '#0f172a',
        secondary: siteContent.__customPalette_secondary || '#64748b',
        accent: siteContent.__customPalette_accent || '#cbd5e1',
      });
    } else if (availablePalettes[selectedPaletteKey]) {
      setPaletteData(availablePalettes[selectedPaletteKey]);
    }
  }, [selectedPaletteKey, availablePalettes, 
      siteContent.__customPalette_primary, siteContent.__customPalette_secondary, siteContent.__customPalette_accent]);

  const redirectToLatestSite = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/user/latest-site', { credentials: 'include' });

      if (!res.ok) {
        if (res.status === 404) {
          router.push('/onboarding');
          return;
        }
        setError('Failed to load your sites');
        setLoading(false);
        return;
      }

      const { site: data } = await res.json();
      router.push(`/editor?siteId=${data.id}`);
    } catch (err) {
      console.error('Failed to fetch latest site:', err);
      setError('Failed to load site');
      setLoading(false);
    }
  };

  const fetchSite = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sites?id=${id}`);

      if (!res.ok) {
        setError('Site not found');
        setLoading(false);
        return;
      }

      const data = await res.json();
      setSite(data);
      const title = data.siteSlug || 'My Website';
      const siteDesign = data.designData || {};
      const selectedPalette = siteDesign.__selectedPalette || 'default';

      // Store initial values for change detection
      initialTitleRef.current = title;
      initialPaletteRef.current = selectedPalette;
      initialContentRef.current = {};

      // Initialize site-level content (header fields)
      setSiteContent(siteDesign);
      initialSiteContentRef.current = { ...siteDesign };

      setSiteTitle(title);
      setSelectedPaletteKey(selectedPalette);
    } catch (err) {
      console.error('Error fetching site:', err);
      setError('Failed to load site');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateComponent = async (templateId: string, savedPaletteKey?: string) => {
    try {
      // Fetch both component and metadata concurrently for speed
      const [component, metadata] = await Promise.all([
        getTemplateComponent(templateId),
        getTemplateMetadata(templateId)
      ]);

      if (!component) {
        console.error(`Template component not found: ${templateId}`);
        setError(`Template not found: ${templateId}`);
        return;
      }

      // Process and apply metadata (palettes, customizables) FIRST
      if (metadata) {
        const palettesObj = metadata.palettes || {};
        const paletteKeys = Object.keys(palettesObj);
        setAvailablePalettes(palettesObj);

        // Use the saved palette key if it exists in the new metadata, otherwise default to first
        const activeKey = (savedPaletteKey === 'custom' || (savedPaletteKey && paletteKeys.includes(savedPaletteKey)))
          ? savedPaletteKey
          : (paletteKeys[0] || 'default');

        setSelectedPaletteKey(activeKey);
        initialPaletteRef.current = activeKey;
        
        if (activeKey === 'custom') {
          // If custom, we'll rely on the colors already in state or loaded from designData
          // The paletteData will be synced by the effects or handlePaletteChange
        } else {
          setPaletteData(palettesObj[activeKey] || {});
        }
      }

      // NOW we set the component, so when it initially renders, it instantly has the correct palette loaded!
      setTemplateComponent(() => component);
    } catch (err) {
      console.error('Error loading template:', err);
      setError('Failed to load template');
    }
  };

  // Sync refs for stable access in callbacks
  const siteContentRef = useRef(siteContent);
  const editableContentRef = useRef(editableContent);
  useEffect(() => { siteContentRef.current = siteContent; }, [siteContent]);
  useEffect(() => { editableContentRef.current = editableContent; }, [editableContent]);

  const handleUpdateContent = useCallback((key: string, value: string) => {
    const oldValue = editableContentRef.current[key] || '';
    if (oldValue === value) return;

    // Track content change first
    addChange(`content:${key}`, `Content: ${key}`, oldValue, value);

    setEditableContent((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, [addChange]);

  // Site-level content updates (header title, CTA text, etc.)
  const handleUpdateSiteContent = useCallback((key: string, value: any) => {
    const oldValue = siteContentRef.current[key] || '';
    if (JSON.stringify(oldValue) === JSON.stringify(value)) return;

    // Track change with specific field key to avoid overwriting other site content changes
    addChange(`siteContent:${key}`, `Header: ${key}`, 
      typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue), 
      typeof value === 'object' ? JSON.stringify(value) : String(value)
    );

    setSiteContent((prev) => ({ ...prev, [key]: value }));
  }, [addChange]);

  // Nav items update (site-level)
  const handleUpdateNavItems = useCallback((items: NavItem[]) => {
    const oldItems: NavItem[] = siteContentRef.current.__navItems || [];
    
    // Build human-readable summary of changes
    const oldLabels = new Map(oldItems.map((i: NavItem) => [i.id, i.label]));
    const newLabels = new Map(items.map((i: NavItem) => [i.id, i.label]));
    const changes: string[] = [];
    
    for (const item of items) {
      if (!oldLabels.has(item.id)) changes.push(`Added "${item.label}"`);
    }
    for (const item of oldItems) {
      if (!newLabels.has(item.id)) changes.push(`Removed "${item.label}"`);
    }
    for (const item of items) {
      const oldLabel = oldLabels.get(item.id);
      if (oldLabel && oldLabel !== item.label) changes.push(`Renamed "${oldLabel}" → "${item.label}"`);
      if (oldLabel && oldLabel === item.label) {
        const oldItem = oldItems.find((o: NavItem) => o.id === item.id);
        if (oldItem && oldItem.href !== item.href) changes.push(`Updated link for "${item.label}"`);
      }
    }
    
    const summary = changes.length > 0 ? changes.join(', ') : 'Reordered menu';
    if (changes.length > 0 || oldItems.length !== items.length) {
      // Pass full items as rawTo for accurate restoration in undo/redo
      addChange('siteContent:navItems', 'Navigation Menu', JSON.stringify(oldItems), JSON.stringify(items));
    }

    setSiteContent((prev) => ({ ...prev, __navItems: items }));
  }, [addChange]);

  const navItems: NavItem[] = siteContent.__navItems || [];

  const addBlock = (type: string, index?: number) => {
    const currentBlocks: BlockData[] = Array.isArray(editableContentRef.current.blocks) ? editableContentRef.current.blocks : [];
    const newBlock: BlockData = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data: {}
    };

    const newBlocks = [...currentBlocks];
    if (index !== undefined && index >= 0 && index <= newBlocks.length) {
      newBlocks.splice(index, 0, newBlock);
    } else {
      newBlocks.push(newBlock);
    }

    addChange('blocks', 'Added Content Block', JSON.stringify(currentBlocks), JSON.stringify(newBlocks));
    
    setEditableContent((prev) => ({ ...prev, blocks: newBlocks }));
  };

  const removeBlock = (id: string) => {
    const currentBlocks: BlockData[] = Array.isArray(editableContentRef.current.blocks) ? editableContentRef.current.blocks : [];
    const newBlocks = currentBlocks.filter(b => b.id !== id);
    
    addChange('blocks', 'Removed Content Block', JSON.stringify(currentBlocks), JSON.stringify(newBlocks));
    
    setEditableContent((prev) => ({ ...prev, blocks: newBlocks }));
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const currentBlocks: BlockData[] = Array.isArray(editableContentRef.current.blocks) ? editableContentRef.current.blocks : [];
    const index = currentBlocks.findIndex(b => b.id === id);
    if (index < 0) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentBlocks.length - 1) return;

    const newBlocks = [...currentBlocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    // Swap
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];

    addChange('blocks', 'Moved Content Block', JSON.stringify(currentBlocks), JSON.stringify(newBlocks));
    
    setEditableContent((prev) => ({ ...prev, blocks: newBlocks }));
  };

  const updateBlockData = (id: string, key: string, value: any) => {
    const currentBlocks: BlockData[] = Array.isArray(editableContentRef.current.blocks) ? editableContentRef.current.blocks : [];
    const index = currentBlocks.findIndex(b => b.id === id);
    if (index < 0) return;

    const oldBlock = currentBlocks[index];
    const oldValue = oldBlock.data[key] || '';
    if (JSON.stringify(oldValue) === JSON.stringify(value)) return;

    const newBlock = { ...oldBlock, data: { ...oldBlock.data, [key]: value } };
    const newBlocks = [...currentBlocks];
    newBlocks[index] = newBlock;

    addChange('blocks', 'Updated Block Content', JSON.stringify(currentBlocks), JSON.stringify(newBlocks));
    
    setEditableContent((prev) => ({ ...prev, blocks: newBlocks }));
  };

  // Reconstruct state when History Undo/Redo is triggered
  useEffect(() => {
    const action = changesHook.lastAction;
    if (!action) return;

    // We reconstruct state from scratch using standard refs to ensure absolute accuracy
    let restoredTitle = initialTitleRef.current;
    let restoredPalette = initialPaletteRef.current;
    let restoredContent = { ...initialContentRef.current };
    let restoredSiteContent = { ...initialSiteContentRef.current };

    // Simply replay all changes currently active in the history array top-down!
    for (const change of action.changes) {
      if (change.field === 'siteTitle' || change.field === 'siteContent:siteTitle') {
        restoredTitle = change.to;
        restoredSiteContent.siteTitle = change.to;
      } else if (change.field === 'palette') {
        restoredPalette = change.to;
      } else if (change.field.startsWith('content:')) {
        const key = change.field.replace('content:', '');
        restoredContent[key] = change.to;
      } else if (change.field === 'content') {
        // legacy change format
        const key = change.label.replace('Content: ', '');
        restoredContent[key] = change.to;
      } else if (change.field.startsWith('siteContent:')) {
        const key = change.field.replace('siteContent:', '');
        if (key === 'navItems') {
          try {
            restoredSiteContent.__navItems = JSON.parse(change.to);
          } catch (e) { console.error('Failed to parse navItems in undo', e); }
        } else {
          // Check if it's JSON (for objects like icons)
          try {
            if (change.to.startsWith('{') || change.to.startsWith('[')) {
              restoredSiteContent[key] = JSON.parse(change.to);
            } else {
              restoredSiteContent[key] = change.to;
            }
          } catch (e) {
            restoredSiteContent[key] = change.to;
          }
        }
      } else if (change.field === 'siteContent') {
        // legacy change format
        const key = change.label.replace('Header: ', '');
        restoredSiteContent[key] = change.to;
      } else if (change.field === 'blocks') {
        restoredContent.blocks = JSON.parse(change.rawTo || change.to);
      }
    }

    // Apply the restored state completely!
    setSiteTitle(restoredTitle);
    setSelectedPaletteKey(restoredPalette);
    setEditableContent(restoredContent);
    setSiteContent(restoredSiteContent);

    const palette = restoredPalette === 'custom'
      ? {
        primary: restoredSiteContent.__customPalette_primary || restoredContent.__customPalette_primary || '#0f172a',
        secondary: restoredSiteContent.__customPalette_secondary || restoredContent.__customPalette_secondary || '#64748b',
        accent: restoredSiteContent.__customPalette_accent || restoredContent.__customPalette_accent || '#cbd5e1',
      }
      : availablePalettes[restoredPalette];

    if (palette) {
      setPaletteData(palette);
    }
  }, [changesHook.lastAction, availablePalettes]);

  const handleSiteTitleChange = (newTitle: string) => {
    // Redundancy handled: handleUpdateSiteContent will call addChange if it changed
    setSiteTitle(newTitle);
    handleUpdateSiteContent('siteTitle', newTitle);
  };

  const handleSaveDesign = async () => {
    if (!site?.id || isPublicView) return;

    try {
      setSaving(true);

      // Site-level design data (header, palette, nav items — shared across all pages)
      const siteDesignData = {
        ...siteContent,
        __selectedPalette: selectedPaletteKey,
        ...(selectedPaletteKey === 'custom' ? {
          __customPalette_primary: paletteData.primary,
          __customPalette_secondary: paletteData.secondary,
          __customPalette_accent: paletteData.accent,
        } : {}),
      };

      // Page-level design data (blocks and page-specific content)
      const pageDesignData = {
        ...editableContent,
      };

      const res = await fetch('/api/sites', {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: site.id,
          title: siteTitle,
          designData: siteDesignData,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setError(errorData.error || 'Failed to save design');
        return;
      }

      // Update local site state
      const updated = await res.json();
      setSite(updated.site || updated);
      initialSiteContentRef.current = { ...siteDesignData };

      // Save page-level design data
      if (currentPageId) {
        await updatePage(currentPageId, { design_data: pageDesignData });
      }

      setError(null);
      clearChanges();
      setAlertConfig({ isOpen: true, title: 'Success', message: 'Design saved successfully!', type: 'success' });
    } catch (err) {
      console.error('Error saving design:', err);
      setError('Failed to save design');
    } finally {
      setSaving(false);
    }
  };

  const handlePaletteChange = (paletteKey: string) => {
    if (paletteKey !== selectedPaletteKey) {
      addChange('palette', 'Color Palette', selectedPaletteKey, paletteKey);
    }
    setSelectedPaletteKey(paletteKey);

    if (paletteKey === 'custom') {
      setPaletteData({
        primary: siteContent.__customPalette_primary || '#0f172a',
        secondary: siteContent.__customPalette_secondary || '#64748b',
        accent: siteContent.__customPalette_accent || '#cbd5e1',
      });
    } else {
      const palette = availablePalettes[paletteKey];
      if (palette) {
        setPaletteData(palette);
      }
    }
  };

  const handleCustomColorChange = (colorType: 'primary' | 'secondary' | 'accent', value: string) => {
    // Record as content change to support undo/redo
    handleUpdateSiteContent(`__customPalette_${colorType}`, value);
    
    if (selectedPaletteKey !== 'custom') {
      handlePaletteChange('custom');
    }
    setPaletteData(prev => ({ ...prev, [colorType]: value }));
  };

  // AI Builder callbacks (stable references via useCallback)
  const aiAddBlock = useCallback((type: string, data: Record<string, any>, index?: number) => {
    setEditableContent((prev) => {
      const currentBlocks: BlockData[] = Array.isArray(prev.blocks) ? prev.blocks : [];
      const newBlock: BlockData = {
        id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        data,
      };
      const newBlocks = [...currentBlocks];
      if (index !== undefined && index >= 0 && index <= newBlocks.length) {
        newBlocks.splice(index, 0, newBlock);
      } else {
        newBlocks.push(newBlock);
      }
      addChange('blocks', `AI: Added ${type} block`, JSON.stringify(currentBlocks), JSON.stringify(newBlocks));
      return { ...prev, blocks: newBlocks };
    });
  }, [addChange]);

  const aiUpdateBlock = useCallback((blockId: string, updates: Record<string, any>) => {
    setEditableContent((prev) => {
      const currentBlocks: BlockData[] = Array.isArray(prev.blocks) ? prev.blocks : [];
      const index = currentBlocks.findIndex(b => b.id === blockId);
      if (index < 0) return prev;
      const oldBlock = currentBlocks[index];
      const newBlock = { ...oldBlock, data: { ...oldBlock.data, ...updates } };
      const newBlocks = [...currentBlocks];
      newBlocks[index] = newBlock;
      addChange('blocks', `AI: Updated ${oldBlock.type} block`, JSON.stringify(currentBlocks), JSON.stringify(newBlocks));
      return { ...prev, blocks: newBlocks };
    });
  }, [addChange]);

  const aiRemoveBlock = useCallback((blockId: string) => {
    setEditableContent((prev) => {
      const currentBlocks: BlockData[] = Array.isArray(prev.blocks) ? prev.blocks : [];
      const newBlocks = currentBlocks.filter(b => b.id !== blockId);
      addChange('blocks', 'AI: Removed block', JSON.stringify(currentBlocks), JSON.stringify(newBlocks));
      return { ...prev, blocks: newBlocks };
    });
  }, [addChange]);

  const aiReorderBlocks = useCallback((blockIds: string[]) => {
    setEditableContent((prev) => {
      const currentBlocks: BlockData[] = Array.isArray(prev.blocks) ? prev.blocks : [];
      const blockMap = new Map(currentBlocks.map(b => [b.id, b]));
      const reordered = blockIds.map(id => blockMap.get(id)).filter(Boolean) as BlockData[];
      for (const block of currentBlocks) {
        if (!blockIds.includes(block.id)) reordered.push(block);
      }
      addChange('blocks', 'AI: Reordered blocks', JSON.stringify(currentBlocks), JSON.stringify(reordered));
      return { ...prev, blocks: reordered };
    });
  }, [addChange]);

  const aiSetSiteTitle = useCallback((title: string) => {
    addChange('siteTitle', 'AI: Site Name', siteTitle, title);
    setSiteTitle(title);
    handleUpdateSiteContent('siteTitle', title);
  }, [addChange, siteTitle, handleUpdateSiteContent]);

  const aiSetFont = useCallback((target: 'heading' | 'body', font: string) => {
    const key = target === 'heading' ? 'titleFont' : 'bodyFont';
    handleUpdateSiteContent(key, font);
  }, [handleUpdateSiteContent]);

  const aiSetCustomColors = useCallback((colors: { primary?: string; secondary?: string; accent?: string }) => {
    if (colors.primary) {
      handleUpdateSiteContent('__customPalette_primary', colors.primary);
    }
    if (colors.secondary) {
      handleUpdateSiteContent('__customPalette_secondary', colors.secondary);
    }
    if (colors.accent) {
      handleUpdateSiteContent('__customPalette_accent', colors.accent);
    }
    if (selectedPaletteKey !== 'custom') {
      handlePaletteChange('custom');
    }
    setPaletteData(prev => ({
      ...prev,
      ...(colors.primary ? { primary: colors.primary } : {}),
      ...(colors.secondary ? { secondary: colors.secondary } : {}),
      ...(colors.accent ? { accent: colors.accent } : {}),
    }));
  }, [selectedPaletteKey, handlePaletteChange, handleUpdateSiteContent]);

  const aiCallbacks = useMemo(() => ({
    onAddBlock: aiAddBlock,
    onUpdateBlock: aiUpdateBlock,
    onRemoveBlock: aiRemoveBlock,
    onReorderBlocks: aiReorderBlocks,
    onSetSiteTitle: aiSetSiteTitle,
    onSetFont: aiSetFont,
    onSetCustomColors: aiSetCustomColors,
  }), [aiAddBlock, aiUpdateBlock, aiRemoveBlock, aiReorderBlocks, aiSetSiteTitle, aiSetFont, aiSetCustomColors]);

  const getAiSiteState = useCallback(() => ({
    title: siteTitle,
    blocks: editableContent.blocks || [],
    palette: selectedPaletteKey,
    headingFont: siteContent.titleFont,
    bodyFont: siteContent.bodyFont,
  }), [siteTitle, editableContent.blocks, selectedPaletteKey, siteContent.titleFont, siteContent.bodyFont]);

  const aiPaletteNames = useMemo(() => Object.keys(availablePalettes), [availablePalettes]);

  const aiBuilder = useAIBuilder(getAiSiteState, aiPaletteNames, aiCallbacks);

  // Redirect to signin if AI builder detects expired session
  useEffect(() => {
    if (aiBuilder.authExpired) {
      router.push('/signin');
    }
  }, [aiBuilder.authExpired]);

  // Auto-send AI prompt from onboarding flow
  const aiOnboardingSentRef = useRef(false);
  const [aiOnboardingBuilding, setAiOnboardingBuilding] = useState(() => {
    // Check synchronously on mount — if there's a pending AI prompt, start in loading state
    if (typeof window !== 'undefined' && sessionStorage.getItem('keystoneAiOnboardingPrompt')) {
      return true;
    }
    return false;
  });
  const aiOnboardingDidStartRef = useRef(false);

  useEffect(() => {
    if (aiOnboardingSentRef.current || !templateComponent) return;
    const prompt = sessionStorage.getItem('keystoneAiOnboardingPrompt');
    if (prompt) {
      aiOnboardingSentRef.current = true;
      sessionStorage.removeItem('keystoneAiOnboardingPrompt');
      setAiOnboardingBuilding(true);
      // Open sidebar and focus AI builder, then send the prompt
      setSidebarOpen(true);
      setTimeout(() => {
        aiBuilder.sendMessage(prompt, { isNewSite: true });
      }, 500);
    }
  }, [templateComponent]);

  // Track when AI loading actually starts so we know when it's safe to dismiss
  useEffect(() => {
    if (aiOnboardingBuilding && aiBuilder.isLoading) {
      aiOnboardingDidStartRef.current = true;
    }
  }, [aiOnboardingBuilding, aiBuilder.isLoading]);

  // Clear the AI onboarding loading screen once the AI finishes (only after it actually started)
  useEffect(() => {
    if (aiOnboardingBuilding && aiOnboardingDidStartRef.current && !aiBuilder.isLoading) {
      // Small delay so operations apply before revealing
      const timer = setTimeout(() => setAiOnboardingBuilding(false), 300);
      return () => clearTimeout(timer);
    }
  }, [aiOnboardingBuilding, aiBuilder.isLoading]);

  // Safety timeout: if the loading screen is stuck for 45 seconds, force-dismiss it
  useEffect(() => {
    if (!aiOnboardingBuilding) return;
    const timeout = setTimeout(() => {
      setAiOnboardingBuilding(false);
    }, 45_000);
    return () => clearTimeout(timeout);
  }, [aiOnboardingBuilding]);

  // Whether to tell the toolbar to focus/scroll to the AI builder section
  const [focusAiBuilder, setFocusAiBuilder] = useState(false);
  useEffect(() => {
    // Once onboarding building finishes, focus the AI panel in the toolbar
    if (aiOnboardingSentRef.current && !aiOnboardingBuilding && aiOnboardingDidStartRef.current) {
      setFocusAiBuilder(true);
      // Reset after a tick so it acts as a one-shot trigger
      setTimeout(() => setFocusAiBuilder(false), 100);
    }
  }, [aiOnboardingBuilding]);

  if (loading || pagesLoading || aiOnboardingBuilding) {
    return <EditorLoadingScreen message={aiOnboardingBuilding ? 'AI is building your site...' : undefined} />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!site || !templateComponent || (siteId && !currentPage)) {
    return <EditorLoadingScreen />;
  }

  // Convert availablePalettes object to array format for FloatingToolbar
  const paletteArray: Array<{ name: string; primary: string; secondary: string; accent: string }> = Object.entries(availablePalettes).map(
    ([key, colors]) => ({
      name: key,
      primary: colors.primary || '',
      secondary: colors.secondary || '',
      accent: colors.accent || '',
    })
  );

  // Add the custom palette option
  const customPalette = {
    name: 'custom',
    primary: siteContent.__customPalette_primary || '#0f172a',
    secondary: siteContent.__customPalette_secondary || '#64748b',
    accent: siteContent.__customPalette_accent || '#cbd5e1',
  };
  paletteArray.push(customPalette);

  const currentPalette = paletteArray.find(p => p.name === selectedPaletteKey) || customPalette;

  return (
    <CartProvider siteId={siteId || ''}>
      <div
        className={`h-screen flex flex-col overflow-hidden relative transition-[margin] duration-300 ease-out ${sidebarOpen ? 'lg:ml-[20rem]' : ''}`}
      >
        {/* Floating Toolbar / Sidebar */}
        <FloatingToolbar
          siteTitle={siteTitle}
          onSiteTitle={handleSiteTitleChange}
          onSave={handleSaveDesign}
          saving={saving}
          publishing={false}
          onPublishSuccess={() => {
            if (siteId) {
              fetchSite(siteId);
            }
            fetchPages();
          }}
          templatePalettes={paletteArray}
          selectedPalette={currentPalette}
          onSelectPalette={(palette) => handlePaletteChange(palette.name)}
          onCustomColorChange={handleCustomColorChange}
          titleFont={siteContent.titleFont}
          onTitleFontChange={(font) => handleUpdateSiteContent('titleFont', font)}
          bodyFont={siteContent.bodyFont}
          onBodyFontChange={(font) => handleUpdateSiteContent('bodyFont', font)}
          changes={changesHook.changes}
          onUndo={changesHook.undo}
          onRedo={changesHook.redo}
          canUndo={changesHook.canUndo}
          canRedo={changesHook.canRedo}
          logoUrl={siteContent.siteLogo}
          onLogoChange={(url) => handleUpdateSiteContent('siteLogo', url)}
          uploadImage={uploadImage}
          siteCategory={site?.category || undefined}
          currentSiteId={siteId || undefined}
          isPublished={site?.isPublished || false}
          publishedDomain={site?.publishedDomain}
          isSynced={isSynced}
          isOpen={sidebarOpen}
          onOpenChange={setSidebarOpen}
          aiMessages={aiBuilder.messages}
          aiIsLoading={aiBuilder.isLoading}
          onAiSend={aiBuilder.sendMessage}
          onAiCancel={aiBuilder.cancel}
          onAiClear={aiBuilder.clearMessages}
          isProUser={isProUser}
          isBasicUser={isBasicUser}
          isFreeUser={isFreeUser}
          showAiUpgradeModal={aiBuilder.showUpgradeModal}
          onDismissAiUpgradeModal={aiBuilder.dismissUpgradeModal}
          aiRemaining={aiBuilder.remaining}
          focusAiBuilder={focusAiBuilder}
        />

        {/* Editor Banner - Redesigned */}
        <div
          className="safe-area-banner flex-none px-4 z-[1000] shadow flex items-center justify-between gap-6 border-b"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          {/* Left: Logo + Page Selector */}
          <div className="flex items-center gap-4">
            {/* Hamburger Menu Button (Toggle settings panel on all screen sizes) */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex-shrink-0 flex items-center hover:opacity-80 transition-opacity mr-4 text-white"
              title={sidebarOpen ? "Close settings" : "Open settings"}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Page Selector */}
            {pages.length > 0 && (
              <PageSelector
                siteId={siteId || ''}
                pages={pages}
                currentPageId={currentPageId || undefined}
                onPageChange={(page) => {
                  setCurrentPageId(page.id);
                  if (previewProductId) {
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete('productId');
                    router.push(`${window.location.pathname}?${params.toString()}`);
                  }
                }}
                onCreatePage={async (slug, title, displayName) => {
                  const newPage = await createPage(slug, title, displayName);
                  // Auto-add a nav item for the new page
                  const newNavItem: NavItem = {
                    id: `nav-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                    label: title,
                    linkType: 'page' as const,
                    href: `/${slug}`,
                    pageId: newPage.id,
                  };
                  const updatedNavItems = [...navItems, newNavItem];
                  // Update state without tracking as unsaved change
                  setSiteContent((prev) => ({ ...prev, __navItems: updatedNavItems }));
                  // Auto-save site content with new nav item
                  if (site?.id) {
                    const updatedSiteContent = { ...siteContent, __navItems: updatedNavItems, __selectedPalette: selectedPaletteKey };
                    fetch('/api/sites', {
                      credentials: 'include',
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ siteId: site.id, designData: updatedSiteContent }),
                    }).then(() => {
                      initialSiteContentRef.current = { ...updatedSiteContent };
                    }).catch(err => console.error('Auto-save nav failed:', err));
                  }
                  return newPage;
                }}
                onDeletePage={async (pageId) => {
                  await deletePage(pageId);
                  // Auto-remove nav items that link to this page
                  const filtered = navItems.filter(item => item.pageId !== pageId);
                  if (filtered.length !== navItems.length) {
                    setSiteContent((prev) => ({ ...prev, __navItems: filtered }));
                    // Auto-save
                    if (site?.id) {
                      const updatedSiteContent = { ...siteContent, __navItems: filtered, __selectedPalette: selectedPaletteKey };
                      fetch('/api/sites', {
                        credentials: 'include',
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ siteId: site.id, designData: updatedSiteContent }),
                      }).then(() => {
                        initialSiteContentRef.current = { ...updatedSiteContent };
                      }).catch(err => console.error('Auto-save nav failed:', err));
                    }
                  }
                }}
              />
            )}
          </div>

          {/* Right: Edit/Preview Toggle */}
          <div className="flex-shrink-0">
            <EmbeddedToggle
              isActive={editMode}
              onToggle={setEditMode}
              activeLabel="Edit"
              inactiveLabel="View"
            />
          </div>
        </div>

        {/* Template Render Wrapper (This section alone scrolls, so sticky headers inside templates stick to the top of THIS container, right below our Editor banner) */}
        <div className="flex-1 overflow-y-auto w-full relative">
          <EditorProvider
            value={{
              content: editableContent,
              siteContent,
              updateSiteContent: handleUpdateSiteContent,
              navItems,
              updateNavItems: handleUpdateNavItems,
              pages: pages.map(p => ({ id: p.id, slug: p.slug, title: p.title })),
              isEditMode: editMode,
              updateContent: handleUpdateContent,
              palette: paletteData,
              availablePalettes: Object.keys(availablePalettes),
              siteId: siteId || undefined,
              siteCategory: site?.category || undefined,
              uploadImage: uploadImage,
              setPalette: handlePaletteChange,
              blocks: editableContent.blocks || [],
              addBlock,
              removeBlock,
              moveBlock,
              updateBlockData,
              addChange,
              isProUser,
            }}
          >
            <div className="w-full">
              {previewProductId ? (
                <PreviewProductPage
                  productId={previewProductId}
                  siteId={siteId!}
                  palette={paletteData}
                  siteName={siteTitle}
                />
              ) : templateComponent ? (
                createElement(templateComponent, {
                  palette: paletteData,
                  isEditMode: editMode,
                })
              ) : null}
            </div>
          </EditorProvider>
        </div>

        <AlertModal
          isOpen={alertConfig.isOpen}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        />

        <AlertModal
          isOpen={leaveConfirmOpen}
          title="Unsaved Changes"
          message="You have unsaved changes that will be lost if you leave. Are you sure?"
          type="warning"
          onClose={() => setLeaveConfirmOpen(false)}
          onConfirm={() => {
            setLeaveConfirmOpen(false);
            router.push('/');
          }}
          confirmLabel="Leave"
          cancelLabel="Stay"
        />
        <CartDrawer siteId={siteId || ''} palette={paletteData} />
        <CartButton accentColor={paletteData?.secondary} />
      </div>
    </CartProvider>
  );
}
