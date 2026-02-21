'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FloatingToolbar from '@/app/components/FloatingToolbar';
import EditModeToggle from '@/app/components/EditModeToggle';
import TemplateRenderer from '@/app/components/TemplateRenderer';
import { useAuth } from '@/lib/auth/context';

interface Palette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

interface TemplateMetadata {
  id: string;
  name: string;
  palettes?: Palette[];
}

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
  const [templateMetadata, setTemplateMetadata] = useState<TemplateMetadata | null>(null);
  const [selectedPalette, setSelectedPalette] = useState<Palette | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editableContent, setEditableContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteTitle, setSiteTitle] = useState('My Website');
  const [error, setError] = useState<string | null>(null);

  // Get siteId from query params
  const siteId = searchParams.get('siteId');

  // Check auth and load site
  useEffect(() => {
    if (authLoading) {
      return; // Wait for auth to finish loading
    }

    if (!user) {
      // User is not authenticated, redirect to signup
      router.push(`/signup${siteId ? `?siteId=${siteId}` : ''}`);
      return;
    }

    // User is authenticated
    if (siteId) {
      // Load specific site
      fetchSite(siteId);
    } else {
      // Redirect to latest site (fetch and redirect with ?siteId param)
      redirectToLatestSite();
    }
  }, [user, authLoading, siteId, router]);

  const redirectToLatestSite = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/user/latest-site');

      if (!res.ok) {
        if (res.status === 404) {
          // User has no sites yet
          setError('You have no sites yet. Create one to get started!');
          setLoading(false);
          return;
        }
        setError('Failed to load your sites');
        setLoading(false);
        return;
      }

      const { site: data } = await res.json();
      // Redirect to editor with siteId so it loads that specific site
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

      const data: SiteData = await res.json();

      // Verify ownership - only site owner can edit
      if (data.userId && data.userId !== user?.id) {
        setError('You do not have permission to edit this site');
        setLoading(false);
        return;
      }
      
      setSite(data);
      setSiteTitle(data.designData.title || 'My Website');

      // Load editable content from site data
      const savedContent = data.designData.editableContent || {};
      setEditableContent(savedContent);

      // Get saved palette before fetching metadata
      const savedPalette = data.designData.selectedPalette;
      if (savedPalette) {
        setSelectedPalette(savedPalette);
      }

      // Fetch template metadata to get palettes (pass savedPalette so it doesn't override)
      fetchTemplateMetadata(data.selectedTemplateId, savedPalette || null);
    } catch (err) {
      console.error('Failed to fetch site:', err);
      setError('Failed to load site');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateMetadata = async (templateId: string, savedPalette: Palette | null) => {
    try {
      // Fetch template metadata via API
      const res = await fetch(`/api/templates/${templateId}`);
      if (res.ok) {
        const data = await res.json();
        setTemplateMetadata(data.metadata);

        // Only set to first palette if no saved palette exists
        if (!savedPalette && data.metadata?.palettes?.length > 0) {
          setSelectedPalette(data.metadata.palettes[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch template metadata:', err);
    }
  };

  const handlePaletteSelect = (palette: Palette) => {
    setSelectedPalette(palette);
    // Palette changes are applied in real-time to TemplateRenderer
  };

  const handleEditableContentChange = (key: string, value: string) => {
    setEditableContent(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    if (!site?.id || !user) return;

    // User is authenticated (required to access editor)
    // Save the design with ownership
    setSaving(true);
    try {
      const res = await fetch('/api/sites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: site.id,
          designData: {
            ...site?.designData,
            title: siteTitle,
            selectedPalette: selectedPalette,
            editableContent: editableContent,
          },
          userId: user.id,
        }),
      });

      if (res.ok) {
        const updatedSite = await res.json();
        setSite(updatedSite.site);
        alert('Site saved successfully!');
      } else if (res.status === 403) {
        alert('You do not have permission to edit this site.');
      } else {
        alert('Failed to save. Please try again.');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  // Loading states
  if (authLoading || loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
          <p className="text-slate-600">Loading editor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <p className="text-lg font-bold text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/onboarding')}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Back to Onboarding
          </button>
        </div>
      </div>
    );
  }

  if (!site) {
    return null;
  }

  // Full-screen editor with template preview
  return (
    <div className="w-full h-screen overflow-hidden flex flex-col bg-white">
      {/* Edit Mode Toggle */}
      <EditModeToggle isEditMode={editMode} onChange={setEditMode} />

      {/* Template Renderer - Full Screen, no top bar */}
      <div className="flex-1 overflow-auto">
        <TemplateRenderer
          templateId={site.selectedTemplateId}
          colors={selectedPalette ? {
            primary: selectedPalette.primary,
            secondary: selectedPalette.secondary,
            accent: selectedPalette.accent,
          } : undefined}
          editMode={editMode}
          editableContent={editableContent}
          onEditableContentChange={handleEditableContentChange}
        />
      </div>

      {/* Floating Toolbar with All Controls */}
      <FloatingToolbar
        siteTitle={siteTitle}
        onSiteTitle={setSiteTitle}
        templateName={templateMetadata?.name}
        templatePalettes={templateMetadata?.palettes}
        selectedPalette={selectedPalette || undefined}
        onSelectPalette={handlePaletteSelect}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}
