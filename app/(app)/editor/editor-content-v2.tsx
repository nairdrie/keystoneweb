'use client';

import { useState, useEffect, Suspense, createElement, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import FloatingToolbar from '@/app/components/FloatingToolbar';
import { EditorProvider } from '@/lib/editor-context';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import { useAuth } from '@/lib/auth/context';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { useChangeTracking } from '@/lib/hooks/useChangeTracking';
import EditorLoadingScreen from '@/app/components/EditorLoadingScreen';

interface SiteData {
  id: string;
  userId: string | null;
  selectedTemplateId: string;
  businessType: string;
  category: string;
  designData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export default function EditorContent() {
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
  const { changes, addChange, undo, redo, canUndo, canRedo, clearChanges } = useChangeTracking();
  const initialTitleRef = useRef<string>('My Website');
  const initialPaletteRef = useRef<string>('default');
  const initialContentRef = useRef<Record<string, string>>({});

  const siteId = searchParams.get('siteId');
  const { uploadImage } = useImageUpload(siteId || '');

  // Auth check and site loading
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
  }, [user, authLoading, siteId, router]);

  // Load template component and metadata when site changes
  useEffect(() => {
    if (!site?.selectedTemplateId) return;

    loadTemplateComponent(site.selectedTemplateId);
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
      const title = data.title || 'My Website';
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

  const loadTemplateComponent = async (templateId: string) => {
    try {
      // Get template component
      const component = await getTemplateComponent(templateId);
      if (!component) {
        console.error(`Template component not found: ${templateId}`);
        setError(`Template not found: ${templateId}`);
        return;
      }
      setTemplateComponent(() => component);

      // Get template metadata (palettes, customizables)
      const metadata = await getTemplateMetadata(templateId);
      if (metadata) {
        const palettesObj = metadata.palettes || {};
        const paletteKeys = Object.keys(palettesObj);
        setAvailablePalettes(palettesObj);
        const firstKey = paletteKeys[0] || 'default';
        setSelectedPaletteKey(firstKey);
        setPaletteData(palettesObj[firstKey] || {});
      }
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

  const handleSiteTitleChange = (newTitle: string) => {
    if (newTitle !== siteTitle) {
      addChange('siteTitle', 'Site Name', siteTitle, newTitle);
    }
    setSiteTitle(newTitle);
  };

  const handleSaveDesign = async () => {
    if (!site) return;

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
          id: site.id,
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
    const palette = availablePalettes[paletteKey];
    if (palette) {
      setPaletteData(palette);
    }
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

  const currentPalette = paletteArray.find(p => p.name === selectedPaletteKey) as any;

  return (
    <div className="relative min-h-screen">
      {/* Floating Toolbar */}
      <FloatingToolbar
        siteTitle={siteTitle}
        onSiteTitle={handleSiteTitleChange}
        onSave={handleSaveDesign}
        saving={saving}
        templatePalettes={paletteArray}
        selectedPalette={currentPalette}
        onSelectPalette={(palette) => handlePaletteChange(palette.name)}
        changes={changes}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        currentSiteId={siteId || undefined}
      />

      {/* Top Banner */}
      <div
        className="fixed top-0 left-0 right-0 border-b p-3 z-[1000] shadow flex justify-center items-center gap-4"
        style={{ backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary-dark)' }}
      >
        <p className="text-sm text-white max-w-7xl">
          {editMode ? (
            <>✏️ <strong>Edit Mode:</strong> Click any pencil icon to edit text</>
          ) : (
            <>👁️ <strong>Preview Mode:</strong> Viewing how your site will look to visitors</>
          )}
        </p>
        <button
          onClick={() => setEditMode(!editMode)}
          className="px-3 py-1 bg-white text-xs font-bold rounded-[4px] hover:bg-slate-100 transition-colors shadow-sm cursor-pointer"
          style={{ color: 'var(--brand-primary)' }}
        >
          Switch to {editMode ? 'Preview' : 'Edit'} Mode
        </button>
      </div>

      {/* Template Render */}
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
        <div className="w-full mt-12">
          {templateComponent
            ? createElement(templateComponent, {
              palette: paletteData,
              isEditMode: editMode,
            })
            : null}
        </div>
      </EditorProvider>
    </div>
  );
}
