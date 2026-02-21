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

// Default colors for palette (from metadata)
const DEFAULT_COLORS = {
  primary: '#1f2937',
  secondary: '#dc2626',
  accent: '#f3f4f6',
};

export default function TemplateRenderer({ templateId, colors }: TemplateRendererProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseHtml, setBaseHtml] = useState<string>(''); // Store original HTML

  // Fetch template once on mount
  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const res = await fetch(`/api/templates/${templateId}`);
        
        if (!res.ok) {
          throw new Error('Failed to fetch template');
        }
        
        const { html: templateHtml } = await res.json();
        setBaseHtml(templateHtml);
        setLoading(false);
      } catch (err) {
        console.error('Error loading template:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    if (templateId) {
      fetchTemplate();
    }
  }, [templateId]);

  // Apply colors to the template whenever colors change
  useEffect(() => {
    if (!baseHtml) return;

    const activeColors = colors || DEFAULT_COLORS;
    const { primary, secondary, accent } = activeColors;

    // Create CSS that overrides Tailwind colors
    // This maps common color classes to our palette colors
    const colorOverrideStyles = `
      <style id="color-overrides">
        :root {
          --color-primary: ${primary};
          --color-secondary: ${secondary};
          --color-accent: ${accent};
        }
        
        /* Override red-600 (usually secondary) */
        .bg-red-600, .text-red-600, .border-red-600 { 
          --tw-bg-opacity: 1; 
          background-color: ${secondary} !important;
          color: ${secondary} !important;
          border-color: ${secondary} !important;
        }
        .hover\\:bg-red-700:hover { 
          background-color: ${secondary} !important; 
          filter: brightness(0.9);
        }
        .hover\\:text-red-600:hover { 
          color: ${secondary} !important; 
        }
        
        /* Override gray-900/gray-800 (usually primary) */
        .bg-gray-900, .bg-gray-800 { 
          background-color: ${primary} !important; 
        }
        .text-gray-900 { 
          color: ${primary} !important; 
        }
        .border-gray-900 { 
          border-color: ${primary} !important; 
        }
        
        /* Override gray-100 (usually accent/light) */
        .bg-gray-100 { 
          background-color: ${accent} !important; 
        }
        
        /* Button colors */
        button { 
          --tw-bg-opacity: 1; 
        }
        
        /* Ensure CSS variables work */
        * {
          --tw-bg-opacity: 1;
        }
      </style>
    `;

    // Inject the color override styles into the HTML
    let finalHtml = baseHtml;
    
    // Remove old color overrides if they exist
    finalHtml = finalHtml.replace(/<style id="color-overrides">[\s\S]*?<\/style>/g, '');
    
    // Insert new color overrides right after opening body tag or at the start
    if (finalHtml.includes('</head>')) {
      finalHtml = finalHtml.replace('</head>', colorOverrideStyles + '</head>');
    } else if (finalHtml.includes('<body')) {
      const bodyEndTag = finalHtml.indexOf('>') + 1;
      finalHtml = finalHtml.slice(0, bodyEndTag) + colorOverrideStyles + finalHtml.slice(bodyEndTag);
    } else {
      finalHtml = colorOverrideStyles + finalHtml;
    }

    setHtml(finalHtml);
  }, [baseHtml, colors]); // Re-apply colors whenever colors change

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
