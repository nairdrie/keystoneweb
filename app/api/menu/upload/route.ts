import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { scanImage } from '@/lib/moderation/image-scan';
import { handleModerationResult } from '@/lib/moderation/report';

/**
 * POST /api/menu/upload
 * Upload a PDF or image file to use as a menu document.
 * Stores in site-assets/{siteId}/menu/ path.
 *
 * Body: FormData { file: File, siteId: string }
 * Returns: { fileUrl: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const siteId = formData.get('siteId') as string | null;

  if (!file || !siteId) return NextResponse.json({ error: 'Missing file or siteId' }, { status: 400 });

  const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF, JPEG, PNG, WebP, or GIF files are allowed.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File is too large (max 20 MB).' }, { status: 400 });
  }

  // Verify site ownership
  const { data: site } = await supabase.from('sites').select('user_id').eq('id', siteId).single();
  if (!site || site.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const filename = `${siteId}/menu/${Date.now()}-menu.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Scan images for illegal content / CSAEM (PDFs are text-only, skip image scan)
  if (file.type !== 'application/pdf') {
    const scanResult = await scanImage(buffer);
    if (scanResult.blocked) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? request.headers.get('x-real-ip')
        ?? null;
      await handleModerationResult(scanResult, {
        siteId:      siteId,
        userId:      user.id,
        ipAddress:   ip,
        contentType: 'image',
        contentRef:  null,
        contentHash: null,
      });
      return NextResponse.json({ error: 'Content policy violation' }, { status: 422 });
    }
  }

  const { data, error: uploadErr } = await supabase.storage
    .from('site-assets')
    .upload(filename, buffer, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: true,
    });

  if (uploadErr) {
    console.error('Menu upload error:', uploadErr);
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from('site-assets').getPublicUrl(data.path);

  return NextResponse.json({ fileUrl: publicUrl });
}
