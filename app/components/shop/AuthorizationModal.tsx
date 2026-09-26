'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Globe, Mail, MessageSquare, Send, Shield } from 'lucide-react';
import { LAW } from '@/lib/shop/rules';
import { computeTotals, formatCents, toInvoiceLine } from '@/lib/shop/money';
import { shortVehicleLabel, roLabel } from '@/lib/shop/board';
import type { AuthMethod, Estimate, JobDetail } from '@/lib/shop/types';
import { api, errorText } from './api';
import { useShop } from './ShopContext';
import { Callout, Dialog, Field, LawNote, RuleErrors, Seg, SignaturePad, type SignaturePadHandle } from './ui';

function localNow(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function AuthorizationModal({ jobId, estimateId, onClose, onDone }: { jobId: string; estimateId: string | null; onClose: () => void; onDone: () => void }) {
  const { siteId, toast } = useShop();
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [methodPick, setMethod] = useState<AuthMethod>('phone');
  const [by, setBy] = useState('');
  const [phone, setPhone] = useState('');
  const [contact, setContact] = useState('');
  const [when, setWhen] = useState(localNow());
  const [takenBy, setTakenBy] = useState('');
  const [notes, setNotes] = useState('');
  const [partsBack, setPartsBack] = useState<'yes' | 'no' | ''>('');
  const [signature, setSignature] = useState<string | null>(null);
  const [declined, setDeclined] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [link, setLink] = useState<string | null>(null);
  const sigRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    api<JobDetail>(siteId, `/jobs/${jobId}`).then(d => {
      setDetail(d);
      setBy(d.customer.name);
      setPhone(d.customer.phone || '');
      setContact(d.customer.email || '');
    }).catch(err => setLoadError(errorText(err)));
  }, [jobId, siteId]);

  const estimate: Estimate | null = useMemo(() => {
    if (!detail) return null;
    if (estimateId) return detail.estimates.find(e => e.id === estimateId) ?? null;
    const open = [...detail.estimates].reverse().find(e => e.status === 'sent') ?? [...detail.estimates].reverse().find(e => e.status === 'draft');
    return open ?? null;
  }, [detail, estimateId]);

  // First estimates must be given in writing first; a revised estimate can be approved on the call.
  const isDraft = estimate?.status === 'draft' && !estimate.is_revision;

  const method: AuthMethod = isDraft && methodPick !== 'in_person' && methodPick !== 'online' ? 'in_person' : methodPick;
  const lines = estimate ? estimate.lines.filter(l => l.decision === 'include') : [];
  const chosen = estimate ? estimate.lines.map(l => (declined.has(l.id) ? { ...l, decision: 'declined' as const } : l)) : [];
  const total = detail ? computeTotals(chosen, detail.settings.tax_rate_bps).total_cents : 0;
  const approvedBefore = detail?.estimates.find(e => e.status === 'approved') ?? null;
  const approvedBeforeTotal = approvedBefore && detail ? computeTotals(approvedBefore.lines, detail.settings.tax_rate_bps).total_cents : 0;
  const staff = detail?.settings.staff ?? [];

  async function sendLink(via: 'email' | 'link' | 'text') {
    if (!estimate) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ url: string; emailed: boolean; texted: boolean }>(siteId, `/estimates/${estimate.id}`, { body: { action: 'send', via, to: via === 'text' ? detail?.customer.phone : contact } });
      setLink(res.url);
      if (via === 'email') toast(`Link sent to ${contact}. The approval shows up here when they tap Approve.`);
      if (via === 'text' && res.texted) toast(`Texted the link to ${detail?.customer.phone}. The approval shows up here when they tap Approve.`);
      else if (via === 'text' && detail?.customer.phone) window.location.href = `sms:${detail.customer.phone}?&body=${encodeURIComponent(`Your estimate from ${detail.site.name}: ${res.url}`)}`;
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!estimate) return;
    setSaving(true);
    setError(null);
    try {
      const decisions: Record<string, string> = {};
      for (const l of lines) decisions[l.id] = declined.has(l.id) ? 'declined' : 'include';
      await api(siteId, `/estimates/${estimate.id}`, {
        body: {
          action: 'authorize',
          method,
          authorized_by: by,
          phone: method === 'phone' ? phone : null,
          contact: method === 'email' ? contact : method === 'text' ? phone : null,
          authorized_at: method === 'in_person' ? null : new Date(when).toISOString(),
          taken_by: takenBy || null,
          notes,
          parts_back: partsBack === '' ? null : partsBack === 'yes',
          signature: method === 'in_person' ? signature : null,
          typed_name: method === 'in_person' && !signature ? by : null,
          decisions,
        },
      });
      toast(estimate.is_revision ? `Approval saved on revised estimate v${estimate.version}. The extra work can go on the invoice.` : `Approval saved. ${roLabel(detail!.job.ro_number)} is in Approved.`);
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  const title = estimate?.is_revision ? 'Get the OK for the extra work' : 'Record the customer’s approval';
  if (loadError) return <Dialog title={title} onClose={onClose}><RuleErrors error={loadError} /></Dialog>;
  if (!detail) return <Dialog title={title} onClose={onClose}><div className="skel" style={{ width: '60%' }} /><div className="skel" style={{ width: '85%' }} /></Dialog>;
  if (!estimate) {
    return (
      <Dialog title={title} onClose={onClose} footer={<button type="button" className="btn" onClick={onClose}>Close</button>}>
        <Callout tone="warn">Write the estimate and give it to the customer first. There’s nothing to approve yet.</Callout>
      </Dialog>
    );
  }
  const first = detail.customer.name.split(' ')[0];

  return (
    <Dialog
      title={title}
      eyebrow={`${roLabel(detail.job.ro_number)} · ${shortVehicleLabel(detail.vehicle)} · ${estimate.is_revision ? 'revised ' : ''}estimate v${estimate.version}`}
      onClose={onClose}
      labelId="au-t"
      footer={method === 'online' ? (
        <>
          <button type="button" className="btn" onClick={onClose}>{link ? 'Done' : 'Cancel'}</button>
          {detail.customer.phone && <button type="button" className="btn" disabled={saving} onClick={() => sendLink('text')}><MessageSquare className="i" />Text the link</button>}
          <button type="button" className="btn primary" disabled={saving || !contact} onClick={() => sendLink('email')}><Send className="i" />Email the approval link</button>
        </>
      ) : (
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" disabled={saving} onClick={save}><Shield className="i" />{saving ? 'Saving…' : 'Save approval'}</button>
        </>
      )}
    >
      {error ? <RuleErrors error={error} /> : null}
      <Seg<AuthMethod>
        label="How they approved"
        value={method}
        onChange={setMethod}
        options={[
          { value: 'phone', label: 'Phone call', disabled: isDraft },
          { value: 'in_person', label: 'In person' },
          { value: 'online', label: 'Online link' },
          { value: 'email', label: 'Email', disabled: isDraft },
          { value: 'text', label: 'Text', disabled: isDraft },
        ]}
      />
      {isDraft && method !== 'online' && <p className="note">This version hasn’t been given to {first} yet. At the counter they can read it and sign here; otherwise send it first.</p>}

      {method === 'phone' && (
        <div className="grid2">
          <Field label="Who approved" required htmlFor="au-by"><input id="au-by" className="input" value={by} onChange={e => setBy(e.target.value)} /></Field>
          <Field label="Number you called" required htmlFor="au-ph"><input id="au-ph" className="input" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></Field>
          <Field label="Date and time" required htmlFor="au-when"><input id="au-when" className="input" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></Field>
          <Field label="Who took the call" htmlFor="au-staff">
            <select id="au-staff" className="input" value={takenBy} onChange={e => setTakenBy(e.target.value)}>
              <option value="">Service desk</option>
              {staff.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </Field>
        </div>
      )}
      {method === 'in_person' && (
        <>
          <div className="grid2">
            <Field label="Name" required htmlFor="au-by"><input id="au-by" className="input" value={by} onChange={e => setBy(e.target.value)} /></Field>
            <Field label="Staff member" htmlFor="au-staff">
              <select id="au-staff" className="input" value={takenBy} onChange={e => setTakenBy(e.target.value)}>
                <option value="">Service desk</option>
                {staff.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label={`${first} signs here`} required>
            <SignaturePad ref={sigRef} onChange={setSignature} />
            <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn sm ghost" onClick={() => sigRef.current?.clear()}>Clear</button></div>
          </Field>
        </>
      )}
      {(method === 'email' || method === 'text') && (
        <div className="grid2">
          <Field label="Who approved" required htmlFor="au-by"><input id="au-by" className="input" value={by} onChange={e => setBy(e.target.value)} /></Field>
          <Field label={method === 'email' ? 'Email address it came from' : 'Number the text came from'} required htmlFor="au-contact">
            <input id="au-contact" className="input" value={method === 'text' ? phone : contact} onChange={e => (method === 'text' ? setPhone(e.target.value) : setContact(e.target.value))} />
          </Field>
          <Field label="Date and time" required htmlFor="au-when"><input id="au-when" className="input" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></Field>
        </div>
      )}
      {method === 'online' && (
        <>
          <Callout icon={<Globe className="i" />}>
            <b>Keystone sends {first} a link</b> to the estimate on your website. When they type their name and tap Approve, the approval, time and device are saved here on their own. Nothing to fill in.
          </Callout>
          <Field label="Send to" htmlFor="au-mail"><div className="row" style={{ flexWrap: 'nowrap' }}><Mail className="i muted" /><input id="au-mail" className="input" type="email" value={contact} onChange={e => setContact(e.target.value)} /></div></Field>
          {link && (
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input className="input mono" readOnly value={link} onFocus={e => e.currentTarget.select()} />
              <button type="button" className="btn" onClick={() => { navigator.clipboard?.writeText(link); toast('Link copied.'); }}><Copy className="i" />Copy</button>
            </div>
          )}
          {!link && <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} disabled={saving} onClick={() => sendLink('link')}><Copy className="i" />Just get the link</button>}
        </>
      )}

      {method !== 'online' && (
        <>
          {method !== 'in_person' && (
            <Field label="Notes" htmlFor="au-notes"><input id="au-notes" className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything they said about the work" /></Field>
          )}
          <Field label="What they’re approving">
            <div className="checklist">
              {lines.map(l => (
                <label key={l.id}>
                  <span>{l.description || 'Untitled line'}{l.is_added_work ? <span className="kind extra" style={{ marginLeft: 6 }}>EXTRA</span> : null}</span>
                  <span className="num">{formatCents(toInvoiceLine(l).amount_cents)}</span>
                  <input type="checkbox" checked={!declined.has(l.id)} onChange={e => {
                    const next = new Set(declined);
                    if (e.target.checked) next.delete(l.id); else next.add(l.id);
                    setDeclined(next);
                  }} />
                </label>
              ))}
            </div>
            <p className="note num">
              {estimate.is_revision
                ? <>Revised total: <b>{formatCents(total)}</b> (was {formatCents(approvedBeforeTotal)}). Once saved it replaces the approved version.</>
                : <>Approved total: <b>{formatCents(total)}</b> · the bill can go up to {formatCents(Math.floor(total * 1.1))} (10%) without asking again.</>}
            </p>
          </Field>
          <Field label="Do they want the replaced parts back?" required>
            <Seg<'yes' | 'no' | ''>
              label="Replaced parts"
              value={partsBack}
              onChange={setPartsBack}
              options={[{ value: 'yes', label: 'Yes, give them back' }, { value: 'no', label: 'No, they don’t want them' }]}
            />
          </Field>
          <LawNote law={LAW.auth} />
        </>
      )}
    </Dialog>
  );
}
