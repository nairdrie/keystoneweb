'use client';

import { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X } from 'lucide-react';

interface EditableTextProps {
  contentKey: string;
  content: string;
  isEditMode: boolean;
  onSave: (key: string, value: string) => void;
  className?: string;
  defaultText?: string;
}

export default function EditableText({
  contentKey,
  content,
  isEditMode,
  onSave,
  className = '',
  defaultText = '',
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(content || defaultText);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (tempValue !== content) {
      onSave(contentKey, tempValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempValue(content || defaultText);
    setIsEditing(false);
  };

  const displayText = content || defaultText;

  // Preview mode: just show the text
  if (!isEditMode) {
    return <span className={className}>{displayText}</span>;
  }

  // Edit mode
  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-300 rounded px-2 py-1">
        <input
          ref={inputRef}
          type="text"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          className="text-sm px-1 py-0 border border-blue-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 flex-grow max-w-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <button
          onClick={handleSave}
          className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
          title="Save"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Edit mode, not editing: show text with pencil icon on hover
  return (
    <span
      className={`${className} relative inline-block group cursor-text`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsEditing(true)}
    >
      <span className="inline-block">{displayText}</span>
      {isHovered && (
        <button
          onClick={(e) => {
            e.preventDefault();
            setIsEditing(true);
          }}
          className="ml-1 inline-block p-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          title={`Edit: ${contentKey}`}
        >
          <Edit2 className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
