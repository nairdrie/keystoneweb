/**
 * Inline-image handling for the Compose editor.
 *
 * When a user pastes or drops an image into the rich text composer it lands
 * as a data: URI inside the HTML. We extract those, run the same moderation
 * + sharp pipeline used for site uploads, store them in the `site-assets`
 * Supabase bucket, and rewrite the HTML to point at the public URL.
 *
 * We never transmit data: URIs to Resend (most clients reject them anyway).
 */

import sharp from 'sharp';
import { SupabaseClient } from '@supabase/supabase-js';
import { scanImage } from '@/lib/moderation/image-scan';
import { handleModerationResult } from '@/lib/moderation/report';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;       // 5 MB per inline image (raw input)
const MAX_TOTAL_INLINE_BYTES = 20 * 1024 * 1024; // 20 MB total per email
const MAX_IMAGES_PER_EMAIL = 10;
const ALLOWED_INPUT_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export class InlineImageError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message);
  }
}

interface ProcessOptions {
  siteId: string;
  userId: string;
  supabase: SupabaseClient; // user-scoped client used for storage upload
}

/**
 * Walk an HTML string, find <img src="data:image/…"> tags, and replace each
 * with an uploaded public URL. Throws InlineImageError on policy violations.
 */
export async function uploadInlineImagesInHtml(
  html: string,
  opts: ProcessOptions,
): Promise<string> {
  if (!html) return html;

  // Parse all data-URI <img> sources up front
  const matches = Array.from(html.matchAll(/<img\b[^>]*?\bsrc="(data:image\/(jpeg|png|webp|gif);base64,([^"]+))"/gi));
  if (matches.length === 0) return html;
  if (matches.length > MAX_IMAGES_PER_EMAIL) {
    throw new InlineImageError(`Too many inline images (max ${MAX_IMAGES_PER_EMAIL}).`);
  }

  let totalBytes = 0;
  const replacements: Array<{ original: string; replacement: string }> = [];
  // Track every storage path we successfully uploaded so we can roll them
  // back if a *later* image in the same email fails (size, moderation, etc.)
  const uploadedPaths: string[] = [];

  async function rollback() {
    if (uploadedPaths.length === 0) return;
    try {
      await opts.supabase.storage.from('site-assets').remove(uploadedPaths);
    } catch (err) {
      console.warn('[inline-images] rollback failed:', err);
    }
  }

  try {
    for (const match of matches) {
      const fullDataUri = match[1];
      const mimeSubtype = match[2].toLowerCase();
      const base64 = match[3];

      const buffer = Buffer.from(base64, 'base64');
      if (buffer.length > MAX_IMAGE_BYTES) {
        throw new InlineImageError(`Inline image is too large (max ${MAX_IMAGE_BYTES / 1024 / 1024} MB each).`);
      }
      totalBytes += buffer.length;
      if (totalBytes > MAX_TOTAL_INLINE_BYTES) {
        throw new InlineImageError(`Total attached images exceed ${MAX_TOTAL_INLINE_BYTES / 1024 / 1024} MB.`);
      }
      if (!ALLOWED_INPUT_MIME.includes(`image/${mimeSubtype}`)) {
        throw new InlineImageError(`Unsupported image format: image/${mimeSubtype}`);
      }

      // Re-encode through sharp (kills exploits, normalises orientation, caps size)
      let processed: Buffer;
      let outputMime: string;
      let ext: string;
      try {
        const img = sharp(buffer);
        const meta = await img.metadata();
        const isTransparent = meta.format === 'png' || meta.format === 'webp' || meta.format === 'gif';
        if (isTransparent) {
          processed = await img.resize({ width: 1600, withoutEnlargement: true }).toBuffer();
          outputMime = `image/${meta.format}`;
          ext = meta.format ?? 'png';
        } else {
          processed = await img.resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
          outputMime = 'image/jpeg';
          ext = 'jpg';
        }
      } catch {
        throw new InlineImageError('Invalid or corrupted image.');
      }

      // Content moderation — same pipeline used for site uploads
      const scanResult = await scanImage(processed);
      if (scanResult.blocked) {
        await handleModerationResult(scanResult, {
          siteId: opts.siteId,
          userId: opts.userId,
          ipAddress: null,
          contentType: 'image',
          contentRef: null,
          contentHash: null,
        });
        throw new InlineImageError('Content policy violation in pasted image.', 422);
      }

      const filename = `${opts.siteId}/email-inline/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { data: uploaded, error: uploadErr } = await opts.supabase.storage
        .from('site-assets')
        .upload(filename, processed, {
          contentType: outputMime,
          cacheControl: '31536000',
          upsert: false,
        });

      if (uploadErr || !uploaded) {
        throw new InlineImageError('Failed to upload inline image.', 500);
      }
      uploadedPaths.push(uploaded.path);

      const { data: { publicUrl } } = opts.supabase.storage.from('site-assets').getPublicUrl(uploaded.path);

      // Track in site_media so it shows up in the media library
      await opts.supabase.from('site_media').upsert({
        site_id: opts.siteId,
        user_id: opts.userId,
        storage_path: uploaded.path,
        public_url: publicUrl,
        file_name: filename.split('/').pop(),
        media_type: 'image',
        mime_type: outputMime,
        size_bytes: processed.length,
      }, { onConflict: 'storage_path', ignoreDuplicates: true });

      replacements.push({ original: fullDataUri, replacement: publicUrl });
    }
  } catch (err) {
    await rollback();
    throw err;
  }

  let out = html;
  for (const { original, replacement } of replacements) {
    out = out.split(original).join(replacement);
  }
  return out;
}
