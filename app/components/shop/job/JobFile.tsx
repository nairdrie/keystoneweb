'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle, Camera, Car, Check, ChevronLeft, ClipboardList, Clock, DollarSign, FileText, Key, Landmark, Mic, Package, Pencil, Phone,
  RotateCcw, Send, Shield, Sparkles, Users, Wrench,
} from 'lucide-react';
import { LANES, STAGE_LABELS, roLabel, vehicleLabel } from '@/lib/shop/board';
import { formatCents } from '@/lib/shop/money';
import { formatShortDateTime } from '@/lib/shop/dates';
import type { ChecklistItem } from '@/lib/shop/rules';
import type { EventKind, JobDetail, JobEvent } from '@/lib/shop/types';
import { api, errorText, shopUrl } from '../api';
import { useShop } from '../ShopContext';
import { Callout, CopyButton, Dialog, Field, KeyTag, Pill, Plate, RuleErrors, km } from '../ui';
import { VehicleForm } from '../CustomerDrawer';
import EstimateTab from './EstimateTab';
import PartsTab from './PartsTab';
import InvoiceTab from './InvoiceTab';
import VoiceNoteModal from './VoiceNoteModal';

export type Detail = JobDetail & { checklist: ChecklistItem[] };
type Tab = 'overview' | 'estimate' | 'parts' | 'invoice' | 'timeline';

const STEPS = ['Dropped off', 'Diagnosed', 'Estimate sent', 'Approved', 'Repaired', 'Invoiced', 'Paid'];

function stepIndex(d: Detail): number {
  const paid = d.invoice && d.payments.filter(p => p.invoice_id === d.invoice!.id).reduce((s, p) => s + p.amount_cents, 0) >= d.invoice.total_cents;
  if (d.job.status === 'closed' && (paid || d.job.closed_reason === 'paid')) return 7;
  if (d.invoice) return 5;
  const approved = d.estimates.some(e => e.status === 'approved');
  if (approved && d.job.stage === 'done') return 4;
  if (approved) return 3;
  if (d.estimates.some(e => e.sent_at)) return 2;
  if (d.job.diagnosed_at || d.job.diagnosis) return 1;
  return 0;
}

export default function JobFile({ jobId }: { jobId: string }) {
  const { siteId, href, toast, version, bump, openCustomer } = useShop();
  const router = useRouter();
  const params = useSearchParams();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tab: Tab = (['overview', 'estimate', 'parts', 'invoice', 'timeline'] as Tab[]).includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'overview';
  const setTab = useCallback((t: Tab) => router.replace(href(`/jobs/${jobId}`, { tab: t }), { scroll: false }), [router, href, jobId]);
  const [callOpen, setCallOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await api<Detail>(siteId, `/jobs/${jobId}`));
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  }, [siteId, jobId]);
  useEffect(() => {
    let live = true;
    api<Detail>(siteId, `/jobs/${jobId}`)
      .then(d => { if (live) { setDetail(d); setError(null); } })
      .catch(err => { if (live) setError(errorText(err)); });
    return () => { live = false; };
  }, [siteId, jobId, version]);

  /** Run an action, then reload this file and the board. */
  const act = useCallback(async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      if (success) toast(success);
      await load();
      bump();
      return true;
    } catch (err) {
      toast(errorText(err), 'warn');
      await load();
      return false;
    }
  }, [load, bump, toast]);

  if (error && !detail) return <div className="empty">{error} <Link href={href('')}>Back to the board</Link></div>;
  if (!detail) return <div className="empty">Loading the job file…</div>;

  const { job, customer, vehicle, settings } = detail;
  const si = stepIndex(detail);
  const latest = detail.estimates[detail.estimates.length - 1] ?? null;
  const pendingRevision = detail.estimates.find(e => e.is_revision && (e.status === 'draft' || e.status === 'sent'));
  const dots: Partial<Record<Tab, boolean>> = {
    estimate: !!latest && latest.status === 'draft' && (latest.needs_review || latest.lines.some(l => l.decision === 'include' && ((l.kind === 'part' && l.unit_price_cents == null) || (l.kind === 'labour' && (l.hours == null || l.rate_cents == null))))),
    invoice: !!pendingRevision && !detail.invoice,
  };
  const place = job.bay ? `bay:${job.bay}` : `lane:${job.stage}`;
  const places = [
    ...LANES.map(l => ({ value: `lane:${l.id}`, label: l.label })),
    ...settings.bays.map(b => ({ value: `bay:${b.id}`, label: b.label })),
  ];

  async function moveTo(value: string) {
    const [kind, id] = value.split(':');
    if (kind === 'lane' && id === 'approved' && !detail!.estimates.some(e => e.status === 'approved')) {
      toast('Record the customer’s approval first (Estimate tab → Record approval).', 'warn');
      return;
    }
    await act(() => api(siteId, `/jobs/${jobId}`, { body: kind === 'bay' ? { action: 'move', bay: id } : { action: 'move', stage: id } }),
      `${roLabel(job.ro_number)} moved to ${kind === 'bay' ? settings.bays.find(b => b.id === id)?.label : STAGE_LABELS[id as keyof typeof STAGE_LABELS]}.`);
  }

  return (
    <>
      <Link className="back" href={href('')}><ChevronLeft className="i" />Board</Link>
      <div className="jf-head">
        <div className="jf-title">
          <KeyTag lg>{job.key_tag}</KeyTag>
          <div>
            <h2>{[vehicleLabel(vehicle), vehicle.trim].filter(Boolean).join(' ')}</h2>
            <p>{roLabel(job.ro_number)} · {customer.name}{vehicle.plate ? <> · <Plate>{vehicle.plate}</Plate></> : null} · {job.odometer_in != null ? `${km(job.odometer_in)} in` : 'odometer not recorded'}</p>
          </div>
        </div>
        <div className="jf-actions">
          {job.status === 'closed' ? (
            <Pill tone="ok" icon={<Check className="i" />}>{job.closed_reason === 'released_on_plan' ? 'Released on a plan' : job.closed_reason === 'paid' ? 'Paid · closed' : job.closed_reason === 'cancelled' ? 'Cancelled' : 'Closed'}</Pill>
          ) : (
            <>
              <label className="sr" htmlFor="move-job">Move to</label>
              <select id="move-job" className="movesel" value={place} onChange={e => moveTo(e.target.value)}>
                {places.map(p => <option key={p.value} value={p.value}>{p.value === place ? 'In: ' : 'Move to: '}{p.label}</option>)}
              </select>
            </>
          )}
          <button type="button" className="btn" onClick={() => setCallOpen(true)}><Phone className="i" />Log a call</button>
        </div>
      </div>
      <div className="stepper" aria-label="Progress">
        {STEPS.map((s, i) => (
          <span key={s} className={`step ${i < si ? 'done' : i === si ? 'now' : ''}`}><span className="sd">{i < si ? <Check className="i" /> : i + 1}</span>{s}</span>
        ))}
      </div>
      <div className="jf-grid">
        <div className="panel">
          <div className="tabs" role="tablist">
            {(['overview', 'estimate', 'parts', 'invoice', 'timeline'] as Tab[]).map(t => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {t[0].toUpperCase() + t.slice(1)}{dots[t] ? <span className="tdot" aria-label="needs attention" /> : null}
              </button>
            ))}
          </div>
          <div className="tab-body">
            {tab === 'overview' && <OverviewTab d={detail} act={act} goTab={setTab} />}
            {tab === 'estimate' && <EstimateTab d={detail} act={act} reload={load} />}
            {tab === 'parts' && <PartsTab d={detail} act={act} />}
            {tab === 'invoice' && <InvoiceTab d={detail} act={act} reload={load} />}
            {tab === 'timeline' && <TimelineTab d={detail} />}
          </div>
        </div>
        <aside className="side">
          <CustomerCard d={detail} onOpen={() => openCustomer(customer.id)} />
          <VehicleCard d={detail} onSaved={() => { load(); bump(); }} />
          <ComplianceCard items={detail.checklist} />
        </aside>
      </div>
      {callOpen && <CallModal d={detail} onClose={() => setCallOpen(false)} onSaved={() => { setCallOpen(false); load(); }} />}
    </>
  );
}

// ── Overview ───────────────────────────────────────────────────────────────

function OverviewTab({ d, act, goTab }: { d: Detail; act: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>; goTab: (t: Tab) => void }) {
  const { siteId } = useShop();
  const { job } = d;
  const [next, setNext] = useState(job.next_step || '');
  const [editing, setEditing] = useState(false);
  const [voice, setVoice] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);
  const voices = d.events.filter(e => e.kind === 'voice');
  const photos = d.events.filter(e => e.kind === 'photo' && e.file_path);
  const approved = d.estimates.find(e => e.status === 'approved');
  const declined = (approved ?? d.estimates[d.estimates.length - 1])?.lines.filter(l => l.decision === 'declined') ?? [];
  const sourceLabel = { walk_in: 'Walk-in', key_drop: 'After-hours key drop', phone: 'Phone call', website_form: 'Website form', booking: 'Online booking', other: 'Other' }[job.source];
  const feeText = job.estimate_fee_cents > 0 ? `${formatCents(job.estimate_fee_cents)}${job.estimate_fee_agreed_at ? `, agreed (${job.estimate_fee_note || 'recorded'})` : ', not recorded as agreed'}` : 'No charge';

  async function upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    await act(() => api(siteId, `/jobs/${job.id}/upload`, { form }), 'Photo added.');
  }

  return (
    <>
      <div className="block">
        <h4><ClipboardList className="i" />In the customer’s words</h4>
        {editing ? <EditJob d={d} onDone={() => setEditing(false)} act={act} /> : (
          <>
            <p className="quote">{job.complaint}</p>
            <p className="note" style={{ marginTop: 6 }}>
              Came in by: {sourceLabel} · Estimate fee: {feeText}
              {!d.estimates.some(e => e.sent_at) && <> · <button type="button" className="linkbtn" onClick={() => setFeeOpen(true)}>{job.estimate_fee_cents > 0 ? 'Change fee' : 'Add an estimate fee'}</button></>}
              {' · '}<button type="button" className="linkbtn" onClick={() => setEditing(true)}>Edit</button>
            </p>
          </>
        )}
      </div>
      <div className="block">
        <h4><Wrench className="i" />What the tech found</h4>
        {job.diagnosis ? <p style={{ whiteSpace: 'pre-wrap' }}>{job.diagnosis}</p> : <p className="note">Nobody has looked at it yet.</p>}
        {voices.slice(-2).map(v => (
          <div key={v.id} style={{ marginTop: 8 }}>
            <p className="quote voice"><Mic className="i" /> {v.actor} · {formatShortDateTime(v.created_at)}: “{v.quote}”</p>
            {v.file_path && <audio controls preload="none" src={shopUrl(siteId, '/files', { path: v.file_path })} style={{ width: '100%', marginTop: 6, height: 32 }} />}
            {Number((v.meta as { lines?: number }).lines) > 0 && <span className="ai-chip"><Sparkles className="i" />Turned into {String((v.meta as { lines?: number }).lines)} estimate lines</span>}
            {(v.meta as { ai_error?: string }).ai_error && <p className="note">{String((v.meta as { ai_error?: string }).ai_error)}</p>}
          </div>
        ))}
        {photos.length > 0 && (
          <div className="photos" style={{ marginTop: 10 }}>
            {photos.map(p => (
              <a key={p.id} className="photo photo-real" href={shopUrl(siteId, '/files', { path: p.file_path! })} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shopUrl(siteId, '/files', { path: p.file_path! })} alt={p.body || 'Job photo'} loading="lazy" />
                <span>{p.body || 'Photo'}</span>
              </a>
            ))}
          </div>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="btn sm" onClick={() => setVoice(true)}><Mic className="i" />Record a note</button>
          <label className="btn sm" tabIndex={0}>
            <Camera className="i" />Add a photo
            <input type="file" accept="image/*" capture="environment" hidden onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          </label>
          {job.status === 'open' && job.stage === 'dropped' && (
            <button type="button" className="btn sm ghost" onClick={() => act(() => api(siteId, `/jobs/${job.id}`, { body: { action: 'done', kind: 'diagnosis' } }), 'Moved to Write estimate.')}><Check className="i" />Diagnosis done</button>
          )}
        </div>
      </div>
      <div className="block">
        <h4><RotateCcw className="i" />Where you left off</h4>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <label className="sr" htmlFor="next-step">Next step</label>
          <input id="next-step" className="input" value={next} onChange={e => setNext(e.target.value)} placeholder="e.g. Waiting on Lakeshore’s price for the CV axle" />
          <button type="button" className="btn" onClick={() => act(() => api(siteId, `/jobs/${job.id}`, { method: 'PATCH', body: { next_step: next } }), 'Saved.')}>Save</button>
        </div>
        <p className="note" style={{ marginTop: 6 }}>This shows up on My desk so you can pick it back up next week.</p>
      </div>
      {declined.length > 0 && (
        <div className="block">
          <h4><Clock className="i" />Recommended for later (declined)</h4>
          {declined.map(l => <p key={l.id}>{l.description}</p>)}
          <p className="note" style={{ marginTop: 4 }}>The decline is on record and prints on the invoice.</p>
        </div>
      )}
      <JobStatusActions d={d} act={act} goTab={goTab} />
      {voice && <VoiceNoteModal d={d} onClose={() => setVoice(false)} onSaved={() => { setVoice(false); act(async () => {}); }} />}
      {feeOpen && <FeeModal d={d} onClose={() => setFeeOpen(false)} act={act} />}
    </>
  );
}

function JobStatusActions({ d, act, goTab }: { d: Detail; act: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>; goTab: (t: Tab) => void }) {
  const { siteId } = useShop();
  const { job } = d;
  const approved = d.estimates.some(e => e.status === 'approved');
  const declined = d.estimates.some(e => e.status === 'declined' && !e.is_revision) && !approved;
  const feeOwed = declined && job.estimate_fee_cents > 0 && !!job.estimate_fee_agreed_at && !d.invoice;
  if (job.status === 'closed') {
    return (
      <div className="row">
        {job.closed_reason !== 'paid' && job.closed_reason !== 'released_on_plan' && (
          <button type="button" className="btn sm" onClick={() => act(() => api(siteId, `/jobs/${job.id}`, { body: { action: 'reopen' } }), 'Job reopened.')}>Reopen job</button>
        )}
      </div>
    );
  }
  return (
    <div className="block">
      <h4><Key className="i" />Closing out</h4>
      {declined && <p className="note" style={{ marginBottom: 8 }}>The customer declined the estimate. {feeOwed ? `The agreed estimate fee (${formatCents(job.estimate_fee_cents)}) can be invoiced from the Invoice tab.` : 'Close the job when they pick the car up.'}</p>}
      <div className="row">
        {feeOwed && <button type="button" className="btn sm primary" onClick={() => goTab('invoice')}><FileText className="i" />Invoice the estimate fee</button>}
        {!d.invoice && <button type="button" className="btn sm" onClick={() => { if (confirm('Close this job with no charge? The key tag is freed.')) act(() => api(siteId, `/jobs/${job.id}`, { body: { action: 'close', reason: 'no_charge' } }), 'Closed with no charge.'); }}>Picked up, no charge</button>}
        {!d.invoice && <button type="button" className="btn sm ghost" onClick={() => { const note = prompt('Why is it cancelled? (kept on file)'); if (note !== null) act(() => api(siteId, `/jobs/${job.id}`, { body: { action: 'close', reason: 'cancelled', note } }), 'Job cancelled.'); }}>Cancel job</button>}
        {d.invoice && !job.returned_at && !job.holding_since && <button type="button" className="btn sm ghost" onClick={() => { if (confirm('Hand the key back without payment or a signed plan? There will be no lien on the car.')) act(() => api(siteId, `/jobs/${job.id}`, { body: { action: 'returned' } }), 'Marked as picked up.'); }}>Picked up without paying</button>}
      </div>
    </div>
  );
}

function EditJob({ d, onDone, act }: { d: Detail; onDone: () => void; act: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean> }) {
  const { siteId } = useShop();
  const [f, setF] = useState({
    complaint: d.job.complaint, odometer_in: d.job.odometer_in != null ? String(d.job.odometer_in) : '', key_tag: d.job.key_tag || '',
    promised_date: d.job.promised_date || '', assigned_tech: d.job.assigned_tech || '', diagnosis: d.job.diagnosis || '',
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Field label="Complaint" htmlFor="ej-c"><textarea id="ej-c" className="input" value={f.complaint} onChange={e => setF({ ...f, complaint: e.target.value })} /></Field>
      <Field label="What the tech found" htmlFor="ej-d"><textarea id="ej-d" className="input" value={f.diagnosis} onChange={e => setF({ ...f, diagnosis: e.target.value })} /></Field>
      <div className="grid2">
        <Field label="Odometer in" htmlFor="ej-o"><input id="ej-o" className="input num" inputMode="numeric" value={f.odometer_in} onChange={e => setF({ ...f, odometer_in: e.target.value })} /></Field>
        <Field label="Key tag" htmlFor="ej-k"><input id="ej-k" className="input mono" value={f.key_tag} onChange={e => setF({ ...f, key_tag: e.target.value })} /></Field>
        <Field label="Promised by" htmlFor="ej-p"><input id="ej-p" className="input" type="date" value={f.promised_date} onChange={e => setF({ ...f, promised_date: e.target.value })} /></Field>
        <Field label="Tech" htmlFor="ej-t">
          <select id="ej-t" className="input" value={f.assigned_tech} onChange={e => setF({ ...f, assigned_tech: e.target.value })}>
            <option value="">Nobody yet</option>
            {d.settings.staff.filter(s => s.role !== 'desk').map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
        <button type="button" className="btn primary" onClick={async () => {
          const ok = await act(() => api(siteId, `/jobs/${d.job.id}`, { method: 'PATCH', body: { ...f, odometer_in: f.odometer_in.replace(/[^0-9]/g, '') || null } }), 'Job saved.');
          if (ok) onDone();
        }}>Save</button>
      </div>
    </div>
  );
}

function FeeModal({ d, onClose, act }: { d: Detail; onClose: () => void; act: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean> }) {
  const { siteId } = useShop();
  const [amount, setAmount] = useState(((d.job.estimate_fee_cents || d.settings.estimate_fee_cents) / 100).toFixed(2));
  const [method, setMethod] = useState(d.job.source === 'phone' ? 'phone' : 'in_person');
  const [phone, setPhone] = useState(d.customer.phone || '');
  const [error, setError] = useState<unknown>(null);
  return (
    <Dialog title="Estimate fee" eyebrow={roLabel(d.job.ro_number)} onClose={onClose} footer={<>
      {d.job.estimate_fee_cents > 0 && <button type="button" className="btn ghost" onClick={async () => { if (await act(() => api(siteId, `/jobs/${d.job.id}`, { method: 'PATCH', body: { remove_fee: true } }), 'Estimate fee removed.')) onClose(); }}>Remove fee</button>}
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button type="button" className="btn primary" onClick={async () => {
        setError(null);
        try {
          await api(siteId, `/jobs/${d.job.id}`, { method: 'PATCH', body: { fee: { cents: Math.round(parseFloat(amount.replace(/[^0-9.]/g, '')) * 100), method, phone, authorized_by: d.customer.name } } });
          await act(async () => {}, 'Estimate fee recorded.');
          onClose();
        } catch (err) { setError(err); }
      }}>Record agreement</button>
    </>}>
      {error ? <RuleErrors error={error} /> : null}
      <div className="grid2">
        <Field label="Fee they agreed to" htmlFor="fee-amt"><input id="fee-amt" className="input num" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
        <Field label="How they agreed" htmlFor="fee-how">
          <select id="fee-how" className="input" value={method} onChange={e => setMethod(e.target.value)}>
            <option value="in_person">In person</option><option value="phone">Phone call</option><option value="online">Online form</option><option value="email">Email</option><option value="text">Text</option>
          </select>
        </Field>
        {method === 'phone' && <Field label="Number you called" required htmlFor="fee-ph"><input id="fee-ph" className="input" value={phone} onChange={e => setPhone(e.target.value)} /></Field>}
      </div>
      <p className="note">It has to be agreed before the estimate is written. If they approve the repair and you do the work, it isn’t charged.</p>
    </Dialog>
  );
}

function CallModal({ d, onClose, onSaved }: { d: Detail; onClose: () => void; onSaved: () => void }) {
  const { siteId, toast } = useShop();
  const [phone, setPhone] = useState(d.customer.phone || '');
  const [outcome, setOutcome] = useState('No answer, left a message');
  const [body, setBody] = useState('');
  const [error, setError] = useState<unknown>(null);
  return (
    <Dialog title="Log a call" eyebrow={`${roLabel(d.job.ro_number)} · ${d.customer.name}`} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button type="button" className="btn primary" onClick={async () => {
        try { await api(siteId, `/jobs/${d.job.id}`, { body: { action: 'note', kind: 'call', phone, outcome, body } }); toast('Call logged.'); onSaved(); } catch (err) { setError(err); }
      }}><Phone className="i" />Save</button>
    </>}>
      {error ? <RuleErrors error={error} /> : null}
      <div className="grid2">
        <Field label="Number" htmlFor="call-ph"><input id="call-ph" className="input" value={phone} onChange={e => setPhone(e.target.value)} />{phone && <a className="note" href={`tel:${phone}`}>Call now</a>}</Field>
        <Field label="What happened" htmlFor="call-out">
          <select id="call-out" className="input" value={outcome} onChange={e => setOutcome(e.target.value)}>
            <option>No answer, left a message</option><option>No answer</option><option>Talked, they’ll think about it</option><option>Talked, they’ll call back</option><option>Talked, told them it’s ready</option><option>Talked about the price</option>
          </select>
        </Field>
      </div>
      <Field label="Notes" htmlFor="call-body"><textarea id="call-body" className="input" value={body} onChange={e => setBody(e.target.value)} placeholder="Wants the brakes only for now; will do the struts next month." /></Field>
      <p className="note">If they approved the estimate on this call, use Record approval on the Estimate tab instead, so the approval stands up later.</p>
    </Dialog>
  );
}

// ── Timeline ───────────────────────────────────────────────────────────────

const EVENT_ICONS: Record<EventKind, typeof Key> = {
  intake: Key, note: Pencil, voice: Mic, photo: Camera, call: Phone, move: Car, diagnosis: Wrench, estimate: FileText,
  authorization: Shield, parts: Package, invoice: FileText, payment: DollarSign, lien: Landmark, email: Send, system: Check,
};

function TimelineTab({ d }: { d: Detail }) {
  const { siteId } = useShop();
  const events = [...d.events].reverse();
  return (
    <div className="tl">
      {events.map((ev: JobEvent) => {
        const Icon = EVENT_ICONS[ev.kind] || Check;
        const meta = ev.meta as { ai_error?: string; lines?: number };
        return (
          <div key={ev.id} className="tl-item">
            <span className="tl-ico"><Icon className="i" /></span>
            <div>
              <div className="tl-meta">{formatShortDateTime(ev.created_at)} · {ev.actor || 'Keystone'}</div>
              <div className="tl-text">{ev.body}</div>
              {ev.quote && <p className={`quote${ev.kind === 'voice' ? ' voice' : ''}`}>“{ev.quote}”</p>}
              {ev.kind === 'voice' && ev.file_path && <audio controls preload="none" src={shopUrl(siteId, '/files', { path: ev.file_path })} style={{ width: '100%', marginTop: 6, height: 32 }} />}
              {ev.kind === 'photo' && ev.file_path && (
                <a href={shopUrl(siteId, '/files', { path: ev.file_path })} target="_blank" rel="noopener noreferrer" className="tl-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shopUrl(siteId, '/files', { path: ev.file_path })} alt={ev.body || 'Photo'} loading="lazy" />
                </a>
              )}
              {ev.kind === 'parts' && ev.file_path && <a className="note" href={shopUrl(siteId, '/files', { path: ev.file_path })} target="_blank" rel="noopener noreferrer">View the supplier invoice</a>}
              {Number(meta.lines) > 0 && <span className="ai-chip"><Sparkles className="i" />Drafted {meta.lines} estimate line{meta.lines === 1 ? '' : 's'}</span>}
              {meta.ai_error && <p className="note">{meta.ai_error}</p>}
            </div>
          </div>
        );
      })}
      {!events.length && <p className="note">Nothing yet.</p>}
    </div>
  );
}

// ── Side cards ─────────────────────────────────────────────────────────────

function CustomerCard({ d, onOpen }: { d: Detail; onOpen: () => void }) {
  const c = d.customer;
  const owes = d.invoice ? d.invoice.total_cents - d.payments.filter(p => p.invoice_id === d.invoice!.id).reduce((s, p) => s + p.amount_cents, 0) : 0;
  return (
    <div className="panel">
      <div className="panel-head"><span className="panel-title"><Users className="i" />Customer</span><button type="button" className="btn sm ghost" onClick={onOpen}>Open file</button></div>
      <div className="panel-body">
        <b style={{ fontSize: 14 }}>{c.name}</b>{c.customer_type === 'business' && <> <Pill>Business</Pill></>}
        <dl className="kv" style={{ marginTop: 8 }}>
          <dt>Phone</dt><dd><span className="copyable">{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : '—'}<CopyButton value={c.phone} /></span></dd>
          <dt>Email</dt><dd>{c.email || '—'}</dd>
          <dt>Customer since</dt><dd>{new Date(c.created_at).getFullYear()}</dd>
          <dt>Visits</dt><dd className="num">{d.other_jobs.length + 1}</dd>
          <dt>Owes on this job</dt><dd className="num">{formatCents(Math.max(0, owes))}</dd>
        </dl>
        {c.preferences && <p className="pref">{c.preferences}</p>}
        {!d.job.owner_is_customer && <p className="pref">Registered owner: {d.job.registered_owner_name || 'not recorded'}</p>}
      </div>
    </div>
  );
}

function VehicleCard({ d, onSaved }: { d: Detail; onSaved: () => void }) {
  const v = d.vehicle;
  const [editing, setEditing] = useState(false);
  return (
    <div className="panel">
      <div className="panel-head"><span className="panel-title"><Car className="i" />Vehicle</span><button type="button" className="btn sm ghost" onClick={() => setEditing(e => !e)}><Pencil className="i" />{editing ? 'Close' : 'Edit'}</button></div>
      <div className="panel-body">
        {editing ? <VehicleForm customerId={d.customer.id} vehicle={v} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onSaved(); }} /> : (
          <dl className="kv">
            <dt>VIN</dt><dd className="mono" style={{ fontSize: 11.5 }}><span className="copyable">{v.vin || <span className="needs">Missing</span>}<CopyButton value={v.vin} /></span></dd>
            <dt>Plate</dt><dd>{v.plate || <span className="needs">Missing</span>}</dd>
            <dt>Colour</dt><dd>{v.color || '—'}</dd>
            {v.engine && <><dt>Engine</dt><dd>{v.engine}</dd></>}
            <dt>Odometer in</dt><dd className="num">{d.job.odometer_in != null ? km(d.job.odometer_in) : <span className="needs">Missing</span>}</dd>
            {d.job.odometer_out != null && <><dt>Odometer out</dt><dd className="num">{km(d.job.odometer_out)}</dd></>}
            <dt>Key tag</dt><dd>{d.job.key_tag || '—'}</dd>
            {d.other_jobs.length > 0 && <><dt>Past visits</dt><dd>{d.other_jobs.slice(0, 4).map(o => `RO-${o.ro_number}`).join(', ')}</dd></>}
          </dl>
        )}
      </div>
    </div>
  );
}

function ComplianceCard({ items }: { items: ChecklistItem[] }) {
  return (
    <div className="panel">
      <div className="panel-head"><span className="panel-title"><Shield className="i" />Ontario repair rules</span></div>
      <div className="panel-body">
        <div className="checks">
          {items.map((x, i) => (
            <div key={i} className={`check ${x.status}`}>
              <span className="ci">{x.status === 'ok' ? <Check className="i" /> : x.status === 'warn' ? <AlertTriangle className="i" /> : null}</span>
              <div className="ct"><b>{x.law.short}</b> <span className="cite">{x.law.cite}</span><p>{x.note}</p></div>
            </div>
          ))}
        </div>
        <p className="note" style={{ marginTop: 12 }}>Keystone blocks or warns at each step. It isn’t legal advice; have a paralegal confirm the details for your shop.</p>
      </div>
    </div>
  );
}

export function useDetailHelpers(d: Detail) {
  return useMemo(() => {
    const approved = d.estimates.find(e => e.status === 'approved') ?? null;
    const paid = d.invoice ? d.payments.filter(p => p.invoice_id === d.invoice!.id).reduce((s, p) => s + p.amount_cents, 0) : 0;
    return { approved, paid, balance: d.invoice ? d.invoice.total_cents - paid : 0 };
  }, [d]);
}

export { Callout };
