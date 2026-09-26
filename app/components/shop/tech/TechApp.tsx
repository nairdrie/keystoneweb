'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, KeyRound, LogOut, Mic, Send, Sparkles, Square, Wrench } from 'lucide-react';
import { shortVehicleLabel, vehicleLabel } from '@/lib/shop/board';
import { formatCents } from '@/lib/shop/money';
import type { Bay, JobDetail, JobSummary, StaffMember, SupplierBill } from '@/lib/shop/types';
import { KeyTag, Pill, ToastProvider, useToast } from '../ui';
import { clock, useVoiceRecorder } from '../useVoiceRecorder';
import '../shop.css';

interface Board {
  siteId: string;
  shop: string;
  is_device: boolean;
  bays: Bay[];
  staff: StaffMember[];
  jobs: JobSummary[];
  services: { ai: boolean; transcription: boolean };
}

type Screen =
  | { s: 'idle' }
  | { s: 'recording' }
  | { s: 'review'; transcript: string; audio: { blob: Blob; mime: string } | null }
  | { s: 'sending' }
  | { s: 'result'; summary: string | null; diagnosis: string | null; lines: number; revision: boolean; aiError: string | null }
  | { s: 'snap' }
  | { s: 'snapped'; bill: SupplierBill; matched: boolean }
  | { s: 'confirmDone' };

const TECH_KEY = 'ks_shop_tech_name';
const BAY_KEY = 'ks_shop_tech_bay';

class TechError extends Error { status: number; constructor(m: string, s: number) { super(m); this.status = s; } }

export default function TechApp({ siteIdParam }: { siteIdParam: string | null }) {
  return (
    <div className="shop-ui tech-app shop-auto-dark">
      <ToastProvider><TechInner siteIdParam={siteIdParam} /></ToastProvider>
    </div>
  );
}

function TechInner({ siteIdParam }: { siteIdParam: string | null }) {
  const toast = useToast();
  const [board, setBoard] = useState<Board | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tech, setTech] = useState(() => { try { return localStorage.getItem(TECH_KEY) || ''; } catch { return ''; } });
  const [bayId, setBayId] = useState<string | null>(() => { try { return localStorage.getItem(BAY_KEY); } catch { return null; } });
  const [detailState, setDetailState] = useState<{ id: string; d: JobDetail } | null>(null);
  const [screen, setScreen] = useState<Screen>({ s: 'idle' });
  const rec = useVoiceRecorder();
  const snapRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const siteId = board?.siteId || siteIdParam;
  const req = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const qs = siteId ? `${path.includes('?') ? '&' : '?'}siteId=${siteId}` : '';
    const res = await fetch(`/api/shop${path}${qs}`, { ...init, credentials: 'include', headers: { ...(init.headers || {}), 'x-shop-tech': tech } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new TechError((data as { error?: string }).error || 'Something went wrong.', res.status);
    return data as T;
  }, [siteId, tech]);

  const loadBoard = useCallback(async () => {
    try {
      const b = await req<Board>('/tech/board');
      setBoard(b);
      setNeedLogin(false);
      setLoadError(null);
    } catch (err) {
      if (err instanceof TechError && (err.status === 401 || err.status === 403)) setNeedLogin(true);
      else setLoadError((err as Error).message);
    }
  }, [req]);

  useEffect(() => {
    let live = true;
    req<Board>('/tech/board')
      .then(b => { if (live) { setBoard(b); setNeedLogin(false); setLoadError(null); } })
      .catch(err => {
        if (!live) return;
        if (err instanceof TechError && (err.status === 401 || err.status === 403)) setNeedLogin(true);
        else setLoadError((err as Error).message);
      });
    return () => { live = false; };
  }, [req]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible' && screen.s === 'idle') loadBoard(); }, 30_000);
    return () => clearInterval(t);
  }, [loadBoard, screen.s]);

  const bays = board?.bays || [];
  const bay = bays.find(b => b.id === bayId) || bays[0] || null;
  const job = board?.jobs.find(j => j.bay === bay?.id) || null;
  const diagnosing = job ? !job.approved : false;
  const techs = (board?.staff || []).filter(s => s.role !== 'desk');

  const jobId = job?.id ?? null;
  const jobStamp = job?.updated_at ?? null;
  useEffect(() => {
    if (!jobId) return;
    let live = true;
    req<JobDetail>(`/jobs/${jobId}`).then(d => { if (live) setDetailState({ id: jobId, d }); }).catch(() => {});
    return () => { live = false; };
  }, [jobId, jobStamp, req]);
  const detail = detailState && job && detailState.id === job.id ? detailState.d : null;

  const approvedLines = useMemo(() => detail?.estimates.find(e => e.status === 'approved')?.lines.filter(l => l.decision === 'include') ?? [], [detail]);

  function pickTech(name: string) { setTech(name); try { localStorage.setItem(TECH_KEY, name); } catch { /* ignore */ } }
  function pickBay(id: string) { setBayId(id); setScreen({ s: 'idle' }); try { localStorage.setItem(BAY_KEY, id); } catch { /* ignore */ } }

  async function record() {
    if (screen.s === 'recording') {
      const r = await rec.stop();
      setScreen({ s: 'review', transcript: r.transcript, audio: r.blob ? { blob: r.blob, mime: r.mime } : null });
      return;
    }
    const ok = await rec.start();
    if (ok) setScreen({ s: 'recording' });
    else if (rec.error) toast(rec.error, 'warn');
  }

  async function sendNote(transcript: string, audio: { blob: Blob; mime: string } | null, mode: 'diagnosis' | 'done' | 'note', finish: boolean) {
    if (!job) return;
    setScreen({ s: 'sending' });
    const form = new FormData();
    form.append('transcript', transcript);
    form.append('mode', mode);
    form.append('finish', String(finish));
    if (audio) form.append('audio', new File([audio.blob], `note.${audio.mime.includes('mp4') ? 'm4a' : 'webm'}`, { type: audio.mime.split(';')[0] }));
    try {
      const res = await req<{ summary: string | null; diagnosis: string | null; lines_added: number; revision: boolean; ai_error: string | null }>(`/jobs/${job.id}/voice`, { method: 'POST', body: form });
      setScreen({ s: 'result', summary: res.summary, diagnosis: res.diagnosis, lines: res.lines_added, revision: res.revision, aiError: res.ai_error });
      if (finish) toast(`${bay?.label} is free.`);
      loadBoard();
    } catch (err) {
      toast((err as Error).message, 'warn');
      setScreen({ s: 'review', transcript, audio });
    }
  }

  async function snap(file: File) {
    if (!job) return;
    setScreen({ s: 'snap' });
    const form = new FormData();
    form.append('file', file);
    form.append('job_id', job.id);
    try {
      const bill = await req<SupplierBill>('/bills', { method: 'POST', body: form });
      let matched = false;
      if (bill.lines.length && bill.suggested_job_id === job.id) {
        try {
          await req(`/bills/${bill.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'match', target: 'job', job_id: job.id }) });
          matched = true;
        } catch { matched = false; }
      }
      setScreen({ s: 'snapped', bill, matched });
    } catch (err) {
      toast((err as Error).message, 'warn');
      setScreen({ s: 'idle' });
    }
  }

  async function photo(file: File) {
    if (!job) return;
    const form = new FormData();
    form.append('file', file);
    try { await req(`/jobs/${job.id}/upload`, { method: 'POST', body: form }); toast('Photo added to the job.'); } catch (err) { toast((err as Error).message, 'warn'); }
  }

  async function markDone() {
    if (!job) return;
    try {
      await req(`/jobs/${job.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'done', kind: diagnosing ? 'diagnosis' : 'repair' }) });
      toast(`${bay?.label} is free. The car is in “${diagnosing ? 'Write estimate' : 'Done · parked'}”.`);
      setScreen({ s: 'idle' });
      loadBoard();
    } catch (err) { toast((err as Error).message, 'warn'); }
  }

  async function pullIn(j: JobSummary) {
    if (!bay) return;
    try {
      await req(`/jobs/${j.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'move', bay: bay.id, assigned_tech: tech || undefined }) });
      toast(`${shortVehicleLabel(j.vehicle)} is in ${bay.label}.`);
      loadBoard();
    } catch (err) { toast((err as Error).message, 'warn'); }
  }

  async function signOut() {
    await fetch('/api/shop/tech/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setBoard(null);
    setNeedLogin(true);
  }

  if (needLogin) return <Login onDone={() => { setNeedLogin(false); loadBoard(); }} />;
  if (loadError) return <div className="tech-login"><p className="note">{loadError}</p><button type="button" className="btn" onClick={loadBoard}>Try again</button></div>;
  if (!board) return <div className="tech-login"><p className="note">Loading…</p></div>;

  const queue = board.jobs.filter(j => !j.bay && j.status === 'open' && (j.stage === 'dropped' || (j.stage === 'approved' && j.parts.received >= j.parts.expected)));

  let out: React.ReactNode = <p className="ph">{job ? 'Tap the red button and say what you found. You can keep your gloves on.' : 'Pick a car to pull into this bay.'}</p>;
  if (screen.s === 'recording') out = <><div className="wave" aria-label="Recording"><i /><i /><i /><i /><i /><i /><i /></div><p className="ph num">Listening… {clock(rec.seconds)}</p>{rec.transcript && <p style={{ color: 'var(--text-2)' }}>“{rec.transcript}”</p>}</>;
  if (screen.s === 'review') out = (
    <>
      <textarea className="input" style={{ minHeight: 120 }} value={screen.transcript} onChange={e => setScreen({ ...screen, transcript: e.target.value })} placeholder={rec.speechSupported ? 'Say it again, or type here.' : 'This phone can’t turn speech into text here. Type the note, or send the recording.'} aria-label="Note" />
      {screen.audio && <audio controls src={URL.createObjectURL(screen.audio.blob)} style={{ width: '100%', height: 32 }} />}
      <div className="row">
        <button type="button" className="btn primary" disabled={!screen.transcript.trim() && !(screen.audio && board.services.transcription)} onClick={() => sendNote(screen.transcript, screen.audio, diagnosing ? 'diagnosis' : 'note', false)}><Send className="i" />Send to the desk</button>
        <button type="button" className="btn" onClick={() => setScreen({ s: 'idle' })}>Discard</button>
      </div>
    </>
  );
  if (screen.s === 'sending') out = <><div className="skel" style={{ width: '70%' }} /><div className="skel" style={{ width: '90%' }} /><div className="skel" style={{ width: '50%' }} /><p className="ph">Writing it up…</p></>;
  if (screen.s === 'result') out = (
    <>
      {screen.summary && <p><b>{screen.summary}</b></p>}
      {screen.diagnosis && <p style={{ color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{screen.diagnosis}</p>}
      {screen.lines > 0 && <span className="ai-chip"><Sparkles className="i" />Drafted {screen.lines} estimate line{screen.lines === 1 ? '' : 's'}{screen.revision ? ' · needs the customer’s OK' : ''}</span>}
      {screen.aiError && <p className="note">{screen.aiError}</p>}
      <Pill tone="ok" icon={<Check className="i" />}>Sent to the desk</Pill>
    </>
  );
  if (screen.s === 'snap') out = <div className="row" style={{ flexWrap: 'nowrap', gap: 12 }}><div className="receipt scan"><i className="dark w70" /><i /><i className="w85" /><i className="w50" /><i /><i className="w70" /></div><div><b>Reading invoice…</b><p className="note">Hold on a sec</p></div></div>;
  if (screen.s === 'snapped') out = (
    <div className="row" style={{ flexWrap: 'nowrap', gap: 12, alignItems: 'flex-start' }}>
      <div className="receipt"><i className="dark w70" /><i /><i className="w85" /><i className="w50" /><i /><i className="w70" /></div>
      <div>
        <b>{screen.bill.supplier_name_raw || 'Supplier'} {screen.bill.invoice_number || ''}</b>
        <p className="note">{screen.bill.lines.filter(l => !l.is_core).map(l => l.description).slice(0, 3).join(' + ') || 'No lines read'}{screen.bill.total_cents ? ` · ${formatCents(screen.bill.total_cents)}` : ''}</p>
        {screen.matched ? <Pill tone="ok" icon={<Check className="i" />}>Matched to this car</Pill> : <Pill tone="info">In the pile for the desk</Pill>}
        {screen.bill.ai_error && <p className="note">{screen.bill.ai_error}</p>}
      </div>
    </div>
  );
  if (screen.s === 'confirmDone') out = (
    <>
      <b>{diagnosing ? 'Diagnosis done?' : 'Repair done?'}</b>
      <p className="note">{diagnosing ? `The car moves to “Write estimate” and ${bay?.label} opens up.` : 'The car moves to “Done · parked” for the invoice. Did anything extra? Say it so the desk can get the OK.'}</p>
      <div className="row">
        <button type="button" className="btn primary" onClick={markDone}>Yes, done</button>
        {!diagnosing && <button type="button" className="btn" onClick={async () => { const ok = await rec.start(); if (ok) setScreen({ s: 'recording' }); }}><Mic className="i" />Say what I did</button>}
        <button type="button" className="btn" onClick={() => setScreen({ s: 'idle' })}>Not yet</button>
      </div>
    </>
  );
  // A "done" recording: send it as the repair note and free the bay.
  const doneFlow = screen.s === 'review' && !diagnosing;

  return (
    <div className="tech-screen">
      <div className="t-head">
        <div>
          <b>{bay?.label || 'Bay'}</b><br />
          <span>
            <select value={tech} onChange={e => pickTech(e.target.value)} aria-label="Who’s working">
              <option value="">Who’s working?</option>
              {techs.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
            {' '}· {board.shop}
          </span>
        </div>
        {board.is_device ? <button type="button" className="icon-btn" aria-label="Sign this device out" onClick={() => { if (confirm('Sign this device out? You’ll need the shop code and PIN again.')) signOut(); }}><LogOut className="i" /></button> : <Wrench className="i" />}
      </div>
      <div className="t-bays" role="group" aria-label="Bay">
        {bays.map(b => <button key={b.id} type="button" aria-pressed={b.id === bay?.id} onClick={() => pickBay(b.id)}>{b.label}</button>)}
      </div>
      {job ? (
        <div className="t-car">
          <div className="row"><KeyTag>{job.key_tag}</KeyTag><span className="ro">RO-{job.ro_number}</span>{diagnosing ? <Pill tone="info">Diagnosing</Pill> : <Pill tone="ok">Approved · repair</Pill>}</div>
          <b>{detail ? [vehicleLabel(detail.vehicle), detail.vehicle.engine].filter(Boolean).join(' · ') : shortVehicleLabel(job.vehicle)}</b>
          <span className="note">{job.customer.name} · “{job.complaint}”</span>
          {!diagnosing && approvedLines.length > 0 && (
            <div>{approvedLines.map(l => <div key={l.id} className="t-line"><span>{l.description}</span><span>{l.kind === 'labour' ? `${Number(l.hours ?? 0).toFixed(1)} h` : l.kind === 'part' ? `×${Number(l.qty)}` : ''}</span></div>)}</div>
          )}
          {detail?.job.diagnosis && diagnosing && <p className="note" style={{ whiteSpace: 'pre-wrap' }}>{detail.job.diagnosis}</p>}
        </div>
      ) : (
        <>
          <div className="t-car"><b>{bay?.label} is empty</b><span className="note">Pull in the next car.</span></div>
          <div className="t-queue" style={{ marginTop: 10 }}>
            {queue.map(j => (
              <button key={j.id} type="button" onClick={() => pullIn(j)}>
                <KeyTag>{j.key_tag}</KeyTag><span style={{ flex: 1 }}><b>{shortVehicleLabel(j.vehicle)}</b><br /><span className="note">{j.stage === 'approved' ? 'Approved · parts here' : 'Needs a diagnosis'} · {j.complaint.slice(0, 60)}</span></span>
              </button>
            ))}
            {!queue.length && <p className="note">Nothing waiting for a bay.</p>}
          </div>
        </>
      )}
      <div className="t-body"><div className="t-out" aria-live="polite">{out}</div></div>
      {doneFlow && screen.s === 'review' && (
        <div style={{ padding: '0 16px 10px' }}>
          <button type="button" className="btn" style={{ width: '100%' }} disabled={!screen.transcript.trim()} onClick={() => sendNote(screen.transcript, screen.audio, 'done', true)}><Check className="i" />Send as the repair-done note and free the bay</button>
        </div>
      )}
      <div className="t-actions">
        <button type="button" className={`t-big mic${screen.s === 'recording' ? ' rec' : ''}`} onClick={record} disabled={!job || screen.s === 'sending' || screen.s === 'snap'}>
          {screen.s === 'recording' ? <><Square className="i" />Listening… tap to stop</> : <><Mic className="i" />Record a note</>}
        </button>
        <button type="button" className="t-big" onClick={() => snapRef.current?.click()} disabled={!job || screen.s === 'recording'}><Camera className="i" />Parts invoice</button>
        <button type="button" className="t-big" onClick={() => setScreen({ s: 'confirmDone' })} disabled={!job || screen.s === 'recording'}><Check className="i" />{diagnosing ? 'Diagnosis done' : 'Repair done'}</button>
        <button type="button" className="t-big" style={{ gridColumn: '1 / -1', flexDirection: 'row', justifyContent: 'center', minHeight: 52 }} onClick={() => photoRef.current?.click()} disabled={!job}><ImagePlus className="i" />Add a photo</button>
        <input ref={snapRef} type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={e => { const f = e.target.files?.[0]; if (f) snap(f); e.target.value = ''; }} />
        <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { const f = e.target.files?.[0]; if (f) photo(f); e.target.value = ''; }} />
      </div>
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setLabel(/iPad|Tablet/i.test(navigator.userAgent) ? 'Bay tablet' : 'Bay phone'); }, []);
  async function go() {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/shop/tech/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, pin, label }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'That didn’t work.');
      onDone();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="tech-login">
      <span className="logo"><KeyRound className="i" /></span>
      <div><h2 style={{ fontSize: 22, fontWeight: 900 }}>Shop sign-in</h2><p className="note">Enter the shop code and PIN from Shop → Settings on the office computer. This device stays signed in.</p></div>
      <input className="input code" placeholder="Shop code" autoCapitalize="characters" autoComplete="off" value={code} onChange={e => setCode(e.target.value.toUpperCase())} aria-label="Shop code" />
      <input className="input" placeholder="PIN" inputMode="numeric" type="password" autoComplete="off" maxLength={8} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} aria-label="PIN" onKeyDown={e => { if (e.key === 'Enter') go(); }} />
      <input className="input" placeholder="Name this device" value={label} onChange={e => setLabel(e.target.value)} aria-label="Device name" style={{ height: 40, fontSize: 14 }} />
      {error && <p className="err" style={{ color: 'var(--crit-text)', fontWeight: 700 }}>{error}</p>}
      <button type="button" className="btn primary" disabled={busy || code.length < 4 || pin.length < 4} onClick={go}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </div>
  );
}
