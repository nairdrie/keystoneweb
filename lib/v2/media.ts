/**
 * Media for agent-built sites: import an image by URL into the site's media
 * library (re-encoded, size-limited, moderated) and search stock photos.
 */
import sharp from 'sharp';
import { scanImage } from '@/lib/moderation/image-scan';
import { handleModerationResult } from '@/lib/moderation/report';
import { OpError } from './ops';
import type { Db } from './store';

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_WIDTH = 2400;

function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new OpError('url must be an absolute https:// URL');
  }
  if (url.protocol !== 'https:') throw new OpError('Only https:// image URLs can be imported');
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.includes(':')
  ) {
    throw new OpError('That host cannot be imported from');
  }
  return url;
}

export async function importImageFromUrl(
  db: Db,
  input: { siteId: string; ownerUserId: string; url: string; name?: string; unsplashDownloadLocation?: string },
): Promise<{ url: string; width: number | null; height: number | null; bytes: number }> {
  const url = assertFetchableUrl(input.url);
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new OpError(`Could not download the image (HTTP ${res.status})`);
  const type = res.headers.get('content-type') || '';
  if (type && !type.startsWith('image/')) throw new OpError(`URL is not an image (${type})`);
  const length = Number(res.headers.get('content-length') || 0);
  if (length > MAX_BYTES) throw new OpError('Image is larger than 12MB');
  const input0 = Buffer.from(await res.arrayBuffer());
  if (input0.length > MAX_BYTES) throw new OpError('Image is larger than 12MB');

  let buffer: Buffer;
  let contentType: string;
  let ext: string;
  let width: number | null = null;
  let height: number | null = null;
  try {
    const image = sharp(input0, { failOn: 'error' }).rotate();
    const meta = await image.metadata();
    const transparent = !!meta.hasAlpha;
    const pipeline = image.resize({ width: MAX_WIDTH, withoutEnlargement: true });
    if (meta.format === 'svg') throw new OpError('SVG images cannot be imported; inline small icons as SVG markup instead');
    if (transparent) {
      buffer = await pipeline.webp({ quality: 86 }).toBuffer();
      contentType = 'image/webp';
      ext = 'webp';
    } else {
      buffer = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      contentType = 'image/jpeg';
      ext = 'jpg';
    }
    const out = await sharp(buffer).metadata();
    width = out.width ?? null;
    height = out.height ?? null;
  } catch (e) {
    if (e instanceof OpError) throw e;
    throw new OpError('The file could not be read as an image');
  }

  const scan = await scanImage(buffer);
  if (scan.blocked) {
    await handleModerationResult(scan, {
      siteId: input.siteId,
      userId: input.ownerUserId,
      ipAddress: null,
      contentType: 'image',
      contentRef: null,
      contentHash: null,
    });
    throw new OpError('Content policy violation', 422);
  }

  const base = (input.name || url.pathname.split('/').pop() || 'image').replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'image';
  const path = `${input.siteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}.${ext}`;
  const { data, error } = await db.storage.from('site-assets').upload(path, buffer, { contentType, cacheControl: '31536000', upsert: false });
  if (error || !data) throw new OpError(`Upload failed: ${error?.message || 'unknown error'}`, 500);
  const { data: { publicUrl } } = db.storage.from('site-assets').getPublicUrl(data.path);

  await db.from('site_media').upsert({
    site_id: input.siteId,
    user_id: input.ownerUserId,
    storage_path: data.path,
    public_url: publicUrl,
    file_name: `${base}.${ext}`,
    media_type: 'image',
    mime_type: contentType,
    size_bytes: buffer.length,
  }, { onConflict: 'storage_path', ignoreDuplicates: true });

  // Unsplash API terms: register the download when a photo is used.
  if (input.unsplashDownloadLocation && process.env.UNSPLASH_ACCESS_KEY) {
    try {
      const dl = new URL(input.unsplashDownloadLocation);
      if (dl.hostname === 'api.unsplash.com') {
        await fetch(dl, { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` }, signal: AbortSignal.timeout(5000) });
      }
    } catch { /* best effort */ }
  }

  return { url: publicUrl, width, height, bytes: buffer.length };
}

interface UnsplashPhoto {
  id: string;
  alt_description?: string | null;
  description?: string | null;
  width: number;
  height: number;
  color?: string;
  urls?: { raw?: string; full?: string; small?: string };
  user?: { name?: string; links?: { html?: string } };
  links?: { download_location?: string };
}

export async function searchStockPhotos(query: string, perPage = 12) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new OpError('Stock photo search is not configured (UNSPLASH_ACCESS_KEY)', 501);
  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', query.slice(0, 100));
  url.searchParams.set('per_page', String(Math.max(1, Math.min(30, perPage))));
  url.searchParams.set('content_filter', 'high');
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new OpError(`Stock search failed (HTTP ${res.status})`, 502);
  const body = await res.json();
  return ((body.results || []) as UnsplashPhoto[]).map((p) => ({
    id: p.id,
    description: p.alt_description || p.description || '',
    width: p.width,
    height: p.height,
    color: p.color,
    url: p.urls?.raw ? `${p.urls.raw}&w=2400&q=80&fm=jpg` : p.urls?.full,
    thumb: p.urls?.small,
    photographer: p.user?.name,
    photographer_url: p.user?.links?.html,
    unsplash_download_location: p.links?.download_location,
  }));
}
