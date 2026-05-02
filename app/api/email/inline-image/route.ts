import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { createClient } from '@/lib/db/supabase-server';
import { scanImage } from '@/lib/moderation/image-scan';
import { handleModerationResult } from '@/lib/moderation/report';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * POST /api/email/inline-image
 *
 * Accepts a single pasted/dropped image from the email composer, runs it through
 * the standard moderation + sharp pipeline, stores it under
 * <siteId>/email-inline/, and returns a public URL the editor can swap in.
 *
 * Body: FormData with `file` (Blob) and `siteId` (text).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file') as File | null;
  const siteId = form.get('siteId') as string | null;

  if (!file || !siteId) {
    return NextResponse.json({ error: 'file and siteId are required' }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `Image too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` }, { status: 400 });
  }

  // Verify site ownership
  const { data: site } = await supabase
    .from('sites')
    .select('user_id')
    .eq('id', siteId)
    .single();
  if (!site || site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  let processed: Buffer;
  let outputMime: string;
  let ext: string;
  try {
    const img = sharp(inputBuffer);
    const meta = await img.metadata();
    const isTransparent = meta.format === 'png' || meta.format === 'webp' || meta.format === 'gif';
    if (isTransparent) {
      processed = await img.resize({ width: 1600, withoutEnlargement: true }).toBuffer();
      outputMime = `image/${meta.format}`;
      ext = meta.format ?? 'png';
    } else {
      processed = await img
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      outputMime = 'image/jpeg';
      ext = 'jpg';
    }
  } catch {
    return NextResponse.json({ error: 'Invalid or corrupted image' }, { status: 400 });
  }

  const scan = await scanImage(processed);
  if (scan.blocked) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? null;
    await handleModerationResult(scan, {
      siteId,
      userId: user.id,
      ipAddress: ip,
      contentType: 'image',
      contentRef: null,
      contentHash: null,
    });
    return NextResponse.json({ error: 'Content policy violation' }, { status: 422 });
  }

  const storagePath = `${siteId}/email-inline/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { data: uploaded, error: upErr } = await supabase.storage
    .from('site-assets')
    .upload(storagePath, processed, {
      contentType: outputMime,
      cacheControl: '31536000',
      upsert: false,
    });
  if (upErr || !uploaded) {
    console.error('[email/inline-image] storage error:', upErr);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from('site-assets').getPublicUrl(uploaded.path);

  await supabase.from('site_media').upsert({
    site_id: siteId,
    user_id: user.id,
    storage_path: uploaded.path,
    public_url: publicUrl,
    file_name: storagePath.split('/').pop(),
    media_type: 'image',
    mime_type: outputMime,
    size_bytes: processed.length,
  }, { onConflict: 'storage_path', ignoreDuplicates: true });

  return NextResponse.json({ url: publicUrl });
}
