'use client';

/**
 * Downscale a phone photo before upload. Serverless request bodies are capped
 * (about 4.5 MB on Vercel) and a 12 MP camera shot often isn't. 2200 px on the
 * long side keeps supplier invoices readable for the AI and for people.
 * PDFs and formats the browser can't draw (e.g. HEIC outside Safari) pass through.
 */
export async function shrinkImage(file: File, maxSide = 2200, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size < 900_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
