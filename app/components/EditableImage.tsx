'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface EditableImageProps {
  contentKey: string;
  imageUrl?: string;
  isEditMode: boolean;
  onSave: (key: string, imageUrl: string) => void;
  onUpload?: (file: File, contentKey: string) => Promise<string>;
  className?: string;
  placeholder?: string;
}

export default function EditableImage({
  contentKey,
  imageUrl,
  isEditMode,
  onSave,
  onUpload,
  className = '',
  placeholder = 'Click to upload image',
}: EditableImageProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(imageUrl);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file is an image
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      // Create local preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreviewUrl(result);
      };
      reader.readAsDataURL(file);

      // If onUpload provided, upload to Supabase
      if (onUpload) {
        const uploadedUrl = await onUpload(file, contentKey);
        setPreviewUrl(uploadedUrl);
        onSave(contentKey, uploadedUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPreviewUrl(imageUrl);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    setPreviewUrl(undefined);
    onSave(contentKey, '');
  };

  // Preview mode: just show the image
  if (!isEditMode) {
    if (!previewUrl) {
      return (
        <div className={`bg-slate-100 rounded ${className}`}>
          <div className="flex items-center justify-center h-48 text-slate-400">
            <ImageIcon className="w-8 h-8" />
          </div>
        </div>
      );
    }

    return (
      <img
        src={previewUrl}
        alt={contentKey}
        className={`rounded object-cover ${className}`}
      />
    );
  }

  // Edit mode
  return (
    <div className="space-y-3">
      {previewUrl ? (
        <div className="relative group">
          <img
            src={previewUrl}
            alt={contentKey}
            className={`rounded object-cover ${className}`}
          />
          <div className="absolute inset-0 rounded bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold transition-colors"
              disabled={isUploading}
              title="Replace image"
            >
              {isUploading ? 'Uploading...' : 'Replace'}
            </button>
            <button
              onClick={handleRemove}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-semibold transition-colors"
              disabled={isUploading}
              title="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-lg p-8 text-center cursor-pointer transition-colors group"
        >
          <Upload className="w-8 h-8 mx-auto text-slate-400 group-hover:text-slate-600 mb-2" />
          <p className="text-sm font-medium text-slate-700">{placeholder}</p>
          <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF up to 5MB</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={isUploading}
        className="hidden"
      />

      {/* Loading indicator */}
      {isUploading && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Uploading...
        </div>
      )}
    </div>
  );
}
