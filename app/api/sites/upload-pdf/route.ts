import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * POST /api/sites/upload-pdf
 * Upload a PDF to Supabase Storage (site-assets bucket)
 *
 * Body: FormData with:
 * - file: PDF File object
 * - siteId: Site UUID
 *
 * Returns: { pdfUrl: string, path: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const siteId = formData.get('siteId') as string;

    if (!file || !siteId) {
      return NextResponse.json({ error: 'Missing file or siteId' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json({ error: 'File is too large (max 20MB)' }, { status: 400 });
    }

    // Verify user owns the site
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('user_id')
      .eq('id', siteId)
      .single();

    if (siteError || !site || site.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to upload files for this site' },
        { status: 403 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const baseName = (file.name || 'document')
      .replace(/\.pdf$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');
    const fileName = `${baseName || 'document'}.pdf`;
    const storagePath = `${siteId}/pdfs/${timestamp}-${randomStr}-${fileName}`;

    const { data, error: uploadError } = await supabase.storage
      .from('site-assets')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase storage error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload PDF' }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('site-assets')
      .getPublicUrl(data.path);

    await supabase.from('site_media').upsert({
      site_id:      siteId,
      user_id:      user.id,
      storage_path: data.path,
      public_url:   publicUrl,
      file_name:    fileName,
      media_type:   'document',
      mime_type:    'application/pdf',
      size_bytes:   buffer.length,
    }, { onConflict: 'storage_path', ignoreDuplicates: true });

    return NextResponse.json({ pdfUrl: publicUrl, path: data.path });
  } catch (error) {
    console.error('Error in POST /api/sites/upload-pdf:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
