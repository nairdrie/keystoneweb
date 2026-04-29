import { NextRequest, NextResponse } from 'next/server';
import { requireOpsAccess } from '@/lib/ops/access';
import { extractLeadFromImage, ImageExtractError } from '@/lib/leads/image-extract';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/ops/leads/extract-from-image
// FormData: { file: File }
// Sends the image to Claude Sonnet vision and returns suggested lead fields
// for the new-lead form to pre-fill. Does NOT save anything; pure extraction.
export async function POST(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mediaType = normalizeMediaType(file.type);

  try {
    const fields = await extractLeadFromImage(buffer, mediaType);
    return NextResponse.json(fields);
  } catch (err) {
    if (err instanceof ImageExtractError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[ops/leads/extract-from-image]', err);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}

// HEIC photos from iPhones come through as image/heic which Anthropic doesn't
// accept. We don't transcode here for now — just normalize known aliases.
function normalizeMediaType(t: string): string {
  if (t === 'image/jpg') return 'image/jpeg';
  return t;
}
