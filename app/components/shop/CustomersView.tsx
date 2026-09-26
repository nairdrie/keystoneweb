'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Upload, UserPlus } from 'lucide-react';
import { formatCents } from '@/lib/shop/money';
import { formatDate } from '@/lib/shop/dates';
import { vehicleLabel } from '@/lib/shop/board';
import type { CustomerListRow } from '@/lib/shop/actions/admin';
import { api, errorText } from './api';
import { useShop } from './ShopContext';
import { Dialog, Field, Pill, RuleErrors } from './ui';

/** Minimal CSV parser (quoted fields, commas, newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim())) rows.push(row);
  return rows;
}

function mapRows(rows: string[][]) {
  const header = rows[0].map(h => h.trim().toLowerCase());
  const find = (re: RegExp) => header.findIndex(h => re.test(h));
  const col = {
    name: [find(/^(customer|display name|customer name|name)$/), find(/full name/), find(/company/)].find(i => i >= 0) ?? -1,
    phone: find(/phone|mobile|cell/),
    email: find(/e-?mail/),
    address: find(/address|billing/),
    notes: find(/note/),
  };
  return rows.slice(1).map(r => ({
    name: col.name >= 0 ? r[col.name] : '',
    phone: col.phone >= 0 ? r[col.phone] : '',
    email: col.email >= 0 ? r[col.email] : '',
    address: col.address >= 0 ? r[col.address] : '',
    notes: col.notes >= 0 ? r[col.notes] : '',
  })).filter(r => r.name?.trim());
}

export default function CustomersView() {
  const { siteId, openCustomer, toast, version } = useShop();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CustomerListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ customers: CustomerListRow[] }>(siteId, '/customers', { query: { q } }).then(r => { setRows(r.customers); setError(null); }).catch(err => setError(errorText(err)));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, siteId, version]);

  async function importFile(file: File) {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) { toast('That file has no customers in it.', 'warn'); return; }
    const mapped = mapRows(parsed);
    if (!mapped.length) { toast('Couldn’t find a name column. Export the customer list as CSV from QuickBooks and try again.', 'warn'); return; }
    try {
      const res = await api<{ added: number; skipped: number }>(siteId, '/customers/import', { body: { rows: mapped } });
      toast(`Imported ${res.added} customer${res.added === 1 ? '' : 's'}${res.skipped ? `; skipped ${res.skipped} already on file or missing a name` : ''}.`);
      setQ('');
      const r = await api<{ customers: CustomerListRow[] }>(siteId, '/customers');
      setRows(r.customers);
    } catch (err) { toast(errorText(err), 'warn'); }
  }

  return (
    <>
      <div className="view-head">
        <div><h2>Customers</h2><p>Everyone under your care. Search by name, phone, plate or vehicle.</p></div>
        <div className="row">
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}><Upload className="i" />Import from QuickBooks</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
          <button type="button" className="btn primary" onClick={() => setAdding(true)}><UserPlus className="i" />Add a customer</button>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <div className="row" style={{ flex: 1, flexWrap: 'nowrap' }}>
            <Search className="i" />
            <label className="sr" htmlFor="cust-q">Search customers</label>
            <input className="input" id="cust-q" placeholder="Try “Tacoma”, “555-01”, or a plate" value={q} onChange={e => setQ(e.target.value)} style={{ border: 0, paddingLeft: 4 }} autoComplete="off" />
          </div>
          <span className="note">{rows ? `${rows.length} ${rows.length === 1 ? 'customer' : 'customers'}` : ''}</span>
        </div>
        <div className="table-wrap">
          {error ? <div className="empty">{error}</div> : !rows ? <div className="empty">Loading…</div> : !rows.length ? (
            <div className="empty">{q ? 'No customer matches that. Check the spelling, or search by phone number.' : 'No customers yet. They’re added when you log a drop-off, or import them from QuickBooks.'}</div>
          ) : (
            <table className="t">
              <thead><tr><th>Customer</th><th>Phone</th><th>Vehicles</th><th className="r">Visits</th><th className="r">Spent</th><th className="r">Owes</th><th>Last visit</th></tr></thead>
              <tbody>{rows.map(c => (
                <tr key={c.id} className="click" tabIndex={0} onClick={() => openCustomer(c.id)} onKeyDown={e => { if (e.key === 'Enter') openCustomer(c.id); }}>
                  <td><b>{c.name}</b>{c.customer_type === 'business' && <> <Pill>Business</Pill></>}{c.open_jobs > 0 && <> <Pill tone="info">Car here</Pill></>}{c.preferences && <span className="sub">{c.preferences}</span>}</td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{c.phone || '—'}</td>
                  <td>{c.vehicles.map(v => <span key={v.id} style={{ display: 'block' }}>{vehicleLabel(v)}{v.plate ? <> <span className="plate">{v.plate}</span></> : null}</span>)}</td>
                  <td className="r">{c.visits}</td>
                  <td className="r">{formatCents(c.lifetime_cents)}</td>
                  <td className="r">{c.owing_cents > 0 ? <b style={{ color: 'var(--warn-text)' }}>{formatCents(c.owing_cents)}</b> : '—'}</td>
                  <td>{c.last_visit ? formatDate(c.last_visit) : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
      {adding && <AddCustomer onClose={() => setAdding(false)} onSaved={id => { setAdding(false); setQ(''); openCustomer(id); }} />}
    </>
  );
}

function AddCustomer({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const { siteId, toast, bump } = useShop();
  const [f, setF] = useState({ name: '', phone: '', email: '', address: '', customer_type: 'consumer', business_reason: '', preferences: '' });
  const [error, setError] = useState<unknown>(null);
  return (
    <Dialog title="Add a customer" onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button type="button" className="btn primary" onClick={async () => {
        try { const c = await api<{ id: string }>(siteId, '/customers', { body: f }); toast('Customer added.'); bump(); onSaved(c.id); } catch (err) { setError(err); }
      }}>Save</button>
    </>}>
      {error ? <RuleErrors error={error} /> : null}
      <div className="grid2">
        <Field label="Name" required htmlFor="ac-name"><input id="ac-name" className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Phone" htmlFor="ac-phone"><input id="ac-phone" className="input" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Email" htmlFor="ac-email"><input id="ac-email" className="input" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Type" htmlFor="ac-type"><select id="ac-type" className="input" value={f.customer_type} onChange={e => setF({ ...f, customer_type: e.target.value })}><option value="consumer">Person (consumer)</option><option value="business">Business or fleet</option></select></Field>
      </div>
      <Field label="Address" htmlFor="ac-addr"><input id="ac-addr" className="input" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></Field>
      <Field label="How they like to be handled" htmlFor="ac-pref"><input id="ac-pref" className="input" value={f.preferences} onChange={e => setF({ ...f, preferences: e.target.value })} placeholder="Wants exact, itemized pricing with options" /></Field>
    </Dialog>
  );
}
