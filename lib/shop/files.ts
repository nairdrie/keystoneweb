import { randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';
import { scanImage } from '@/lib/moderation/image-scan';
import { handleModerationResult } from '@/lib/moderation/report';
import { ShopRuleError, type ShopAccess } from './access';

/** Private bucket for job photos, voice notes, supplier invoices and signatures. */
export const SHOP_BUCKET = 'shop-files';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
export const DOC_TYPES = [...IMAGE_TYPES, 'application/pdf'];
export const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac', 'video/webm'];
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif',
  'application/pdf': 'pdf', 'audio/webm': 'webm', 'video/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/aac': 'aac',
};

export function baseMime(type: string): string {
  return (type || '').split(';')[0].trim().toLowerCase();
}

function clientIp(request: NextRequest | null): string | null {
  if (!request) return null;
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? null;
}

/**
 * Store a file for a site after type/size checks and, for images, the same
 * moderation scan the rest of the app runs on uploads. Returns the object path.
 */
export async function storeShopFile(
  access: ShopAccess,
  request: NextRequest | null,
  folder: 'photos' | 'voice' | 'bills' | 'signatures' | 'statements',
  buffer: Buffer,
  mimeType: string,
  allowed: string[],
): Promise<string> {
  const mime = baseMime(mimeType);
  if (!allowed.includes(mime)) throw new ShopRuleError('That file type isn’t supported here.', undefined, 400);
  if (buffer.length === 0) throw new ShopRuleError('The file is empty.', undefined, 400);
  if (buffer.length > MAX_UPLOAD_BYTES) throw new ShopRuleError('That file is too large (20 MB max).', undefined, 413);

  if (mime.startsWith('image/')) {
    const scan = await scanImage(buffer);
    if (scan.blocked) {
      await handleModerationResult(scan, {
        siteId: access.siteId,
        userId: access.userId,
        ipAddress: clientIp(request),
        contentType: 'image',
        contentRef: null,
        contentHash: null,
      });
      throw new ShopRuleError('That image can’t be uploaded.', undefined, 422);
    }
  }

  const path = `${access.siteId}/${folder}/${randomUUID()}.${EXT[mime] || 'bin'}`;
  const { error } = await access.db.storage.from(SHOP_BUCKET).upload(path, buffer, { contentType: mime, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

/** Decode a `data:image/png;base64,...` signature and store it. */
export async function storeSignature(access: ShopAccess, request: NextRequest | null, dataUrl: string): Promise<string> {
  const match = /^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) throw new ShopRuleError('The signature didn’t come through. Ask them to sign again.', undefined, 400);
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length < 200) throw new ShopRuleError('The signature is blank. Ask them to sign again.', undefined, 400);
  return storeShopFile(access, request, 'signatures', buffer, match[1], ['image/png', 'image/jpeg']);
}

export function pathBelongsToSite(siteId: string, path: string): boolean {
  return typeof path === 'string' && path.startsWith(`${siteId}/`) && !path.includes('..');
}

export async function signedFileUrl(access: Pick<ShopAccess, 'db' | 'siteId'>, path: string, seconds = 600): Promise<string | null> {
  if (!pathBelongsToSite(access.siteId, path)) return null;
  const { data } = await access.db.storage.from(SHOP_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export async function downloadShopFile(access: Pick<ShopAccess, 'db' | 'siteId'>, path: string): Promise<Buffer | null> {
  if (!pathBelongsToSite(access.siteId, path)) return null;
  const { data } = await access.db.storage.from(SHOP_BUCKET).download(path);
  if (!data) return null;
  return Buffer.from(await data.arrayBuffer());
}
