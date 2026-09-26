import { NextRequest } from 'next/server';
import { ShopRuleError } from '@/lib/shop/access';
import { requireJob } from '@/lib/shop/actions/common';
import { applyVoiceNote } from '@/lib/shop/actions/voice';
import { transcribeAudio, transcriptionConfigured } from '@/lib/shop/ai';
import { AUDIO_TYPES, baseMime, storeShopFile } from '@/lib/shop/files';
import { fileFrom, readForm, run, tech } from '@/lib/shop/http';

export const runtime = 'nodejs';
export const maxDuration = 120;

// POST /api/shop/jobs/:id/voice (multipart: audio?, transcript?, mode, finish)
// Saves the recording, transcribes it on the server if the browser couldn't,
// and turns it into diagnosis notes and draft estimate lines.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const { id } = await params;
    const access = await tech(request);
    await requireJob(access, id);
    const form = await readForm(request);
    const audio = await fileFrom(form, 'audio');
    let transcript = String(form.get('transcript') || '').trim();
    let audioPath: string | null = null;
    if (audio && audio.buffer.length > 0) {
      audioPath = await storeShopFile(access, request, 'voice', audio.buffer, audio.mime, AUDIO_TYPES);
      if (!transcript) {
        if (!transcriptionConfigured()) throw new ShopRuleError('This device couldn’t turn the recording into text. Type the note instead, or use Chrome or Safari.', undefined, 422);
        transcript = await transcribeAudio(audio.buffer, baseMime(audio.mime));
      }
    }
    return applyVoiceNote(access, id, {
      transcript,
      mode: form.get('mode'),
      finish: form.get('finish') === 'true',
      audio_path: audioPath,
    });
  });
}
