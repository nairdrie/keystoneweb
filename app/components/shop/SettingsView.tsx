'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Check, KeyRound, Landmark, Plus, Printer, Save, Smartphone, Sparkles, Trash2, Truck, Users, Wrench } from 'lucide-react';
import { LAW } from '@/lib/shop/rules';
import { centsToInput, parseMoneyToCents } from '@/lib/shop/money';
import { formatShortDateTime } from '@/lib/shop/dates';
import type { Bay, ShopSettings, StaffMember, Supplier } from '@/lib/shop/types';
import { api, errorText, shopUrl } from './api';
import { useShop } from './ShopContext';
import { Field, LawNote, Pill, RuleErrors } from './ui';

interface SettingsData {
  settings: ShopSettings;
  devices: { id: string; label: string | null; created_at: string; last_seen_at: string | null; revoked_at: string | null }[];
  site: { name: string; base_url: string | null; stripe: boolean; paypal: boolean };
  services: { ai: boolean; transcription: boolean; sms: boolean };
}

type Form = Record<string, string>;

function toForm(s: ShopSettings): Form {
  return {
    legal_name: s.legal_name || '', address: s.address || '', phone: s.phone || '', email: s.email || '', hst_number: s.hst_number || '',
    tax_label: s.tax_label, tax_rate: (s.tax_rate_bps / 100).toString(), labour_rate: centsToInput(s.labour_rate_cents), estimate_fee: centsToInput(s.estimate_fee_cents),
    estimate_valid_days: String(s.estimate_valid_days), key_tag_max: String(s.key_tag_max), payment_terms: s.payment_terms, payment_methods_note: s.payment_methods_note,
    etransfer_email: s.etransfer_email || '', warranty_extra: s.warranty_extra || '', diagnostic_policy: s.diagnostic_policy || '', flat_rate_policy: s.flat_rate_policy || '',
    parts_commission_policy: s.parts_commission_policy, other_charges: s.other_charges || '',
  };
}

export default function SettingsView() {
  const { siteId, toast, refresh } = useShop();
  const [data, setData] = useState<SettingsData | null>(null);
  const [form, setForm] = useState<Form>({});
  const [bays, setBays] = useState<Bay[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<SettingsData>(siteId, '/settings');
      setData(d);
      setForm(toForm(d.settings));
      setBays(d.settings.bays);
      setStaff(d.settings.staff);
    } catch (err) { setError(err); }
  }, [siteId]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true); setError(null);
    try {
      await api(siteId, '/settings', {
        method: 'PUT',
        body: {
          legal_name: form.legal_name, address: form.address, phone: form.phone, email: form.email, hst_number: form.hst_number,
          tax_label: form.tax_label, tax_rate_bps: Math.round(parseFloat(form.tax_rate || '0') * 100), labour_rate_cents: parseMoneyToCents(form.labour_rate),
          estimate_fee_cents: parseMoneyToCents(form.estimate_fee) ?? 0, estimate_valid_days: Number(form.estimate_valid_days), key_tag_max: Number(form.key_tag_max),
          payment_terms: form.payment_terms, payment_methods_note: form.payment_methods_note, etransfer_email: form.etransfer_email,
          warranty_extra: form.warranty_extra, diagnostic_policy: form.diagnostic_policy, flat_rate_policy: form.flat_rate_policy,
          parts_commission_policy: form.parts_commission_policy, other_charges: form.other_charges, bays, staff,
        },
      });
      toast('Settings saved.');
      await load();
      refresh();
    } catch (err) { setError(err); } finally { setSaving(false); }
  }

  if (!data) return error ? <RuleErrors error={error} /> : <div className="empty">Loading settings…</div>;
  const f = (k: string) => ({ value: form[k] ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <>
      <div className="view-head">
        <div><h2>Shop settings</h2><p>What prints on estimates, invoices and the counter sign, plus your bays, staff, suppliers and the bay devices.</p></div>
        <div className="row"><button type="button" className="btn primary" disabled={saving} onClick={save}><Save className="i" />{saving ? 'Saving…' : 'Save settings'}</button></div>
      </div>
      {error ? <RuleErrors error={error} /> : null}
      <div className="two">
        <div className="stack">
          <section className="panel">
            <div className="panel-head"><span className="panel-title"><Building2 className="i" />Business details</span><span className="note">Printed on every estimate and invoice</span></div>
            <div className="panel-body settings-grid">
              <Field label="Legal business name" required htmlFor="st-name"><input id="st-name" className="input" {...f('legal_name')} placeholder="Mike the Mechanic Inc." /></Field>
              <Field label="Phone" required htmlFor="st-phone"><input id="st-phone" className="input" {...f('phone')} /></Field>
              <Field label="Address" required htmlFor="st-addr"><input id="st-addr" className="input" {...f('address')} placeholder="123 Main St, Hamilton ON L8P 1A1" /></Field>
              <Field label="Email" htmlFor="st-email"><input id="st-email" className="input" {...f('email')} /></Field>
              <Field label="HST registration number" htmlFor="st-hst"><input id="st-hst" className="input mono" {...f('hst_number')} placeholder="123456789 RT0001" /></Field>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><span className="panel-title"><Wrench className="i" />Rates and tax</span></div>
            <div className="panel-body settings-grid">
              <Field label="Labour rate (per hour)" htmlFor="st-lab"><input id="st-lab" className="input num" {...f('labour_rate')} /></Field>
              <Field label="Estimate fee" hint="Only charged if agreed before the estimate and the repair isn’t done." htmlFor="st-fee"><input id="st-fee" className="input num" {...f('estimate_fee')} /></Field>
              <Field label="Tax name" htmlFor="st-taxl"><input id="st-taxl" className="input" {...f('tax_label')} /></Field>
              <Field label="Tax rate (%)" htmlFor="st-tax"><input id="st-tax" className="input num" {...f('tax_rate')} /></Field>
              <Field label="Estimates are good for (days)" htmlFor="st-valid"><input id="st-valid" className="input num" {...f('estimate_valid_days')} /></Field>
              <Field label="Highest key tag number" htmlFor="st-tags"><input id="st-tags" className="input num" {...f('key_tag_max')} /></Field>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><span className="panel-title"><Landmark className="i" />Getting paid</span></div>
            <div className="panel-body settings-grid">
              <Field label="Payment terms" htmlFor="st-terms"><input id="st-terms" className="input" {...f('payment_terms')} /></Field>
              <Field label="Ways to pay (printed)" htmlFor="st-ways"><input id="st-ways" className="input" {...f('payment_methods_note')} /></Field>
              <Field label="E-transfer email" hint="Shown on the customer’s invoice page." htmlFor="st-et"><input id="st-et" className="input" {...f('etransfer_email')} /></Field>
              <div className="field">
                <span className="lbl">Online payments</span>
                <div className="row">
                  {data.site.stripe ? <Pill tone="ok" icon={<Check className="i" />}>Card (Stripe) connected</Pill> : <Pill>Card: not connected</Pill>}
                  {data.site.paypal ? <Pill tone="ok" icon={<Check className="i" />}>PayPal connected</Pill> : <Pill>PayPal: not connected</Pill>}
                </div>
                <span className="note">Connect Stripe or PayPal in your site’s payment settings. Invoices then get a pay-online button.</span>
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><span className="panel-title"><Printer className="i" />Counter sign and policies</span><a className="btn sm" href={shopUrl(siteId, '/sign')} target="_blank" rel="noopener noreferrer"><Printer className="i" />Print the sign</a></div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <LawNote law={LAW.sign} />
              <Field label="How diagnostic time is charged" htmlFor="st-diag"><textarea id="st-diag" className="input" {...f('diagnostic_policy')} placeholder="Diagnostic time is charged at our hourly labour rate, only with your approval." /></Field>
              <Field label="Flat rates" htmlFor="st-flat"><textarea id="st-flat" className="input" {...f('flat_rate_policy')} placeholder="Labour is charged by the hour, or at a flat rate for listed jobs (ask for the list)." /></Field>
              <Field label="Parts commissions" htmlFor="st-comm"><input id="st-comm" className="input" {...f('parts_commission_policy')} /></Field>
              <Field label="Other charges" hint="Storage, pick-up and delivery, loaner cars, with prices." htmlFor="st-other"><textarea id="st-other" className="input" {...f('other_charges')} placeholder="Storage: $20/day starting 3 business days after we tell you the car is ready." /></Field>
              <Field label="Your own warranty (on top of the legal minimum)" htmlFor="st-war"><textarea id="st-war" className="input" {...f('warranty_extra')} placeholder="We warrant our labour for 12 months / 20,000 km." /></Field>
            </div>
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <div className="panel-head"><span className="panel-title"><Wrench className="i" />Bays</span><button type="button" className="btn sm" onClick={() => setBays([...bays, { id: `bay${Date.now().toString(36)}`, label: `Bay ${bays.length + 1}` }])}><Plus className="i" />Add</button></div>
            <div className="panel-body stat-list">
              {bays.map((b, i) => (
                <div key={b.id}>
                  <input className="input sm" value={b.label} onChange={e => setBays(bays.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label={`Bay ${i + 1} name`} />
                  <button type="button" className="icon-btn" aria-label={`Remove ${b.label}`} disabled={bays.length <= 1} onClick={() => setBays(bays.filter((_, j) => j !== i))}><Trash2 className="i" /></button>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><span className="panel-title"><Users className="i" />Staff</span><button type="button" className="btn sm" onClick={() => setStaff([...staff, { name: '', role: 'tech' }])}><Plus className="i" />Add</button></div>
            <div className="panel-body stat-list">
              {staff.map((s, i) => (
                <div key={i}>
                  <input className="input sm" value={s.name} placeholder="Name" onChange={e => setStaff(staff.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Name" />
                  <span className="row" style={{ flexWrap: 'nowrap' }}>
                    <select className="input sm" value={s.role} onChange={e => setStaff(staff.map((x, j) => (j === i ? { ...x, role: e.target.value as StaffMember['role'] } : x)))} aria-label="Role">
                      <option value="tech">Tech</option><option value="desk">Service desk</option><option value="owner">Owner</option>
                    </select>
                    <button type="button" className="icon-btn" aria-label="Remove" onClick={() => setStaff(staff.filter((_, j) => j !== i))}><Trash2 className="i" /></button>
                  </span>
                </div>
              ))}
              {!staff.length && <p className="note">Add the people who work on cars. Their names show up on the board, in the bay view and on approvals.</p>}
            </div>
          </section>
          <SuppliersPanel />
          <DevicesPanel data={data} onChanged={load} />
          <section className="panel">
            <div className="panel-head"><span className="panel-title"><Sparkles className="i" />Reading and voice</span></div>
            <div className="panel-body stat-list">
              <div><span>Reads supplier invoices and voice notes</span>{data.services.ai ? <Pill tone="ok" icon={<Check className="i" />}>On</Pill> : <Pill tone="warn">Not set up</Pill>}</div>
              <div><span>Texts estimate and pay links</span>{data.services.sms ? <Pill tone="ok" icon={<Check className="i" />}>On</Pill> : <Pill>Uses your phone</Pill>}</div>
              <div><span>Transcribes recordings on the server</span>{data.services.transcription ? <Pill tone="ok" icon={<Check className="i" />}>On</Pill> : <Pill>Browser only</Pill>}</div>
              <p className="note">Chrome, Edge and Safari transcribe as you talk. Other browsers send the recording for the server to transcribe when that’s set up.</p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function SuppliersPanel() {
  const { siteId, toast, refresh } = useShop();
  const [list, setList] = useState<Supplier[]>([]);
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => { api<{ suppliers: Supplier[] }>(siteId, '/suppliers').then(r => setList(r.suppliers)).catch(() => {}); }, [siteId]);
  useEffect(() => { load(); }, [load]);
  async function save() {
    if (!editing) return;
    setError(null);
    try {
      if (editing.id) await api(siteId, `/suppliers/${editing.id}`, { method: 'PATCH', body: editing });
      else await api(siteId, '/suppliers', { body: editing });
      toast('Supplier saved.');
      setEditing(null);
      load();
      refresh();
    } catch (err) { setError(err); }
  }
  return (
    <section className="panel">
      <div className="panel-head"><span className="panel-title"><Truck className="i" />Suppliers</span><button type="button" className="btn sm" onClick={() => setEditing({ name: '' })}><Plus className="i" />Add</button></div>
      <div className="panel-body stat-list">
        {editing && (
          <div style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            {error ? <RuleErrors error={error} /> : null}
            <input className="input sm" placeholder="Name (e.g. Lakeshore Auto Parts)" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            <div className="grid2">
              <input className="input sm" placeholder="Account #" value={editing.account_number || ''} onChange={e => setEditing({ ...editing, account_number: e.target.value })} />
              <input className="input sm" placeholder="Rep" value={editing.rep_name || ''} onChange={e => setEditing({ ...editing, rep_name: e.target.value })} />
              <input className="input sm" placeholder="Phone" value={editing.phone || ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} />
              <input className="input sm" placeholder="Terms (e.g. Net 30)" value={editing.terms || ''} onChange={e => setEditing({ ...editing, terms: e.target.value })} />
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              {editing.id && <button type="button" className="btn sm ghost" onClick={async () => { await api(siteId, `/suppliers/${editing.id}`, { method: 'PATCH', body: { archived: !editing.archived_at } }); setEditing(null); load(); }}>{editing.archived_at ? 'Restore' : 'Archive'}</button>}
              <button type="button" className="btn sm" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="btn sm primary" onClick={save}>Save</button>
            </div>
          </div>
        )}
        {list.map(s => (
          <div key={s.id}>
            <span>{s.name}{s.archived_at && <span className="note"> (archived)</span>}<br /><span className="note">{[s.account_number && `Acct ${s.account_number}`, s.rep_name, s.phone, s.terms].filter(Boolean).join(' · ')}</span></span>
            <button type="button" className="btn sm ghost" onClick={() => setEditing(s)}>Edit</button>
          </div>
        ))}
        {!list.length && !editing && <p className="note">Add the wholesalers you order from. Keystone remembers which one quoted which part, and reads their invoices.</p>}
      </div>
    </section>
  );
}

function DevicesPanel({ data, onChanged }: { data: SettingsData; onChanged: () => void }) {
  const { siteId, toast } = useShop();
  const [pin, setPin] = useState('');
  const [signOut, setSignOut] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [origin] = useState(() => (typeof window !== 'undefined' ? window.location.origin : ''));
  const active = data.devices.filter(d => !d.revoked_at);
  return (
    <section className="panel">
      <div className="panel-head"><span className="panel-title"><Smartphone className="i" />Bay phones and tablets</span><a className="btn sm" href={`/shop-tech?siteId=${siteId}`} target="_blank" rel="noopener noreferrer">Open the tech view</a></div>
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="note">Techs don’t need their own logins. On the shop phone or tablet, open <span className="mono">{origin}/shop-tech</span> and enter the shop code and PIN once.</p>
        <div className="kv"><dt>Shop code</dt><dd className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{data.settings.tech_code || '—'}</dd><dt>PIN</dt><dd>{data.settings.has_tech_pin ? 'Set' : <span className="needs">Not set</span>}</dd></div>
        {error ? <RuleErrors error={error} /> : null}
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <KeyRound className="i muted" />
          <input className="input" inputMode="numeric" maxLength={8} placeholder={data.settings.has_tech_pin ? 'New PIN (4–8 digits)' : 'Set a PIN (4–8 digits)'} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
          <button type="button" className="btn primary" disabled={pin.length < 4} onClick={async () => {
            setError(null);
            try { await api(siteId, '/settings', { body: { action: 'pin', pin, sign_out_devices: signOut } }); setPin(''); toast('PIN saved.'); onChanged(); } catch (err) { setError(err); }
          }}>Save PIN</button>
        </div>
        {data.settings.has_tech_pin && <label className="check-inline"><input type="checkbox" checked={signOut} onChange={e => setSignOut(e.target.checked)} /> Also sign out every device</label>}
        <div className="stat-list">
          {active.map(d => (
            <div key={d.id}>
              <span>{d.label || 'Shop device'}<br /><span className="note">Last used {d.last_seen_at ? formatShortDateTime(d.last_seen_at) : 'never'}</span></span>
              <button type="button" className="btn sm ghost" onClick={async () => { try { await api(siteId, '/settings/devices', { method: 'DELETE', query: { id: d.id } }); toast('Device signed out.'); onChanged(); } catch (err) { toast(errorText(err), 'warn'); } }}>Sign out</button>
            </div>
          ))}
          {!active.length && <p className="note">No devices signed in.</p>}
        </div>
      </div>
    </section>
  );
}
