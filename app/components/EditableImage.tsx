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
  emptyBackgroundClassName?: string;
  placeholder?: string;
  fallback?: React.ReactNode;
  editOverlayStyle?: 'pill' | 'icon';
  allowUnsplash?: boolean;
  showAttribution?: boolean;
  initialSettings?: ImageSettings;
  initialAttribution?: UnsplashAttribution;
  /** Mark this as the LCP image: eager + fetchpriority=high. Default false → lazy. */
  priority?: boolean;
}

export default function EditableImage({
  contentKey,
  imageUrl,
  isEditMode,
  onSave,
  onUpload,
  className = '',
  emptyBackgroundClassName = 'bg-slate-100',
  placeholder = 'Click to add image',
  fallback,
  editOverlayStyle = 'pill',
  allowUnsplash = true,
  showAttribution = true,
  initialSettings,
  initialAttribution,
  priority = false,
}: EditableImageProps) {
  const context = useEditorContext();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(imageUrl);
  const [modalOpen, setModalOpen] = useState(false);
  const [imageSettings, setImageSettings] = useState<ImageSettings>(initialSettings || { objectFit: 'cover', borderRadius: 0 });
  const [attribution, setAttribution] = useState<UnsplashAttribution | undefined>(initialAttribution);

  // Sync previewUrl when imageUrl prop changes externally (undo/redo, page switch)
  useEffect(() => {
    setPreviewUrl(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    setAttribution(initialAttribution);
  }, [initialAttribution]);

  const handleSave = (newUrl: string, settings: ImageSettings, attr?: UnsplashAttribution) => {
    setPreviewUrl(newUrl || undefined);
    setImageSettings(settings);
    setAttribution(attr);

    // Save the image URL
    onSave(contentKey, newUrl);

    // Save image settings alongside (always save to persist altText and other settings)
    onSave(`${contentKey}__settings`, settings);

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
      if (fallback) return <>{fallback}</>;

      return (
        <div className={`flex min-h-48 items-center justify-center ${emptyBackgroundClassName} text-slate-400 rounded ${className}`}>
          <ImageIcon className="w-8 h-8" />
        </div>
      );
    }

    return (
      <div className="relative w-full h-full">
        <img
          src={previewUrl}
          alt={imageSettings.altText || contentKey}
          className={`rounded ${className}`}
          style={imgStyle}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding={priority ? 'sync' : 'async'}
        />
      </div>
    );
  }

  // Edit mode
  return (
    <>
      {previewUrl ? (
        <div className="relative w-full h-full group cursor-pointer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setModalOpen(true); }}>
          <img
            src={previewUrl}
            alt={imageSettings.altText || contentKey}
            className={`rounded ${className}`}
            style={imgStyle}
          />
          <div className="absolute inset-0 z-20 rounded bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
            {editOverlayStyle === 'icon' ? (
              <span className="p-2 bg-white text-red-600 rounded-full shadow-lg">
                <Pencil className="w-4 h-4" />
              </span>
            ) : (
              <span className="px-4 py-2 bg-white/90 text-slate-900 rounded-lg text-sm font-semibold shadow-lg flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                Edit Image
              </span>
            )}
          </div>
          {/* Unsplash attribution */}
          {allowUnsplash && showAttribution && attribution && (
            <div className="absolute bottom-1 right-1 z-30 max-w-[calc(100%-0.5rem)] rounded bg-black/70 px-2 py-1 text-right text-[10px] leading-tight text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
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
      ) : fallback ? (
        <div
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setModalOpen(true); }}
          className="cursor-pointer group relative block"
        >
          {fallback}
          <div className="absolute inset-0 rounded bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
            {editOverlayStyle === 'icon' ? (
              <span className="p-1.5 bg-white text-red-600 rounded-full shadow-lg">
                <Pencil className="w-3.5 h-3.5" />
              </span>
            ) : (
              <span className="px-3 py-1.5 bg-white/90 text-slate-900 rounded-lg text-xs font-semibold shadow-lg flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setModalOpen(true); }}
          className={`flex min-h-48 flex-col items-center justify-center ${emptyBackgroundClassName} border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-lg p-8 text-center cursor-pointer transition-colors group ${className}`}
        >
          <ImageIcon className="w-8 h-8 mx-auto text-slate-400 group-hover:text-slate-600 mb-2" />
          <p className="text-sm font-medium text-slate-700">{placeholder}</p>
          <p className="text-xs text-slate-500 mt-1">{allowUnsplash ? 'Upload or search Unsplash' : 'Upload an image'}</p>
        </div>
      )
      }

      {/* Image Editor Modal */}
      <ImageEditorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currentImageUrl={previewUrl}
        siteCategory={context?.siteCategory}
        siteId={context?.siteId || ''}
        onSave={handleSave}
        onUpload={onUpload || context?.uploadImage || (async () => '')}
        contentKey={contentKey}
        currentSettings={imageSettings}
        allowUnsplash={allowUnsplash}
      />
    </>
  );
}
