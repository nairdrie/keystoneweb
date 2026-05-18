'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Edit2, Plus, X } from 'lucide-react';
import { sanitizeRichHtml } from '@/lib/html-sanitize';
import { useEditorContext, useBlockData, useBlockMetaSave } from '@/lib/editor-context';
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
  /** Optional index for indexed fields (e.g. cards in a list). Emits data-ks-index for Keyframe selectors. */
  index?: number;
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
  index,
}: EditableTextProps) {
  const ksFieldClass = `ks-field ks-field--${sanitizeFieldName(contentKey)}`;
  const ksMarkerProps = {
    'data-ks-field': contentKey,
    ...(index !== undefined ? { 'data-ks-index': String(index) } : {}),
  };
  const displayText = content !== undefined && content !== '' ? content : defaultValue;
  const editorCtx = useEditorContext();
  const palette = editorCtx?.palette;
  const blockData = useBlockData();
  const saveMeta = useBlockMetaSave();
  // styleData prop wins; otherwise look it up in the surrounding block's data
  // via context. Blocks wrap their render in <BlockDataProvider value={data}>.
  const resolvedStyleData = styleData ?? (blockData?.[`${contentKey}__styles`] as string | Record<string, unknown> | undefined);
  const removed = Boolean(blockData?.[`${contentKey}__removed`]);

  const setRemoved = useCallback((next: boolean) => {
    if (saveMeta) saveMeta(`${contentKey}__removed`, next);
  }, [saveMeta, contentKey]);

  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [controlsOnLeft, setControlsOnLeft] = useState(false);

  // Live block-level styles while editing (preview before commit)
  const initialParsed = parseStyleData(resolvedStyleData);
  const [pendingStyles, setPendingStyles] = useState<TextStyles>(initialParsed);
  // Callback ref backed by state so the toolbar receives the actual element
  // as soon as the contenteditable mounts (a plain useRef wouldn't trigger
  // the re-render that flushes targetEl into the toolbar's props).
  const [editorEl, setEditorEl] = useState<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLElement>(null);
  const isEditingRef = useRef(false);
  const displayTextRef = useRef(displayText);
  // Last non-collapsed selection range inside the editor. Restored when a
  // toolbar control (slider, color input, etc.) takes focus and clears the
  // live selection so style commands still target the user's intended text.
  const savedRangeRef = useRef<Range | null>(null);

  const parsedStyles: TextStyles = isEditing ? pendingStyles : initialParsed;

  const fontFamily = parsedStyles.fontFamily;
  const fontSize = parsedStyles.fontSize;
  const color = parsedStyles.color;
  const fontWeight = parsedStyles.fontWeight;
  const letterSpacing = parsedStyles.letterSpacing;
  const lineHeight = parsedStyles.lineHeight;
  const textAlign = parsedStyles.textAlign;
  const textShadowCss = textShadowToCss(parsedStyles.textShadow);

  const mergedStyle: React.CSSProperties = {
    ...style,
    ...(fontFamily ? { fontFamily: `"${fontFamily}", sans-serif` } : {}),
    ...(fontSize ? { fontSize } : {}),
    ...(color ? { color } : {}),
    ...(fontWeight ? { fontWeight } : {}),
    ...(letterSpacing ? { letterSpacing } : {}),
    ...(lineHeight ? { lineHeight } : {}),
    // Alignment only takes effect inside a block formatting context. When the
    // user explicitly aligns text we force display:block so a span EditableText
    // (or any element a parent class is forcing inline) actually honors it.
    ...(textAlign ? { textAlign, display: 'block' } : {}),
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
      setPendingStyles(parseStyleData(resolvedStyleData));
    }
  }, [resolvedStyleData, isEditing]);

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

  // Track the live selection while editing so commands triggered from the
  // toolbar (sliders, color inputs) can apply to the user's last real
  // selection even after focus moves to a control. When the user collapses
  // their selection (just a cursor in the editor), clear the saved range so
  // subsequent style changes operate at the block level, not on stale text.
  useEffect(() => {
    if (!isEditing || !editorEl) return;
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);
      if (!editorEl.contains(r.commonAncestorContainer)) return;
      if (r.collapsed) {
        savedRangeRef.current = null;
      } else {
        savedRangeRef.current = r.cloneRange();
      }
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [isEditing, editorEl]);

  // Clear any stale saved range when a new edit session begins
  useEffect(() => {
    if (!isEditing) savedRangeRef.current = null;
  }, [isEditing]);

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
    setPendingStyles(parseStyleData(resolvedStyleData));
    setIsEditing(true);
  };

  const commitSave = useCallback(() => {
    if (!editorEl) {
      setIsEditing(false);
      return;
    }
    const rawHtml = normalizeEditorHtml(editorEl.innerHTML);
    const initial = initialEditorHtml(displayTextRef.current);
    if (rawHtml !== initial) {
      onSave(contentKey, rawHtml);
    }
    const stylesJson = JSON.stringify(stripUndefined(pendingStyles));
    const initialStylesJson = JSON.stringify(stripUndefined(parseStyleData(resolvedStyleData)));
    if (stylesJson !== initialStylesJson) {
      onSave(`${contentKey}__styles`, stylesJson);
    }
    setIsEditing(false);
  }, [contentKey, onSave, pendingStyles, resolvedStyleData, editorEl]);

  const cancelEdit = () => {
    setPendingStyles(parseStyleData(resolvedStyleData));
    setIsEditing(false);
  };

  // Initialize the contenteditable HTML when entering edit mode
  useEffect(() => {
    if (!isEditing || !editorEl) return;
    editorEl.innerHTML = initialEditorHtml(displayText);
    editorEl.focus();
    // Place cursor at end
    const range = document.createRange();
    range.selectNodeContents(editorEl);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editorEl]);

  // Toolbar -> inline command runner
  const runCommand = useCallback((cmd: InlineCommand) => {
    const editor = editorEl;
    if (!editor) return;
    editor.focus();
    // After focusing, the live selection may be collapsed at the cursor
    // (focus moved here from a slider/input). Restore the last good range so
    // the command operates on the user's intended text.
    let sel = window.getSelection();
    const live = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    const liveValid = !!live && !live.collapsed && editor.contains(live.commonAncestorContainer);
    if (!liveValid && savedRangeRef.current && !savedRangeRef.current.collapsed
        && editor.contains(savedRangeRef.current.commonAncestorContainer)) {
      sel?.removeAllRanges();
      sel?.addRange(savedRangeRef.current);
    }
    sel = window.getSelection();
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
      case 'letterSpacing': {
        const value = cmd.value || '';
        if (hasSelection && value) {
          wrapSelectionWithStyle('letter-spacing', value);
        } else {
          setPendingStyles(s => ({ ...s, letterSpacing: value || undefined }));
        }
        break;
      }
      case 'lineHeight': {
        // Line-height is inherently a paragraph-level property. Applying it
        // to a wrapper span around a selection can only enlarge the line box,
        // never shrink it below the parent's strut — so we always apply at
        // the block level for predictable behavior.
        const value = cmd.value || '';
        setPendingStyles(s => ({ ...s, lineHeight: value || undefined }));
        break;
      }
    }
  }, [editorEl]);

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
    // Plain Enter: insert <br> consistently across browsers, instead of
    // letting Chrome wrap subsequent content in <div> blocks (which then
    // fail to render line breaks inside the inline display container).
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      insertLineBreakAtCursor();
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
    if (removed) return null;
    return (
      <>
        {overrideFontHref && <link rel="stylesheet" href={overrideFontHref} />}
        <Component className={`${className} ${ksFieldClass}`.trim()} style={mergedStyle} {...ksMarkerProps}>
          {renderDisplayContent(displayText)}
        </Component>
      </>
    );
  }

  if (removed) {
    const label = humanizeFieldName(contentKey);
    return (
      <Component
        className={`${className} ${ksFieldClass}`.trim()}
        style={style}
        {...ksMarkerProps}
      >
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setRemoved(false);
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 border border-dashed border-blue-400 rounded-full hover:bg-blue-100 hover:border-blue-500 transition-colors"
          title={`Restore ${label}`}
        >
          <Plus className="w-3 h-3" />
          <span>{label}</span>
        </button>
      </Component>
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
            ref={setEditorEl}
            contentEditable
            suppressContentEditableWarning
            onKeyDown={handleEditorKeyDown}
            onPaste={handlePaste}
            className="outline-none whitespace-pre-wrap break-words bg-blue-50/60 rounded-sm ring-2 ring-blue-400/70 cursor-text"
            style={{
              minWidth: '1ch',
              padding: '2px 4px',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              fontWeight: 'inherit',
              color: 'inherit',
              textAlign: 'inherit',
              lineHeight: 'inherit',
              letterSpacing: 'inherit',
            }}
          />
        </Component>
        <RichTextToolbar
          targetEl={editorEl}
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
            {saveMeta && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setRemoved(true);
                }}
                className="inline-flex items-center justify-center w-7 h-7 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-full shadow-md"
                title={`Remove: ${contentKey}`}
                onMouseDown={(e) => e.preventDefault()}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        </span>
      </Component>
    </>
  );
}

// ---- helpers ----

// Normalize a contentKey into a CSS-class-safe suffix. Keyframe selectors use
// `[data-ks-field="..."]` for the raw value, but the human-readable
// `ks-field--{name}` class is also emitted for custom CSS targeting.
function sanitizeFieldName(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]/g, '_');
}

// Turn a contentKey like "faq_0_question" or "bannerPhone" into a readable
// label for the restore placeholder ("+ question", "+ banner phone").
function humanizeFieldName(name: string): string {
  const parts = name
    .split(/[_-]+/g)
    .filter((p) => p.length > 0 && !/^\d+$/.test(p));
  if (parts.length === 0) return name;
  const last = parts[parts.length - 1];
  const spaced = last.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced;
}

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
  const ls = getCssScalar(raw.letterSpacing); if (ls) styles.letterSpacing = ls;
  const lh = getCssScalar(raw.lineHeight); if (lh) styles.lineHeight = lh;
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
  if (obj.letterSpacing) out.letterSpacing = obj.letterSpacing;
  if (obj.lineHeight) out.lineHeight = obj.lineHeight;
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
  // Convert browser-inserted block wrappers (Chrome/Edge wrap each Enter-press
  // in a <div>) into inline <br> separators so the saved HTML renders the same
  // inside an inline display container as it does inside the contenteditable.
  let normalized = html
    .replace(/<div>\s*<br\s*\/?>\s*<\/div>/gi, '<br>')
    .replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, '<br>')
    .replace(/<\/(?:div|p)>\s*<(?:div|p)(\s[^>]*)?>/gi, '<br>')
    .replace(/<(?:div|p)(\s[^>]*)?>/gi, '<br>')
    .replace(/<\/(?:div|p)>/gi, '');
  const trimmed = normalized
    .replace(/^(\s|&nbsp;|<br\s*\/?>)+/i, '')
    .replace(/(\s|&nbsp;|<br\s*\/?>)+$/i, '');
  if (!trimmed || /^<br\s*\/?>$/i.test(trimmed.trim())) return '';
  return trimmed;
}

// Insert a <br> at the current selection inside the active contenteditable.
// Some browsers need an extra trailing <br> so the new line is actually
// rendered when it's the final node.
function insertLineBreakAtCursor() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const br = document.createElement('br');
  range.insertNode(br);
  // If the <br> is now the last node in its parent, append a sentinel <br>
  // so the visible line break renders (lone trailing <br>s collapse otherwise).
  const needsSentinel = !br.nextSibling
    || (br.nextSibling.nodeType === Node.TEXT_NODE && br.nextSibling.textContent === '');
  if (needsSentinel) {
    const sentinel = document.createElement('br');
    br.parentNode?.insertBefore(sentinel, br.nextSibling);
    range.setStartBefore(sentinel);
    range.setEndBefore(sentinel);
  } else {
    range.setStartAfter(br);
    range.setEndAfter(br);
  }
  sel.removeAllRanges();
  sel.addRange(range);
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

// Wrap the current selection in a span with a single inline style. When the
// selection exactly matches the contents of an existing inline span, reuse
// that span instead of nesting another one — this lets slider drags update
// in place rather than producing a deep <span><span>... pile.
function wrapSelectionWithStyle(prop: string, value: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;

  const reusable = findReusableSpanForRange(range);
  if (reusable) {
    if (value) reusable.style.setProperty(prop, value);
    else reusable.style.removeProperty(prop);
    const newRange = document.createRange();
    newRange.selectNodeContents(reusable);
    sel.removeAllRanges();
    sel.addRange(newRange);
    return;
  }

  const span = document.createElement('span');
  if (value) span.style.setProperty(prop, value);
  try {
    span.appendChild(range.extractContents());
    range.insertNode(span);
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(newRange);
  } catch {
    // If extractContents fails (cross-element selection edge cases), bail silently
  }
}

// Return the SPAN whose contents exactly match the range, if any. Used so a
// slider can keep updating the same wrapper rather than nesting new ones.
function findReusableSpanForRange(range: Range): HTMLSpanElement | null {
  // Case 1: selection is contained within a single text node whose parent is
  // a span, and the range spans the whole text.
  if (
    range.startContainer === range.endContainer &&
    range.startContainer.nodeType === Node.TEXT_NODE
  ) {
    const text = range.startContainer as Text;
    const parent = text.parentElement;
    if (
      parent &&
      parent.tagName === 'SPAN' &&
      parent.childNodes.length === 1 &&
      range.startOffset === 0 &&
      range.endOffset === (text.textContent?.length ?? 0)
    ) {
      return parent as HTMLSpanElement;
    }
  }
  // Case 2: the common ancestor itself is a span and the range covers all of
  // its children.
  const ancestor = range.commonAncestorContainer;
  if (
    ancestor.nodeType === Node.ELEMENT_NODE &&
    (ancestor as Element).tagName === 'SPAN'
  ) {
    const el = ancestor as HTMLSpanElement;
    if (
      range.startContainer === el &&
      range.endContainer === el &&
      range.startOffset === 0 &&
      range.endOffset === el.childNodes.length
    ) {
      return el;
    }
  }
  return null;
}
