'use client';

import { Eye, Pencil } from 'lucide-react';

interface EditModeToggleProps {
  isEditMode: boolean;
  onChange: (mode: boolean) => void;
}

export default function EditModeToggle({ isEditMode, onChange }: EditModeToggleProps) {
  return (
    <div className="fixed left-6 top-1/2 -translate-y-1/2 z-50">
      <div className="bg-red-600 rounded-full p-1 shadow-lg flex items-center gap-1">
        {/* Preview Mode Button */}
        <button
          onClick={() => onChange(false)}
          className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
            !isEditMode
              ? 'bg-red-700 text-white shadow-md'
              : 'bg-transparent text-red-100 hover:text-white'
          }`}
          title="Preview Mode"
        >
          <Eye className="w-5 h-5" />
        </button>

        {/* Edit Mode Button */}
        <button
          onClick={() => onChange(true)}
          className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
            isEditMode
              ? 'bg-red-700 text-white shadow-md'
              : 'bg-transparent text-red-100 hover:text-white'
          }`}
          title="Edit Mode"
        >
          <Pencil className="w-5 h-5" />
        </button>
      </div>

      {/* Status Label */}
      <div className="text-center mt-3 text-xs font-semibold text-red-600 bg-white rounded px-2 py-1 shadow">
        {isEditMode ? 'EDITING' : 'PREVIEW'}
      </div>
    </div>
  );
}
