'use client';

import { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X } from 'lucide-react';

/**
 * EditableText Component
 * 
 * Renders text that can be edited inline with pencil icon.
 * 
 * Props:
 * - contentKey: unique identifier (e.g., 'heroTitle')
 * - content: actual value from database/user edit (if set, displays this)
 * - defaultValue: industry-specific fallback (displays if no content set)
 * - isEditMode: enables pencil icons and click-to-edit
 * - onSave: callback when user saves (called with key, value)
 * 
 * Display priority:
 * 1. User's saved content (from database) if it exists
 * 2. Industry default (defaultValue) if no content set
 * 
 * Example:
 * <EditableText
 *   contentKey="heroTitle"
 *   content={userSavedTitle}  // undefined on first load
 *   defaultValue="Expert Plumbing Services"  // shows this initially
 *   isEditMode={editMode}
 *   onSave={updateContent}
 * />
 */

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
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(content || defaultValue);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (tempValue.trim() && tempValue !== content) {
      onSave(contentKey, tempValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempValue(content || defaultValue);
    setIsEditing(false);
  };

  const displayText = content || defaultValue;

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
      <span className={`relative inline-block ${isHovered ? 'bg-blue-100/50 outline outline-2 outline-blue-500 outline-offset-2 rounded-sm' : 'bg-blue-100/20 md:bg-transparent outline outline-1 outline-blue-400 md:outline-none outline-offset-2 rounded-sm'}`}>
        {displayText}

        {/* Desktop: Show pencil on hover. Mobile: Always show pencil */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className={`absolute -right-8 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all shadow-md z-50 ${isHovered ? 'opacity-100 scale-100' : 'opacity-100 scale-100 md:opacity-0 md:scale-90'
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
