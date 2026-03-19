import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

/**
 * POST /api/sites/upload-image
 * Upload image to Supabase Storage (site-assets bucket)
 * 
 * Body: FormData with:
 * - file: File object
 * - siteId: Site UUID
 * 
 * Returns: { imageUrl: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const siteId = formData.get('siteId') as string;
    const imageUrl = formData.get('imageUrl') as string | null;

    if ((!file && !imageUrl) || !siteId) {
      return NextResponse.json(
        { error: 'Missing file/imageUrl or siteId' },
        { status: 400 }
      );
    }

    // Verify user owns the site
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('user_id')
      .eq('id', siteId)
      .single();

    if (siteError || !site || site.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to upload images for this site' },
        { status: 403 }
      );
    }

    let buffer: Buffer;
    let contentType: string;
    let originalName: string;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

    if (imageUrl) {
      // URL-based upload (e.g. from Unsplash)
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch image from URL' },
          { status: 400 }
        );
      }

      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

      // Validate file size
      if (imgBuffer.length > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'Image from URL is too large (max 10MB)' },
          { status: 400 }
        );
      }

      // Resize and sanitize with sharp
      try {
        buffer = await sharp(imgBuffer)
          .resize({ width: 2000, withoutEnlargement: true })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();
        
        contentType = 'image/jpeg';
        originalName = 'imported-image.jpg';
      } catch (err) {
        return NextResponse.json(
          { error: 'Failed to process image from URL' },
          { status: 400 }
        );
      }
    } else if (file) {
      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}. Allowed types: JPEG, PNG, WebP, GIF, AVIF.` },
          { status: 400 }
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'File is too large (max 10MB)' },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuffer);

      // Always process with sharp for security (re-encoding kills many attacks)
      // and optimization (resizing/quality)
      try {
        buffer = await sharp(inputBuffer)
          .resize({ width: 2000, withoutEnlargement: true })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();

        contentType = 'image/jpeg';
        // Sanitize filename and force .jpg extension
        const baseName = (file.name || 'upload').replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9]/g, '-');
        originalName = `${baseName || 'image'}.jpg`;
      } catch (err) {
        return NextResponse.json(
          { error: 'Invalid or corrupted image file' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const filename = `${siteId}/${timestamp}-${randomStr}-${originalName}`;

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from('site-assets')
      .upload(filename, buffer, {
        contentType,
        cacheControl: '31536000', // 1 year
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase storage error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('site-assets')
      .getPublicUrl(data.path);

    return NextResponse.json({
      imageUrl: publicUrl,
      path: data.path,
    });
  } catch (error) {
    console.error('Error in POST /api/sites/upload-image:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sites/upload-image?siteId=<id>
 * List all images uploaded for a site
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json(
        { error: 'Missing siteId' },
        { status: 400 }
      );
    }

    // Verify user owns the site
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('user_id')
      .eq('id', siteId)
      .single();

    if (siteError || !site || site.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to access this site' },
        { status: 403 }
      );
    }

    // List files in site's folder
    const { data: files, error: listError } = await supabase.storage
      .from('site-assets')
      .list(siteId);

    if (listError) {
      console.error('Supabase storage list error:', listError);
      return NextResponse.json(
        { error: 'Failed to list images' },
        { status: 500 }
      );
    }

    // Map files to public URLs
    const images = files
      .filter((f) => f.name !== '.emptyFolderPlaceholder')
      .map((f) => ({
        name: f.name,
        url: supabase.storage
          .from('site-assets')
          .getPublicUrl(`${siteId}/${f.name}`).data.publicUrl,
        createdAt: f.created_at,
      }));

    return NextResponse.json({ images });
  } catch (error) {
    console.error('Error in GET /api/sites/upload-image:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
