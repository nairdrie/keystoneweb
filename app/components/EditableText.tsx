'use client';

import { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X } from 'lucide-react';

interface EditableTextProps {
  contentKey: string;
  content?: string;
  isEditMode: boolean;
  onSave: (key: string, value: string) => void;
  className?: string;
  defaultValue?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';
  style?: React.CSSProperties;
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
}: EditableTextProps) {
  const displayText = content !== undefined && content !== '' ? content : defaultValue;
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(displayText);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    return <Component className={className} style={style}>{displayText}</Component>;
  }

  // Edit mode - show inline element with pencil on hover
  if (isEditing) {
    return (
      <Component className={`${className} relative`} style={style}>
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
        <div className="absolute right-0 top-full mt-2 flex items-center gap-2 z-[100] whitespace-nowrap">
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
        </div>
      </Component>
    );
  }

  // Edit mode, not currently editing: show text with pencil icon on hover
  return (
    <Component
      className={`${className} cursor-text pointer-events-auto transition-colors`}
      style={style}
      onClick={() => setIsEditing(true)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className={`relative inline-block ${isHovered ? 'bg-blue-100/50 outline outline-2 outline-blue-400 outline-offset-2 rounded-sm' : 'bg-blue-100/20 md:bg-transparent outline outline-1 outline-blue-300 md:outline-none outline-offset-2 rounded-sm'}`}>
        {displayText}

        {/* Desktop: Show pencil on hover only. Mobile: Don't show pencil at all */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className={`absolute -right-8 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all shadow-md z-50 hidden md:inline-flex ${
            isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
            }`}
          title={`Edit: ${contentKey}`}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Edit2 className="w-3 h-3" />
        </button>
      </span>
    </Component>
  );
}
