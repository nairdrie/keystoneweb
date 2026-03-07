'use client';

import { useState, useEffect } from 'react';
import { Image as ImageIcon, Pencil } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import ImageEditorModal, { ImageSettings, UnsplashAttribution } from './ImageEditorModal';

interface EditableImageProps {
  contentKey: string;
  imageUrl?: string;
  isEditMode: boolean;
  onSave: (key: string, value: any) => void;
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
  placeholder = 'Click to add image',
}: EditableImageProps) {
  const context = useEditorContext();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(imageUrl);
  const [modalOpen, setModalOpen] = useState(false);
  const [imageSettings, setImageSettings] = useState<ImageSettings>({ objectFit: 'cover', borderRadius: 0 });
  const [attribution, setAttribution] = useState<UnsplashAttribution | undefined>();

  // Sync previewUrl when imageUrl prop changes externally (undo/redo, page switch)
  useEffect(() => {
    setPreviewUrl(imageUrl);
  }, [imageUrl]);

  const handleSave = (newUrl: string, settings: ImageSettings, attr?: UnsplashAttribution) => {
    setPreviewUrl(newUrl || undefined);
    setImageSettings(settings);
    setAttribution(attr);

    // Save the image URL
    onSave(contentKey, newUrl);

    // Save image settings alongside
    if (settings.objectFit !== 'cover' || (settings.borderRadius && settings.borderRadius > 0)) {
      onSave(`${contentKey}__settings`, settings);
    }

    // Save attribution if from Unsplash
    if (attr) {
      onSave(`${contentKey}__attribution`, attr);
    } else {
      onSave(`${contentKey}__attribution`, null);
    }
  };

  const imgStyle: React.CSSProperties = {
    objectFit: imageSettings.objectFit || 'cover',
    borderRadius: imageSettings.borderRadius ? `${imageSettings.borderRadius}px` : undefined,
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
      <div className="relative">
        <img
          src={previewUrl}
          alt={contentKey}
          className={`rounded ${className}`}
          style={imgStyle}
        />
        {/* Unsplash attribution */}
        {attribution && (
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/40 text-white text-[10px] rounded-b">
            Photo by{' '}
            <a href={attribution.photographerUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {attribution.photographerName}
            </a>
            {' on '}
            <a href={attribution.unsplashUrl} target="_blank" rel="noopener noreferrer" className="underline">
              Unsplash
            </a>
          </div>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <>
      {previewUrl ? (
        <div className="relative group cursor-pointer" onClick={() => setModalOpen(true)}>
          <img
            src={previewUrl}
            alt={contentKey}
            className={`rounded ${className}`}
            style={imgStyle}
          />
          <div className="absolute inset-0 rounded bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="px-4 py-2 bg-white/90 text-slate-900 rounded-lg text-sm font-semibold shadow-lg flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Edit Image
            </span>
          </div>
          {/* Unsplash attribution */}
          {attribution && (
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/40 text-white text-[10px] rounded-b">
              Photo by{' '}
              <a
                href={attribution.photographerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                onClick={(e) => e.stopPropagation()}
              >
                {attribution.photographerName}
              </a>
              {' on '}
              <a
                href={attribution.unsplashUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                onClick={(e) => e.stopPropagation()}
              >
                Unsplash
              </a>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => setModalOpen(true)}
          className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-lg p-8 text-center cursor-pointer transition-colors group"
        >
          <ImageIcon className="w-8 h-8 mx-auto text-slate-400 group-hover:text-slate-600 mb-2" />
          <p className="text-sm font-medium text-slate-700">{placeholder}</p>
          <p className="text-xs text-slate-500 mt-1">Upload or search Unsplash</p>
        </div>
      )}

      {/* Image Editor Modal */}
      <ImageEditorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currentImageUrl={previewUrl}
        siteCategory={context?.siteCategory}
        siteId={context?.siteId || ''}
        onSave={handleSave}
        onUpload={onUpload || (async () => '')}
        contentKey={contentKey}
        currentSettings={imageSettings}
      />
    </>
  );
}
