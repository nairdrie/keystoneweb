/**
 * Voice notes from the bay: the mechanic talks, Keystone writes the diagnosis
 * and drafts estimate lines (no prices) for the desk to price and send.
 */

import { ShopRuleError, type ShopAccess } from '../access';
import { addEvent } from '../data';
import { aiConfigured, parseVoiceNote, type VoiceNoteResult } from '../ai';
import { pathBelongsToSite } from '../files';
import { vehicleLabel } from '../board';
import { formatShortDateTime } from '../dates';
import { appendDraftLines } from './estimates';
import { markDone } from './jobs';
import { fail, requireJob, str } from './common';

export interface VoiceInput {
  transcript?: unknown;
  mode?: unknown;
  audio_path?: string | null;
  finish?: unknown;
}

export async function applyVoiceNote(access: ShopAccess, jobId: string, input: VoiceInput) {
  const detail = await requireJob(access, jobId);
  const { db, siteId } = access;
  const transcript = str(input.transcript, 8000);
  if (!transcript || transcript.length < 3) throw new ShopRuleError('The note is empty. Record it again or type it.', undefined, 400);
  if (detail.job.status !== 'open') throw new ShopRuleError('This job is closed.', undefined, 409);
  const mode = input.mode === 'done' ? 'done' : input.mode === 'note' ? 'note' : 'diagnosis';
  const audioPath = input.audio_path && pathBelongsToSite(siteId, input.audio_path) ? input.audio_path : null;

  const approved = detail.estimates.find(e => e.status === 'approved');
  const draft = [...detail.estimates].reverse().find(e => e.status === 'draft');
  let result: VoiceNoteResult | null = null;
  let aiError: string | null = null;
  if (aiConfigured()) {
    try {
      result = await parseVoiceNote({
        transcript,
        mode,
        vehicle: [vehicleLabel(detail.vehicle), detail.vehicle.engine].filter(Boolean).join(', '),
        complaint: detail.job.complaint,
        approvedLines: (approved?.lines || []).filter(l => l.decision === 'include').map(l => l.description),
        draftLines: (draft?.lines || []).map(l => l.description),
      });
    } catch (err) {
      aiError = err instanceof Error ? err.message : 'Couldn’t read the note.';
    }
  } else {
    aiError = 'AI isn’t set up on this server, so the note was saved as spoken.';
  }

  // Findings go on the job file either way.
  const findings = result ? result.diagnosis : mode === 'diagnosis' ? transcript : '';
  if (findings && mode !== 'done') {
    const stamp = `${access.actor}, ${formatShortDateTime(new Date().toISOString())}`;
    const diagnosis = detail.job.diagnosis ? `${detail.job.diagnosis.trim()}\n\n${findings} (${stamp})` : `${findings} (${stamp})`;
    const { error } = await db.from('shop_jobs').update({
      diagnosis: diagnosis.slice(0, 8000),
      ...(mode === 'diagnosis' && !detail.job.diagnosed_at ? { diagnosed_at: new Date().toISOString() } : {}),
    }).eq('site_id', siteId).eq('id', jobId);
    fail(error, 'Save diagnosis');
  }

  await addEvent(db, siteId, jobId, 'voice', {
    actor: access.actor,
    body: result?.summary || (mode === 'done' ? 'Repair note.' : 'Voice note.'),
    quote: transcript,
    file_path: audioPath,
    meta: { mode, lines: result?.lines.length ?? 0, ai_error: aiError },
  });

  let added = { estimate_id: null as string | null, added: 0, revision: false };
  if (result?.lines.length) {
    const fresh = await requireJob(access, jobId);
    added = await appendDraftLines(access, fresh, result.lines);
  }

  let stage = detail.job.stage;
  if (input.finish === true) {
    const done = await markDone(access, jobId, mode === 'done' && approved ? 'repair' : 'diagnosis');
    stage = done.stage;
  }
  return {
    ok: true,
    summary: result?.summary ?? null,
    diagnosis: findings || null,
    extra_work_found: !!result?.extra_work_found,
    lines_added: added.added,
    revision: added.revision,
    estimate_id: added.estimate_id,
    ai_error: aiError,
    stage,
  };
}
