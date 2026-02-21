'use client';

import { useEffect, useState } from 'react';

interface TemplateRendererProps {
  templateId: string;
  colors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  editMode?: boolean;
  editableContent?: Record<string, string>;
  onEditableContentChange?: (key: string, value: string) => void;
}

// Default colors for palette (from metadata)
const DEFAULT_COLORS = {
  primary: '#1f2937',
  secondary: '#dc2626',
  accent: '#f3f4f6',
};

// Define editable content keys per template
const EDITABLE_KEYS_MAP: Record<string, string[]> = {
  'svc_handyman_classic': [
    'heroTitle',
    'heroSubtitle',
    'servicesTitle',
    'aboutTitle',
    'aboutText',
    'testimonialsTitle',
    'ctaText',
  ],
  // Add more templates as needed - they'll default to empty array
};

export default function TemplateRenderer({
  templateId,
  colors,
  editMode = false,
  editableContent = {},
  onEditableContentChange,
}: TemplateRendererProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseHtml, setBaseHtml] = useState<string>('');

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

  // Apply colors and editable content to the template
  useEffect(() => {
    if (!baseHtml) return;

    const activeColors = colors || DEFAULT_COLORS;
    const { primary, secondary, accent } = activeColors;

    // Create CSS that overrides Tailwind colors with high specificity
    const colorOverrideStyles = `
      <style id="color-overrides">
        :root, html, body, * {
          --color-primary: ${primary} !important;
          --color-secondary: ${secondary} !important;
          --color-accent: ${accent} !important;
        }
        
        [class*="bg-red-600"] { 
          background-color: ${secondary} !important;
        }
        [class*="text-red-600"] { 
          color: ${secondary} !important;
        }
        [class*="border-red-600"] { 
          border-color: ${secondary} !important;
        }
        [class*="hover:bg-red-700"]:hover { 
          background-color: ${secondary} !important;
          opacity: 0.9;
        }
        
        [class*="bg-gray-900"] { 
          background-color: ${primary} !important;
        }
        [class*="text-gray-900"] { 
          color: ${primary} !important;
        }
        [class*="border-gray-900"] { 
          border-color: ${primary} !important;
        }
        
        [class*="bg-gray-800"] { 
          background-color: ${primary} !important;
        }
        
        [class*="bg-gray-100"] { 
          background-color: ${accent} !important;
        }
        
        button[class*="bg-red"],
        button[class*="bg-gray-9"],
        a[class*="bg-red"],
        a[class*="bg-gray-9"] {
          background-color: ${secondary} !important;
          color: white !important;
        }
        
        [class*="from-gray-900"] {
          background: linear-gradient(to right, ${primary}, ${primary}) !important;
        }
        [class*="from-gray-800"] {
          background: linear-gradient(to bottom, ${primary}, ${primary}) !important;
        }

        ${editMode ? `
          /* Edit mode styles */
          [data-editable] {
            position: relative;
            outline: 2px dashed rgba(59, 130, 246, 0.3);
            outline-offset: 2px;
            transition: outline-color 0.2s;
          }
          [data-editable]:hover {
            outline-color: rgba(59, 130, 246, 0.8);
            background-color: rgba(59, 130, 246, 0.05);
          }
        ` : ''}
      </style>
    `;

    let finalHtml = baseHtml;
    
    // Remove old color overrides
    finalHtml = finalHtml.replace(/<style id="color-overrides">[\s\S]*?<\/style>/g, '');
    
    // Apply editable content by simple text replacement
    // This is a simplified approach - matches common placeholder patterns
    if (editableContent && Object.keys(editableContent).length > 0) {
      // Replace patterns like "Professional Handyman Services You Can Trust"
      // with edited content based on editable keys
      
      // For now, just mark editable sections with data attribute
      // In a more sophisticated version, we'd use template syntax like {{heroTitle}}
      
      // Example: if we find "Professional Handyman Services" and it's the heroTitle key,
      // replace it with editableContent.heroTitle
      
      // For simplicity in this MVP, we'll use a basic find/replace for h1 and h2 tags
      let editCounter = 0;
      const editableKeys = EDITABLE_KEYS_MAP[templateId] || [];
      
      finalHtml = finalHtml.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/g, (match) => {
        if (editCounter < editableKeys.length && editableContent[editableKeys[editCounter]]) {
          const key = editableKeys[editCounter];
          editCounter++;
          return `<h1 data-editable="${key}">${editableContent[key]}</h1>`;
        }
        editCounter++;
        return match;
      });
    }
    
    // Insert color overrides
    if (finalHtml.includes('</head>')) {
      finalHtml = finalHtml.replace('</head>', colorOverrideStyles + '</head>');
    } else if (finalHtml.includes('<body')) {
      const bodyStart = finalHtml.indexOf('<body');
      const bodyEndTag = finalHtml.indexOf('>', bodyStart) + 1;
      finalHtml = finalHtml.slice(0, bodyEndTag) + colorOverrideStyles + finalHtml.slice(bodyEndTag);
    } else {
      finalHtml = colorOverrideStyles + finalHtml;
    }

    setHtml(finalHtml);
  }, [baseHtml, colors, editMode, editableContent, templateId]);

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
    <div className="w-full overflow-auto flex">
      {/* Template */}
      <div 
        className={`flex-1 ${editMode ? 'mr-96' : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Edit Panel - Only show in edit mode */}
      {editMode && (
        <div className="fixed right-0 top-0 bottom-0 w-96 bg-white border-l border-slate-200 overflow-y-auto z-40 shadow-xl">
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Edit Content</h2>
            
            {EDITABLE_KEYS_MAP[templateId]?.length ? (
              <div className="space-y-6">
                {EDITABLE_KEYS_MAP[templateId]?.map(key => (
                  <div key={key}>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <textarea
                      value={editableContent[key] || ''}
                      onChange={(e) => onEditableContentChange?.(key, e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent resize-none"
                      rows={3}
                      placeholder={`Edit ${key}`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600 text-sm">
                No editable content defined for this template yet.
              </p>
            )}

            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                💡 Changes are saved in real-time. Click elements on the template to edit them.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
