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
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

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
          /* Edit mode - show permanent pencil icons */
          [data-editable-key] {
            position: relative;
            display: inline-block;
          }
          [data-editable-key]::after {
            content: "✏️";
            position: absolute;
            right: -28px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 16px;
            cursor: pointer;
            padding: 4px 8px;
            background: rgba(59, 130, 246, 0.9);
            border-radius: 6px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          }
          [data-editable-key]:hover::after {
            background: rgba(59, 130, 246, 1);
            transform: translateY(-50%) scale(1.1);
          }
        ` : ''}
      </style>
    `;

    let finalHtml = baseHtml.replace(/<style id="color-overrides">[\s\S]*?<\/style>/g, '');
    
    // Mark editable elements with data attribute
    finalHtml = finalHtml.replace(/{{(\w+)}}/g, '<span data-editable-key="$1" class="inline-block" data-content-key="$1">{{$1}}</span>');
    
    // Replace placeholders with actual content
    if (editableContent && Object.keys(editableContent).length > 0) {
      Object.entries(editableContent).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        finalHtml = finalHtml.replace(regex, value || `(${key})`);
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

  // Handle click on pencil icon (after element)
  useEffect(() => {
    if (!editMode) return;

    const handleEditableClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if clicked on an editable element or its pencil icon
      const editableElement = target.closest('[data-editable-key]') as HTMLElement;
      if (!editableElement) return;

      const key = editableElement.getAttribute('data-content-key');
      if (!key) return;

      setEditingKey(key);
      setEditingValue(editableContent[key] || '');
    };

    const templateDiv = document.querySelector('[dangerouslySetInnerHTML]') as HTMLElement;
    if (templateDiv) {
      templateDiv.addEventListener('click', handleEditableClick);
      return () => templateDiv.removeEventListener('click', handleEditableClick);
    }
  }, [editMode, editableContent]);

  const handleEditSave = () => {
    if (editingKey && editingValue.trim()) {
      onEditableContentChange?.(editingKey, editingValue);
    }
    setEditingKey(null);
  };

  const handleEditCancel = () => {
    setEditingKey(null);
    setEditingValue('');
  };

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
    <div className="w-full overflow-auto relative">
      {editMode && (
        <div className="fixed top-0 left-0 right-0 bg-blue-100 border-b-2 border-blue-400 p-3 z-40 shadow">
          <p className="text-sm text-blue-900 max-w-7xl mx-auto">
            ✏️ <strong>Edit Mode:</strong> Click the pencil icons to edit text
          </p>
        </div>
      )}
      
      <div className={editMode ? 'mt-16' : ''}>
        <div 
          className="relative"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {/* Edit Modal - Overlay for editing */}
      {editingKey && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="font-bold text-lg text-slate-900 mb-4">
              Edit: {editingKey}
            </h3>
            <textarea
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              className="w-full px-4 py-3 border-2 border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-sm"
              rows={4}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) handleEditSave();
                if (e.key === 'Escape') handleEditCancel();
              }}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleEditSave}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                Save (Ctrl+Enter)
              </button>
              <button
                onClick={handleEditCancel}
                className="flex-1 px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-900 rounded-lg font-medium transition-colors"
              >
                Cancel (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
