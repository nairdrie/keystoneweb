'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Camera, Check, FileText, Landmark, Pencil, Plus, RefreshCw, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react';
import { centsToInput, formatCents, parseMoneyToCents } from '@/lib/shop/money';
import { formatDate } from '@/lib/shop/dates';
import type { Supplier, SupplierBill } from '@/lib/shop/types';
import type { CoreOwed, SupplierTab, UnbilledPart } from '@/lib/shop/reports';
import type { OpenJobOption } from '@/lib/shop/views';
import { api, errorText, shopUrl } from './api';
import { useShop } from './ShopContext';
import { Dialog, Field, RuleErrors } from './ui';

interface PartsData {
  bills: SupplierBill[];
  suppliers: Supplier[];
  jobs: OpenJobOption[];
  ro_by_job: Record<string, number>;
  tabs: SupplierTab[];
  cores: CoreOwed[];
  unbilled: UnbilledPart[];
}

export default function PartsView() {
  const { siteId, toast, bump, refresh: refreshWs, href } = useShop();
  const [data, setData] = useState<PartsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<{ id: number; name: string; preview: string | null }[]>([]);
  const [over, setOver] = useState(false);
  const [manual, setManual] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { setData(await api<PartsData>(siteId, '/bills')); setError(null); } catch (err) { setError(errorText(err)); }
  }, [siteId]);
  useEffect(() => { load(); }, [load]);
  const after = useCallback(async (msg?: string) => { if (msg) toast(msg); await load(); refreshWs(); bump(); }, [load, refreshWs, bump, toast]);

  async function upload(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const id = Date.now() + Math.random();
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      setReading(r => [...r, { id, name: file.name, preview }]);
      const form = new FormData();
      form.append('file', file);
      try {
        const bill = await api<SupplierBill>(siteId, '/bills', { form });
        const supplier = data?.suppliers.find(s => s.id === bill.supplier_id)?.name || bill.supplier_name_raw || 'Supplier';
        const job = data?.jobs.find(j => j.id === bill.suggested_job_id);
        toast(bill.ai_error ? bill.ai_error : `Read ${supplier} invoice ${bill.invoice_number || ''}: ${bill.lines.length} line${bill.lines.length === 1 ? '' : 's'}.${job ? ` It looks like it’s for ${job.label.split(' · ').slice(1).join(' · ')}.` : ''}`, bill.ai_error ? 'warn' : undefined);
      } catch (err) {
        toast(errorText(err), 'warn');
      } finally {
        setReading(r => r.filter(x => x.id !== id));
        if (preview) URL.revokeObjectURL(preview);
        await after();
      }
    }
  }

  if (error && !data) return <div className="empty">{error}</div>;
  if (!data) return <div className="empty">Loading parts…</div>;
  const pile = data.bills.filter(b => b.status === 'needs_match');
  const filed = data.bills.filter(b => b.status !== 'needs_match').slice(0, 25);
  const supplierName = (b: SupplierBill) => data.suppliers.find(s => s.id === b.supplier_id)?.name || b.supplier_name_raw || 'Unknown supplier';

  return (
    <>
      <div className="view-head">
        <div><h2>Parts</h2><p>The pile of supplier invoices, sorted. Every invoice gets matched to a car, so nothing gets lost and every part ends up on a customer’s bill.</p></div>
      </div>
      <div className="two">
        <div className="stack">
          <div
            className={`drop${over ? ' over' : ''}`}
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
          >
            <span className="drop-ico"><Camera className="i" /></span>
            <div><b>Snap or upload a parts invoice</b><p>Keystone reads the supplier, invoice number and every line, then finds the car it belongs to. Works from a phone when the driver drops parts off. Drop files here too.</p></div>
            <div className="row">
              <button type="button" className="btn primary" onClick={() => fileRef.current?.click()}><Upload className="i" />Upload or take a photo</button>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={e => { if (e.target.files?.length) upload(e.target.files); e.target.value = ''; }} />
              <button type="button" className="btn" onClick={() => setManual(true)}><Pencil className="i" />Type one in</button>
            </div>
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Needs a job · {pile.length + reading.length}</p>
            {reading.map(r => (
              <article key={r.id} className="pile-card">
                <div className="receipt scan">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.preview ? <img src={r.preview} alt="Uploaded invoice" /> : <><i className="dark w70" /><i /><i className="w85" /><i className="w50" /><i /><i className="w70" /></>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}><b>Reading invoice…</b><div className="skel" style={{ width: '60%' }} /><div className="skel" style={{ width: '85%' }} /><div className="skel" style={{ width: '40%' }} /></div>
              </article>
            ))}
            {pile.map(b => <PileCard key={b.id} bill={b} data={data} onChanged={after} />)}
            {!pile.length && !reading.length && <div className="panel empty"><Check className="i" /> All caught up. Every supplier invoice is matched to a car or to shop stock.</div>}
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title"><Check className="i" />Filed recently</span><span className="note">{filed.length}</span></div>
            <div className="table-wrap"><table className="t">
              <thead><tr><th>Invoice</th><th>Supplier</th><th>Date</th><th>Went to</th><th className="r">Total</th></tr></thead>
              <tbody>{filed.map(b => {
                const jobIds = [...new Set(b.lines.map(l => l.job_id).filter(Boolean))] as string[];
                return (
                  <tr key={b.id}>
                    <td className="mono">{b.file_path ? <a href={shopUrl(siteId, '/files', { path: b.file_path })} target="_blank" rel="noopener noreferrer">{b.invoice_number || 'No number'}</a> : b.invoice_number || 'No number'}</td>
                    <td>{supplierName(b)}</td>
                    <td>{formatDate((b.invoice_date || b.created_at).slice(0, 10))}</td>
                    <td>{b.status === 'stock' ? 'Shop stock' : b.status === 'returned' ? 'Sent back' : jobIds.map(id => <Link key={id} href={href(`/jobs/${id}`)} style={{ marginRight: 6 }}>RO-{data.ro_by_job[id] ?? '?'}</Link>)}</td>
                    <td className="r">{b.total_cents != null ? formatCents(b.total_cents) : '—'}</td>
                  </tr>
                );
              })}</tbody>
            </table>{!filed.length && <div className="empty">Nothing filed yet.</div>}</div>
          </div>
        </div>
        <div className="stack">
          <SupplierTabs data={data} onChanged={after} />
          <div className="panel">
            <div className="panel-head"><span className="panel-title"><RotateCcw className="i" />Cores owed back to you</span><span className="note num">{formatCents(data.cores.reduce((s, c) => s + c.amount_cents, 0))}</span></div>
            <div className="panel-body stat-list">
              {data.cores.map(c => (
                <div key={c.line_id}>
                  <span>{c.description}<br /><span className="note">{c.job_id ? `RO-${data.ro_by_job[c.job_id] ?? '?'} → ` : ''}{c.supplier}{c.bill_invoice_number ? ` · ${c.bill_invoice_number}` : ''}</span></span>
                  <span className="row" style={{ flexWrap: 'nowrap' }}><b>{formatCents(c.amount_cents)}</b><button type="button" className="btn sm" onClick={async () => { try { await api(siteId, '/bills/actions', { body: { action: 'core', line_id: c.line_id, returned: true } }); after('Core marked returned.'); } catch (err) { toast(errorText(err), 'warn'); } }}>Returned</button></span>
                </div>
              ))}
              {!data.cores.length && <p className="note">No cores waiting to go back.</p>}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title"><AlertTriangle className="i" />Bought but never billed</span><span className="note num">{formatCents(data.unbilled.reduce((s, u) => s + u.cost_cents, 0))}</span></div>
            <div className="panel-body stat-list">
              {data.unbilled.map(u => (
                <div key={u.line_id}>
                  <span><span className="mono">{u.bill_invoice_number || '—'}</span> · {formatDate(u.date)} · {u.description}<br /><span className="note">{u.reason}{u.job_id ? <> · <Link href={href(`/jobs/${u.job_id}`, { tab: 'invoice' })}>Open job</Link></> : null}</span></span>
                  <b>{formatCents(u.cost_cents)}</b>
                </div>
              ))}
              {!data.unbilled.length && <p className="note">Every part you bought is on a customer’s invoice or filed as stock.</p>}
              <p className="note" style={{ paddingTop: 8 }}>Parts you paid for that aren’t on any customer’s invoice. Money that used to slip through the pile.</p>
            </div>
          </div>
        </div>
      </div>
      {manual && <BillEditor data={data} bill={null} onClose={() => setManual(false)} onSaved={() => { setManual(false); after('Supplier invoice added to the pile.'); }} />}
    </>
  );
}

function PileCard({ bill, data, onChanged }: { bill: SupplierBill; data: PartsData; onChanged: (msg?: string) => Promise<void> }) {
  const { siteId, toast } = useShop();
  const [target, setTarget] = useState(bill.suggested_job_id || (bill.lines.length ? '' : ''));
  const [editing, setEditing] = useState(false);
  const [split, setSplit] = useState(false);
  const [lineJobs, setLineJobs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const supplier = data.suppliers.find(s => s.id === bill.supplier_id)?.name || bill.supplier_name_raw || 'Unknown supplier';
  const suggested = data.jobs.find(j => j.id === bill.suggested_job_id);
  const sub = bill.subtotal_cents ?? bill.lines.filter(l => !l.is_core).reduce((s, l) => s + l.line_total_cents, 0);

  async function match() {
    setBusy(true);
    try {
      if (target === 'stock' || target === 'return') {
        await api(siteId, `/bills/${bill.id}`, { body: { action: 'match', target } });
        await onChanged(target === 'stock' ? `${bill.invoice_number || 'Invoice'} filed as shop stock. It still counts on the ${supplier} tab.` : `${bill.invoice_number || 'Invoice'} marked to go back to ${supplier}.`);
      } else {
        const job = data.jobs.find(j => j.id === target);
        await api(siteId, `/bills/${bill.id}`, { body: { action: 'match', target: 'job', job_id: target || null, line_jobs: split ? Object.fromEntries(Object.entries(lineJobs).map(([k, v]) => [k, v === 'none' ? null : v])) : undefined } });
        await onChanged(`${bill.invoice_number || 'Invoice'} matched${job ? ` to RO-${job.ro_number}` : ''}. Its parts are on that job at cost, ready for the invoice.`);
      }
    } catch (err) { toast(errorText(err), 'warn'); } finally { setBusy(false); }
  }

  return (
    <article className="pile-card">
      <a className="receipt" href={bill.file_path ? shopUrl(siteId, '/files', { path: bill.file_path }) : undefined} target="_blank" rel="noopener noreferrer">
        <i className="dark w70" /><i /><i className="w85" /><i className="w50" /><i /><i className="w70" /><i className="w85" /><i className="w50" />
        {bill.handwritten_note && <span className="scrawl">{bill.handwritten_note}</span>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {bill.file_path && bill.file_mime?.startsWith('image/') && <img src={shopUrl(siteId, '/files', { path: bill.file_path })} alt="Supplier invoice" loading="lazy" />}
        {bill.file_mime === 'application/pdf' && <span className="receipt-badge"><FileText className="i" />PDF</span>}
      </a>
      <div style={{ minWidth: 0 }}>
        <div className="pc-top">
          <b>{supplier}</b>
          {bill.invoice_number && <span className="mono">{bill.invoice_number}</span>}
          {bill.invoice_date && <span>{formatDate(bill.invoice_date)}</span>}
          <span className="num">{formatCents(sub)}{bill.tax_cents ? ` + tax ${formatCents(bill.tax_cents)}` : ''}</span>
          {!bill.supplier_id && bill.supplier_name_raw && <span className="needs">New supplier</span>}
        </div>
        {bill.ai_error && <p className="note needs" style={{ marginTop: 4 }}>{bill.ai_error}</p>}
        {bill.lines.length > 0 ? (
          <div className="table-wrap"><table className="t mini">
            <thead><tr><th>Line</th><th>Part #</th><th className="r">Qty</th><th className="r">Cost</th>{split && <th>Car</th>}</tr></thead>
            <tbody>{bill.lines.map(l => (
              <tr key={l.id}>
                <td>{l.description}{l.is_core && <span className="kind extra" style={{ marginLeft: 6 }}>CORE</span>}</td>
                <td className="mono">{l.part_number || ''}</td><td className="r">{Number(l.qty)}</td><td className="r">{formatCents(l.line_total_cents)}</td>
                {split && <td><select className="input sm" value={lineJobs[l.id] ?? target} onChange={e => setLineJobs({ ...lineJobs, [l.id]: e.target.value })}>
                  <option value="none">Stock</option>
                  {data.jobs.map(j => <option key={j.id} value={j.id}>RO-{j.ro_number}</option>)}
                </select></td>}
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="note" style={{ marginTop: 6 }}>No lines yet. {bill.ai_error ? '' : 'Add them with Edit.'}</p>}
        {(suggested || bill.suggestion_reason) && (
          <div className="suggest">
            <div className="row"><Sparkles className="i" /><span>{suggested ? <>Looks like <b>{suggested.label}</b></> : <b>Looks like shop stock</b>}</span></div>
            {bill.suggestion_reason && <p>{bill.suggestion_reason}</p>}
          </div>
        )}
        {editing ? <BillEditor data={data} bill={bill} inline onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged('Saved.'); }} /> : (
          <div className="pc-actions">
            <label className="sr" htmlFor={`sel-${bill.id}`}>Match to</label>
            <select className="input sm" id={`sel-${bill.id}`} value={target} onChange={e => setTarget(e.target.value)}>
              <option value="">Pick the car…</option>
              {data.jobs.map(j => <option key={j.id} value={j.id}>{j.label}</option>)}
              <option value="stock">Shop stock (no customer)</option>
              <option value="return">Wrong part, send it back</option>
            </select>
            <button type="button" className="btn primary sm" disabled={busy || (!target && !split) || (!bill.lines.length && target !== 'stock' && target !== 'return')} onClick={match}><Check className="i" />{busy ? 'Filing…' : 'Match'}</button>
            {bill.lines.length > 1 && <button type="button" className="btn sm ghost" onClick={() => setSplit(s => !s)}>{split ? 'One car' : 'Split lines'}</button>}
            <button type="button" className="btn sm ghost" onClick={() => setEditing(true)}><Pencil className="i" />Edit</button>
            {bill.file_path && <button type="button" className="btn sm ghost" disabled={busy} onClick={async () => { setBusy(true); try { await api(siteId, `/bills/${bill.id}`, { body: { action: 'reread' } }); await onChanged('Read it again.'); } catch (err) { toast(errorText(err), 'warn'); } finally { setBusy(false); } }}><RefreshCw className="i" />Read again</button>}
            <button type="button" className="btn sm ghost" aria-label="Delete" onClick={async () => { if (!confirm('Delete this supplier invoice? Only for a duplicate or a mistake.')) return; try { await api(siteId, `/bills/${bill.id}`, { method: 'DELETE' }); await onChanged('Deleted.'); } catch (err) { toast(errorText(err), 'warn'); } }}><Trash2 className="i" /></button>
          </div>
        )}
      </div>
    </article>
  );
}

interface EditBillLine { key: string; description: string; part_number: string; qty: string; unit: string; total: string; is_core: boolean; job_id: string | null }

function BillEditor({ data, bill, inline, onClose, onSaved }: { data: PartsData; bill: SupplierBill | null; inline?: boolean; onClose: () => void; onSaved: () => void }) {
  const { siteId } = useShop();
  const [supplierId, setSupplierId] = useState(bill?.supplier_id || (bill?.supplier_name_raw ? 'new' : ''));
  const [newName, setNewName] = useState(bill?.supplier_name_raw || '');
  const [number, setNumber] = useState(bill?.invoice_number || '');
  const [date, setDate] = useState(bill?.invoice_date || '');
  const [subtotal, setSubtotal] = useState(centsToInput(bill?.subtotal_cents ?? null));
  const [tax, setTax] = useState(centsToInput(bill?.tax_cents ?? null));
  const [total, setTotal] = useState(centsToInput(bill?.total_cents ?? null));
  const [note, setNote] = useState(bill?.handwritten_note || '');
  const [lines, setLines] = useState<EditBillLine[]>(() => (bill?.lines || []).map(l => ({
    key: l.id, description: l.description, part_number: l.part_number || '', qty: String(l.qty), unit: centsToInput(l.unit_cost_cents), total: centsToInput(l.line_total_cents), is_core: l.is_core, job_id: l.job_id,
  })));
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setError(null);
    const body = {
      ...(supplierId === 'new' ? { create_supplier: true, supplier_name: newName } : { supplier_id: supplierId || null }),
      invoice_number: number, invoice_date: date || null, subtotal_cents: parseMoneyToCents(subtotal), tax_cents: parseMoneyToCents(tax), total_cents: parseMoneyToCents(total), handwritten_note: note,
      lines: lines.map(l => {
        const qty = Number(l.qty) || 1;
        const unit = parseMoneyToCents(l.unit) ?? 0;
        return { description: l.description, part_number: l.part_number, qty, unit_cost_cents: unit, line_total_cents: parseMoneyToCents(l.total) ?? Math.round(qty * unit), is_core: l.is_core, job_id: l.job_id };
      }),
    };
    try {
      if (bill) await api(siteId, `/bills/${bill.id}`, { method: 'PATCH', body });
      else await api(siteId, '/bills', { body });
      onSaved();
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  const form = (
    <div className="bill-editor">
      {error ? <RuleErrors error={error} /> : null}
      <div className="grid3">
        <Field label="Supplier" htmlFor={`be-sup-${bill?.id ?? 'new'}`}>
          <select id={`be-sup-${bill?.id ?? 'new'}`} className="input" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
            <option value="">Unknown</option>
            {data.suppliers.filter(s => !s.archived_at).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="new">New supplier…</option>
          </select>
        </Field>
        {supplierId === 'new' && <Field label="Supplier name" htmlFor="be-new"><input id="be-new" className="input" value={newName} onChange={e => setNewName(e.target.value)} /></Field>}
        <Field label="Invoice #" htmlFor="be-num"><input id="be-num" className="input mono" value={number} onChange={e => setNumber(e.target.value)} /></Field>
        <Field label="Date" htmlFor="be-date"><input id="be-date" className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Subtotal" htmlFor="be-sub"><input id="be-sub" className="input num" value={subtotal} onChange={e => setSubtotal(e.target.value)} /></Field>
        <Field label="Tax (HST paid)" htmlFor="be-tax"><input id="be-tax" className="input num" value={tax} onChange={e => setTax(e.target.value)} /></Field>
        <Field label="Total" htmlFor="be-total"><input id="be-total" className="input num" value={total} onChange={e => setTotal(e.target.value)} /></Field>
      </div>
      <Field label="Note on the paper" htmlFor="be-note"><input id="be-note" className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. “Smith Jetta”" /></Field>
      <div className="table-wrap"><table className="t mini">
        <thead><tr><th>Line</th><th>Part #</th><th className="r">Qty</th><th className="r">Unit cost</th><th className="r">Line total</th><th>Core</th><th /></tr></thead>
        <tbody>{lines.map((l, i) => (
          <tr key={l.key}>
            <td><input className="input sm" style={{ width: '100%' }} value={l.description} onChange={e => setLines(ls => ls.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} /></td>
            <td><input className="input sm mono" style={{ width: 100 }} value={l.part_number} onChange={e => setLines(ls => ls.map((x, j) => (j === i ? { ...x, part_number: e.target.value } : x)))} /></td>
            <td className="r"><input className="input sm num" style={{ width: 52 }} value={l.qty} onChange={e => setLines(ls => ls.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} /></td>
            <td className="r"><input className="input sm num" style={{ width: 80 }} value={l.unit} onChange={e => setLines(ls => ls.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} /></td>
            <td className="r"><input className="input sm num" style={{ width: 80 }} value={l.total} placeholder="auto" onChange={e => setLines(ls => ls.map((x, j) => (j === i ? { ...x, total: e.target.value } : x)))} /></td>
            <td><input type="checkbox" checked={l.is_core} onChange={e => setLines(ls => ls.map((x, j) => (j === i ? { ...x, is_core: e.target.checked } : x)))} aria-label="Core charge" /></td>
            <td><button type="button" className="icon-btn" aria-label="Remove line" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}><Trash2 className="i" /></button></td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className="row"><button type="button" className="btn sm" onClick={() => setLines(ls => [...ls, { key: `n${Date.now()}`, description: '', part_number: '', qty: '1', unit: '', total: '', is_core: false, job_id: null }])}><Plus className="i" />Add a line</button></div>
      {inline && <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn sm" onClick={onClose}>Cancel</button><button type="button" className="btn sm primary" disabled={busy} onClick={save}>Save</button></div>}
    </div>
  );
  if (inline) return form;
  return (
    <Dialog wide title="Type in a supplier invoice" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="button" className="btn primary" disabled={busy} onClick={save}>Add to the pile</button></>}>
      {form}
    </Dialog>
  );
}

function SupplierTabs({ data, onChanged }: { data: PartsData; onChanged: (msg?: string) => Promise<void> }) {
  const [open, setOpen] = useState<string | null>(null);
  const [paying, setPaying] = useState<SupplierTab | null>(null);
  return (
    <div className="panel">
      <div className="panel-head"><span className="panel-title"><Landmark className="i" />Supplier tabs</span><span className="note">Unpaid</span></div>
      {data.tabs.map(t => {
        const s = data.suppliers.find(x => x.id === t.supplier_id);
        const key = t.supplier_id || t.name;
        return (
          <div key={key} className="sup">
            <div className="sup-top"><b>{t.name}</b><span className="sup-bal">{formatCents(t.unpaid_cents)}</span></div>
            {s && (s.account_number || s.rep_name || s.phone) && <small>{[s.account_number && `Acct ${s.account_number}`, s.rep_name, s.phone].filter(Boolean).join(' · ')}</small>}
            <small>{[s?.terms, `${t.unpaid_count} unpaid invoice${t.unpaid_count === 1 ? '' : 's'}`, t.oldest && `oldest ${formatDate(t.oldest)}`].filter(Boolean).join(' · ')}</small>
            <div className="row">
              <button type="button" className="btn sm" onClick={() => setOpen(open === key ? null : key)}>{open === key ? 'Hide' : 'Check'} their statement</button>
              <button type="button" className="btn sm" onClick={() => setPaying(t)}>Mark paid…</button>
            </div>
            {open === key && <Reconcile supplierId={t.supplier_id} name={t.name} />}
          </div>
        );
      })}
      {!data.tabs.length && <div className="empty">No unpaid supplier invoices.</div>}
      {paying && <PayTab tab={paying} data={data} onClose={() => setPaying(null)} onDone={msg => { setPaying(null); onChanged(msg); }} />}
    </div>
  );
}

interface ReconResult { found: string[]; missing: string[]; notOnStatement: { id: string; invoice_number: string | null; total_cents: number | null; invoice_date: string | null }[] }

function Reconcile({ supplierId, name }: { supplierId: string | null; name: string }) {
  const { siteId, toast } = useShop();
  const [numbers, setNumbers] = useState('');
  const [result, setResult] = useState<ReconResult | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function check() {
    setBusy(true);
    try { const r = await api<{ result: ReconResult }>(siteId, '/bills/actions', { body: { action: 'reconcile', supplier_id: supplierId, numbers } }); setResult(r.result); }
    catch (err) { toast(errorText(err), 'warn'); } finally { setBusy(false); }
  }
  async function snap(file: File) {
    setBusy(true);
    const form = new FormData();
    form.append('file', file);
    if (supplierId) form.append('supplier_id', supplierId);
    try {
      const r = await api<{ read: { entries: { invoice_number: string }[] }; result: ReconResult }>(siteId, '/bills/actions', { form });
      setNumbers(r.read.entries.map(e => e.invoice_number).join('\n'));
      setResult(r.result);
    } catch (err) { toast(errorText(err), 'warn'); } finally { setBusy(false); }
  }
  const total = result ? result.found.length + result.missing.length : 0;
  return (
    <div className="recon">
      <Field label={`Invoice numbers on ${name}’s statement`} hint="Paste them (one per line), or snap the statement." htmlFor={`rc-${supplierId}`}>
        <textarea id={`rc-${supplierId}`} className="input" style={{ minHeight: 60 }} value={numbers} onChange={e => setNumbers(e.target.value)} />
      </Field>
      <div className="row">
        <button type="button" className="btn sm primary" disabled={busy || !numbers.trim()} onClick={check}>Check</button>
        <button type="button" className="btn sm" disabled={busy} onClick={() => fileRef.current?.click()}><Camera className="i" />Snap the statement</button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={e => { const f = e.target.files?.[0]; if (f) snap(f); e.target.value = ''; }} />
      </div>
      {result && <>
        <div className="rl"><span>Lines on the statement</span><b className="num">{total}</b></div>
        <div className="rl"><span>Found in Keystone</span><b className="num" style={{ color: 'var(--ok-text)' }}>{result.found.length}</b></div>
        {result.missing.map(n => <div key={n} className="rl"><span>Missing: <span className="mono">{n}</span></span><b className="num" style={{ color: 'var(--warn-text)' }}>never snapped</b></div>)}
        {result.notOnStatement.length > 0 && <p className="note">On file but not on this statement: {result.notOnStatement.map(b => b.invoice_number).join(', ')}</p>}
        {result.missing.length > 0 && <p className="note">Ask {name} for copies of the missing ones before you pay, or dispute them.</p>}
      </>}
    </div>
  );
}

function PayTab({ tab, data, onClose, onDone }: { tab: SupplierTab; data: PartsData; onClose: () => void; onDone: (msg: string) => void }) {
  const { siteId } = useShop();
  const bills = data.bills.filter(b => tab.bill_ids.includes(b.id));
  const [picked, setPicked] = useState<Set<string>>(new Set(tab.bill_ids));
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [error, setError] = useState<unknown>(null);
  const sum = bills.filter(b => picked.has(b.id)).reduce((s, b) => s + (b.total_cents ?? 0), 0);
  return (
    <Dialog title={`Pay ${tab.name}`} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button type="button" className="btn primary" disabled={!picked.size} onClick={async () => {
        try { await api(siteId, '/bills/actions', { body: { action: 'paid', bill_ids: [...picked], paid_on: date } }); onDone(`${picked.size} invoice${picked.size === 1 ? '' : 's'} marked paid (${formatCents(sum)}).`); } catch (err) { setError(err); }
      }}>Mark {formatCents(sum)} paid</button>
    </>}>
      {error ? <RuleErrors error={error} /> : null}
      <div className="checklist" style={{ maxHeight: 280 }}>
        {bills.map(b => (
          <label key={b.id}>
            <span><span className="mono">{b.invoice_number || 'No number'}</span> · {formatDate((b.invoice_date || b.created_at).slice(0, 10))}</span>
            <span className="num">{b.total_cents != null ? formatCents(b.total_cents) : '—'}</span>
            <input type="checkbox" checked={picked.has(b.id)} onChange={e => { const n = new Set(picked); if (e.target.checked) n.add(b.id); else n.delete(b.id); setPicked(n); }} />
          </label>
        ))}
      </div>
      <Field label="Paid on" htmlFor="pt-date"><input id="pt-date" className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      <p className="note">This is the expense side for QuickBooks: paid bills go over in the next export.</p>
    </Dialog>
  );
}
