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
}

export default function EditableText({
  contentKey,
  content,
  isEditMode,
  onSave,
  className = '',
  defaultValue = '',
  as: Component = 'span',
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
    return <Component className={className}>{displayText}</Component>;
  }

  // Edit mode - show inline element with pencil on hover
  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-2 bg-blue-50 border-2 border-blue-400 rounded px-2 py-1">
        <input
          ref={inputRef}
          type="text"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          className="px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 flex-grow"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <button
          onClick={handleSave}
          className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
          title="Save (Enter)"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
          title="Cancel (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Edit mode, not currently editing: show text with pencil icon on hover
  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Component 
        className={`${className} ${
          isHovered ? 'bg-blue-100 outline outline-2 outline-blue-400 outline-offset-1' : ''
        } transition-colors cursor-text py-1 px-1 inline-block pointer-events-auto`}
        onClick={() => setIsEditing(true)}
      >
        {displayText}
      </Component>
      {isHovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="absolute -right-8 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors shadow-md z-50"
          title={`Edit: ${contentKey}`}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Edit2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
