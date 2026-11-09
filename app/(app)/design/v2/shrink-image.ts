/**
 * Scale a photo down in the browser before uploading. Request bodies are
 * capped (~4.5MB on our host) and phone photos are often bigger; the server
 * re-encodes and resizes to ≤2400px anyway, so nothing is lost.
 */
const SEND_AS_IS = 3.5 * 1024 * 1024;
const MAX_EDGE = 2400;

export async function shrinkImage(file: File): Promise<File> {
  if (/^image\/(jpeg|png|webp|gif)$/.test(file.type) && file.size <= SEND_AS_IS) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('This file could not be read as an image'));
      el.src = url;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const alpha = /png|webp|gif/.test(file.type);
    const type = alpha ? 'image/webp' : 'image/jpeg';
    for (let q = 0.88; ; q -= 0.15) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
      if (!blob) throw new Error('This browser could not read that image');
      if (blob.size <= SEND_AS_IS || q <= 0.5) {
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.${alpha ? 'webp' : 'jpg'}`, { type });
      }
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const isImageFile = (f: File) => f.type.startsWith('image/') || /\.(heic|heif|avif)$/i.test(f.name);
