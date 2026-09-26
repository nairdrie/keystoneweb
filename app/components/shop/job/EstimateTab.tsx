'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle, Clock, Copy, FileText, Mic, Phone, Plus, Printer, Send, Shield, Sparkles, Trash2, X,
} from 'lucide-react';
import { CONDITION_LABELS, CONDITION_OPTIONS, methodLabel } from '@/lib/shop/rules';
import { centsToInput, computeTotals, formatCents, lineCostCents, lineNeedsPrice, lineTotalCents, parseMoneyToCents } from '@/lib/shop/money';
import { buildEstimateDoc } from '@/lib/shop/documents';
import { formatDate, formatDateTime } from '@/lib/shop/dates';
import type { Alternate, Estimate, EstimateLine, LineKind, PartCondition } from '@/lib/shop/types';
import { api, shopUrl } from '../api';
import { useShop } from '../ShopContext';
import { Callout, Dialog, Field, Pill, RuleErrors, Seg, Switch } from '../ui';
import { EstimatePaper } from '../Paper';
import type { Detail } from './JobFile';

type Act = (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;

/** A line as edited: numbers kept as strings so typing isn't fought. */
interface EditLine {
  key: string;
  id?: string;
  kind: LineKind;
  description: string;
  decision: 'include' | 'declined';
  qty: string;
  hours: string;
  rate: string;
  price: string;
  amount: string;
  cost: string;
  supplier_id: string;
  part_number: string;
  brand: string;
  condition: PartCondition | '';
  quoted_at: string | null;
  quoted_by: string | null;
  eta: string;
  core: string;
  no_warranty: boolean;
  is_added_work: boolean;
  alternates: Alternate[];
  ordered_at: string | null;
}

const KIND_TAG: Record<LineKind, { cls: string; text: string }> = {
  labour: { cls: 'lab', text: 'LAB' }, part: { cls: 'part', text: 'PART' }, supply: { cls: 'fee', text: 'SUP' },
  fee: { cls: 'fee', text: 'FEE' }, discount: { cls: 'disc', text: 'DISC' }, sublet: { cls: 'fee', text: 'SUB' },
};

let keySeq = 0;
const nextKey = () => `n${++keySeq}`;

function toEdit(l: EstimateLine): EditLine {
  return {
    key: l.id, id: l.id, kind: l.kind, description: l.description, decision: l.decision,
    qty: String(l.qty ?? 1), hours: l.hours == null ? '' : String(l.hours), rate: centsToInput(l.rate_cents), price: centsToInput(l.unit_price_cents),
    amount: l.amount_cents == null ? '' : centsToInput(Math.abs(l.amount_cents)), cost: centsToInput(l.unit_cost_cents), supplier_id: l.supplier_id || '',
    part_number: l.part_number || '', brand: l.brand || '', condition: l.condition || '', quoted_at: l.quoted_at, quoted_by: l.quoted_by, eta: l.eta || '',
    core: centsToInput(l.core_charge_cents), no_warranty: l.no_warranty, is_added_work: l.is_added_work, alternates: l.alternates || [], ordered_at: l.ordered_at,
  };
}

function fromEdit(e: EditLine) {
  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(/[^0-9.]/g, '')));
  return {
    id: e.id, kind: e.kind, description: e.description, decision: e.decision,
    qty: num(e.qty) ?? 1, hours: e.kind === 'labour' ? num(e.hours) : null, rate_cents: e.kind === 'labour' ? parseMoneyToCents(e.rate) : null,
    unit_price_cents: e.kind === 'part' ? parseMoneyToCents(e.price) : null,
    amount_cents: ['supply', 'fee', 'sublet', 'discount'].includes(e.kind) ? (parseMoneyToCents(e.amount) == null ? null : (e.kind === 'discount' ? -Math.abs(parseMoneyToCents(e.amount)!) : parseMoneyToCents(e.amount))) : null,
    unit_cost_cents: e.kind === 'part' || e.kind === 'sublet' ? parseMoneyToCents(e.cost) : null,
    supplier_id: e.supplier_id || null, part_number: e.part_number || null, brand: e.brand || null, condition: e.condition || null,
    quoted_at: e.quoted_at, quoted_by: e.quoted_by, eta: e.eta || null, core_charge_cents: parseMoneyToCents(e.core),
    no_warranty: e.no_warranty, is_added_work: e.is_added_work, alternates: e.alternates, ordered_at: e.ordered_at,
  };
}

function priced(e: EditLine) {
  const f = fromEdit(e);
  return { ...f, qty: f.qty, hours: f.hours };
}

export default function EstimateTab({ d, act, reload }: { d: Detail; act: Act; reload: () => Promise<void> }) {
  const { siteId, openAuth, bump } = useShop();
  const [picked, setPicked] = useState<{ version: number; count: number } | null>(null);
  const [custView, setCustView] = useState(false);
  const [send, setSend] = useState<Estimate | null>(null);
  const [declineOpen, setDeclineOpen] = useState<Estimate | null>(null);
  const [preview, setPreview] = useState<Estimate | null>(null);

  const estimates = d.estimates;
  // A new version (or revision) resets the picker to the latest one.
  const version = picked && picked.count === estimates.length ? picked.version : null;
  const setVersion = (v: number) => setPicked({ version: v, count: estimates.length });
  const est = estimates.find(e => e.version === version) ?? estimates[estimates.length - 1] ?? null;

  if (!est) {
    return (
      <div className="empty">
        No estimate yet. When the tech records a voice note, Keystone drafts one here for you to price. Or start one yourself.
        <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button type="button" className="btn primary" onClick={() => act(() => api(siteId, `/jobs/${d.job.id}`, { body: { action: 'start_estimate' } }), 'Estimate v1 started.')}><Plus className="i" />Start the estimate</button>
        </div>
      </div>
    );
  }

  const approvedAuth = d.authorizations.filter(a => a.estimate_id === est.id && a.kind === 'estimate').sort((a, b) => b.authorized_at.localeCompare(a.authorized_at))[0];

  return (
    <>
      <div className="est-bar">
        <div className="row">
          {estimates.length > 1 ? (
            <Seg<string>
              label="Estimate version"
              value={String(est.version)}
              onChange={v => setVersion(Number(v))}
              options={estimates.map(x => ({ value: String(x.version), label: `v${x.version}${x.is_revision ? ' rev' : ''}${x.status === 'approved' ? ' · approved' : x.status === 'replaced' ? ' · replaced' : x.status === 'declined' ? ' · declined' : x.status === 'sent' ? ' · sent' : ' · draft'}` }))}
            />
          ) : (
            <Pill tone={est.status === 'approved' ? 'ok' : est.status === 'draft' ? 'neutral' : est.status === 'declined' ? 'crit' : 'info'}>
              v{est.version} · {est.status === 'sent' && est.sent_at ? `sent ${formatDate(est.sent_at.slice(0, 10))}` : est.status}
            </Pill>
          )}
          {est.is_revision && <Pill tone="warn">Revised estimate (extra work)</Pill>}
        </div>
        <Switch checked={custView} onChange={setCustView}>Customer view</Switch>
      </div>

      {est.needs_review && est.status === 'draft' && (
        <Callout icon={<Sparkles className="i" />}><b>Keystone drafted these lines from the tech’s voice note.</b> Add prices and the part sources, then send it. Hours and part numbers are only filled in where the tech said them.</Callout>
      )}

      {est.status === 'draft'
        ? <DraftEditor key={est.id} d={d} est={est} custView={custView} act={act} reload={reload} onSend={() => setSend(est)} onPreview={() => setPreview(est)} />
        : <ReadOnlyEstimate d={d} est={est} custView={custView} />}

      {est.status !== 'draft' && (
        <div className="est-foot">
          <div className="est-status">
            {est.status === 'approved' && approvedAuth && (
              <Callout tone="ok" icon={<Shield className="i" />}>
                <b>Approved {methodLabel(approvedAuth.method).toLowerCase()}</b> by {approvedAuth.authorized_by}{approvedAuth.phone && approvedAuth.method === 'phone' ? ` at ${approvedAuth.phone}` : ''} · {formatDateTime(approvedAuth.authorized_at)}{approvedAuth.taken_by ? ` · taken by ${approvedAuth.taken_by}` : ''}. {approvedAuth.parts_back ? 'Wants the old parts back.' : 'Doesn’t want the old parts.'}
                {approvedAuth.signature_path && <> <a className="note" href={shopUrl(siteId, '/files', { path: approvedAuth.signature_path })} target="_blank" rel="noopener noreferrer">View signature</a></>}
              </Callout>
            )}
            {est.status === 'replaced' && <Callout icon={<FileText className="i" />}><b>Replaced by a later version.</b> Kept on file exactly as given {est.sent_at ? formatDate(est.sent_at.slice(0, 10)) : ''}, so you can show what was quoted and when.</Callout>}
            {est.status === 'declined' && <Callout tone="warn" icon={<X className="i" />}><b>Declined {est.declined_at ? formatDate(est.declined_at.slice(0, 10)) : ''}.</b> {est.is_revision ? 'The bill stays at the approved estimate.' : 'Make a new version if they want to talk about it.'}</Callout>}
            {est.status === 'sent' && <Callout icon={<Send className="i" />}>Given {est.sent_at ? formatDateTime(est.sent_at) : ''}{est.sent_via ? ` (${est.sent_via === 'in_person' ? 'in person' : est.sent_via})` : ''} · good until {est.valid_until ? formatDate(est.valid_until) : '—'}. When the customer approves, the car moves to Approved and the approval is saved on this file.</Callout>}
            <div className="row">
              {est.status === 'sent' && <>
                <button type="button" className="btn primary" onClick={() => openAuth({ jobId: d.job.id, estimateId: est.id })}><Phone className="i" />Record approval</button>
                <button type="button" className="btn" onClick={() => setSend(est)}><Send className="i" />Send again</button>
                <button type="button" className="btn" onClick={() => setDeclineOpen(est)}><X className="i" />Customer declined</button>
              </>}
              <button type="button" className="btn" onClick={() => setPreview(est)}><FileText className="i" />Preview</button>
              <a className="btn" href={shopUrl(siteId, `/estimates/${est.id}/pdf`)} target="_blank" rel="noopener noreferrer"><Printer className="i" />PDF</a>
              {(est.status === 'sent' || est.status === 'declined' || est.status === 'replaced') && (
                <button type="button" className="btn ghost" onClick={() => act(() => api(siteId, `/estimates/${est.id}`, { body: { action: 'new_version' } }), 'New version started. The one you sent stays on file.')}><Copy className="i" />New version</button>
              )}
              {est.status === 'approved' && !d.invoice && (
                <button type="button" className="btn ghost" onClick={() => act(() => api(siteId, `/jobs/${d.job.id}`, { body: { action: 'revision' } }), 'Revised estimate started. Add the extra work, then get the OK.')}><Plus className="i" />Add extra work</button>
              )}
            </div>
          </div>
          <TotalsBlock lines={est.lines} taxBps={d.settings.tax_rate_bps} taxLabel={d.settings.tax_label} internal={!custView} />
        </div>
      )}
      {send && <SendEstimateModal d={d} est={send} onClose={() => setSend(null)} onSent={() => { setSend(null); reload(); bump(); }} />}
      {declineOpen && <DeclineModal d={d} est={declineOpen} onClose={() => setDeclineOpen(null)} act={act} />}
      {preview && (
        <Dialog wide title={`${preview.is_revision ? 'Revised estimate' : 'Estimate'} v${preview.version}`} eyebrow={`What ${d.customer.name} gets`} onClose={() => setPreview(null)}
          footLeft="Print or download from the PDF button."
          footer={<><button type="button" className="btn" onClick={() => setPreview(null)}>Close</button><a className="btn primary" href={shopUrl(siteId, `/estimates/${preview.id}/pdf`)} target="_blank" rel="noopener noreferrer"><Printer className="i" />Open PDF</a></>}>
          <div style={{ background: 'var(--surface-2)', margin: -16, padding: 16 }}>
            <EstimatePaper doc={buildEstimateDoc({ estimate: preview, job: d.job, customer: d.customer, vehicle: d.vehicle, settings: d.settings, site: d.site })} />
          </div>
        </Dialog>
      )}
    </>
  );
}

function TotalsBlock({ lines, taxBps, taxLabel, internal }: { lines: Parameters<typeof computeTotals>[0]; taxBps: number; taxLabel: string; internal: boolean }) {
  const t = computeTotals(lines, taxBps);
  return (
    <div className="totals">
      <div><span>Subtotal</span><span>{formatCents(t.subtotal_cents)}</span></div>
      <div><span>{taxLabel} {(taxBps / 100).toFixed(taxBps % 100 ? 2 : 0)}%</span><span>{formatCents(t.tax_cents)}</span></div>
      <div className="grand"><span>Total</span><span>{formatCents(t.total_cents)}</span></div>
      {internal && <>
        <div className="int"><span>Parts cost</span><span>{formatCents(t.cost_cents)}</span></div>
        <div className="int"><span>Gross profit</span><span>{formatCents(t.gross_profit_cents)} ({t.margin_pct}%)</span></div>
      </>}
    </div>
  );
}

function ReadOnlyEstimate({ d, est, custView }: { d: Detail; est: Estimate; custView: boolean }) {
  const internal = !custView;
  const supplierName = (id: string | null) => d.suppliers.find(s => s.id === id)?.name ?? '';
  const included = est.lines.filter(l => l.decision === 'include');
  const declined = est.lines.filter(l => l.decision === 'declined');
  return (
    <>
      <div className="table-wrap"><table className="t">
        <thead><tr><th>Item</th><th className="r">Qty</th><th className="r">Price</th>{internal && <><th className="r">Cost</th><th className="r">Margin</th></>}<th className="r">Total</th></tr></thead>
        <tbody>{included.map(l => {
          const total = lineTotalCents(l);
          const cost = lineCostCents(l);
          const margin = l.kind === 'part' && total > 0 && cost > 0 ? `${Math.round((1 - cost / total) * 100)}%` : '';
          return (
            <tr key={l.id}>
              <td>
                <span className={`kind ${KIND_TAG[l.kind].cls}`}>{KIND_TAG[l.kind].text}</span>{l.description}{l.is_added_work && <span className="kind extra" style={{ marginLeft: 6 }}>EXTRA</span>}
                {l.kind === 'part' && (
                  <div className="source">
                    {l.condition && <span>{CONDITION_LABELS[l.condition]}</span>}
                    {internal && l.supplier_id && <span><b>{supplierName(l.supplier_id)}</b>{l.part_number ? ` #${l.part_number}` : ''}</span>}
                    {!internal && l.part_number && <span>Part #{l.part_number}</span>}
                    {internal && l.quoted_at && <span>Quoted {formatDate(l.quoted_at)}{l.quoted_by ? ` by ${l.quoted_by}` : ''}</span>}
                    {internal && l.eta && <span>ETA {l.eta}</span>}
                    {internal && l.core_charge_cents ? <span>Core {formatCents(l.core_charge_cents)}</span> : null}
                    {l.no_warranty && <span>No warranty</span>}
                  </div>
                )}
                {internal && l.alternates?.map((a, i) => <span key={i} className="alt">Other option on file: {a.description}{a.supplier_id ? ` (${supplierName(a.supplier_id)})` : ''}{a.unit_price_cents != null ? ` · ${formatCents(a.unit_price_cents)} ea` : ''}{a.unit_cost_cents != null ? ` (cost ${formatCents(a.unit_cost_cents)})` : ''}</span>)}
              </td>
              <td className="r">{l.kind === 'labour' ? `${Number(l.hours ?? 0).toFixed(1)} h` : l.kind === 'part' ? `×${Number(l.qty)}` : ''}</td>
              <td className="r">{l.kind === 'labour' ? `${formatCents(l.rate_cents)}/h` : l.kind === 'part' ? (l.unit_price_cents == null ? <span className="needs">Needs price</span> : formatCents(l.unit_price_cents)) : ''}</td>
              {internal && <><td className="r">{cost ? formatCents(cost) : ''}</td><td className="r">{margin}</td></>}
              <td className="r">{formatCents(total)}</td>
            </tr>
          );
        })}</tbody>
      </table></div>
      {declined.length > 0 && <p className="note"><Clock className="i" /> Declined: {declined.map(l => `${l.description} (${formatCents(lineTotalCents(l))})`).join('; ')}</p>}
    </>
  );
}

function DraftEditor({ d, est, custView, act, reload, onSend, onPreview }: { d: Detail; est: Estimate; custView: boolean; act: Act; reload: () => Promise<void>; onSend: () => void; onPreview: () => void }) {
  const { siteId, openAuth, toast } = useShop();
  const [lines, setLines] = useState<EditLine[]>(() => est.lines.map(toEdit));
  const [validUntil, setValidUntil] = useState(est.valid_until || '');
  const [readyBy, setReadyBy] = useState(est.ready_by || '');
  const [notes, setNotes] = useState(est.notes || '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const internal = !custView;

  const set = (key: string, patch: Partial<EditLine>) => { setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l))); setDirty(true); };
  const add = (kind: LineKind) => {
    const base: EditLine = {
      key: nextKey(), kind, description: '', decision: 'include', qty: '1', hours: '', rate: kind === 'labour' ? centsToInput(d.settings.labour_rate_cents) : '',
      price: '', amount: '', cost: '', supplier_id: '', part_number: '', brand: '', condition: kind === 'part' ? 'new_non_oem' : '', quoted_at: null, quoted_by: null,
      eta: '', core: '', no_warranty: false, is_added_work: est.is_revision, alternates: [], ordered_at: null,
    };
    if (kind === 'supply') base.description = 'Shop supplies';
    if (kind === 'discount') base.description = 'Discount';
    setLines(ls => [...ls, base]);
    setDirty(true);
  };
  const move = (key: string, dir: -1 | 1) => {
    setLines(ls => { const i = ls.findIndex(l => l.key === key); const j = i + dir; if (i < 0 || j < 0 || j >= ls.length) return ls; const out = [...ls]; [out[i], out[j]] = [out[j], out[i]]; return out; });
    setDirty(true);
  };

  async function save(quiet = false): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      await api(siteId, `/estimates/${est.id}`, { method: 'PATCH', body: { lines: lines.map(fromEdit), valid_until: validUntil || null, ready_by: readyBy || null, notes } });
      setDirty(false);
      if (!quiet) toast('Estimate saved.');
      await reload();
      return true;
    } catch (err) {
      setError(err);
      return false;
    } finally {
      setSaving(false);
    }
  }

  const pricedLines = useMemo(() => lines.map(priced), [lines]);
  const needs = pricedLines.filter(l => l.decision === 'include' && lineNeedsPrice(l)).length;

  return (
    <>
      {error ? <RuleErrors error={error} /> : null}
      <div className="line-list">
        {lines.map((l, i) => (
          <LineRow key={l.key} l={l} index={i} count={lines.length} d={d} internal={internal} onChange={p => set(l.key, p)} onRemove={() => { setLines(ls => ls.filter(x => x.key !== l.key)); setDirty(true); }} onMove={dir => move(l.key, dir)} />
        ))}
        {!lines.length && <p className="note">No lines yet. Add the labour and parts below.</p>}
      </div>
      <div className="row">
        <button type="button" className="btn sm" onClick={() => add('labour')}><Plus className="i" />Labour</button>
        <button type="button" className="btn sm" onClick={() => add('part')}><Plus className="i" />Part</button>
        <button type="button" className="btn sm" onClick={() => add('supply')}><Plus className="i" />Shop supplies</button>
        <button type="button" className="btn sm" onClick={() => add('fee')}><Plus className="i" />Fee</button>
        <button type="button" className="btn sm" onClick={() => add('sublet')}><Plus className="i" />Sublet</button>
        <button type="button" className="btn sm" onClick={() => add('discount')}><Plus className="i" />Discount</button>
      </div>
      <div className="grid3">
        <Field label="Good until" hint={`Default ${d.settings.estimate_valid_days} days from sending.`} htmlFor="est-valid"><input id="est-valid" className="input" type="date" value={validUntil} onChange={e => { setValidUntil(e.target.value); setDirty(true); }} /></Field>
        <Field label="Work done by" required htmlFor="est-ready"><input id="est-ready" className="input" type="date" value={readyBy} onChange={e => { setReadyBy(e.target.value); setDirty(true); }} /></Field>
        <Field label="Note on the estimate" htmlFor="est-notes"><input id="est-notes" className="input" value={notes} onChange={e => { setNotes(e.target.value); setDirty(true); }} placeholder="e.g. Tires quoted with installation and balancing" /></Field>
      </div>
      <div className="est-foot">
        <div className="est-status">
          {needs > 0
            ? <Callout tone="warn" icon={<AlertTriangle className="i" />}><b>Draft.</b> {needs} line{needs === 1 ? '' : 's'} still need{needs === 1 ? 's' : ''} a price before you send it.</Callout>
            : <Callout icon={<FileText className="i" />}><b>Draft.</b> Not given to the customer yet. Sending it saves this version exactly as sent.</Callout>}
          <div className="row">
            <button type="button" className="btn primary" disabled={saving} onClick={async () => { if (!dirty || await save(true)) onSend(); }}><Send className="i" />Send for approval</button>
            <button type="button" className="btn" disabled={saving} onClick={async () => { if (!dirty || await save(true)) openAuth({ jobId: d.job.id, estimateId: est.id }); }}><Phone className="i" />Approve at the counter</button>
            <button type="button" className="btn" disabled={saving || !dirty} onClick={() => save()}>{saving ? 'Saving…' : dirty ? 'Save draft' : 'Saved'}</button>
            <button type="button" className="btn" onClick={async () => { if (!dirty || await save(true)) onPreview(); }}><FileText className="i" />Preview</button>
            <button type="button" className="btn ghost" onClick={() => { if (confirm(est.is_revision ? 'Delete this revised estimate? The extra work won’t be billed.' : 'Delete this draft?')) act(() => api(siteId, `/estimates/${est.id}`, { method: 'DELETE' }), 'Draft deleted.'); }}><Trash2 className="i" />Delete</button>
          </div>
        </div>
        <TotalsBlock lines={pricedLines} taxBps={d.settings.tax_rate_bps} taxLabel={d.settings.tax_label} internal={internal} />
      </div>
    </>
  );
}

function LineRow({ l, index, count, d, internal, onChange, onRemove, onMove }: {
  l: EditLine; index: number; count: number; d: Detail; internal: boolean;
  onChange: (p: Partial<EditLine>) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void;
}) {
  const [showAlt, setShowAlt] = useState(false);
  const p = priced(l);
  const total = lineTotalCents(p);
  const declined = l.decision === 'declined';
  const supplier = d.suppliers.find(s => s.id === l.supplier_id);
  return (
    <div className={`line-card${declined ? ' declined' : ''}`}>
      <div className="line-top">
        <span className={`kind ${KIND_TAG[l.kind].cls}`}>{KIND_TAG[l.kind].text}</span>
        {l.is_added_work && <span className="kind extra">EXTRA</span>}
        <input className="input line-desc" value={l.description} onChange={e => onChange({ description: e.target.value })} placeholder={l.kind === 'labour' ? 'What the work is' : l.kind === 'part' ? 'Part' : 'Description'} aria-label={`Line ${index + 1} description`} />
        <span className="line-total num">{lineNeedsPrice(p) ? <span className="needs">Needs price</span> : formatCents(total)}</span>
        <div className="line-tools">
          <button type="button" className="icon-btn" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
          <button type="button" className="icon-btn" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>↓</button>
          <button type="button" className="icon-btn" aria-label="Remove line" onClick={onRemove}><Trash2 className="i" /></button>
        </div>
      </div>
      <div className="line-fields">
        {l.kind === 'labour' && <>
          <label className="mini-field">Hours<input className="input sm num" inputMode="decimal" value={l.hours} onChange={e => onChange({ hours: e.target.value })} placeholder="1.0" /></label>
          <label className="mini-field">Rate / h<input className="input sm num" inputMode="decimal" value={l.rate} onChange={e => onChange({ rate: e.target.value })} /></label>
        </>}
        {l.kind === 'part' && <>
          <label className="mini-field">Qty<input className="input sm num" inputMode="decimal" value={l.qty} onChange={e => onChange({ qty: e.target.value })} /></label>
          <label className="mini-field">Price each<input className="input sm num" inputMode="decimal" value={l.price} onChange={e => onChange({ price: e.target.value })} placeholder="0.00" /></label>
          {internal && <label className="mini-field">Cost each<input className="input sm num" inputMode="decimal" value={l.cost} onChange={e => onChange({ cost: e.target.value, quoted_at: null })} placeholder="0.00" /></label>}
          <label className="mini-field">Condition
            <select className="input sm" value={l.condition} onChange={e => onChange({ condition: e.target.value as PartCondition })}>
              <option value="">Pick one</option>
              {CONDITION_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          {internal && <>
            <label className="mini-field">Supplier
              <select className="input sm" value={l.supplier_id} onChange={e => onChange({ supplier_id: e.target.value, quoted_at: null })}>
                <option value="">Shop stock</option>
                {d.suppliers.filter(s => !s.archived_at || s.id === l.supplier_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="mini-field">Part #<input className="input sm mono" value={l.part_number} onChange={e => onChange({ part_number: e.target.value })} /></label>
            <label className="mini-field">Brand<input className="input sm" value={l.brand} onChange={e => onChange({ brand: e.target.value })} /></label>
            <label className="mini-field">ETA<input className="input sm" value={l.eta} onChange={e => onChange({ eta: e.target.value })} placeholder="Tomorrow AM" /></label>
            <label className="mini-field">Core<input className="input sm num" inputMode="decimal" value={l.core} onChange={e => onChange({ core: e.target.value })} placeholder="0.00" /></label>
          </>}
        </>}
        {(l.kind === 'supply' || l.kind === 'fee' || l.kind === 'discount') && (
          <label className="mini-field">{l.kind === 'discount' ? 'Discount' : 'Amount'}<input className="input sm num" inputMode="decimal" value={l.amount} onChange={e => onChange({ amount: e.target.value })} placeholder="0.00" /></label>
        )}
        {l.kind === 'sublet' && <>
          <label className="mini-field">Charge<input className="input sm num" inputMode="decimal" value={l.amount} onChange={e => onChange({ amount: e.target.value })} placeholder="0.00" /></label>
          {internal && <label className="mini-field">Cost<input className="input sm num" inputMode="decimal" value={l.cost} onChange={e => onChange({ cost: e.target.value })} placeholder="0.00" /></label>}
          {internal && <label className="mini-field">Done by
            <select className="input sm" value={l.supplier_id} onChange={e => onChange({ supplier_id: e.target.value })}>
              <option value="">—</option>
              {d.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>}
        </>}
        <label className="mini-check"><input type="checkbox" checked={declined} onChange={e => onChange({ decision: e.target.checked ? 'declined' : 'include' })} /> Declined</label>
        {l.kind === 'part' && <label className="mini-check"><input type="checkbox" checked={l.no_warranty} onChange={e => onChange({ no_warranty: e.target.checked })} /> No warranty (fluid, filter, light, tire, battery)</label>}
      </div>
      {internal && l.kind === 'part' && (
        <div className="source">
          {supplier && (l.cost || l.price) ? <span><b>{supplier.name}</b>{l.part_number ? ` #${l.part_number}` : ''}</span> : !l.supplier_id && l.price ? <span>From shop stock</span> : <span className="needs">No quote yet.</span>}
          {l.quoted_at && <span>Quoted {formatDate(l.quoted_at)}{l.quoted_by ? ` by ${l.quoted_by}` : ''}</span>}
          {p.unit_price_cents && p.unit_cost_cents ? <span>Margin {Math.round((1 - p.unit_cost_cents / p.unit_price_cents) * 100)}%</span> : null}
          {l.condition && <span>{CONDITION_LABELS[l.condition]}</span>}
        </div>
      )}
      {internal && l.kind === 'part' && (
        <div className="alts">
          {l.alternates.map((a, i) => (
            <span key={i} className="alt">
              Other option: {a.description}{a.supplier_id ? ` (${d.suppliers.find(s => s.id === a.supplier_id)?.name ?? ''})` : ''}{a.unit_price_cents != null ? ` · ${formatCents(a.unit_price_cents)} ea` : ''}{a.unit_cost_cents != null ? ` (cost ${formatCents(a.unit_cost_cents)})` : ''}
              <button type="button" className="linkbtn" onClick={() => {
                // Swap: make the alternate the main quote and keep the current one as the other option.
                const current: Alternate = { description: l.description, supplier_id: l.supplier_id || null, part_number: l.part_number || null, condition: (l.condition || null) as PartCondition | null, unit_price_cents: parseMoneyToCents(l.price), unit_cost_cents: parseMoneyToCents(l.cost), note: null };
                const rest = l.alternates.filter((_, j) => j !== i);
                onChange({ description: a.description, supplier_id: a.supplier_id || '', part_number: a.part_number || '', condition: (a.condition || l.condition) as PartCondition | '', price: centsToInput(a.unit_price_cents ?? null), cost: centsToInput(a.unit_cost_cents ?? null), quoted_at: null, alternates: [current, ...rest] });
              }}>Use this</button>
              <button type="button" className="linkbtn" onClick={() => onChange({ alternates: l.alternates.filter((_, j) => j !== i) })}>Remove</button>
            </span>
          ))}
          {showAlt ? <AltForm d={d} onCancel={() => setShowAlt(false)} onAdd={a => { onChange({ alternates: [...l.alternates, a] }); setShowAlt(false); }} /> : (
            <button type="button" className="linkbtn" onClick={() => setShowAlt(true)}>+ Save another supplier’s quote</button>
          )}
        </div>
      )}
    </div>
  );
}

function AltForm({ d, onAdd, onCancel }: { d: Detail; onAdd: (a: Alternate) => void; onCancel: () => void }) {
  const [a, setA] = useState({ description: '', supplier_id: '', part_number: '', price: '', cost: '', condition: 'new_non_oem' });
  return (
    <div className="alt-form">
      <input className="input sm" placeholder="Part (e.g. OEM coil)" value={a.description} onChange={e => setA({ ...a, description: e.target.value })} />
      <select className="input sm" value={a.supplier_id} onChange={e => setA({ ...a, supplier_id: e.target.value })}>
        <option value="">Supplier</option>
        {d.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input className="input sm mono" placeholder="Part #" value={a.part_number} onChange={e => setA({ ...a, part_number: e.target.value })} />
      <input className="input sm num" placeholder="Price" value={a.price} onChange={e => setA({ ...a, price: e.target.value })} />
      <input className="input sm num" placeholder="Cost" value={a.cost} onChange={e => setA({ ...a, cost: e.target.value })} />
      <select className="input sm" value={a.condition} onChange={e => setA({ ...a, condition: e.target.value })}>
        {CONDITION_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      <button type="button" className="btn sm primary" disabled={!a.description.trim()} onClick={() => onAdd({ description: a.description.trim(), supplier_id: a.supplier_id || null, part_number: a.part_number || null, condition: a.condition as PartCondition, unit_price_cents: parseMoneyToCents(a.price), unit_cost_cents: parseMoneyToCents(a.cost), note: `Quoted ${new Date().toLocaleDateString('en-CA')}` })}>Save</button>
      <button type="button" className="btn sm ghost" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function SendEstimateModal({ d, est, onClose, onSent }: { d: Detail; est: Estimate; onClose: () => void; onSent: () => void }) {
  const { siteId, toast } = useShop();
  const [via, setVia] = useState<'email' | 'in_person' | 'text' | 'link'>(d.customer.email ? 'email' : 'in_person');
  const [to, setTo] = useState(d.customer.email || '');
  const [message, setMessage] = useState('');
  const [validUntil, setValidUntil] = useState(est.valid_until || '');
  const [readyBy, setReadyBy] = useState(est.ready_by || '');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const total = computeTotals(est.lines, d.settings.tax_rate_bps).total_cents;
  const first = d.customer.name.split(' ')[0];

  async function go() {
    setBusy(true); setError(null);
    try {
      const res = await api<{ url: string; emailed: boolean }>(siteId, `/estimates/${est.id}`, { body: { action: 'send', via, to, message, valid_until: validUntil || null, ready_by: readyBy || null } });
      setUrl(res.url);
      if (via === 'email') { toast(`Emailed to ${to} with the PDF and an approval link.`); onSent(); }
      if (via === 'in_person') { window.open(shopUrl(siteId, `/estimates/${est.id}/pdf`), '_blank'); toast('Marked as given in person. Print the PDF and hand it over.'); onSent(); }
      if (via === 'text' && d.customer.phone) { window.location.href = `sms:${d.customer.phone}?&body=${encodeURIComponent(`Hi ${first}, here’s the estimate for your car from ${d.site.name}: ${res.url}`)}`; }
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  return (
    <Dialog title={est.status === 'sent' ? 'Send the estimate again' : 'Send for approval'} eyebrow={`${est.is_revision ? 'Revised estimate' : 'Estimate'} v${est.version} · ${formatCents(total)}`} onClose={onClose}
      footer={url && (via === 'link' || via === 'text') ? <button type="button" className="btn primary" onClick={onSent}>Done</button> : <>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn primary" disabled={busy} onClick={go}><Send className="i" />{busy ? 'Sending…' : via === 'email' ? 'Email it' : via === 'in_person' ? 'Print and hand it over' : via === 'text' ? 'Text the link' : 'Get the link'}</button>
      </>}>
      {error ? <RuleErrors error={error} /> : null}
      <Seg label="How" value={via} onChange={setVia} options={[
        { value: 'email', label: 'Email' }, { value: 'in_person', label: 'In person (print)' }, { value: 'text', label: 'Text a link' }, { value: 'link', label: 'Copy a link' },
      ]} />
      {via === 'email' && <>
        <Field label="Email to" required htmlFor="se-to"><input id="se-to" className="input" type="email" value={to} onChange={e => setTo(e.target.value)} /></Field>
        <Field label="Message" hint="Leave blank for the standard note." htmlFor="se-msg"><textarea id="se-msg" className="input" value={message} onChange={e => setMessage(e.target.value)} placeholder={`Here’s the estimate for your car. You can approve it (or pick the items you want) online, or reply to this email.`} /></Field>
      </>}
      {est.status === 'draft' && (
        <div className="grid2">
          <Field label="Good until" htmlFor="se-valid"><input id="se-valid" className="input" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></Field>
          <Field label="Work done by" required htmlFor="se-ready"><input id="se-ready" className="input" type="date" value={readyBy} onChange={e => setReadyBy(e.target.value)} /></Field>
        </div>
      )}
      {url && (
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input className="input mono" readOnly value={url} onFocus={e => e.currentTarget.select()} />
          <button type="button" className="btn" onClick={() => { navigator.clipboard?.writeText(url); toast('Link copied.'); }}><Copy className="i" />Copy</button>
        </div>
      )}
      <p className="note">The customer sees the estimate with every item Ontario requires and can approve it online, choosing the lines they want. Their approval is saved on this file with the time and device.</p>
    </Dialog>
  );
}

function DeclineModal({ d, est, onClose, act }: { d: Detail; est: Estimate; onClose: () => void; act: Act }) {
  const { siteId } = useShop();
  const [reason, setReason] = useState('');
  return (
    <Dialog title="Customer declined" eyebrow={`${est.is_revision ? 'Revised estimate' : 'Estimate'} v${est.version}`} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button type="button" className="btn primary" onClick={async () => { if (await act(() => api(siteId, `/estimates/${est.id}`, { body: { action: 'decline', reason, by: d.customer.name } }), est.is_revision ? 'Extra work declined. The bill stays at the approved estimate.' : 'Marked declined. The car moves to Done for pickup.')) onClose(); }}>Save</button>
    </>}>
      <Field label="What they said" htmlFor="dec-r"><textarea id="dec-r" className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Too expensive right now; will do it in the spring." /></Field>
      {!est.is_revision && d.job.estimate_fee_cents > 0 && d.job.estimate_fee_agreed_at && <p className="note">The agreed estimate fee ({formatCents(d.job.estimate_fee_cents)}) can be invoiced after this.</p>}
      {est.is_revision && <p className="note">The extra work stays off the bill. If it was already done, it can’t be charged.</p>}
      <p className="note"><Mic className="i" /> Declined lines stay on file as recommendations for next time.</p>
    </Dialog>
  );
}
