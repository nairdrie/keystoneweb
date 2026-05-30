'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Pencil } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import ImageEditorModal, { type ImageFrameSize, type ImageSettings, type UnsplashAttribution } from './ImageEditorModal';
import ImageCropFrame from './ImageCropFrame';

interface EditableImageProps {
  contentKey: string;
  imageUrl?: string;
  isEditMode: boolean;
  // EditableImage saves both URL strings and companion image metadata settings.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  /** Optional index for indexed fields. Emits data-ks-index for Keyframe selectors. */
  index?: number;
  enableInlineCropControls?: boolean;
  showInlineCropZoomControl?: boolean;
  inlineCropFrameClassName?: string;
  inlineCropImageClassName?: string;
  editorPreviewFrameClassName?: string;
  style?: React.CSSProperties;
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
  index,
  enableInlineCropControls = false,
  showInlineCropZoomControl = true,
  inlineCropFrameClassName,
  inlineCropImageClassName = '',
  editorPreviewFrameClassName,
  style,
}: EditableImageProps) {
  const ksFieldClass = `ks-field ks-field--${contentKey.replace(/[^A-Za-z0-9_-]/g, '_')}`;
  const ksMarkerProps: Record<string, string> = { 'data-ks-field': contentKey };
  if (index !== undefined) ksMarkerProps['data-ks-index'] = String(index);
  const context = useEditorContext();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(imageUrl);
  const [modalOpen, setModalOpen] = useState(false);
  const [imageSettings, setImageSettings] = useState<ImageSettings>(() => getInitialImageSettings(className, initialSettings));
  const [attribution, setAttribution] = useState<UnsplashAttribution | undefined>(initialAttribution);
  const [editorPreviewFrameSize, setEditorPreviewFrameSize] = useState<ImageFrameSize | undefined>();

  // Sync previewUrl when imageUrl prop changes externally (undo/redo, page switch)
  useEffect(() => {
    setPreviewUrl(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    setImageSettings(getInitialImageSettings(className, initialSettings));
  }, [className, initialSettings]);

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

  const handleSettingsChange = (settings: ImageSettings) => {
    setImageSettings(settings);
  };

  const handleSettingsCommit = (settings: ImageSettings) => {
    setImageSettings(settings);
    onSave(`${contentKey}__settings`, settings);
  };

  const handleFrameSizeChange = useCallback((size: ImageFrameSize) => {
    const next = {
      width: roundFrameSize(size.width),
      height: roundFrameSize(size.height),
    };
    setEditorPreviewFrameSize((previous) => {
      if (previous?.width === next.width && previous?.height === next.height) return previous;
      return next;
    });
  }, []);

  const imgStyle: React.CSSProperties = {
    objectFit: imageSettings.objectFit || 'cover',
    objectPosition: imageSettings.objectPosition || 'center center',
    transform: imageSettings.objectScale && imageSettings.objectScale > 1 ? `scale(${imageSettings.objectScale})` : undefined,
    transformOrigin: imageSettings.objectPosition || 'center center',
    borderRadius: imageSettings.borderRadius ? `${imageSettings.borderRadius}px` : undefined,
  };
  const imageClassName = className;
  const cropFrameClassName = inlineCropFrameClassName || className;
  const editorFrameClassName = editorPreviewFrameClassName || className || undefined;
  const imageRadiusClassName = getImageRadiusClasses(className);
  const imageBorderRadius = imageSettings.borderRadius ? `${imageSettings.borderRadius}px` : undefined;
  const frameStyle: React.CSSProperties = {
    ...style,
    borderRadius: imageBorderRadius || style?.borderRadius,
  };
  const inlineEditButtonClassName = editOverlayStyle === 'icon'
    ? 'absolute left-1/2 top-1/2 z-30 inline-flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 opacity-0 shadow-lg transition-opacity hover:bg-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 group-hover/editable-image:opacity-100 [@media(hover:none)]:opacity-100'
    : 'absolute left-1/2 top-1/2 z-30 inline-flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 opacity-0 shadow-lg transition-opacity hover:bg-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 group-hover/editable-image:opacity-100 [@media(hover:none)]:opacity-100';
  const inlineEditIconClassName = editOverlayStyle === 'icon' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(priority);
  useEffect(() => {
    if (!priority) setImgLoaded(false);
  }, [imageUrl, priority]);
  useEffect(() => {
    if (!priority && imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setImgLoaded(true);
    }
  });

  // Preview mode: just show the image
  if (!isEditMode) {
    if (!previewUrl) {
      if (fallback) return <>{fallback}</>;

      return (
        <div className={`flex min-h-48 items-center justify-center ${emptyBackgroundClassName} text-slate-400 ${imageClassName} ${ksFieldClass}`} style={frameStyle} {...ksMarkerProps}>
          <ImageIcon className="w-8 h-8" />
        </div>
      );
    }

    return (
      <div className={`relative w-full h-full overflow-hidden bg-gray-100 ${imageRadiusClassName} ${ksFieldClass}`} style={frameStyle} {...ksMarkerProps}>
        <img
          ref={imgRef}
          src={previewUrl}
          alt={imageSettings.altText || contentKey}
          className={`${imageClassName} duration-500`}
          style={{ ...imgStyle, ...(imgLoaded ? {} : { opacity: 0 }) }}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={() => setImgLoaded(true)}
        />
      </div>
    );
  }

  // Edit mode
  return (
    <>
      {previewUrl ? (
        <div
          className={`group/editable-image relative w-full h-full ${enableInlineCropControls ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
          onClick={enableInlineCropControls ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); setModalOpen(true); }}
        >
          {enableInlineCropControls ? (
            <ImageCropFrame
              imageUrl={previewUrl}
              alt={imageSettings.altText || contentKey}
              settings={imageSettings}
              onChange={handleSettingsChange}
              onCommit={handleSettingsCommit}
              frameClassName={cropFrameClassName}
              imageClassName={inlineCropImageClassName}
              frameStyle={frameStyle}
              showZoomControl={showInlineCropZoomControl}
              onFrameSizeChange={handleFrameSizeChange}
            >
              <button
                type="button"
                data-image-crop-control
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setModalOpen(true);
                }}
                className={inlineEditButtonClassName}
                title="Edit image"
                aria-label="Edit image"
              >
                <Pencil className={inlineEditIconClassName} />
              </button>
            </ImageCropFrame>
          ) : (
            <>
              <div className={`relative w-full h-full overflow-hidden ${imageRadiusClassName}`} style={frameStyle}>
                <img
                  src={previewUrl}
                  alt={imageSettings.altText || contentKey}
                  className={imageClassName}
                  style={imgStyle}
                />
              </div>
              <div className={`absolute inset-0 z-20 bg-black/0 opacity-0 transition-all group-hover/editable-image:bg-black/30 group-hover/editable-image:opacity-100 flex items-center justify-center ${imageRadiusClassName}`} style={frameStyle}>
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
            </>
          )}
          {/* Unsplash attribution */}
          {allowUnsplash && showAttribution && attribution && (
            <div className="absolute bottom-1 right-1 z-30 max-w-[calc(100%-0.5rem)] rounded bg-black/70 px-2 py-1 text-right text-[10px] leading-tight text-white opacity-0 shadow transition-opacity group-hover/editable-image:opacity-100">
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
          className="group/editable-image cursor-pointer relative block"
        >
          {fallback}
          <div className={`absolute inset-0 bg-black/0 opacity-0 transition-all group-hover/editable-image:bg-black/30 group-hover/editable-image:opacity-100 flex items-center justify-center ${imageRadiusClassName}`} style={frameStyle}>
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
          className={`group/editable-image flex min-h-48 flex-col items-center justify-center ${emptyBackgroundClassName} border-2 border-dashed border-slate-300 hover:border-slate-400 p-8 text-center cursor-pointer transition-colors ${imageClassName}`}
          style={frameStyle}
        >
          <ImageIcon className="w-8 h-8 mx-auto text-slate-400 group-hover/editable-image:text-slate-600 mb-2" />
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
        previewFrameClassName={editorFrameClassName}
        previewFrameSize={editorPreviewFrameSize}
      />
    </>
  );
}

function getInitialImageSettings(className: string, initialSettings?: ImageSettings): ImageSettings {
  const objectFit = className.includes('object-contain')
    ? 'contain'
    : className.includes('object-fill')
      ? 'fill'
      : 'cover';

  return {
    objectFit,
    borderRadius: 0,
    ...initialSettings,
  };
}

function roundFrameSize(value: number): number {
  return Math.max(1, Math.round(value * 10) / 10);
}

function getImageRadiusClasses(value: string): string {
  return value
    .split(/\s+/)
    .filter((token) => token && isImageRadiusClass(token))
    .join(' ');
}

function isImageRadiusClass(token: string): boolean {
  const baseClass = token.split(':').pop() || token;
  return baseClass === 'rounded' || baseClass.startsWith('rounded-');
}
