'use client';

import { useState } from 'react';
import { Mic, Send, Sparkles, Square } from 'lucide-react';
import { roLabel } from '@/lib/shop/board';
import { api } from '../api';
import { useShop } from '../ShopContext';
import { Callout, Dialog, Field, RuleErrors, Seg } from '../ui';
import { clock, useVoiceRecorder } from '../useVoiceRecorder';
import type { Detail } from './JobFile';

type Mode = 'diagnosis' | 'done' | 'note';

interface VoiceResponse { summary: string | null; diagnosis: string | null; lines_added: number; revision: boolean; ai_error: string | null }

/** Record (or type) a note for a job; Keystone writes it up and drafts estimate lines. */
export default function VoiceNoteModal({ d, onClose, onSaved }: { d: Detail; onClose: () => void; onSaved: () => void }) {
  const { siteId, toast } = useShop();
  const approved = d.estimates.some(e => e.status === 'approved');
  const [mode, setMode] = useState<Mode>(approved ? 'done' : 'diagnosis');
  const rec = useVoiceRecorder();
  const [audio, setAudio] = useState<{ blob: Blob; mime: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<VoiceResponse | null>(null);

  async function toggle() {
    if (rec.state === 'recording') {
      const r = await rec.stop();
      if (r.blob) setAudio({ blob: r.blob, mime: r.mime });
    } else {
      setAudio(null);
      setResult(null);
      await rec.start();
    }
  }

  async function send() {
    setBusy(true); setError(null);
    const form = new FormData();
    form.append('transcript', rec.transcript);
    form.append('mode', mode);
    form.append('finish', 'false');
    if (audio) form.append('audio', new File([audio.blob], `note.${audio.mime.includes('mp4') ? 'm4a' : 'webm'}`, { type: audio.mime.split(';')[0] }));
    try {
      const res = await api<VoiceResponse>(siteId, `/jobs/${d.job.id}/voice`, { form });
      setResult(res);
      toast(res.lines_added ? `Saved. Keystone drafted ${res.lines_added} estimate line${res.lines_added === 1 ? '' : 's'}${res.revision ? ' on a revised estimate' : ''}.` : 'Note saved to the job.');
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  return (
    <Dialog title="Record a note" eyebrow={`${roLabel(d.job.ro_number)} · talk instead of type`} onClose={onClose} footer={result ? <button type="button" className="btn primary" onClick={onSaved}>Done</button> : <>
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button type="button" className="btn primary" disabled={busy || rec.state === 'recording' || (!rec.transcript.trim() && !audio)} onClick={send}><Send className="i" />{busy ? 'Writing it up…' : 'Save to the job'}</button>
    </>}>
      {error ? <RuleErrors error={error} /> : null}
      <Seg<Mode> label="What kind of note" value={mode} onChange={setMode} options={[
        { value: 'diagnosis', label: 'What’s wrong (diagnosis)' }, { value: 'done', label: 'Repair done', }, { value: 'note', label: 'General update' },
      ]} />
      <div className="t-out" style={{ minHeight: 140 }}>
        {rec.state === 'recording' ? (
          <>
            <div className="wave" aria-label="Recording"><i /><i /><i /><i /><i /><i /><i /></div>
            <p className="ph num">Listening… {clock(rec.seconds)}</p>
            {rec.transcript && <p style={{ color: 'var(--text-2)' }}>“{rec.transcript}”</p>}
          </>
        ) : result ? (
          <>
            {result.summary && <p><b>{result.summary}</b></p>}
            {result.diagnosis && <p style={{ color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{result.diagnosis}</p>}
            {result.lines_added > 0 && <span className="ai-chip"><Sparkles className="i" />Drafted {result.lines_added} estimate line{result.lines_added === 1 ? '' : 's'}{result.revision ? ' (needs the customer’s OK)' : ''}</span>}
            {result.ai_error && <p className="note">{result.ai_error}</p>}
          </>
        ) : (
          <Field label="Transcript" hint={rec.speechSupported ? 'Tap record and talk. Fix any words before saving.' : 'This browser can’t transcribe live. Record it (the server transcribes it if it’s set up) or type it.'} htmlFor="vn-text">
            <textarea id="vn-text" className="input" value={rec.transcript} onChange={e => rec.setTranscript(e.target.value)} placeholder="CR-V, code P0302, misfire on number two. Swapped the coil and the misfire moved with it…" />
          </Field>
        )}
      </div>
      {!result && (
        <button type="button" className={`t-big mic${rec.state === 'recording' ? ' rec' : ''}`} onClick={toggle} disabled={busy}>
          {rec.state === 'recording' ? <><Square className="i" />Listening… tap to stop</> : <><Mic className="i" />{audio ? 'Record again' : 'Record'}</>}
        </button>
      )}
      {audio && !result && <audio controls src={URL.createObjectURL(audio.blob)} style={{ width: '100%', height: 32 }} />}
      {rec.error && <Callout tone="warn">{rec.error}</Callout>}
      <p className="note">{mode === 'diagnosis' ? 'Keystone writes up the findings and drafts the labour and parts lines, without prices.' : mode === 'done' ? 'Anything beyond the approved estimate is flagged as extra work that needs the customer’s OK.' : 'Saved to the timeline. New work mentioned becomes draft lines.'}</p>
    </Dialog>
  );
}
