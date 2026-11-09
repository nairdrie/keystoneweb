/**
 * POST /api/v2/archie/upload — an image the owner attached in Archie's chat box
 * (picked, pasted or dropped). multipart/form-data: siteId, file.
 * → { url, width, height, bytes, name }
 *
 * Stored like every agent image (lib/v2/media.ts: re-encoded, ≤2400px,
 * moderated, in the site's media library), so Archie can use the URL as is.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { importImageBuffer, MAX_IMAGE_BYTES } from '@/lib/v2/media';
import { OpError } from '@/lib/v2/ops';
import { getSiteEngine } from '@/lib/v2/store';
import { ENGINE_V2 } from '@/lib/v2/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Could not read the upload' }, { status: 400 });
  }
  const siteId = form.get('siteId');
  const file = form.get('file');
  let access;
  try {
    access = await requireSiteAccess(typeof siteId === 'string' ? siteId : null, request);
  } catch (e) {
    return siteAccessErrorResponse(e);
  }
  const db = createAdminClient();
  if ((await getSiteEngine(db, access.siteId)) !== ENGINE_V2) {
    return NextResponse.json({ error: 'Archie v2 works on sites built with the new editor.' }, { status: 409 });
  }
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'No image was sent' }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'That image is larger than 12MB' }, { status: 413 });

  try {
    const result = await importImageBuffer(db, {
      siteId: access.siteId,
      ownerUserId: access.targetUserId,
      data: Buffer.from(await file.arrayBuffer()),
      name: file.name || 'image',
    });
    return NextResponse.json({ ...result, name: file.name || 'image' });
  } catch (e) {
    if (e instanceof OpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[archie upload]', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
