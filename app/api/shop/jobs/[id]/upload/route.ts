import { NextRequest } from 'next/server';
import { ShopRuleError } from '@/lib/shop/access';
import { requireJob } from '@/lib/shop/actions/common';
import { addNote } from '@/lib/shop/actions/jobs';
import { IMAGE_TYPES, storeShopFile } from '@/lib/shop/files';
import { fileFrom, readForm, run, tech } from '@/lib/shop/http';

export const runtime = 'nodejs';

// POST /api/shop/jobs/:id/upload (multipart: file, note) — a photo on the job timeline.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { id } = await params;
    const access = await tech(request);
    await requireJob(access, id);
    const form = await readForm(request);
    const file = await fileFrom(form, 'file');
    if (!file) throw new ShopRuleError('Pick a photo.', undefined, 400);
    const path = await storeShopFile(access, request, 'photos', file.buffer, file.mime, IMAGE_TYPES);
    const note = form.get('note');
    await addNote(access, id, { kind: 'photo', body: typeof note === 'string' && note.trim() ? note : 'Photo', file_path: path });
    return { ok: true, path };
  });
}
