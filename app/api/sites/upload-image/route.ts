import { createClient } from '@/lib/db/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

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
    const file = formData.get('file') as File;
    const siteId = formData.get('siteId') as string;

    if (!file || !siteId) {
      return NextResponse.json(
        { error: 'Missing file or siteId' },
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

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const originalName = file.name.toLowerCase().replace(/[^a-z0-9.]/g, '-');
    const filename = `${siteId}/${timestamp}-${randomStr}-${originalName}`;

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from('site-assets')
      .upload(filename, buffer, {
        contentType: file.type,
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
