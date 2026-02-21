'use client';

import { useEffect, useState, ReactNode } from 'react';
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

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const res = await fetch(`/api/templates/${templateId}`);
        if (!res.ok) throw new Error('Failed to fetch template');
        
        const { html: templateHtml } = await res.json();
        setBaseHtml(templateHtml);
        setLoading(false);
      } catch (err) {
        console.error('Error loading template:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    if (templateId) fetchTemplate();
  }, [templateId]);

  // Apply colors and process editable content
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
          /* Edit mode hints */
          [data-editable-key]:hover { outline: 2px dashed rgba(59, 130, 246, 0.5); outline-offset: 2px; }
        ` : ''}
      </style>
    `;

    let finalHtml = baseHtml.replace(/<style id="color-overrides">[\s\S]*?<\/style>/g, '');
    
    // Mark editable elements with data attribute so we can style them in edit mode
    // Replace {{key}} with data-editable-key="key" wrapper
    finalHtml = finalHtml.replace(/{{(\w+)}}/g, '<span data-editable-key="$1" contenteditable="false">{{$1}}</span>');
    
    // If we have edited content, replace the placeholders with the actual content
    if (editableContent && Object.keys(editableContent).length > 0) {
      Object.entries(editableContent).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        finalHtml = finalHtml.replace(regex, value);
      });
    }
    
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
  }, [baseHtml, colors, editMode, editableContent]);

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
    <div className="w-full overflow-auto">
      {editMode && (
        <div className="fixed top-0 left-0 right-0 bg-blue-100 border-b-2 border-blue-400 p-3 z-40 shadow">
          <p className="text-sm text-blue-900 max-w-7xl mx-auto">
            ✏️ <strong>Edit Mode:</strong> Click any highlighted text to edit it directly • Pencil icon appears on hover
          </p>
        </div>
      )}
      
      <div className={editMode ? 'mt-16' : ''}>
        <div 
          className="relative"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {/* Enhanced Edit Mode UI - Show editable keys on right side */}
      {editMode && Object.keys(editableContent).length > 0 && (
        <div className="fixed right-0 bottom-32 w-80 bg-white border-l border-slate-200 shadow-lg rounded-tl-lg p-4 z-40 max-h-96 overflow-y-auto">
          <h3 className="font-bold text-slate-900 mb-3 text-sm">Editable Content</h3>
          <div className="space-y-2 text-xs">
            {Object.entries(editableContent).map(([key, value]) => (
              <div key={key} className="p-2 bg-slate-50 rounded border border-slate-200">
                <p className="font-semibold text-slate-600">{key}</p>
                <p className="text-slate-700 truncate">{value || '(empty)'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
