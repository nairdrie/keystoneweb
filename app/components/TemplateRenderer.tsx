'use client';

import { useEffect, useState } from 'react';
import EditableText from './EditableText';

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

const DEFAULT_COLORS = {
  primary: '#1f2937',
  secondary: '#dc2626',
  accent: '#f3f4f6',
};

// Map content keys to their locations in specific templates
// This is a temporary mapping - ideally templates would have markup like {{heroTitle}}
const EDITABLE_KEYS_MAP: Record<string, string[]> = {
  'svc_handyman_classic': [
    'heroTitle',
    'heroSubtitle',
    'servicesTitle',
    'aboutTitle',
    'ctaText',
  ],
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
  const [dom, setDom] = useState<Document | null>(null);

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const res = await fetch(`/api/templates/${templateId}`);
        if (!res.ok) throw new Error('Failed to fetch template');
        
        const { html: templateHtml } = await res.json();
        setBaseHtml(templateHtml);
        
        // Parse HTML to DOM for manipulation
        if (typeof window !== 'undefined') {
          const parser = new DOMParser();
          const doc = parser.parseFromString(templateHtml, 'text/html');
          setDom(doc);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading template:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    if (templateId) fetchTemplate();
  }, [templateId]);

  // Apply colors to the template
  useEffect(() => {
    if (!baseHtml) return;

    const activeColors = colors || DEFAULT_COLORS;
    const { primary, secondary, accent } = activeColors;

    const colorOverrideStyles = `
      <style id="color-overrides">
        :root, html, body, * {
          --color-primary: ${primary} !important;
          --color-secondary: ${secondary} !important;
          --color-accent: ${accent} !important;
        }
        [class*="bg-red-600"] { background-color: ${secondary} !important; }
        [class*="text-red-600"] { color: ${secondary} !important; }
        [class*="border-red-600"] { border-color: ${secondary} !important; }
        [class*="hover:bg-red-700"]:hover { background-color: ${secondary} !important; opacity: 0.9; }
        [class*="bg-gray-900"] { background-color: ${primary} !important; }
        [class*="text-gray-900"] { color: ${primary} !important; }
        [class*="border-gray-900"] { border-color: ${primary} !important; }
        [class*="bg-gray-800"] { background-color: ${primary} !important; }
        [class*="bg-gray-100"] { background-color: ${accent} !important; }
        button[class*="bg-red"], button[class*="bg-gray-9"], a[class*="bg-red"], a[class*="bg-gray-9"] {
          background-color: ${secondary} !important; color: white !important;
        }
        [class*="from-gray-900"] { background: linear-gradient(to right, ${primary}, ${primary}) !important; }
        [class*="from-gray-800"] { background: linear-gradient(to bottom, ${primary}, ${primary}) !important; }

        ${editMode ? `
          /* Edit mode - show hint on edit-enabled elements */
          [data-editable]:hover { background-color: rgba(59, 130, 246, 0.1); }
        ` : ''}
      </style>
    `;

    let finalHtml = baseHtml.replace(/<style id="color-overrides">[\s\S]*?<\/style>/g, '');
    
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
  }, [baseHtml, colors, editMode]);

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

  // In edit mode, wrap template with EditableText overlay
  // For now, just show the template with base HTML
  // The EditableText wrapper would be added when we have proper template syntax
  
  return (
    <div className="w-full overflow-auto">
      {editMode && (
        <div className="fixed top-0 left-0 right-0 bg-blue-100 border-b-2 border-blue-400 p-3 z-40">
          <p className="text-sm text-blue-900">
            ✏️ <strong>Edit Mode:</strong> Hover over text and click the pencil icon to edit
          </p>
        </div>
      )}
      
      <div className={editMode ? 'mt-16' : ''}>
        <div 
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
