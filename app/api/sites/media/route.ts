import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { PLANS, getPlanByName } from '@/lib/plans';
import { getUserEffectiveLimits } from '@/lib/addons';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_IMAGE_SIZE  = 10  * 1024 * 1024;  // 10 MB
const MAX_PDF_SIZE    = 50  * 1024 * 1024;  // 50 MB
const MAX_VIDEO_SIZE  = 500 * 1024 * 1024;  // 500 MB

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'image/x-icon', 'image/vnd.microsoft.icon',
]);
const ALLOWED_PDF_MIME = new Set(['application/pdf']);
const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
]);
const ALL_ALLOWED_MIME = new Set([
  ...ALLOWED_IMAGE_MIME, ...ALLOWED_PDF_MIME, ...ALLOWED_VIDEO_MIME,
]);

/** Magic-byte signatures for each type to prevent MIME spoofing. */
function validateMagicBytes(
  buf: Buffer,
  mimeType: string
): { ok: boolean; reason?: string } {
  if (mimeType === 'image/x-icon' || mimeType === 'image/vnd.microsoft.icon') {
    // ICO header: 00 00 01 00 (reserved=0, type=1 for ICO)
    if (buf.length < 4
      || buf[0] !== 0x00 || buf[1] !== 0x00
      || buf[2] !== 0x01 || buf[3] !== 0x00) {
      return { ok: false, reason: 'File does not appear to be a valid ICO file.' };
    }
    return { ok: true };
  }

  if (ALLOWED_IMAGE_MIME.has(mimeType)) {
    // Images are re-encoded by Sharp — no extra magic-byte check needed here.
    return { ok: true };
  }

  if (mimeType === 'application/pdf') {
    // PDF must start with %PDF-
    if (buf.slice(0, 5).toString('ascii') !== '%PDF-') {
      return { ok: false, reason: 'File does not appear to be a valid PDF.' };
    }
    // Reject PDFs that embed JavaScript (/JS or /JavaScript keyword)
    const text = buf.toString('latin1');
    if (/\/JS\s|\/JavaScript\s/.test(text)) {
      return { ok: false, reason: 'PDF contains embedded JavaScript and cannot be uploaded.' };
    }
    return { ok: true };
  }

  if (ALLOWED_VIDEO_MIME.has(mimeType)) {
    // MP4/MOV: ftyp box at byte 4
    const ftyp = buf.slice(4, 8).toString('ascii');
    // WebM: starts with EBML header 0x1A 0x45 0xDF 0xA3
    const isEbml = buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
    // Ogg: starts with OggS
    const isOgg = buf.slice(0, 4).toString('ascii') === 'OggS';

    if (mimeType === 'video/webm' && !isEbml) {
      return { ok: false, reason: 'File does not appear to be a valid WebM video.' };
    }
    if (mimeType === 'video/ogg' && !isOgg) {
      return { ok: false, reason: 'File does not appear to be a valid Ogg video.' };
    }
    if ((mimeType === 'video/mp4' || mimeType === 'video/quicktime') && ftyp !== 'ftyp') {
      // Allow files where the check isn't definitive — don't block valid MP4s
      // that may not have ftyp exactly at byte 4 (rare, but valid).
      // We still block obvious non-videos.
      const hasNoKnownHeader = !isEbml && !isOgg && ftyp !== 'ftyp';
      if (hasNoKnownHeader) {
        return { ok: false, reason: 'File does not appear to be a valid MP4/MOV video.' };
      }
    }
    return { ok: true };
  }

  return { ok: false, reason: 'Unsupported file type.' };
}

/** Classify mime type into our three categories. */
function classifyMime(mime: string): 'image' | 'pdf' | 'video' | null {
  if (ALLOWED_IMAGE_MIME.has(mime)) return 'image';
  if (ALLOWED_PDF_MIME.has(mime))  return 'pdf';
  if (ALLOWED_VIDEO_MIME.has(mime)) return 'video';
  return null;
}

/** Sum storage used (bytes) across all media for a user. */
async function getUserStorageUsed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('site_media')
    .select('size_bytes')
    .eq('user_id', userId);
  if (error || !data) return 0;
  return data.reduce((sum, row) => sum + (row.size_bytes ?? 0), 0);
}

/** Verify the requesting user owns the given site. Returns null on success, response on failure. */
async function verifySiteOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  siteId: string
): Promise<NextResponse | null> {
  const { data: site, error } = await supabase
    .from('sites')
    .select('user_id')
    .eq('id', siteId)
    .single();
  if (error || !site || site.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

// ─── GET /api/sites/media?siteId=<id> ────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const ownershipError = await verifySiteOwnership(supabase, user.id, siteId);
    if (ownershipError) return ownershipError;

    // Fetch media items for this site
    const { data: media, error: mediaError } = await supabase
      .from('site_media')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });

    if (mediaError) {
      console.error('site_media fetch error:', mediaError);
      return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
    }

    // Total storage used across ALL user's sites (for the storage gauge)
    const totalStorageBytes = await getUserStorageUsed(supabase, user.id);

    // Fetch user plan limits
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('subscription_plan, storage_limit_mb')
      .eq('user_id', user.id)
      .single();

    const planConfig = getPlanByName(sub?.subscription_plan);
    // Prefer plan config over the stored column — storage_limit_mb may be stale
    // (e.g. user upgraded to Pro but the column still holds the Basic default).
    const storageLimitMb = planConfig?.storageLimitMb ?? sub?.storage_limit_mb ?? PLANS.basic.storageLimitMb;

    return NextResponse.json({
      media: media ?? [],
      storageUsedBytes: totalStorageBytes,
      storageLimitMb,
    });
  } catch (err) {
    console.error('GET /api/sites/media error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/sites/media ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file   = formData.get('file')   as File | null;
    const siteId = formData.get('siteId') as string | null;

    if (!file || !siteId) {
      return NextResponse.json({ error: 'Missing file or siteId' }, { status: 400 });
    }

    const ownershipError = await verifySiteOwnership(supabase, user.id, siteId);
    if (ownershipError) return ownershipError;

    // ── MIME type validation ──────────────────────────────────────────────────
    const declaredMime = file.type.toLowerCase();
    if (!ALL_ALLOWED_MIME.has(declaredMime)) {
      return NextResponse.json(
        { error: `File type "${declaredMime}" is not allowed. Supported types: images (JPEG, PNG, WebP, GIF, AVIF, ICO), PDFs, and videos (MP4, WebM, Ogg, MOV).` },
        { status: 400 }
      );
    }

    const mediaType = classifyMime(declaredMime);
    if (!mediaType) {
      return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 });
    }

    // ── File size check ───────────────────────────────────────────────────────
    const sizeLimit = mediaType === 'image' ? MAX_IMAGE_SIZE
                    : mediaType === 'pdf'   ? MAX_PDF_SIZE
                    : MAX_VIDEO_SIZE;

    if (file.size > sizeLimit) {
      const limitLabel = mediaType === 'image' ? '10 MB'
                       : mediaType === 'pdf'   ? '50 MB'
                       : '500 MB';
      return NextResponse.json(
        { error: `File is too large. Maximum size for ${mediaType}s is ${limitLabel}.` },
        { status: 400 }
      );
    }

    // ── Storage quota check ───────────────────────────────────────────────────
    const effectiveLimits = await getUserEffectiveLimits(user.id, supabase);
    const storageLimitMb = effectiveLimits.storageLimitMb;
    const storageLimitBytes = storageLimitMb * 1024 * 1024;
    const currentUsageBytes = await getUserStorageUsed(supabase, user.id);

    if (currentUsageBytes + file.size > storageLimitBytes) {
      const usedMb = (currentUsageBytes / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        { error: `Storage limit reached (${usedMb} MB / ${storageLimitMb} MB used). Upgrade your plan or delete unused files.` },
        { status: 413 }
      );
    }

    // ── Read file into buffer ─────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // ── Magic-byte / content validation ──────────────────────────────────────
    const magicCheck = validateMagicBytes(inputBuffer, declaredMime);
    if (!magicCheck.ok) {
      return NextResponse.json({ error: magicCheck.reason }, { status: 400 });
    }

    // ── Per-type processing ───────────────────────────────────────────────────
    let finalBuffer: Buffer;
    let finalMime: string;
    let finalExt: string;
    let finalSizeBytes: number;

    const safeName = (file.name || 'upload')
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .slice(0, 80);

    if (mediaType === 'image') {
      const isIco = declaredMime === 'image/x-icon' || declaredMime === 'image/vnd.microsoft.icon';
      if (isIco) {
        // ICO files: pass through as-is (Sharp doesn't support ICO, already validated by magic bytes)
        finalBuffer    = inputBuffer;
        finalMime      = 'image/x-icon';
        finalExt       = 'ico';
        finalSizeBytes = inputBuffer.length;
      } else {
        // Re-encode with Sharp to sanitize (strips metadata, kills embedded attacks)
        try {
          const image = sharp(inputBuffer);
          const meta  = await image.metadata();
          const transparent = meta.format === 'png' || meta.format === 'webp' || meta.format === 'gif';
          if (transparent) {
            finalBuffer = await image.resize({ width: 2000, withoutEnlargement: true }).toBuffer();
            finalMime   = declaredMime;
            finalExt    = meta.format === 'png' ? 'png' : meta.format === 'webp' ? 'webp' : 'gif';
          } else {
            finalBuffer = await image
              .resize({ width: 2000, withoutEnlargement: true })
              .jpeg({ quality: 85, mozjpeg: true })
              .toBuffer();
            finalMime = 'image/jpeg';
            finalExt  = 'jpg';
          }
        } catch {
          return NextResponse.json({ error: 'Invalid or corrupted image file.' }, { status: 400 });
        }
        finalSizeBytes = finalBuffer.length;
      }
    } else {
      // PDFs and videos: upload as-is (already validated above)
      finalBuffer    = inputBuffer;
      finalMime      = declaredMime;
      finalExt       = mediaType === 'pdf'       ? 'pdf'
                     : declaredMime === 'video/webm'  ? 'webm'
                     : declaredMime === 'video/ogg'   ? 'ogv'
                     : declaredMime === 'video/quicktime' ? 'mov'
                     : 'mp4';
      finalSizeBytes = file.size;
    }

    // ── Upload to Supabase Storage ────────────────────────────────────────────
    const timestamp  = Date.now();
    const randomStr  = Math.random().toString(36).slice(2, 8);
    const storagePath = `${siteId}/${timestamp}-${randomStr}-${safeName}.${finalExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('site-assets')
      .upload(storagePath, finalBuffer, {
        contentType:  finalMime,
        cacheControl: '31536000',
        upsert:       false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file to storage.' }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('site-assets')
      .getPublicUrl(uploadData.path);

    // ── Record in site_media table ────────────────────────────────────────────
    const displayName = `${safeName}.${finalExt}`;
    const { data: record, error: insertError } = await supabase
      .from('site_media')
      .insert({
        site_id:      siteId,
        user_id:      user.id,
        storage_path: uploadData.path,
        public_url:   publicUrl,
        file_name:    displayName,
        media_type:   mediaType,
        mime_type:    finalMime,
        size_bytes:   finalSizeBytes,
      })
      .select()
      .single();

    if (insertError) {
      console.error('site_media insert error:', insertError);
      // Attempt to clean up the orphaned file
      await supabase.storage.from('site-assets').remove([uploadData.path]);
      return NextResponse.json({ error: 'Failed to record media upload.' }, { status: 500 });
    }

    return NextResponse.json({ media: record }, { status: 201 });
  } catch (err) {
    console.error('POST /api/sites/media error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/sites/media ──────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mediaId, siteId, force } = await request.json() as {
      mediaId: string;
      siteId:  string;
      force?:  boolean;
    };

    if (!mediaId || !siteId) {
      return NextResponse.json({ error: 'Missing mediaId or siteId' }, { status: 400 });
    }

    const ownershipError = await verifySiteOwnership(supabase, user.id, siteId);
    if (ownershipError) return ownershipError;

    // Fetch the media record
    const { data: record, error: fetchError } = await supabase
      .from('site_media')
      .select('*')
      .eq('id', mediaId)
      .eq('site_id', siteId)
      .single();

    if (fetchError || !record) {
      return NextResponse.json({ error: 'Media not found.' }, { status: 404 });
    }

    // ── "Where used" check ────────────────────────────────────────────────────
    // Scan site design_data + published_data + pages for references to this URL.
    // We search as a plain text substring in the JSONB-cast-to-text.
    const urlToFind = record.public_url;

    const usages: string[] = [];

    // Check main site design_data / published_data
    const { data: siteData } = await supabase
      .from('sites')
      .select('design_data, published_data, site_slug')
      .eq('id', siteId)
      .single();

    if (siteData) {
      const designText   = JSON.stringify(siteData.design_data   ?? '');
      const publishedText = JSON.stringify(siteData.published_data ?? '');
      if (designText.includes(urlToFind) || publishedText.includes(urlToFind)) {
        usages.push('Site content');
      }
    }

    // Check pages
    const { data: pages } = await supabase
      .from('pages')
      .select('title, design_data, published_data')
      .eq('site_id', siteId);

    if (pages) {
      for (const page of pages) {
        const designText    = JSON.stringify(page.design_data    ?? '');
        const publishedText = JSON.stringify(page.published_data ?? '');
        if (designText.includes(urlToFind) || publishedText.includes(urlToFind)) {
          usages.push(`Page: ${page.title || 'Untitled'}`);
        }
      }
    }

    // If in use and not forcing, return usage info so UI can warn
    if (usages.length > 0 && !force) {
      return NextResponse.json({ inUse: true, usages }, { status: 409 });
    }

    // ── Delete from Supabase Storage ──────────────────────────────────────────
    const { error: storageError } = await supabase.storage
      .from('site-assets')
      .remove([record.storage_path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      return NextResponse.json({ error: 'Failed to delete file from storage.' }, { status: 500 });
    }

    // ── Delete DB record ──────────────────────────────────────────────────────
    const { error: deleteError } = await supabase
      .from('site_media')
      .delete()
      .eq('id', mediaId);

    if (deleteError) {
      console.error('site_media delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to remove media record.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/sites/media error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
