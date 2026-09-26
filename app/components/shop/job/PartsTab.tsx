'use client';

import { useState } from 'react';
import { Camera, Check, Clock, Package, RotateCcw, Sparkles } from 'lucide-react';
import { formatCents } from '@/lib/shop/money';
import { formatDate } from '@/lib/shop/dates';
import type { SupplierBill } from '@/lib/shop/types';
import { api, errorText, shopUrl } from '../api';
import { useShop } from '../ShopContext';
import { Pill, RuleErrors } from '../ui';
import type { Detail } from './JobFile';

type Act = (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;

export default function PartsTab({ d, act }: { d: Detail; act: Act }) {
  const { siteId, toast } = useShop();
  const [reading, setReading] = useState(false);
  const [bill, setBill] = useState<SupplierBill | null>(null);
  const [error, setError] = useState<unknown>(null);
  const supplierName = (id: string | null) => d.suppliers.find(s => s.id === id)?.name ?? null;
  const cores = d.parts_received.filter(p => p.is_core);
  const received = d.parts_received.filter(p => !p.is_core);
  const bills = [...new Map(d.parts_received.filter(p => p.bill_file_path).map(p => [p.bill_id, p])).values()];

  async function upload(file: File) {
    setReading(true); setError(null); setBill(null);
    const form = new FormData();
    form.append('file', file);
    form.append('job_id', d.job.id);
    try {
      const b = await api<SupplierBill>(siteId, '/bills', { form });
      setBill(b);
    } catch (err) { setError(err); } finally { setReading(false); }
  }

  return (
    <>
      <div className="block">
        <h4><Package className="i" />Parts on the estimate</h4>
        {d.parts_expected.length ? (
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Part</th><th>From</th><th>Status</th></tr></thead>
            <tbody>{d.parts_expected.map(p => (
              <tr key={p.line_id}>
                <td>{p.description}{p.part_number && <span className="sub mono">#{p.part_number}</span>}</td>
                <td>{p.from_stock ? 'Shop stock' : supplierName(p.supplier_id) || '—'}</td>
                <td>{p.from_stock ? <Pill>From shop stock</Pill> : p.received ? <Pill tone="ok" icon={<Check className="i" />}>Received · matched</Pill> : <Pill tone="info" icon={<Clock className="i" />}>{p.eta ? `Expected ${p.eta}` : 'Not in yet'}</Pill>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="note">No parts on the estimate yet.</p>}
      </div>

      <div className="block">
        <h4><Check className="i" />Received from suppliers</h4>
        {received.length ? (
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Part</th><th>Supplier · invoice</th><th className="r">Qty</th><th className="r">Cost</th></tr></thead>
            <tbody>{received.map(p => (
              <tr key={p.id}>
                <td>{p.description}{p.part_number && <span className="sub mono">#{p.part_number}</span>}</td>
                <td>{p.supplier_name || '—'} <span className="mono">{p.bill_invoice_number || ''}</span><span className="sub">{p.bill_invoice_date ? formatDate(p.bill_invoice_date) : ''}</span></td>
                <td className="r">{Number(p.qty)}</td>
                <td className="r">{formatCents(p.line_total_cents)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="note">No parts matched to this job yet. When a supplier invoice is snapped and matched, its lines land here with the cost.</p>}
      </div>

      {cores.length > 0 && (
        <div className="block">
          <h4><RotateCcw className="i" />Cores to send back</h4>
          {cores.map(p => (
            <div key={p.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
              <span>{p.description} → {p.supplier_name || 'supplier'} · refund {formatCents(p.line_total_cents)}</span>
              <button type="button" className={`btn sm${p.core_returned_at ? '' : ' dark'}`} onClick={() => act(() => api(siteId, '/bills/actions', { body: { action: 'core', line_id: p.id, returned: !p.core_returned_at } }), p.core_returned_at ? 'Marked not returned.' : 'Core marked returned.')}>
                {p.core_returned_at ? <><Check className="i" />Returned</> : 'Mark returned'}
              </button>
            </div>
          ))}
          <p className="note" style={{ marginTop: 6 }}>Core charges are refunded when the old part goes back. Keystone keeps a list so the refunds don’t get lost.</p>
        </div>
      )}

      <div className="block">
        <h4><Camera className="i" />Supplier invoices on this job</h4>
        <div className="row">
          {bills.map(b => (
            <a key={b.bill_id} className="bill-thumb" href={shopUrl(siteId, '/files', { path: b.bill_file_path! })} target="_blank" rel="noopener noreferrer">
              <div className="receipt" style={{ width: 64 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shopUrl(siteId, '/files', { path: b.bill_file_path! })} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                <i className="dark w70" /><i /><i className="w85" /><i className="w50" />
              </div>
              <span className="mono" style={{ fontSize: 10.5 }}>{b.bill_invoice_number || 'No number'}</span>
            </a>
          ))}
          {!bills.length && <span className="note">None yet</span>}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <label className="btn sm" tabIndex={0}>
            <Camera className="i" />{reading ? 'Reading…' : 'Snap a parts invoice for this car'}
            <input type="file" accept="image/*,application/pdf" capture="environment" hidden disabled={reading} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          </label>
        </div>
        {reading && <div className="pile-card" style={{ marginTop: 10 }}><div className="receipt scan"><i className="dark w70" /><i /><i className="w85" /><i className="w50" /></div><div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}><b>Reading invoice…</b><div className="skel" style={{ width: '60%' }} /><div className="skel" style={{ width: '85%' }} /></div></div>}
        {error ? <RuleErrors error={error} /> : null}
        {bill && (
          <div className="suggest" style={{ marginTop: 10 }}>
            <div className="row"><Sparkles className="i" /><span><b>{supplierName(bill.supplier_id) || bill.supplier_name_raw || 'Supplier'}</b> {bill.invoice_number ? <span className="mono">{bill.invoice_number}</span> : null} · {bill.lines.length} line{bill.lines.length === 1 ? '' : 's'}{bill.total_cents ? ` · ${formatCents(bill.total_cents)}` : ''}</span></div>
            {bill.ai_error && <p>{bill.ai_error}</p>}
            {bill.lines.length > 0 ? (
              <div className="row" style={{ marginTop: 8 }}>
                <button type="button" className="btn sm primary" onClick={async () => {
                  try {
                    await api(siteId, `/bills/${bill.id}`, { body: { action: 'match', target: 'job', job_id: d.job.id } });
                    setBill(null);
                    await act(async () => {}, `Matched to RO-${d.job.ro_number}. The parts are on this job at cost.`);
                  } catch (err) { toast(errorText(err), 'warn'); }
                }}><Check className="i" />Match to RO-{d.job.ro_number}</button>
                <span className="note">Or fix the lines in Parts first.</span>
              </div>
            ) : <p>It’s in the pile on the Parts page. Add the lines there, then match it.</p>}
          </div>
        )}
      </div>
    </>
  );
}
