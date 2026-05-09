'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Edit2 } from 'lucide-react';
import { sanitizeRichHtml } from '@/lib/html-sanitize';
import { useEditorContext } from '@/lib/editor-context';
import RichTextToolbar, { type InlineCommand } from './RichTextToolbar';
import {
  textShadowToCss,
  type TextShadowSettings,
  type TextStyles,
} from '@/lib/text-styles';

interface EditableTextProps {
  contentKey: string;
  content?: string;
  isEditMode: boolean;
  onSave: (key: string, value: string) => void;
  className?: string;
  defaultValue?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';
  style?: React.CSSProperties;
  styleData?: string | Record<string, unknown>;
}

export default function EditableText({
  contentKey,
  content,
  isEditMode,
  onSave,
  className = '',
  defaultValue = '',
  as: Component = 'span',
  style = {},
  styleData,
}: EditableTextProps) {
  const displayText = content !== undefined && content !== '' ? content : defaultValue;
  const editorCtx = useEditorContext();
  const palette = editorCtx?.palette;

  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [controlsOnLeft, setControlsOnLeft] = useState(false);

  // Live block-level styles while editing (preview before commit)
  const initialParsed = parseStyleData(styleData);
  const [pendingStyles, setPendingStyles] = useState<TextStyles>(initialParsed);
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const isEditingRef = useRef(false);
  const displayTextRef = useRef(displayText);

  const parsedStyles: TextStyles = isEditing ? pendingStyles : initialParsed;

  const fontFamily = parsedStyles.fontFamily;
  const fontSize = parsedStyles.fontSize;
  const color = parsedStyles.color;
  const fontWeight = parsedStyles.fontWeight;
  const textAlign = parsedStyles.textAlign;
  const textShadowCss = textShadowToCss(parsedStyles.textShadow);

  const mergedStyle: React.CSSProperties = {
    ...style,
    ...(fontFamily ? { fontFamily: `"${fontFamily}", sans-serif` } : {}),
    ...(fontSize ? { fontSize } : {}),
    ...(color ? { color } : {}),
    ...(fontWeight ? { fontWeight } : {}),
    ...(textAlign ? { textAlign } : {}),
    ...(textShadowCss ? { textShadow: textShadowCss } : {}),
  };

  const overrideFontHref = fontFamily
    ? `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@400;500;600;700;800;900&display=swap`
    : null;

  // Refs in sync
  useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);
  useEffect(() => { displayTextRef.current = displayText; }, [displayText]);

  // Reset pending styles when styleData changes externally and we're not editing
  useEffect(() => {
    if (!isEditing) {
      setPendingStyles(parseStyleData(styleData));
    }
  }, [styleData, isEditing]);

  // Detect overflow position for the inline edit chrome
  useEffect(() => {
    if (isEditMode && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceOnRight = window.innerWidth - rect.right;
      setControlsOnLeft(spaceOnRight < 80);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (isEditMode && containerRef.current && isHovered) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceOnRight = window.innerWidth - rect.right;
      setControlsOnLeft(spaceOnRight < 80);
    }
  }, [isEditMode, isHovered]);

  // Commit pending edit if another EditableText starts editing
  useEffect(() => {
    const handleOtherEditStart = (e: Event) => {
      const key = (e as CustomEvent<{ key: string }>).detail?.key;
      if (key !== contentKey && isEditingRef.current) {
        commitSave();
      }
    };
    window.addEventListener('ks:editstart', handleOtherEditStart);
    return () => window.removeEventListener('ks:editstart', handleOtherEditStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey]);

  const startEditing = () => {
    window.dispatchEvent(new CustomEvent('ks:editstart', { detail: { key: contentKey } }));
    setPendingStyles(parseStyleData(styleData));
    setIsEditing(true);
  };

  const commitSave = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      setIsEditing(false);
      return;
    }
    const rawHtml = normalizeEditorHtml(editor.innerHTML);
    const initial = initialEditorHtml(displayTextRef.current);
    if (rawHtml !== initial) {
      onSave(contentKey, rawHtml);
    }
    const stylesJson = JSON.stringify(stripUndefined(pendingStyles));
    const initialStylesJson = JSON.stringify(stripUndefined(parseStyleData(styleData)));
    if (stylesJson !== initialStylesJson) {
      onSave(`${contentKey}__styles`, stylesJson);
    }
    setIsEditing(false);
  }, [contentKey, onSave, pendingStyles, styleData]);

  const cancelEdit = () => {
    setPendingStyles(parseStyleData(styleData));
    setIsEditing(false);
  };

  // Initialize the contenteditable HTML when entering edit mode
  useEffect(() => {
    if (!isEditing) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = initialEditorHtml(displayText);
    editor.focus();
    // Place cursor at end
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // Toolbar -> inline command runner
  const runCommand = useCallback((cmd: InlineCommand) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    const hasSelection = !!sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed
      && editor.contains(sel.getRangeAt(0).commonAncestorContainer);

    switch (cmd.kind) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strike': {
        const map = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough' } as const;
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand(map[cmd.kind], false);
        break;
      }
      case 'clear': {
        if (hasSelection) document.execCommand('removeFormat', false);
        break;
      }
      case 'color': {
        const value = cmd.value || '';
        if (hasSelection && value) {
          document.execCommand('styleWithCSS', false, 'true');
          document.execCommand('foreColor', false, value);
        } else {
          setPendingStyles(s => ({ ...s, color: value || undefined }));
        }
        break;
      }
      case 'fontFamily': {
        const value = cmd.value || '';
        if (hasSelection && value) {
          wrapSelectionWithStyle('font-family', `"${value}", sans-serif`);
        } else {
          setPendingStyles(s => ({ ...s, fontFamily: value || undefined }));
        }
        break;
      }
      case 'fontSize': {
        const value = cmd.value || '';
        if (hasSelection && value) {
          wrapSelectionWithStyle('font-size', value);
        } else {
          setPendingStyles(s => ({ ...s, fontSize: value || undefined }));
        }
        break;
      }
      case 'fontWeight': {
        const value = cmd.value || '';
        if (hasSelection && value) {
          wrapSelectionWithStyle('font-weight', value);
        } else {
          setPendingStyles(s => ({ ...s, fontWeight: value || undefined }));
        }
        break;
      }
    }
  }, []);

  // Handle keyboard shortcuts inside the editor
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      commitSave();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      runCommand({ kind: 'bold' });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
      e.preventDefault();
      runCommand({ kind: 'italic' });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      runCommand({ kind: 'underline' });
      return;
    }
  };

  // Strip rich content from pasted text to plain text
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  // ---- RENDER ----

  if (!isEditMode) {
    return (
      <>
        {overrideFontHref && <link rel="stylesheet" href={overrideFontHref} />}
        <Component className={className} style={mergedStyle}>
          {renderDisplayContent(displayText)}
        </Component>
      </>
    );
  }

  if (isEditing) {
    return (
      <>
        {overrideFontHref && <link rel="stylesheet" href={overrideFontHref} />}
        <Component
          ref={containerRef as React.Ref<HTMLHeadingElement>}
          className={`${className} relative block min-w-0 max-w-full`}
          style={mergedStyle}
        >
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onKeyDown={handleEditorKeyDown}
            onPaste={handlePaste}
            className="outline-none whitespace-pre-wrap break-words bg-blue-50/60 rounded-sm ring-2 ring-blue-400/70"
            style={{
              minWidth: '1ch',
              padding: '2px 4px',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              fontWeight: 'inherit',
              color: 'inherit',
              textAlign: 'inherit',
              lineHeight: 'inherit',
            }}
          />
        </Component>
        <RichTextToolbar
          targetEl={editorRef.current}
          blockStyles={pendingStyles}
          onBlockStylesChange={setPendingStyles}
          runCommand={runCommand}
          onSave={commitSave}
          onCancel={cancelEdit}
          palette={palette as { primary?: string; secondary?: string; accent?: string } | undefined}
          previewText={textPreviewFromHtml(displayText)}
        />
      </>
    );
  }

  // Edit mode, not currently editing
  return (
    <>
      {overrideFontHref && <link rel="stylesheet" href={overrideFontHref} />}
      <Component
        ref={containerRef as React.Ref<HTMLHeadingElement>}
        className={`${className} cursor-text pointer-events-auto transition-colors`}
        style={mergedStyle}
        onClick={(e: React.MouseEvent) => {
          if (isEditMode) {
            e.preventDefault();
            e.stopPropagation();
            startEditing();
          }
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className={`relative inline-block ${isHovered ? 'bg-blue-100/50 outline outline-2 outline-blue-400 outline-offset-2 rounded-sm' : 'bg-blue-100/20 md:bg-transparent outline outline-1 outline-blue-300 md:outline-none outline-offset-2 rounded-sm'}`}>
          {renderDisplayContent(displayText)}
          <span
            className={`absolute top-1/2 -translate-y-1/2 items-center gap-1 z-50 flex transition-all ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'} [@media(hover:none)]:opacity-100 [@media(hover:none)]:scale-100 ${
              controlsOnLeft ? '-left-9' : '-right-9'
            }`}
            onMouseDown={e => e.preventDefault()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startEditing();
              }}
              className="inline-flex items-center justify-center w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md"
              title={`Edit: ${contentKey}`}
              onMouseDown={(e) => e.preventDefault()}
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </span>
        </span>
      </Component>
    </>
  );
}

// ---- helpers ----

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getCssScalar(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

function getTextAlign(value: unknown): TextStyles['textAlign'] {
  return value === 'left' || value === 'center' || value === 'right' || value === 'justify'
    ? value
    : undefined;
}

function parseStyleData(styleData: string | Record<string, unknown> | undefined): TextStyles {
  if (!styleData) return {};
  let raw: unknown = styleData;
  if (typeof styleData === 'string') {
    try { raw = JSON.parse(styleData); } catch { return {}; }
  }
  if (!isRecord(raw)) return {};
  const styles: TextStyles = {};
  if (typeof raw.fontFamily === 'string') styles.fontFamily = raw.fontFamily;
  const fs = getCssScalar(raw.fontSize); if (fs) styles.fontSize = fs;
  if (typeof raw.color === 'string') styles.color = raw.color;
  const fw = getCssScalar(raw.fontWeight); if (fw) styles.fontWeight = fw;
  const ta = getTextAlign(raw.textAlign); if (ta) styles.textAlign = ta;
  if (isRecord(raw.textShadow)) styles.textShadow = raw.textShadow as unknown as TextShadowSettings;
  return styles;
}

function stripUndefined(obj: TextStyles): TextStyles {
  const out: TextStyles = {};
  if (obj.fontFamily) out.fontFamily = obj.fontFamily;
  if (obj.fontSize) out.fontSize = obj.fontSize;
  if (obj.color) out.color = obj.color;
  if (obj.fontWeight) out.fontWeight = obj.fontWeight;
  if (obj.textAlign) out.textAlign = obj.textAlign;
  if (obj.textShadow && obj.textShadow.enabled) out.textShadow = obj.textShadow;
  return out;
}

// Detect whether the stored content already contains rich HTML markup
function isHtmlContent(s: string): boolean {
  return /<[a-zA-Z][^>]*>/.test(s);
}

// Convert {{tagged}} segments and \n into renderable HTML
function legacyTextToHtml(text: string): string {
  const escape = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Split by \n or literal \\n
  const lines = text.split(/\n|\\n/g);
  const html = lines.map(line => {
    const parts = line.split(/(\{\{.*?\}\})/g);
    return parts.map(p => {
      if (p.startsWith('{{') && p.endsWith('}}')) {
        const inner = p.slice(2, -2);
        return `<span class="ksw-highlight">${escape(inner)}</span>`;
      }
      return escape(p);
    }).join('');
  }).join('<br/>');
  return html;
}

// What to put inside the contenteditable when editing begins
function initialEditorHtml(text: string): string {
  if (!text) return '';
  if (isHtmlContent(text)) return sanitizeRichHtml(text);
  return legacyTextToHtml(text);
}

// Trim trailing empty lines / strip wrapping artifacts before saving
function normalizeEditorHtml(html: string): string {
  const trimmed = html
    .replace(/^(\s|&nbsp;|<br\s*\/?>)+/i, '')
    .replace(/(\s|&nbsp;|<br\s*\/?>)+$/i, '');
  if (!trimmed || /^<br\s*\/?>$/i.test(trimmed.trim())) return '';
  return trimmed;
}

// What to render in non-edit (and edit-but-not-yet-editing) display
function renderDisplayContent(text: string): React.ReactNode {
  if (!text) return null;
  if (isHtmlContent(text)) {
    return <span dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(text) }} />;
  }
  // Legacy plain-text + {{}} parser, preserved per request
  return renderFormattedText(text);
}

function renderFormattedText(text: string): React.ReactNode {
  const lines = text.split(/\n|\\n/g);
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\{\{.*?\}\})/g);
    const formattedLine = parts.map((part, partIdx) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        const inner = part.slice(2, -2);
        return (
          <span key={`${lineIdx}-${partIdx}`} className="ksw-highlight">{inner}</span>
        );
      }
      return part;
    });
    return (
      <span key={lineIdx}>
        {formattedLine}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}

function textPreviewFromHtml(text: string): string {
  if (!text) return '';
  if (!isHtmlContent(text)) {
    return text.replace(/\{\{(.*?)\}\}/g, '$1');
  }
  // Strip tags for the preview shown in toolbar popovers
  if (typeof document === 'undefined') return text.replace(/<[^>]+>/g, '');
  const tmp = document.createElement('div');
  tmp.innerHTML = sanitizeRichHtml(text);
  return tmp.textContent || '';
}

// Wrap the current selection in a span with a single inline style
function wrapSelectionWithStyle(prop: string, value: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;
  const span = document.createElement('span');
  span.style.setProperty(prop, value);
  try {
    span.appendChild(range.extractContents());
    range.insertNode(span);
    // Restore the selection over the inserted span
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(newRange);
  } catch {
    // If extractContents fails (cross-element selection edge cases), bail silently
  }
}
