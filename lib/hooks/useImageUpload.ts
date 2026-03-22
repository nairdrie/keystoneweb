import { useState, useCallback } from 'react';

/**
 * Compresses an image client-side before upload to bypass Next.js 4MB payload limits
 * and vastly improve upload speeds. Scales down to 2000px maximum.
 */
const compressImage = async (file: File, maxWidth = 2000, maxHeight = 2000): Promise<File> => {
  return new Promise((resolve) => {
    // Skip compression for non-images or SVGs
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);

        // draw image
        ctx.drawImage(img, 0, 0, width, height);

        const isTransparent = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif';
        const mimeType = isTransparent ? file.type : 'image/jpeg';
        const quality = 0.85;

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const newFile = new File([blob], file.name, {
                type: mimeType,
                lastModified: Date.now(),
              });
              resolve(newFile);
            } else {
              resolve(file);
            }
          },
          mimeType,
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

export function useImageUpload(siteId: string) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = useCallback(
    async (file: File, contentKey: string): Promise<string> => {
      try {
        setUploading(true);
        setError(null);

        const compressedFile = await compressImage(file);

        const formData = new FormData();
        formData.append('file', compressedFile);
        formData.append('siteId', siteId);
        formData.append('contentKey', contentKey);

        const res = await fetch('/api/sites/upload-image', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Upload failed');
        }

        const { imageUrl } = await res.json();
        return imageUrl;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        setError(errorMsg);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [siteId]
  );

  return {
    uploadImage,
    uploading,
    error,
    clearError: () => setError(null),
  };
}
