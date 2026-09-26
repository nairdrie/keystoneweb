'use client';

import { useEffect, useMemo, useState } from 'react';
import { Key, Search } from 'lucide-react';
import { LAW } from '@/lib/shop/rules';
import { centsToInput, formatCents, parseMoneyToCents } from '@/lib/shop/money';
import { vehicleLabel } from '@/lib/shop/board';
import type { AuthMethod, JobSource, Vehicle } from '@/lib/shop/types';
import type { CustomerListRow } from '@/lib/shop/actions/admin';
import { api } from './api';
import { useShop } from './ShopContext';
import { Dialog, Field, LawNote, RuleErrors } from './ui';

export interface IntakePrefill {
  customer_id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  complaint?: string;
  source?: JobSource;
  source_ref?: string;
}

type CustomerRow = CustomerListRow;

const SOURCES: { value: JobSource; label: string }[] = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'key_drop', label: 'After-hours key drop' },
  { value: 'phone', label: 'Phone call' },
  { value: 'website_form', label: 'Website form' },
  { value: 'booking', label: 'Online booking' },
  { value: 'other', label: 'Other' },
];

export default function IntakeModal({ prefill, onClose }: { prefill: IntakePrefill; onClose: () => void }) {
  const { siteId, ws, toast, refresh, bump } = useShop();
  const settings = ws?.settings;
  const [query, setQuery] = useState(prefill.email || prefill.phone || '');
  const [results, setResults] = useState<CustomerRow[]>([]);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [vehicleId, setVehicleId] = useState<string>('new');
  const [c, setC] = useState({ name: prefill.name || '', phone: prefill.phone || '', email: prefill.email || '', customer_type: 'consumer', business_reason: '' });
  const [v, setV] = useState({ year: '', make: '', model: '', plate: '', vin: '', color: '' });
  const [odometer, setOdometer] = useState('');
  const [complaint, setComplaint] = useState(prefill.complaint || '');
  const [source, setSource] = useState<JobSource>(prefill.source || 'walk_in');
  const [keyTag, setKeyTag] = useState('');
  const [feeMode, setFeeMode] = useState<'agreed' | 'none'>(settings && settings.estimate_fee_cents > 0 ? 'agreed' : 'none');
  const [feeAmount, setFeeAmount] = useState(centsToInput(settings?.estimate_fee_cents ?? 0));
  const [feeMethod, setFeeMethod] = useState<AuthMethod>(prefill.source === 'website_form' || prefill.source === 'booking' ? 'online' : 'in_person');
  const [feePhone, setFeePhone] = useState(prefill.phone || '');
  const [owner, setOwner] = useState(true);
  const [ownerName, setOwnerName] = useState('');
  const [promised, setPromised] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [missing, setMissing] = useState<Record<string, boolean>>({});

  // Search existing customers as you type (name, phone, email, plate).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || customer) { setResults([]); return; }
    const t = setTimeout(() => {
      api<{ customers: CustomerRow[] }>(siteId, '/customers', { query: { q } }).then(r => setResults(r.customers.slice(0, 6))).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query, siteId, customer]);

  // Coming from a website form: pick the existing customer if the email or phone matches exactly.
  useEffect(() => {
    if (prefill.customer_id) {
      api<{ customer: CustomerRow; vehicles: Vehicle[] }>(siteId, `/customers/${prefill.customer_id}`).then(r => {
        const row = { ...r.customer, vehicles: r.vehicles.filter(x => !x.archived_at) } as unknown as CustomerRow;
        setCustomer(row);
        setVehicleId(row.vehicles[0]?.id || 'new');
      }).catch(() => {});
    }
  }, [prefill.customer_id, siteId]);
  useEffect(() => {
    if (customer || prefill.customer_id || !results.length) return;
    const email = prefill.email?.toLowerCase();
    const exact = results.find(r => (email && r.email?.toLowerCase() === email) || (prefill.phone && r.phone && r.phone.replace(/\D/g, '') === prefill.phone.replace(/\D/g, '')));
    if (exact) { setCustomer(exact); setVehicleId(exact.vehicles[0]?.id || 'new'); }
  }, [results, customer, prefill]);

  useEffect(() => {
    if (source === 'phone') setFeeMethod('phone');
    else if (source === 'website_form' || source === 'booking') setFeeMethod('online');
  }, [source]);

  const nextTag = useMemo(() => {
    if (!ws) return null;
    const used = new Set(ws.jobs.map(j => j.key_tag));
    for (let i = 1; i <= ws.settings.key_tag_max; i++) { const t = String(i).padStart(2, '0'); if (!used.has(t)) return t; }
    return null;
  }, [ws]);

  async function save() {
    const miss: Record<string, boolean> = {};
    if (!customer && !c.name.trim()) miss.name = true;
    if (!customer && !c.phone.trim() && !c.email.trim()) miss.contact = true;
    if (vehicleId === 'new' && !v.make.trim() && !v.model.trim() && !v.plate.trim() && !v.vin.trim()) miss.vehicle = true;
    if (!complaint.trim()) miss.complaint = true;
    if (feeMode === 'agreed' && feeMethod === 'phone' && !feePhone.trim()) miss.feePhone = true;
    setMissing(miss);
    if (Object.keys(miss).length) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ id: string; ro_number: number; key_tag: string | null }>(siteId, '/jobs', {
        body: {
          customer_id: customer?.id ?? null,
          customer: customer ? undefined : c,
          vehicle_id: vehicleId !== 'new' ? vehicleId : null,
          vehicle: vehicleId === 'new' ? v : undefined,
          complaint,
          customer_words: complaint,
          key_tag: keyTag.trim() || null,
          odometer_in: odometer.replace(/[^0-9]/g, '') || null,
          source,
          source_ref: prefill.source_ref ?? null,
          promised_date: promised || null,
          owner_is_customer: owner,
          registered_owner_name: owner ? null : ownerName,
          fee: feeMode === 'agreed'
            ? { cents: parseMoneyToCents(feeAmount), method: feeMethod, phone: feePhone, authorized_by: customer?.name || c.name }
            : null,
        },
      });
      toast(`Key ${res.key_tag ?? '(none free)'} logged. RO-${res.ro_number} is in Dropped off.`);
      await refresh();
      bump();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  const vehicles = (customer?.vehicles || []) as (Pick<Vehicle, 'id' | 'year' | 'make' | 'model' | 'plate' | 'vin' | 'color'>)[];

  return (
    <Dialog
      title="Log a key drop-off"
      eyebrow={`Key tag ${keyTag || nextTag || '—'}`}
      onClose={onClose}
      labelId="in-t"
      footLeft={`Write key tag ${keyTag || nextTag || ''} on the key after saving.`}
      footer={<>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn primary" onClick={save} disabled={saving}><Key className="i" />{saving ? 'Saving…' : 'Put it on the board'}</button>
      </>}
    >
      {error ? <RuleErrors error={error} /> : null}
      {customer ? (
        <div className="callout">
          <div style={{ flex: 1 }}>
            <b>{customer.name}</b> <span className="note">{[customer.phone, customer.email].filter(Boolean).join(' · ')}</span>
            {customer.preferences && <p className="note" style={{ marginTop: 4 }}>{customer.preferences}</p>}
          </div>
          <button type="button" className="btn sm ghost" onClick={() => { setCustomer(null); setVehicleId('new'); }}>Change</button>
        </div>
      ) : (
        <>
          <Field label="Find a customer" hint="Search by name, phone, email or plate, or fill in a new customer below." htmlFor="in-find">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <Search className="i muted" />
              <input id="in-find" className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, phone, email or plate" autoComplete="off" />
            </div>
          </Field>
          {results.length > 0 && (
            <div className="pick-list">
              {results.map(r => (
                <button type="button" key={r.id} onClick={() => { setCustomer(r); setVehicleId(r.vehicles[0]?.id || 'new'); setResults([]); }}>
                  <b>{r.name}</b><span className="note">{[r.phone, r.email].filter(Boolean).join(' · ')}{r.vehicles.length ? ` · ${r.vehicles.map(x => vehicleLabel(x)).join(', ')}` : ''}</span>
                </button>
              ))}
            </div>
          )}
          <div className="grid2">
            <Field label="Customer name" required error={missing.name ? 'Enter their name.' : null} htmlFor="in-name">
              <input id="in-name" className="input" value={c.name} onChange={e => setC({ ...c, name: e.target.value })} autoComplete="off" />
            </Field>
            <Field label="Phone" error={missing.contact ? 'A phone number or email.' : null} htmlFor="in-phone">
              <input id="in-phone" className="input" inputMode="tel" value={c.phone} onChange={e => setC({ ...c, phone: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="in-email">
              <input id="in-email" className="input" type="email" value={c.email} onChange={e => setC({ ...c, email: e.target.value })} />
            </Field>
            <Field label="Who’s paying" htmlFor="in-type">
              <select id="in-type" className="input" value={c.customer_type} onChange={e => setC({ ...c, customer_type: e.target.value })}>
                <option value="consumer">A person (consumer rules apply)</option>
                <option value="business">A business or fleet</option>
              </select>
            </Field>
          </div>
          {c.customer_type === 'business' && (
            <Field label="Business name or reason" hint="Consumer repair rules protect individuals. Keystone keeps the same paper trail either way." htmlFor="in-biz">
              <input id="in-biz" className="input" value={c.business_reason} onChange={e => setC({ ...c, business_reason: e.target.value })} placeholder="e.g. Westway Plumbing fleet" />
            </Field>
          )}
        </>
      )}

      {vehicles.length > 0 && (
        <Field label="Vehicle" htmlFor="in-veh-pick">
          <select id="in-veh-pick" className="input" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
            {vehicles.map(x => <option key={x.id} value={x.id}>{vehicleLabel(x)}{x.plate ? ` · ${x.plate}` : ''}</option>)}
            <option value="new">Another vehicle…</option>
          </select>
        </Field>
      )}
      {vehicleId === 'new' && (
        <div className="grid3">
          <Field label="Year" htmlFor="in-year"><input id="in-year" className="input" inputMode="numeric" value={v.year} onChange={e => setV({ ...v, year: e.target.value })} placeholder="2017" /></Field>
          <Field label="Make" required error={missing.vehicle ? 'Add the vehicle.' : null} htmlFor="in-make"><input id="in-make" className="input" value={v.make} onChange={e => setV({ ...v, make: e.target.value })} placeholder="Kia" /></Field>
          <Field label="Model" htmlFor="in-model"><input id="in-model" className="input" value={v.model} onChange={e => setV({ ...v, model: e.target.value })} placeholder="Soul" /></Field>
          <Field label="Plate" htmlFor="in-plate"><input id="in-plate" className="input mono" value={v.plate} onChange={e => setV({ ...v, plate: e.target.value.toUpperCase() })} placeholder="ABCD 123" /></Field>
          <Field label="VIN" htmlFor="in-vin"><input id="in-vin" className="input mono" value={v.vin} maxLength={17} onChange={e => setV({ ...v, vin: e.target.value.toUpperCase() })} placeholder="17 characters" /></Field>
          <Field label="Colour" htmlFor="in-color"><input id="in-color" className="input" value={v.color} onChange={e => setV({ ...v, color: e.target.value })} placeholder="Grey" /></Field>
        </div>
      )}
      <div className="grid2">
        <Field label="Odometer" hint="Needed on the estimate and invoice." htmlFor="in-odo"><input id="in-odo" className="input num" inputMode="numeric" value={odometer} onChange={e => setOdometer(e.target.value)} placeholder="187,412" /></Field>
        <Field label="Key tag" hint={nextTag ? `Leave blank for the next free tag (${nextTag}).` : 'All tags are in use. Type one.'} htmlFor="in-tag"><input id="in-tag" className="input mono" value={keyTag} onChange={e => setKeyTag(e.target.value)} placeholder={nextTag || ''} /></Field>
      </div>
      <Field label="What’s wrong, in their words" required error={missing.complaint ? 'Write down what they told you. It’s the first line of the estimate.' : null} htmlFor="in-comp">
        <textarea id="in-comp" className="input" value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="Squealing when I turn the wheel all the way. Worse in the morning." />
      </Field>
      <div className="grid2">
        <Field label="How it came in" htmlFor="in-src">
          <select id="in-src" className="input" value={source} onChange={e => setSource(e.target.value as JobSource)}>
            {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Promised by" htmlFor="in-prom"><input id="in-prom" className="input" type="date" value={promised} onChange={e => setPromised(e.target.value)} /></Field>
      </div>
      <div className="grid2">
        <Field label="Estimate fee" htmlFor="in-fee">
          <select id="in-fee" className="input" value={feeMode} onChange={e => setFeeMode(e.target.value as 'agreed' | 'none')}>
            <option value="agreed">They agreed to an estimate fee</option>
            <option value="none">No charge for the estimate</option>
          </select>
        </Field>
        {feeMode === 'agreed' && (
          <Field label="Fee amount" htmlFor="in-fee-amt"><input id="in-fee-amt" className="input num" inputMode="decimal" value={feeAmount} onChange={e => setFeeAmount(e.target.value)} /></Field>
        )}
      </div>
      {feeMode === 'agreed' && (
        <div className="grid2">
          <Field label="How they agreed" htmlFor="in-fee-how">
            <select id="in-fee-how" className="input" value={feeMethod} onChange={e => setFeeMethod(e.target.value as AuthMethod)}>
              <option value="in_person">In person (at the counter or on the key-drop form)</option>
              <option value="phone">On the phone</option>
              <option value="online">Online form</option>
              <option value="email">Email</option>
              <option value="text">Text message</option>
            </select>
          </Field>
          {feeMethod === 'phone' && (
            <Field label="Number you called" required error={missing.feePhone ? 'Required for a phone agreement.' : null} htmlFor="in-fee-ph"><input id="in-fee-ph" className="input" inputMode="tel" value={feePhone} onChange={e => setFeePhone(e.target.value)} /></Field>
          )}
        </div>
      )}
      <div className="grid2">
        <Field label="Ownership">
          <label className="check-inline"><input type="checkbox" checked={owner} onChange={e => setOwner(e.target.checked)} /> They’re the registered owner</label>
        </Field>
        {!owner && <Field label="Registered owner" htmlFor="in-owner"><input id="in-owner" className="input" value={ownerName} onChange={e => setOwnerName(e.target.value)} /></Field>}
      </div>
      <LawNote law={LAW.estFee}>{LAW.estFee.text}{feeMode === 'agreed' && parseMoneyToCents(feeAmount) ? ` This one: ${formatCents(parseMoneyToCents(feeAmount))}.` : ''}</LawNote>
    </Dialog>
  );
}
