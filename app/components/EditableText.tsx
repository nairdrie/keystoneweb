'use client';

import { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X, Settings } from 'lucide-react';
import TextSettingsModal from './TextSettingsModal';

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

  // Parse dynamic styles if present
  let parsedStyles: Record<string, any> = {};
  if (styleData) {
    try {
      parsedStyles = typeof styleData === 'string' ? JSON.parse(styleData) : styleData;
    } catch (e) { console.error('Failed to parse styleData for', contentKey, e); }
  }

  // Combine baseline style with text-specific user settings
  const mergedStyle = {
    ...style,
    ...(parsedStyles.fontFamily ? { fontFamily: `"${parsedStyles.fontFamily}", sans-serif` } : {}),
    ...(parsedStyles.fontSize ? { fontSize: parsedStyles.fontSize } : {}),
    ...(parsedStyles.color ? { color: parsedStyles.color } : {})
  };

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
  useEffect(() => {
    if (isEditMode && containerRef.current && isHovered) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceOnRight = window.innerWidth - rect.right;
      // If less than 120px on right (slightly more for text since icons are far), flip controls to left
      if (spaceOnRight < 120) {
        setControlsOnLeft(true);
      } else {
        setControlsOnLeft(false);
      }
    }
  }, [isEditMode, isHovered]);

  const handleSave = () => {
    // Always save if value differs from what was displayed — allow empty strings
    if (tempValue !== displayText) {
      onSave(contentKey, tempValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempValue(displayText);
    setIsEditing(false);
  };

  // Preview mode: just show the text
  if (!isEditMode) {
    return <Component className={className} style={mergedStyle}>{displayText}</Component>;
  }

  // Edit mode - show inline element with pencil on hover
  if (isEditing) {
    return (
      <Component className={`${className} relative`} style={mergedStyle}>
        <input
          ref={inputRef}
          type="text"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          className="bg-blue-50/80 border-b-2 border-blue-500 text-slate-900 outline-none w-full"
          style={{
            fontFamily: 'inherit',
            fontSize: 'inherit',
            fontWeight: 'inherit',
            textAlign: 'inherit',
            padding: 0,
            margin: 0,
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <span className="absolute right-0 top-full mt-2 flex items-center gap-2 z-[100] whitespace-nowrap" style={{ display: 'flex' }}>
          <button
            onClick={handleSave}
            className="p-2 bg-green-500 hover:bg-green-600 text-white rounded shadow-lg transition-colors flex items-center gap-1 text-sm font-bold"
            title="Save (Enter)"
          >
            <Check className="w-4 h-4" /> Save
          </button>
          <button
            onClick={handleCancel}
            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded shadow-lg transition-colors flex items-center gap-1 text-sm font-bold"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
        </span>
      </Component>
    );
  }

  // Edit mode, not currently editing: show text with pencil icon on hover
  return (
    <Component
      ref={containerRef as any}
      className={`${className} cursor-text pointer-events-auto transition-colors`}
      style={mergedStyle}
      onClick={() => setIsEditing(true)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className={`relative inline-block ${isHovered ? 'bg-blue-100/50 outline outline-2 outline-blue-400 outline-offset-2 rounded-sm' : 'bg-blue-100/20 md:bg-transparent outline outline-1 outline-blue-300 md:outline-none outline-offset-2 rounded-sm'}`}>
        {displayText}

        {/* Desktop: Show pencil on hover only. Mobile: Don't show pencil at all */}
        <span 
            className={`absolute top-1/2 -translate-y-1/2 items-center gap-1 z-50 hidden md:flex transition-all ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'} ${
                controlsOnLeft ? '-left-14' : '-right-16'
            }`} 
            onMouseDown={e => e.preventDefault()}
        >
          <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="inline-flex items-center justify-center w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md"
          title={`Edit: ${contentKey}`}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
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
        onSave={(newStyles) => {
            onSave(`${contentKey}__styles`, JSON.stringify(newStyles));
        }}
      />
    </Component>
  );
}
