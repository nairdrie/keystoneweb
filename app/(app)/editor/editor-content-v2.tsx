'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import FloatingToolbar from '@/app/components/FloatingToolbar';
import EditModeToggle from '@/app/components/EditModeToggle';
import { EditorProvider } from '@/lib/editor-context';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import { useAuth } from '@/lib/auth/context';

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

  const siteId = searchParams.get('siteId');

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
      const res = await fetch('/api/user/latest-site');

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
      setSiteTitle(data.title || 'My Website');
      setEditableContent(data.designData || {});
    } catch (err) {
      console.error('Error fetching site:', err);
      setError('Failed to load site');
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
    setEditableContent((prev) => ({
      ...prev,
      [key]: value,
    }));
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
      alert('Design saved successfully!');
    } catch (err) {
      console.error('Error saving design:', err);
      setError('Failed to save design');
    } finally {
      setSaving(false);
    }
  };

  const handlePaletteChange = (paletteKey: string) => {
    setSelectedPaletteKey(paletteKey);
    const palette = availablePalettes[paletteKey];
    if (palette) {
      setPaletteData(palette);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading editor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!site || !templateComponent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading template...</p>
      </div>
    );
  }

  // Convert availablePalettes object to array format for FloatingToolbar
  const paletteArray = Object.entries(availablePalettes).map(([key, colors]) => ({
    name: key,
    ...colors,
  }));

  const currentPalette = paletteArray.find(p => p.name === selectedPaletteKey);

  return (
    <div className="relative min-h-screen">
      {/* Floating Toolbar */}
      <FloatingToolbar
        siteTitle={siteTitle}
        onSiteTitle={setSiteTitle}
        onSave={handleSaveDesign}
        saving={saving}
        templatePalettes={paletteArray}
        selectedPalette={currentPalette}
        onSelectPalette={(palette) => handlePaletteChange(palette.name)}
      />

      {/* Edit Mode Toggle */}
      <EditModeToggle
        isEditMode={editMode}
        onToggle={setEditMode}
      />

      {/* Template Render */}
      <EditorProvider
        value={{
          content: editableContent,
          isEditMode: editMode,
          updateContent: handleUpdateContent,
          palette: paletteData,
          availablePalettes: Object.keys(availablePalettes),
          setPalette: handlePaletteChange,
        }}
      >
        <div className="w-full">
          {templateComponent({
            palette: paletteData,
            isEditMode: editMode,
          })}
        </div>
      </EditorProvider>
    </div>
  );
}
