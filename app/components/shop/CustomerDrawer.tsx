'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Car, Key, Pencil, Plus } from 'lucide-react';
import { formatCents } from '@/lib/shop/money';
import { STAGE_LABELS, invoiceLabel, vehicleLabel } from '@/lib/shop/board';
import { formatDate } from '@/lib/shop/dates';
import type { Customer, Stage, Vehicle } from '@/lib/shop/types';
import { api, errorText } from './api';
import { useShop } from './ShopContext';
import { CopyButton, Drawer, Field, Pill, RuleErrors } from './ui';

interface FileJob {
  id: string; ro_number: number; vehicle_id: string; complaint: string; stage: Stage; status: string; closed_reason: string | null; created_at: string;
  invoice: { id: string; invoice_number: number; total_cents: number; paid_cents: number; issued_at: string } | null;
}
interface CustomerFile {
  customer: Customer;
  vehicles: Vehicle[];
  jobs: FileJob[];
  liens: { id: string; job_id: string; status: string; amount_owing_cents: number; ppsr_registration_number: string | null }[];
}

export default function CustomerDrawer({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { siteId, href, openIntake, toast, bump } = useShop();
  const [file, setFile] = useState<CustomerFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [vehicleEdit, setVehicleEdit] = useState<Vehicle | 'new' | null>(null);

  const load = useCallback(() => {
    api<CustomerFile>(siteId, `/customers/${customerId}`).then(setFile).catch(err => setError(errorText(err)));
  }, [siteId, customerId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <Drawer title="Customer file" onClose={onClose}><RuleErrors error={error} /></Drawer>;
  if (!file) return <Drawer title="Customer file" onClose={onClose}><div className="skel" style={{ width: '70%' }} /><div className="skel" style={{ width: '50%' }} /></Drawer>;

  const c = file.customer;
  const owes = file.jobs.reduce((s, j) => s + (j.invoice ? j.invoice.total_cents - j.invoice.paid_cents : 0), 0);
  const spent = file.jobs.reduce((s, j) => s + (j.invoice ? j.invoice.paid_cents : 0), 0);

  return (
    <Drawer
      eyebrow="Customer file"
      title={c.name}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn" onClick={onClose}>Close</button>
        <button type="button" className="btn primary" onClick={() => { onClose(); openIntake({ customer_id: c.id }); }}><Key className="i" />New drop-off</button>
      </>}
    >
      {editing ? (
        <CustomerForm customer={c} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); load(); bump(); toast('Customer saved.'); }} />
      ) : (
        <>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>{c.customer_type === 'business' ? <Pill tone="neutral">Business{c.business_reason ? `: ${c.business_reason}` : ''}</Pill> : <Pill tone="neutral">Consumer</Pill>}</span>
            <button type="button" className="btn sm ghost" onClick={() => setEditing(true)}><Pencil className="i" />Edit</button>
          </div>
          <dl className="kv">
            <dt>Phone</dt><dd><span className="copyable">{c.phone || '—'}<CopyButton value={c.phone} /></span></dd>
            <dt>Email</dt><dd>{c.email || '—'}</dd>
            {c.address && <><dt>Address</dt><dd>{c.address}</dd></>}
            <dt>Customer since</dt><dd>{new Date(c.created_at).getFullYear()}</dd>
            <dt>Visits</dt><dd className="num">{file.jobs.length}</dd>
            <dt>Lifetime spend</dt><dd className="num">{formatCents(spent)}</dd>
            <dt>Owes</dt><dd className="num">{owes > 0 ? <b style={{ color: 'var(--warn-text)' }}>{formatCents(owes)}</b> : formatCents(0)}</dd>
          </dl>
          {c.preferences && <p className="pref">{c.preferences}</p>}
          {c.notes && <p className="note">{c.notes}</p>}
        </>
      )}

      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <p className="eyebrow">Vehicles</p>
          <button type="button" className="btn sm ghost" onClick={() => setVehicleEdit('new')}><Plus className="i" />Add</button>
        </div>
        {vehicleEdit && (
          <VehicleForm customerId={c.id} vehicle={vehicleEdit === 'new' ? null : vehicleEdit} onCancel={() => setVehicleEdit(null)} onSaved={() => { setVehicleEdit(null); load(); bump(); toast('Vehicle saved.'); }} />
        )}
        {file.vehicles.filter(v => !v.archived_at).map(v => (
          <div key={v.id} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <span className="row" style={{ flexWrap: 'nowrap', minWidth: 0 }}><Car className="i" /><span>{vehicleLabel(v)}{v.plate ? <> <span className="plate">{v.plate}</span></> : null}{v.vin ? <span className="note mono" style={{ display: 'block' }}>{v.vin}</span> : null}</span></span>
            <button type="button" className="icon-btn" aria-label={`Edit ${vehicleLabel(v)}`} onClick={() => setVehicleEdit(v)}><Pencil className="i" /></button>
          </div>
        ))}
        {!file.vehicles.length && <p className="note">No vehicles yet.</p>}
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Jobs</p>
        {file.jobs.length ? file.jobs.map(j => {
          const v = file.vehicles.find(x => x.id === j.vehicle_id);
          const bal = j.invoice ? j.invoice.total_cents - j.invoice.paid_cents : 0;
          return (
            <Link key={j.id} href={href(`/jobs/${j.id}`)} onClick={onClose} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', flexWrap: 'nowrap' }}>
              <span style={{ minWidth: 0 }}>
                <span className="ro">RO-{j.ro_number}</span> · {v ? vehicleLabel(v) : 'Vehicle'} · <span className="note">{formatDate(j.created_at)}</span><br />
                <span className="note">{j.complaint}</span>
                {j.invoice && <span className="note" style={{ display: 'block' }}>{invoiceLabel(j.invoice.invoice_number)} · {formatCents(j.invoice.total_cents)}{bal > 0 ? ` · owes ${formatCents(bal)}` : ' · paid'}</span>}
              </span>
              {j.status === 'closed'
                ? <Pill tone={j.closed_reason === 'released_on_plan' ? 'info' : 'ok'}>{j.closed_reason === 'released_on_plan' ? 'On a plan' : j.closed_reason === 'cancelled' ? 'Cancelled' : 'Closed'}</Pill>
                : <Pill tone="info">{STAGE_LABELS[j.stage]}</Pill>}
            </Link>
          );
        }) : <p className="note">No visits yet.</p>}
      </div>
    </Drawer>
  );
}

function CustomerForm({ customer, onCancel, onSaved }: { customer: Customer; onCancel: () => void; onSaved: () => void }) {
  const { siteId } = useShop();
  const [f, setF] = useState({
    name: customer.name, phone: customer.phone || '', email: customer.email || '', address: customer.address || '',
    customer_type: customer.customer_type, business_reason: customer.business_reason || '', preferences: customer.preferences || '', notes: customer.notes || '',
  });
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true); setError(null);
    try { await api(siteId, `/customers/${customer.id}`, { method: 'PATCH', body: f }); onSaved(); } catch (err) { setError(err); } finally { setSaving(false); }
  }
  return (
    <div className="panel"><div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error ? <RuleErrors error={error} /> : null}
      <div className="grid2">
        <Field label="Name" required htmlFor="cf-name"><input id="cf-name" className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Phone" htmlFor="cf-phone"><input id="cf-phone" className="input" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Email" htmlFor="cf-email"><input id="cf-email" className="input" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Type" htmlFor="cf-type">
          <select id="cf-type" className="input" value={f.customer_type} onChange={e => setF({ ...f, customer_type: e.target.value as Customer['customer_type'] })}>
            <option value="consumer">Person (consumer)</option><option value="business">Business or fleet</option>
          </select>
        </Field>
      </div>
      <Field label="Address" hint="Printed on invoices; needed for a lien registration." htmlFor="cf-addr"><input id="cf-addr" className="input" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></Field>
      {f.customer_type === 'business' && <Field label="Business name or reason" htmlFor="cf-biz"><input id="cf-biz" className="input" value={f.business_reason} onChange={e => setF({ ...f, business_reason: e.target.value })} /></Field>}
      <Field label="How they like to be handled" hint="Shows on every job, e.g. “Wants exact, itemized pricing with options.”" htmlFor="cf-pref"><input id="cf-pref" className="input" value={f.preferences} onChange={e => setF({ ...f, preferences: e.target.value })} /></Field>
      <Field label="Notes" htmlFor="cf-notes"><textarea id="cf-notes" className="input" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div></div>
  );
}

export function VehicleForm({ customerId, vehicle, onCancel, onSaved }: { customerId: string; vehicle: Vehicle | null; onCancel: () => void; onSaved: (v: Vehicle) => void }) {
  const { siteId } = useShop();
  const [f, setF] = useState({
    year: vehicle?.year ? String(vehicle.year) : '', make: vehicle?.make || '', model: vehicle?.model || '', trim: vehicle?.trim || '',
    vin: vehicle?.vin || '', plate: vehicle?.plate || '', color: vehicle?.color || '', engine: vehicle?.engine || '', notes: vehicle?.notes || '',
  });
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true); setError(null);
    try {
      const v = vehicle
        ? await api<Vehicle>(siteId, `/vehicles/${vehicle.id}`, { method: 'PATCH', body: f })
        : await api<Vehicle>(siteId, '/vehicles', { body: { ...f, customer_id: customerId } });
      onSaved(v);
    } catch (err) { setError(err); } finally { setSaving(false); }
  }
  return (
    <div className="panel" style={{ marginBottom: 10 }}><div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error ? <RuleErrors error={error} /> : null}
      <div className="grid3">
        <Field label="Year" htmlFor="vf-year"><input id="vf-year" className="input" inputMode="numeric" value={f.year} onChange={e => setF({ ...f, year: e.target.value })} /></Field>
        <Field label="Make" htmlFor="vf-make"><input id="vf-make" className="input" value={f.make} onChange={e => setF({ ...f, make: e.target.value })} /></Field>
        <Field label="Model" htmlFor="vf-model"><input id="vf-model" className="input" value={f.model} onChange={e => setF({ ...f, model: e.target.value })} /></Field>
        <Field label="Trim" htmlFor="vf-trim"><input id="vf-trim" className="input" value={f.trim} onChange={e => setF({ ...f, trim: e.target.value })} /></Field>
        <Field label="Plate" htmlFor="vf-plate"><input id="vf-plate" className="input mono" value={f.plate} onChange={e => setF({ ...f, plate: e.target.value.toUpperCase() })} /></Field>
        <Field label="Colour" htmlFor="vf-color"><input id="vf-color" className="input" value={f.color} onChange={e => setF({ ...f, color: e.target.value })} /></Field>
      </div>
      <div className="grid2">
        <Field label="VIN" htmlFor="vf-vin"><input id="vf-vin" className="input mono" maxLength={17} value={f.vin} onChange={e => setF({ ...f, vin: e.target.value.toUpperCase() })} /></Field>
        <Field label="Engine" htmlFor="vf-engine"><input id="vf-engine" className="input" value={f.engine} onChange={e => setF({ ...f, engine: e.target.value })} placeholder="2.4L I4" /></Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save vehicle'}</button>
      </div>
    </div></div>
  );
}
