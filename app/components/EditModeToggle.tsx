'use client';

import { Eye, Pencil } from 'lucide-react';

interface EditModeToggleProps {
  isEditMode: boolean;
  onChange: (mode: boolean) => void;
}

export default function EditModeToggle({ isEditMode, onChange }: EditModeToggleProps) {
  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-2">
      {/* Preview Mode Button */}
      <button
        onClick={() => onChange(false)}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
          !isEditMode
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-white border-2 border-red-600 text-red-600 hover:bg-red-50'
        }`}
        title="Preview Mode"
      >
        <Eye className="w-5 h-5" />
      </button>

      {/* Edit Mode Button */}
      <button
        onClick={() => onChange(true)}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
          isEditMode
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-white border-2 border-red-600 text-red-600 hover:bg-red-50'
        }`}
        title="Edit Mode"
      >
        <Pencil className="w-5 h-5" />
      </button>
    </div>
  );
}
