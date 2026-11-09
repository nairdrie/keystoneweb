/**
 * Media for agent-built sites: import an image (by URL, or as uploaded bytes)
 * into the site's media library (re-encoded, size-limited, moderated), list
 * the library, and search stock photos.
 */
import sharp from 'sharp';
import { scanImage } from '@/lib/moderation/image-scan';
import { handleModerationResult } from '@/lib/moderation/report';
import { OpError } from './ops';
import type { Db } from './store';

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_BYTES = MAX_IMAGE_BYTES;
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

export interface ImportedImage {
  url: string;
  width: number | null;
  height: number | null;
  bytes: number;
}

/** Moderate an already re-encoded image, store it in site-assets and list it in the media library. */
async function storeSiteImage(
  db: Db,
  input: { siteId: string; ownerUserId: string; buffer: Buffer; contentType: string; fileName: string },
): Promise<string> {
  const { buffer, contentType, fileName } = input;
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

  const path = `${input.siteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`;
  const { data, error } = await db.storage.from('site-assets').upload(path, buffer, { contentType, cacheControl: '31536000', upsert: false });
  if (error || !data) throw new OpError(`Upload failed: ${error?.message || 'unknown error'}`, 500);
  const { data: { publicUrl } } = db.storage.from('site-assets').getPublicUrl(data.path);

  await db.from('site_media').upsert({
    site_id: input.siteId,
    user_id: input.ownerUserId,
    storage_path: data.path,
    public_url: publicUrl,
    file_name: fileName,
    media_type: 'image',
    mime_type: contentType,
    size_bytes: buffer.length,
  }, { onConflict: 'storage_path', ignoreDuplicates: true });

  return publicUrl;
}

export async function importImageFromUrl(
  db: Db,
  input: { siteId: string; ownerUserId: string; url: string; name?: string; unsplashDownloadLocation?: string },
): Promise<ImportedImage> {
  const url = assertFetchableUrl(input.url);
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new OpError(`Could not download the image (HTTP ${res.status})`);
  const type = res.headers.get('content-type') || '';
  if (type && !type.startsWith('image/')) throw new OpError(`URL is not an image (${type})`);
  const length = Number(res.headers.get('content-length') || 0);
  if (length > MAX_BYTES) throw new OpError('Image is larger than 12MB');
  const input0 = Buffer.from(await res.arrayBuffer());
  if (input0.length > MAX_BYTES) throw new OpError('Image is larger than 12MB');

  const result = await importImageBuffer(db, {
    siteId: input.siteId,
    ownerUserId: input.ownerUserId,
    data: input0,
    name: input.name || url.pathname.split('/').pop() || undefined,
  });

  // Unsplash API terms: register the download when a photo is used.
  if (input.unsplashDownloadLocation && process.env.UNSPLASH_ACCESS_KEY) {
    try {
      const dl = new URL(input.unsplashDownloadLocation);
      if (dl.hostname === 'api.unsplash.com') {
        await fetch(dl, { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` }, signal: AbortSignal.timeout(5000) });
      }
    } catch { /* best effort */ }
  }

  return result;
}

/**
 * Store image bytes (an upload, or a downloaded file) in the site's media
 * library: re-encoded (strips metadata and anything hidden in the file),
 * resized to ≤2400px and moderated before upload.
 */
export async function importImageBuffer(
  db: Db,
  input: { siteId: string; ownerUserId: string; data: Buffer; name?: string },
): Promise<ImportedImage> {
  const input0 = input.data;
  if (!input0.length) throw new OpError('The file is empty');
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

  const base = (input.name || 'image').replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'image';
  const publicUrl = await storeSiteImage(db, { siteId: input.siteId, ownerUserId: input.ownerUserId, buffer, contentType, fileName: `${base}.${ext}` });
  return { url: publicUrl, width, height, bytes: buffer.length };
}

/** The site's image library, newest first (owner uploads and agent imports alike). */
export async function listSiteImages(db: Db, siteId: string, opts: { limit?: number; since?: string } = {}) {
  const limit = Math.max(1, Math.min(100, opts.limit || 30));
  let query = db
    .from('site_media')
    .select('public_url, file_name, mime_type, size_bytes, created_at')
    .eq('site_id', siteId)
    .eq('media_type', 'image')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (opts.since) {
    const since = new Date(opts.since);
    if (Number.isNaN(since.getTime())) throw new OpError('since must be an ISO date-time');
    query = query.gt('created_at', since.toISOString());
  }
  const { data, error } = await query;
  if (error) throw new OpError(`Could not list media: ${error.message}`, 500);
  return (data || []).map((row) => ({
    url: row.public_url as string,
    name: row.file_name as string,
    mime_type: row.mime_type as string,
    bytes: Number(row.size_bytes) || 0,
    uploaded_at: row.created_at as string,
  }));
}

// ── Favicons ────────────────────────────────────────────────────────────────

const FAVICON_MAX_BYTES = 2 * 1024 * 1024;
const FAVICON_SVG_MAX_BYTES = 200 * 1024;
const FAVICON_SIZE = 512;

function isIco(buf: Buffer) {
  return buf.length >= 6 && buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0;
}

function looksLikeSvg(buf: Buffer) {
  const head = buf.subarray(0, 4096).toString('utf8').replace(/^﻿/, '').trimStart();
  return head.startsWith('<') && /<svg[\s>]/i.test(head);
}

/**
 * The largest PNG frame inside an .ico (most modern icons embed PNGs), or null
 * when every frame is a legacy BMP — those are kept as the original .ico.
 */
function largestPngInIco(buf: Buffer): Buffer | null {
  const count = buf.readUInt16LE(4);
  let best: { area: number; data: Buffer } | null = null;
  for (let i = 0; i < Math.min(count, 64); i++) {
    const at = 6 + i * 16;
    if (at + 16 > buf.length) break;
    const w = buf[at] || 256;
    const h = buf[at + 1] || 256;
    const size = buf.readUInt32LE(at + 8);
    const offset = buf.readUInt32LE(at + 12);
    if (offset + size > buf.length || size < 8) continue;
    const data = buf.subarray(offset, offset + size);
    if (data[0] !== 0x89 || data.toString('latin1', 1, 4) !== 'PNG') continue;
    if (!best || w * h > best.area) best = { area: w * h, data };
  }
  return best?.data ?? null;
}

/** Rasterising SVG must never reach outside the file. */
function assertSelfContainedSvg(svg: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(svg)) throw new OpError('SVG must not contain a DOCTYPE or entities');
  if (/(?:href|src)\s*=\s*["']\s*(?!#|data:image\/)/i.test(svg) || /url\(\s*["']?\s*(?!#|data:image\/)/i.test(svg)) {
    throw new OpError('SVG must be self-contained: no external images, fonts or links (embed images as data: URIs)');
  }
}

/**
 * Turn a URL, raw file bytes or SVG markup into a site favicon: a square
 * 512px transparent PNG (non-square images are padded, not cropped). Legacy
 * BMP-only .ico files are kept as-is since they can't be re-encoded.
 */
export async function importFavicon(
  db: Db,
  input: { siteId: string; ownerUserId: string; url?: string; svg?: string; base64?: string; name?: string },
): Promise<{ url: string; width: number | null; height: number | null; bytes: number; format: 'png' | 'ico' }> {
  const given = [input.url, input.svg, input.base64].filter((v) => typeof v === 'string' && v.trim()).length;
  if (given !== 1) throw new OpError('Pass exactly one of url, svg or image_base64');

  let raw: Buffer;
  let nameHint = input.name || 'favicon';
  if (input.url) {
    const url = assertFetchableUrl(input.url);
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new OpError(`Could not download the favicon (HTTP ${res.status})`);
    if (Number(res.headers.get('content-length') || 0) > FAVICON_MAX_BYTES) throw new OpError('Favicon is larger than 2MB');
    raw = Buffer.from(await res.arrayBuffer());
    if (!input.name) nameHint = url.pathname.split('/').pop() || nameHint;
  } else if (input.svg) {
    raw = Buffer.from(input.svg.trim(), 'utf8');
    if (raw.length > FAVICON_SVG_MAX_BYTES) throw new OpError('SVG is larger than 200KB');
  } else {
    const b64 = String(input.base64).replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(b64)) throw new OpError('image_base64 is not valid base64');
    raw = Buffer.from(b64, 'base64');
    if (!raw.length) throw new OpError('image_base64 is empty');
  }
  if (raw.length > FAVICON_MAX_BYTES) throw new OpError('Favicon is larger than 2MB');

  const base = nameHint.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'favicon';
  const store = (buffer: Buffer, contentType: string, ext: string) =>
    storeSiteImage(db, { siteId: input.siteId, ownerUserId: input.ownerUserId, buffer, contentType, fileName: `${base}.${ext}` });

  let source = raw;
  let isSvg = false;
  if (isIco(raw)) {
    const png = largestPngInIco(raw);
    if (!png) {
      const url = await store(raw, 'image/x-icon', 'ico');
      return { url, width: null, height: null, bytes: raw.length, format: 'ico' };
    }
    source = png;
  } else if (looksLikeSvg(raw)) {
    assertSelfContainedSvg(raw.toString('utf8'));
    isSvg = true;
  }

  let buffer: Buffer;
  try {
    const image = sharp(source, { failOn: 'error', ...(isSvg ? { density: 300 } : {}) }).rotate();
    const meta = await image.metadata();
    if (meta.format === 'svg' && !isSvg) throw new OpError('The file could not be read as an image (use PNG, JPG, WebP, GIF, SVG or ICO)');
    const longest = Math.max(meta.width || 0, meta.height || 0);
    if (!isSvg && longest < 16) throw new OpError('Favicon is too small (at least 16×16 px)');
    const size = isSvg ? FAVICON_SIZE : Math.min(FAVICON_SIZE, longest);
    buffer = await image
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (e) {
    if (e instanceof OpError) throw e;
    throw new OpError('The file could not be read as an image (use PNG, JPG, WebP, GIF, SVG or ICO)');
  }
  const out = await sharp(buffer).metadata();
  const url = await store(buffer, 'image/png', 'png');
  return { url, width: out.width ?? null, height: out.height ?? null, bytes: buffer.length, format: 'png' };
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
