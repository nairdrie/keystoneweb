'use client';

import { useState, useEffect, createElement } from 'react';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import { EditorProvider } from '@/lib/editor-context';

interface PublicSiteRendererProps {
  siteId: string;
  templateId: string;
  designData: Record<string, any>;
}

export default function PublicSiteRenderer({
  siteId,
  templateId,
  designData,
}: PublicSiteRendererProps) {
  const [templateComponent, setTemplateComponent] = useState<React.ComponentType<any> | null>(null);
  const [paletteData, setPaletteData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        setLoading(true);
        const [component, metadata] = await Promise.all([
          getTemplateComponent(templateId),
          getTemplateMetadata(templateId)
        ]);

        if (!component) {
          throw new Error(`Template not found: ${templateId}`);
        }

        // Process requested palette from designData
        if (metadata) {
          const palettesObj = metadata.palettes || {};
          const requestedPalette = designData.__selectedPalette || 'default';
          setPaletteData(palettesObj[requestedPalette] || palettesObj['default'] || {});
        }

        setTemplateComponent(() => component);
        setError(null);
      } catch (err) {
        console.error('Error loading template:', err);
        setError(err instanceof Error ? err.message : 'Failed to load template');
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, [templateId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading site...</p>
        </div>
      </div>
    );
  }

  if (error || !templateComponent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Error Loading Site</h1>
          <p className="text-slate-600">{error || 'Failed to load template'}</p>
        </div>
      </div>
    );
  }

  // Ensure designData has safe defaults for palette
  const safeDesignData = {
    __selectedPalette: 'default',
    ...designData,
  };

  // Render template through EditorProvider so context hooks resolve (even in read-only)
  return (
    <EditorProvider
      value={{
        content: safeDesignData,
        isEditMode: false,
        updateContent: () => { }, // No-ops for public viewer
        palette: paletteData,
        availablePalettes: [],
        siteId: siteId,
        uploadImage: async () => { return ''; },
        setPalette: () => { },
      }}
    >
      {createElement(templateComponent, {
        palette: paletteData,
        isEditMode: false,
      })}
    </EditorProvider>
  );
}
