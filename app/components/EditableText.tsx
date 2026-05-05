'use client';

import { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X, Settings } from 'lucide-react';
import TextSettingsModal, { textShadowToCss, type TextShadowSettings } from './TextSettingsModal';

interface EditableTextProps {
  contentKey: string;
  content?: string;
  isEditMode: boolean;
  onSave: (key: string, value: string) => void;
  className?: string;
  defaultValue?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';
  style?: React.CSSProperties;
  styleData?: string | Record<string, any>;
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
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(displayText);
  const [isHovered, setIsHovered] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [controlsOnLeft, setControlsOnLeft] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const isEditingRef = useRef(false);
  const displayTextRef = useRef(displayText);
  const blurSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse dynamic styles if present
  let parsedStyles: Record<string, any> = {};
  if (styleData) {
    try {
      parsedStyles = typeof styleData === 'string' ? JSON.parse(styleData) : styleData;
    } catch (e) { console.error('Failed to parse styleData for', contentKey, e); }
  }

  // Combine baseline style with text-specific user settings
  const textShadowCss = textShadowToCss(parsedStyles.textShadow as TextShadowSettings | undefined);
  const mergedStyle = {
    ...style,
    ...(parsedStyles.fontFamily ? { fontFamily: `"${parsedStyles.fontFamily}", sans-serif` } : {}),
    ...(parsedStyles.fontSize ? { fontSize: parsedStyles.fontSize } : {}),
    ...(parsedStyles.color ? { color: parsedStyles.color } : {}),
    ...(parsedStyles.fontWeight ? { fontWeight: parsedStyles.fontWeight } : {}),
    ...(textShadowCss ? { textShadow: textShadowCss } : {})
  };

  // If the user picked a font override via styleData, render a <link> for it.
  // React 19 hoists and dedupes <link> elements into <head> automatically, so
  // this loads server-side (discoverable by the preload scanner) instead of
  // appending to document.head post-hydration like before.
  const overrideFontHref = parsedStyles.fontFamily
    ? `https://fonts.googleapis.com/css2?family=${(parsedStyles.fontFamily as string).replace(/ /g, '+')}:wght@400;500;600;700;800;900&display=swap`
    : null;

  // Keep refs in sync
  useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);
  useEffect(() => { displayTextRef.current = displayText; }, [displayText]);

  // Sync tempValue when content/defaultValue changes externally (undo/redo, page switch)
  useEffect(() => {
    if (!isEditing) {
      const newDisplay = content !== undefined && content !== '' ? content : defaultValue;
      setTempValue(newDisplay);
    }
  }, [content, defaultValue, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Detect if we should show controls on the left based on screen position
  // Runs on mount and whenever edit mode changes so it also works on mobile (no hover events)
  useEffect(() => {
    if (isEditMode && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceOnRight = window.innerWidth - rect.right;
      setControlsOnLeft(spaceOnRight < 120);
    }
  }, [isEditMode]);

  // Also update position when hovered (desktop fine-grained update)
  useEffect(() => {
    if (isEditMode && containerRef.current && isHovered) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceOnRight = window.innerWidth - rect.right;
      setControlsOnLeft(spaceOnRight < 120);
    }
  }, [isEditMode, isHovered]);

  // Listen for another EditableText starting to edit — close this one if open
  useEffect(() => {
    const handleOtherEditStart = (e: Event) => {
      const key = (e as CustomEvent<{ key: string }>).detail?.key;
      if (key !== contentKey && isEditingRef.current) {
        // Auto-save and close
        if (blurSaveTimeout.current) clearTimeout(blurSaveTimeout.current);
        const current = inputRef.current?.value ?? displayTextRef.current;
        if (current !== displayTextRef.current) {
          onSave(contentKey, current);
        }
        setIsEditing(false);
      }
    };
    window.addEventListener('ks:editstart', handleOtherEditStart);
    return () => window.removeEventListener('ks:editstart', handleOtherEditStart);
  }, [contentKey, onSave]);

  const handleSave = () => {
    if (blurSaveTimeout.current) clearTimeout(blurSaveTimeout.current);
    if (tempValue !== displayText) {
      onSave(contentKey, tempValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (blurSaveTimeout.current) clearTimeout(blurSaveTimeout.current);
    setTempValue(displayText);
    setIsEditing(false);
  };

  const startEditing = () => {
    // Notify all other EditableText instances to close
    window.dispatchEvent(new CustomEvent('ks:editstart', { detail: { key: contentKey } }));
    setIsEditing(true);
  };

  // Helper to parse {{text}} into highlighted spans and \n into <br/>
  const renderFormattedText = (text: string) => {
    // Split by literal \n string or actual newline character
    const lines = text.split(/\n|\\n/g);

    return lines.map((line, lineIdx) => {
      // For each line, handle the {{highlight}} syntax
      const parts = line.split(/(\{\{.*?\}\})/g);
      const formattedLine = parts.map((part, partIdx) => {
        if (part.startsWith('{{') && part.endsWith('}}')) {
          const content = part.slice(2, -2);
          return (
            <span key={`${lineIdx}-${partIdx}`} className="ksw-highlight">
              {content}
            </span>
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
  };

  // Preview mode: just show the text
  if (!isEditMode) {
    return (
      <>
        {overrideFontHref && <link rel="stylesheet" href={overrideFontHref} />}
        <Component className={className} style={mergedStyle}>{renderFormattedText(displayText)}</Component>
      </>
    );
  }

  // Edit mode - show inline element with pencil on hover
  if (isEditing) {
    return (
      <>
        {overrideFontHref && <link rel="stylesheet" href={overrideFontHref} />}
      <Component className={`${className} relative`} style={mergedStyle}>
        <textarea
          ref={inputRef as any}
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          className="bg-blue-50/80 border-b-2 border-blue-500 text-slate-900 outline-none w-full resize-none overflow-hidden block"
          rows={tempValue.split('\n').length || 1}
          style={{
            fontFamily: 'inherit',
            fontSize: 'inherit',
            fontWeight: 'inherit',
            textAlign: 'inherit',
            padding: 0,
            margin: 0,
            lineHeight: 'inherit',
          }}
          onKeyDown={(e) => {
            // Enter saves, Shift+Enter adds newline
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
            if (e.key === 'Escape') handleCancel();
          }}
          onBlur={() => {
            // Auto-save when focus leaves the textarea (e.g. clicking elsewhere)
            // Use a short delay so Save/Cancel button clicks can cancel this first
            blurSaveTimeout.current = setTimeout(handleSave, 150);
          }}
        />
        <span className="absolute right-0 top-full mt-2 flex items-center gap-2 z-[100] whitespace-nowrap" style={{ display: 'flex' }}>
          <button
            onMouseDown={(e) => e.preventDefault()} // Prevent textarea blur
            onClick={handleSave}
            className="p-2 bg-green-500 hover:bg-green-600 text-white rounded shadow-lg transition-colors flex items-center gap-1 text-sm font-bold"
            title="Save (Enter)"
          >
            <Check className="w-4 h-4" /> Save
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()} // Prevent textarea blur
            onClick={handleCancel}
            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded shadow-lg transition-colors flex items-center gap-1 text-sm font-bold"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
        </span>
      </Component>
      </>
    );
  }

  // Edit mode, not currently editing: show text with pencil icon on hover (desktop) or always (mobile)
  return (
    <>
      {overrideFontHref && <link rel="stylesheet" href={overrideFontHref} />}
    <Component
      ref={containerRef as any}
      className={`${className} cursor-text pointer-events-auto transition-colors`}
      style={mergedStyle}
      onClick={(e) => {
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
        {renderFormattedText(displayText)}

        {/* Desktop: show on hover. Mobile (hover:none): always visible */}
        <span
            className={`absolute top-1/2 -translate-y-1/2 items-center gap-1 z-50 flex transition-all ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'} [@media(hover:none)]:opacity-100 [@media(hover:none)]:scale-100 ${
                controlsOnLeft ? '-left-14' : '-right-16'
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
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsSettingsOpen(true);
            }}
            className="inline-flex items-center justify-center w-7 h-7 bg-slate-800 hover:bg-slate-900 text-white rounded-full shadow-md"
            title={`Settings: ${contentKey}`}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </span>
      </span>

      <TextSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Typography Settings"
        initialStyles={parsedStyles}
        previewText={displayText}
        onSave={(newStyles) => {
            onSave(`${contentKey}__styles`, JSON.stringify(newStyles));
        }}
      />
    </Component>
    </>
  );
}
