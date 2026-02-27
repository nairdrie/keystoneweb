'use client';

import { useState, useEffect, Suspense, createElement, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Eye, Pencil } from 'lucide-react';
import FloatingToolbar from '@/app/components/FloatingToolbar';
import { EditorProvider } from '@/lib/editor-context';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import { useAuth } from '@/lib/auth/context';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { useChangeTracking } from '@/lib/hooks/useChangeTracking';
import EditorLoadingScreen from '@/app/components/EditorLoadingScreen';

export interface SiteData {
  id: string;
  userId: string | null;
  selectedTemplateId: string;
  businessType: string;
  category: string;
  designData: Record<string, any>;
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
    return (
      <EditorProvider
        value={{
          content: publicSiteData?.designData || {},
          isEditMode: false,
          updateContent: () => { },
          palette: precomputedPalette || {},
          availablePalettes: [],
          siteId: publicSiteData?.id,
          uploadImage: async () => { return ''; },
          setPalette: () => { },
        }}
      >
        <div className="w-full min-h-screen">
          {children}
        </div>
      </EditorProvider>
    );
  }

  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [site, setSite] = useState<SiteData | null>(null);
  const [templateComponent, setTemplateComponent] = useState<React.ComponentType<any> | null>(null);
  const [selectedPaletteKey, setSelectedPaletteKey] = useState<string>('default');
  const [availablePalettes, setAvailablePalettes] = useState<Record<string, Record<string, string>>>({});
  const [paletteData, setPaletteData] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState(false);
  const [editableContent, setEditableContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteTitle, setSiteTitle] = useState('My Website');
  const [error, setError] = useState<string | null>(null);

  // Change tracking
  const changesHook = useChangeTracking();
  const { addChange, clearChanges } = changesHook;

  const initialTitleRef = useRef<string>('My Website');
  const initialPaletteRef = useRef<string>('default');
  const initialContentRef = useRef<Record<string, string>>({});

  const siteId = searchParams.get('siteId');
  const { uploadImage } = useImageUpload(siteId || '');

  // Auth check and site loading (ONLY for editor mode)
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push(`/onboarding${siteId ? `?siteId=${siteId}` : ''}`);
      return;
    }

    if (siteId) {
      fetchSite(siteId);
    } else {
      redirectToLatestSite();
    }
  }, [user, authLoading, siteId, router, isPublicView, publicSiteData]);

  // Load template component and metadata when site changes
  useEffect(() => {
    if (!site?.selectedTemplateId) return;

    loadTemplateComponent(site.selectedTemplateId, site.designData?.__selectedPalette);
  }, [site?.selectedTemplateId]);

  const redirectToLatestSite = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/user/latest-site', { credentials: 'include' });

      if (!res.ok) {
        if (res.status === 404) {
          setError('You have no sites yet. Create one to get started!');
          setLoading(false);
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
      const content = data.designData || {};
      const selectedPalette = content.__selectedPalette || 'default';

      // Store initial values for change detection
      initialTitleRef.current = title;
      initialPaletteRef.current = selectedPalette;
      initialContentRef.current = { ...content };

      setSiteTitle(title);
      setEditableContent(content);
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
        const activeKey = (savedPaletteKey && paletteKeys.includes(savedPaletteKey))
          ? savedPaletteKey
          : (paletteKeys[0] || 'default');

        setSelectedPaletteKey(activeKey);
        setPaletteData(palettesObj[activeKey] || {});
      }

      // NOW we set the component, so when it initially renders, it instantly has the correct palette loaded!
      setTemplateComponent(() => component);
    } catch (err) {
      console.error('Error loading template:', err);
      setError('Failed to load template');
    }
  };

  const handleUpdateContent = (key: string, value: string) => {
    setEditableContent((prev) => {
      const updated = {
        ...prev,
        [key]: value,
      };

      // Track content change
      const oldValue = prev[key] || '';
      if (oldValue !== value) {
        addChange('content', `Content: ${key}`, oldValue, value);
      }

      return updated;
    });
  };

  // Reconstruct state when History Undo/Redo is triggered
  useEffect(() => {
    const action = changesHook.lastAction;
    if (!action) return;

    // We reconstruct state from scratch using standard refs to ensure absolute accuracy
    let restoredTitle = initialTitleRef.current;
    let restoredPalette = initialPaletteRef.current;
    let restoredContent = { ...initialContentRef.current };

    // Simply replay all changes currently active in the history array top-down!
    for (const change of action.changes) {
      if (change.field === 'siteTitle') {
        restoredTitle = change.to;
      } else if (change.field === 'palette') {
        restoredPalette = change.to;
      } else if (change.field === 'content') {
        // change.label looks like "Content: heroTitle", we just need the key
        const key = change.label.replace('Content: ', '');
        restoredContent[key] = change.to;
      }
    }

    // Apply the restored state completely!
    setSiteTitle(restoredTitle);
    setSelectedPaletteKey(restoredPalette);

    const palette = restoredPalette === 'custom'
      ? {
        primary: restoredContent.__customPalette_primary || '#0f172a',
        secondary: restoredContent.__customPalette_secondary || '#64748b',
        accent: restoredContent.__customPalette_accent || '#cbd5e1',
      }
      : availablePalettes[restoredPalette];

    if (palette) {
      setPaletteData(palette);
    }

    setEditableContent(restoredContent);

  }, [changesHook.lastAction, availablePalettes]);

  const handleSiteTitleChange = (newTitle: string) => {
    if (newTitle !== siteTitle) {
      addChange('siteTitle', 'Site Name', siteTitle, newTitle);
    }
    setSiteTitle(newTitle);
  };

  const handleSaveDesign = async () => {
    if (!site?.id || isPublicView) return;

    try {
      setSaving(true);

      // Include palette selection in design data
      const designData = {
        ...editableContent,
        __selectedPalette: selectedPaletteKey,
      };

      const res = await fetch('/api/sites', {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: site.id,
          title: siteTitle,
          designData,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setError(errorData.error || 'Failed to save design');
        return;
      }

      // Success!
      const updated = await res.json();
      setSite(updated);
      setError(null);
      clearChanges();
      alert('Design saved successfully!');
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
        primary: editableContent.__customPalette_primary || '#0f172a',
        secondary: editableContent.__customPalette_secondary || '#64748b',
        accent: editableContent.__customPalette_accent || '#cbd5e1',
      });
    } else {
      const palette = availablePalettes[paletteKey];
      if (palette) {
        setPaletteData(palette);
      }
    }
  };

  const handleCustomColorChange = (colorType: 'primary' | 'secondary' | 'accent', value: string) => {
    handleUpdateContent(`__customPalette_${colorType}`, value);
    if (selectedPaletteKey !== 'custom') {
      handlePaletteChange('custom');
    }
    setPaletteData(prev => ({ ...prev, [colorType]: value }));
  };

  if (loading) {
    return <EditorLoadingScreen />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!site || !templateComponent) {
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
    primary: editableContent.__customPalette_primary || '#0f172a',
    secondary: editableContent.__customPalette_secondary || '#64748b',
    accent: editableContent.__customPalette_accent || '#cbd5e1',
  };
  paletteArray.push(customPalette);

  const currentPalette = paletteArray.find(p => p.name === selectedPaletteKey) || customPalette;

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      {/* Floating Toolbar */}
      <FloatingToolbar
        siteTitle={siteTitle}
        onSiteTitle={handleSiteTitleChange}
        onSave={handleSaveDesign}
        saving={saving}
        publishing={false}
        templatePalettes={paletteArray}
        selectedPalette={currentPalette}
        onSelectPalette={(palette) => handlePaletteChange(palette.name)}
        onCustomColorChange={handleCustomColorChange}
        changes={changesHook.changes}
        onUndo={changesHook.undo}
        onRedo={changesHook.redo}
        canUndo={changesHook.canUndo}
        canRedo={changesHook.canRedo}
        currentSiteId={siteId || undefined}
        isPublished={site?.isPublished || false}
        publishedDomain={site?.publishedDomain}
      />

      {/* Top Banner (Flex-none so it stays at very top of screen while template scrolls below) */}
      <div
        className="flex-none border-b p-3 z-[1000] shadow flex justify-center items-center gap-4 flex-wrap"
        style={{ backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary-dark)' }}
      >
        <p className="text-sm text-white max-w-7xl text-center">
          {editMode ? (
            <><Pencil className="inline-block w-4 h-4"></Pencil> <strong>Edit Mode:</strong> Click any element to edit text</>
          ) : (
            <><Eye className="inline-block w-4 h-4"></Eye> <strong>Preview Mode:</strong> Viewing how your site will look to visitors</>
          )}
        </p>
        <button
          onClick={() => setEditMode(!editMode)}
          className="px-3 py-1 bg-white text-xs font-bold rounded-[4px] hover:bg-slate-100 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
          style={{ color: 'var(--brand-primary)' }}
        >
          Switch to {editMode ? 'Preview' : 'Edit'} Mode
        </button>
      </div>

      {/* Template Render Wrapper (This section alone scrolls, so sticky headers inside templates stick to the top of THIS container, right below our Editor banner) */}
      <div className="flex-1 overflow-y-auto w-full relative">
        <EditorProvider
          value={{
            content: editableContent,
            isEditMode: editMode,
            updateContent: handleUpdateContent,
            palette: paletteData,
            availablePalettes: Object.keys(availablePalettes),
            siteId: siteId || undefined,
            uploadImage: uploadImage,
            setPalette: handlePaletteChange,
          }}
        >
          <div className="w-full">
            {templateComponent
              ? createElement(templateComponent, {
                palette: paletteData,
                isEditMode: editMode,
              })
              : null}
          </div>
        </EditorProvider>
      </div>
    </div>
  );
}
