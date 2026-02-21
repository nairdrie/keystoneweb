'use client';

import { useEffect, useState } from 'react';

interface TemplateRendererProps {
  templateId: string;
  colors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export default function TemplateRenderer({ templateId, colors }: TemplateRendererProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const res = await fetch(`/api/templates/${templateId}`);
        
        if (!res.ok) {
          throw new Error('Failed to fetch template');
        }
        
        let { html: templateHtml } = await res.json();

        // Apply color overrides if provided
        if (colors) {
          // Replace color variables in the HTML with actual values
          // Assumes templates use CSS variables or data attributes for colors
          templateHtml = templateHtml
            .replace(/var\(--primary\)/g, colors.primary)
            .replace(/var\(--secondary\)/g, colors.secondary)
            .replace(/var\(--accent\)/g, colors.accent)
            .replace(/\[primary\]/g, colors.primary)
            .replace(/\[secondary\]/g, colors.secondary)
            .replace(/\[accent\]/g, colors.accent);
        }

        setHtml(templateHtml);
        setError(null);
      } catch (err) {
        console.error('Error loading template:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (templateId) {
      fetchTemplate();
    }
  }, [templateId, colors]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          <p className="mt-4 text-slate-600">Loading template...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <p className="text-red-600 font-semibold">Error loading template</p>
          <p className="text-slate-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full overflow-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
