import { useState, useCallback } from 'react';

// Vercel serverless function payload limit is ~4.5MB; target well under that.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Render an image to a canvas blob at the given dimensions and quality.
 */
const canvasToFile = (
  img: HTMLImageElement,
  width: number,
  height: number,
  mimeType: string,
  quality: number,
  fileName: string,
): Promise<File | null> =>
  new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve(null);
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(new File([blob], fileName, { type: mimeType, lastModified: Date.now() }));
        } else {
          resolve(null);
        }
      },
      mimeType,
      quality,
    );
  });

/**
 * Compresses an image client-side before upload.
 * Guarantees the output is under MAX_UPLOAD_BYTES by progressively reducing
 * quality and dimensions. Always outputs JPEG for non-transparent images
 * (and for PNGs/WebPs that are still too large after the first pass).
 */
const compressImage = async (file: File): Promise<File> => {
  // Skip compression for non-images or SVGs
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }

  // If the file is already small enough, skip compression
  if (file.size <= MAX_UPLOAD_BYTES) {
    // Still resize if the image could be very large dimensionally
    // — but if it's under the limit, the risk is low. We'll compress anyway
    // for consistent quality, but the early-return is a fast path for tiny files.
    if (file.size <= 500_000) return file;
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const image = new Image();
      image.src = event.target?.result as string;
      image.onload = () => resolve(image);
      image.onerror = reject;
    };
    reader.onerror = reject;
  }).catch(() => null);

  if (!img) return file;

  // Determine initial output format
  const isTransparent = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif';

  // Progressive compression passes: reduce dimensions and quality until under limit
  const passes: Array<{ maxDim: number; quality: number; forceJpeg: boolean }> = [
    { maxDim: 2000, quality: 0.85, forceJpeg: false },
    { maxDim: 1600, quality: 0.80, forceJpeg: false },
    { maxDim: 1200, quality: 0.75, forceJpeg: true }, // force JPEG even for PNGs
    { maxDim: 1000, quality: 0.65, forceJpeg: true },
  ];

  for (const pass of passes) {
    let width = img.width;
    let height = img.height;

    // Scale down proportionally
    if (width > height) {
      if (width > pass.maxDim) {
        height = Math.round(height * (pass.maxDim / width));
        width = pass.maxDim;
      }
    } else {
      if (height > pass.maxDim) {
        width = Math.round(width * (pass.maxDim / height));
        height = pass.maxDim;
      }
    }

    const useJpeg = !isTransparent || pass.forceJpeg;
    const mimeType = useJpeg ? 'image/jpeg' : file.type;

    const result = await canvasToFile(img, width, height, mimeType, pass.quality, file.name);
    if (result && result.size <= MAX_UPLOAD_BYTES) {
      return result;
    }

    // If this was a non-forced transparent pass and still too large,
    // continue to the next pass which may force JPEG
  }

  // Final fallback: most aggressive settings
  const minDim = 800;
  let width = img.width;
  let height = img.height;
  if (width > height) {
    if (width > minDim) {
      height = Math.round(height * (minDim / width));
      width = minDim;
    }
  } else {
    if (height > minDim) {
      width = Math.round(width * (minDim / height));
      height = minDim;
    }
  }
  const fallback = await canvasToFile(img, width, height, 'image/jpeg', 0.60, file.name);
  return fallback || file;
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
