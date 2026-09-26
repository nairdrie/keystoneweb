'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Records a voice note and, where the browser supports it, transcribes it live
 * with the Web Speech API. The recording is kept either way so the server can
 * transcribe it when the browser can't (and so the desk can play it back).
 */

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

export interface VoiceResult { blob: Blob | null; mime: string; transcript: string }

export function useVoiceRecorder() {
  const [state, setState] = useState<'idle' | 'recording'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recog = useRef<SpeechRecognitionLike | null>(null);
  const finalText = useRef('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const keepListening = useRef(false);
  const transcriptRef = useRef('');
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  const speechSupported = !!recognitionCtor();
  const recordingSupported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    keepListening.current = false;
    try { recog.current?.abort(); } catch { /* already stopped */ }
    recog.current = null;
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setTranscript('');
    finalText.current = '';
    chunks.current = [];
    setSeconds(0);
    if (recordingSupported) {
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        const mime = pickMime();
        const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
        rec.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
        rec.start(1000);
        recorder.current = rec;
      } catch {
        setError('The microphone is blocked. Allow it in the browser settings, or type the note.');
        cleanup();
        return false;
      }
    }
    const Ctor = recognitionCtor();
    if (Ctor) {
      const r = new Ctor();
      r.lang = 'en-CA';
      r.continuous = true;
      r.interimResults = true;
      r.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalText.current += `${res[0].transcript.trim()} `;
          else interim += res[0].transcript;
        }
        setTranscript(`${finalText.current}${interim}`.trim());
      };
      r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') keepListening.current = false; };
      // Mobile browsers end recognition after a pause; keep it going while recording.
      r.onend = () => { if (keepListening.current) { try { r.start(); } catch { /* restarting too fast */ } } };
      keepListening.current = true;
      try { r.start(); recog.current = r; } catch { recog.current = null; }
    }
    if (!recordingSupported && !Ctor) {
      setError('This browser can’t record. Type the note instead.');
      return false;
    }
    setState('recording');
    timer.current = setInterval(() => setSeconds(s => s + 1), 1000);
    return true;
  }, [recordingSupported, cleanup]);

  const stop = useCallback(async (): Promise<VoiceResult> => {
    keepListening.current = false;
    try { recog.current?.stop(); } catch { /* ignore */ }
    const rec = recorder.current;
    let blob: Blob | null = null;
    let mime = '';
    if (rec && rec.state !== 'inactive') {
      mime = rec.mimeType || 'audio/webm';
      await new Promise<void>(resolve => { rec.onstop = () => resolve(); rec.stop(); });
      blob = chunks.current.length ? new Blob(chunks.current, { type: mime }) : null;
    }
    recorder.current = null;
    // Give the recognizer a moment to deliver its last words.
    await new Promise(r => setTimeout(r, 400));
    const text = transcriptRef.current;
    cleanup();
    setState('idle');
    return { blob, mime, transcript: text };
  }, [cleanup]);

  return { state, seconds, transcript, setTranscript, error, start, stop, speechSupported, recordingSupported };
}

export function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
