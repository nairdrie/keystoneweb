'use client';

import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Calendar, Check, Copy, DollarSign, FileText, Key, Landmark, Mail, PenLine, Phone, Printer, Shield, Sparkles, Trash2, Wrench, X,
} from 'lucide-react';
import { LAW, buildSchedule, capCheck, estimateFeeChargeable, lienCheck, ppsrExpiresOn, saleEligibleOn } from '@/lib/shop/rules';
import { applyAdjustments, centsToInput, computeTotals, formatCents, lineTotalCents, parseMoneyToCents } from '@/lib/shop/money';
import { buildAcknowledgmentDoc, buildInvoiceSnapshot, shopIdentity } from '@/lib/shop/documents';
import { addDays, daysBetween, formatDate, formatDateTime, todayISO } from '@/lib/shop/dates';
import { invoiceLabel, roLabel, vehicleLabel } from '@/lib/shop/board';
import type { Lien, LineAdjustment, PaymentMethod } from '@/lib/shop/types';
import { api, shopUrl } from '../api';
import { useShop } from '../ShopContext';
import { Callout, Dialog, Field, LawNote, Pill, RuleErrors, Seg, SignaturePad, type SignaturePadHandle } from '../ui';
import { InvoicePaper } from '../Paper';
import type { Detail } from './JobFile';

type Act = (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;

export default function InvoiceTab({ d, act, reload }: { d: Detail; act: Act; reload: () => Promise<void> }) {
  const { siteId, openAuth, toast } = useShop();
  const [issueOpen, setIssueOpen] = useState<null | 'repair' | 'estimate_fee'>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [lienOpen, setLienOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const { job, estimates, settings } = d;
  const approved = estimates.find(e => e.status === 'approved') ?? null;
  const revision = estimates.find(e => e.is_revision && (e.status === 'draft' || e.status === 'sent')) ?? null;
  const inv = d.invoice;
  const paid = inv ? d.payments.filter(p => p.invoice_id === inv.id).reduce((s, p) => s + p.amount_cents, 0) : 0;
  const balance = inv ? inv.total_cents - paid : 0;
  const first = d.customer.name.split(' ')[0];
  const lien = d.lien && d.lien.status !== 'cancelled' ? d.lien : null;

  const preview = useMemo(() => {
    if (inv) return null;
    const kind = approved ? 'repair' : 'estimate_fee';
    return buildInvoiceSnapshot({
      job, customer: d.customer, vehicle: d.vehicle, estimates, authorizations: d.authorizations, settings, site: d.site,
      number: null, issuedOn: todayISO(), odometerOut: job.odometer_out, returnedOn: null, kind,
    });
  }, [inv, approved, job, d, estimates, settings]);

  // ── No approved estimate ─────────────────────────────────────────────────
  if (!approved && !inv) {
    const declined = estimates.some(e => e.status === 'declined' && !e.is_revision);
    if (declined && estimateFeeChargeable(job, false) && preview) {
      return (
        <>
          <Callout icon={<FileText className="i" />}><b>The repair was declined.</b> {first} agreed to a {formatCents(job.estimate_fee_cents)} estimate fee before the estimate, so it can be charged (CPA s. 57).</Callout>
          <InvoicePaper s={preview.snapshot} />
          <div className="row">
            <button type="button" className="btn primary" onClick={() => setIssueOpen('estimate_fee')}><Check className="i" />Issue the estimate-fee invoice</button>
          </div>
          {issueOpen && <IssueModal d={d} kind={issueOpen} onClose={() => setIssueOpen(null)} onDone={() => { setIssueOpen(null); act(async () => {}); }} />}
        </>
      );
    }
    return <div className="empty">Invoices are built from the approved estimate. This job doesn’t have one yet.</div>;
  }

  const approvedTotal = approved ? computeTotals(approved.lines, settings.tax_rate_bps).total_cents : 0;
  const billed = inv ? inv.total_cents : preview!.totals.total_cents;
  const withExtra = revision ? computeTotals(applyAdjustments(revision.lines.filter(l => l.decision === 'include'), {}), settings.tax_rate_bps).total_cents : billed;
  const shown = revision && !inv ? withExtra : billed;
  const cap = capCheck(approvedTotal, shown);
  const scaleMax = Math.max(cap.limitCents, shown) * 1.08 || 1;
  const pct = approvedTotal ? (shown / approvedTotal - 1) * 100 : 0;
  const supplierInvoices = [...new Set(d.parts_received.map(p => p.bill_invoice_number).filter(Boolean))] as string[];
  const doneNote = d.events.some(e => e.kind === 'voice' && (e.meta as { mode?: string }).mode === 'done');
  const holdDays = job.holding_since ? daysBetween(job.holding_since) : 0;

  return (
    <>
      {approved && (
        <Callout icon={<Sparkles className="i" />}>
          <b>Built for you</b> from estimate v{approved.version} (approved){supplierInvoices.length ? `, ${supplierInvoices.length} supplier invoice${supplierInvoices.length > 1 ? 's' : ''} (${supplierInvoices.join(', ')})` : ''}{doneNote ? ' and the tech’s “done” note' : ''}. Nobody retyped anything.
        </Callout>
      )}
      {revision && !inv && (
        <Callout tone="warn" icon={<AlertTriangle className="i" />}>
          <b>Extra work isn’t on the approved estimate yet.</b>
          {revision.lines.filter(l => l.is_added_work && l.decision === 'include').map(l => <div key={l.id} className="num" style={{ marginTop: 4 }}>• {l.description || 'Untitled line'}: {formatCents(lineTotalCents(l))}</div>)}
          <div style={{ marginTop: 6 }}>With it, the bill would be {formatCents(withExtra)}: <b>{pct.toFixed(1)}% {pct >= 0 ? 'over' : 'under'}</b> the {formatCents(approvedTotal)} {first} approved. Extra work needs a revised estimate and {first}’s OK before it goes on the bill, even when it’s under 10%.</div>
          <div className="row">
            <button type="button" className="btn primary sm" onClick={() => openAuth({ jobId: job.id, estimateId: revision.id })}><Phone className="i" />Get {first}’s OK</button>
            <button type="button" className="btn sm" onClick={() => {
              if (revision.status === 'draft') { if (confirm('Leave the extra work off the bill? The revised estimate is deleted.')) act(() => api(siteId, `/estimates/${revision.id}`, { method: 'DELETE' }), 'Extra work left off the bill.'); }
              else act(() => api(siteId, `/estimates/${revision.id}`, { body: { action: 'decline', reason: 'Left off the bill' } }), 'Extra work left off the bill.');
            }}>Leave it off</button>
          </div>
        </Callout>
      )}
      {approved && (
        <div className="block">
          <h4><Shield className="i" />10% check</h4>
          <div className="meter" role="img" aria-label={`Invoice ${formatCents(shown)} against approved ${formatCents(approvedTotal)}, limit ${formatCents(cap.limitCents)}`}>
            <div className={`fill${cap.ok ? '' : ' over'}`} style={{ width: `${Math.min(100, (shown / scaleMax) * 100)}%` }} />
            <div className="appr" style={{ left: `${(approvedTotal / scaleMax) * 100}%` }} />
            <div className="cap" style={{ left: `${(cap.limitCents / scaleMax) * 100}%` }}><span>Limit {formatCents(cap.limitCents)}</span></div>
          </div>
          <div className="meter-legend"><span>Approved {formatCents(approvedTotal)}</span><span>{revision && !inv ? 'With the extra work' : inv ? 'This invoice' : 'Bill so far'} {formatCents(shown)} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)</span></div>
          {!cap.ok && !revision && <p className="note needs" style={{ marginTop: 6 }}>Over the limit. Lower the bill or get a revised estimate approved before you can issue it.</p>}
        </div>
      )}
      {!inv && approved && <Adjustments d={d} act={act} />}
      {inv ? <InvoicePaper s={inv.snapshot} paidCents={paid} /> : preview && <InvoicePaper s={preview.snapshot} />}

      <div className="row">
        {inv ? (
          balance > 0 ? <>
            <button type="button" className="btn primary" onClick={() => setPayOpen(true)}><DollarSign className="i" />Record payment</button>
            {!lien && <button type="button" className="btn" onClick={() => setLienOpen(true)}><Landmark className="i" />Can’t pay in full</button>}
            <button type="button" className="btn" onClick={() => act(() => api(siteId, `/invoices/${inv.id}`, { body: { action: 'send' } }), `Emailed to ${d.customer.email}.`)} disabled={!d.customer.email}><Mail className="i" />Email it</button>
            <CopyPayLink d={d} />
          </> : <Pill tone="ok" icon={<Check className="i" />}>Paid in full</Pill>
        ) : job.stage === 'done' ? <>
          <button type="button" className="btn primary" disabled={!!revision || !cap.ok} onClick={() => setIssueOpen('repair')}><Check className="i" />Issue invoice</button>
          {revision && <span className="note">Sort out the extra work first.</span>}
        </> : <>
          <span className="note">The invoice fills in as parts arrive and the work gets done. Issue it once the car is in “Done · parked”.</span>
          {job.status === 'open' && <button type="button" className="btn" onClick={() => act(() => api(siteId, `/jobs/${job.id}`, { body: { action: 'done', kind: 'repair' } }), 'Repair done. The car is in Done · parked.')}><Wrench className="i" />Mark repair done</button>}
        </>}
        {inv && <a className="btn" href={shopUrl(siteId, `/invoices/${inv.id}/pdf`)} target="_blank" rel="noopener noreferrer"><Printer className="i" />PDF</a>}
        {inv && paid === 0 && !lien && <button type="button" className="btn ghost" onClick={() => setVoidOpen(true)}><X className="i" />Void</button>}
      </div>

      {inv && balance > 0 && !lien && job.status === 'open' && (
        <div className="block">
          <h4><Key className="i" />Holding the car</h4>
          {job.holding_since ? (
            <div className="countdown">
              <span className="big">{holdDays}</span>
              <p><b>Days held for payment.</b> Only this invoice counts. From {formatDate(saleEligibleOn(inv.issued_at.slice(0, 10)))} you could start a sale, with written notice at least 15 days before it goes to the customer, the owner and anyone registered against the car. <span className="cite">{LAW.hold.cite}</span></p>
            </div>
          ) : <p className="note">If they can’t pay at pickup, you can keep the car until the bill is paid, or release it on a signed payment plan.</p>}
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn sm" onClick={() => act(() => api(siteId, `/jobs/${job.id}`, { body: { action: 'hold', hold: !job.holding_since } }), job.holding_since ? 'Stopped holding the car.' : 'Holding the car until it’s paid.')}>
              <Key className="i" />{job.holding_since ? 'Stop holding it' : 'Keep the car until paid'}
            </button>
          </div>
        </div>
      )}

      {lien && <LienSummary lien={lien} d={d} />}

      {inv && d.payments.filter(p => p.invoice_id === inv.id).length > 0 && (
        <div className="block">
          <h4><DollarSign className="i" />Payments</h4>
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th className="r">Amount</th><th /></tr></thead>
            <tbody>{d.payments.filter(p => p.invoice_id === inv.id).map(p => (
              <tr key={p.id}>
                <td>{formatDate(p.received_at.slice(0, 10))}</td><td>{p.method}{p.lien_id ? ' · plan' : ''}</td><td>{p.reference || '—'}</td><td className="r">{formatCents(p.amount_cents)}</td>
                <td className="r">{!p.provider_ref && daysBetween(p.received_at) < 7 && (
                  <button type="button" className="icon-btn" aria-label="Delete payment" onClick={() => { if (confirm('Delete this payment? Only for one entered by mistake.')) act(() => api(siteId, `/payments/${p.id}`, { method: 'DELETE' }), 'Payment deleted.'); }}><Trash2 className="i" /></button>
                )}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
      {d.void_invoices.length > 0 && <p className="note">Voided: {d.void_invoices.map(v => `${invoiceLabel(v.invoice_number)} (${v.void_reason})`).join('; ')}</p>}

      {issueOpen && <IssueModal d={d} kind={issueOpen} onClose={() => setIssueOpen(null)} onDone={() => { setIssueOpen(null); act(async () => {}); }} />}
      {payOpen && inv && <PaymentModal d={d} balance={balance} onClose={() => setPayOpen(false)} onDone={msg => { setPayOpen(false); act(async () => {}, msg); }} />}
      {lienOpen && inv && <LienWizard d={d} balance={balance} onClose={() => setLienOpen(false)} onDone={msg => { setLienOpen(false); toast(msg); reload(); act(async () => {}); }} />}
      {voidOpen && inv && <VoidModal d={d} onClose={() => setVoidOpen(false)} act={act} />}
    </>
  );
}

function CopyPayLink({ d }: { d: Detail }) {
  const { toast, siteId } = useShop();
  if (!d.invoice?.public_token || !d.site.base_url) return null;
  const url = `${d.site.base_url}/shop-doc/${d.invoice.public_token}`;
  return (
    <>
      <button type="button" className="btn" onClick={() => { navigator.clipboard?.writeText(url); toast(d.site.stripe || d.site.paypal ? 'Pay link copied. Text or email it.' : 'Invoice link copied.'); }}><Copy className="i" />Copy {d.site.stripe || d.site.paypal ? 'pay' : 'invoice'} link</button>
      {d.customer.phone && (d.site.sms
        ? <button type="button" className="btn" onClick={async () => { try { await api(siteId, `/invoices/${d.invoice!.id}`, { body: { action: 'text' } }); toast(`Texted to ${d.customer.phone}.`); } catch (err) { toast(err instanceof Error ? err.message : 'The text didn’t send.', 'warn'); } }}>Text it</button>
        : <a className="btn" href={`sms:${d.customer.phone}?&body=${encodeURIComponent(`Your invoice from ${d.site.name}: ${url}`)}`}>Text it</a>)}
    </>
  );
}

function Adjustments({ d, act }: { d: Detail; act: Act }) {
  const { siteId } = useShop();
  const approved = d.estimates.find(e => e.status === 'approved')!;
  const lines = approved.lines.filter(l => l.decision === 'include');
  const [open, setOpen] = useState(Object.keys(d.job.invoice_adjustments || {}).length > 0);
  const [adj, setAdj] = useState<Record<string, Record<string, string>>>(() => {
    const out: Record<string, Record<string, string>> = {};
    for (const [id, a] of Object.entries(d.job.invoice_adjustments || {})) {
      out[id] = {
        hours: a.hours != null ? String(a.hours) : '', qty: a.qty != null ? String(a.qty) : '',
        unit_price_cents: a.unit_price_cents != null ? centsToInput(a.unit_price_cents) : '', amount_cents: a.amount_cents != null ? centsToInput(Math.abs(a.amount_cents)) : '',
      };
    }
    return out;
  });
  const payload = () => {
    const out: Record<string, LineAdjustment> = {};
    for (const [id, a] of Object.entries(adj)) {
      const x: LineAdjustment = {};
      if (a.hours?.trim()) x.hours = Number(a.hours);
      if (a.qty?.trim()) x.qty = Number(a.qty);
      if (a.unit_price_cents?.trim()) x.unit_price_cents = parseMoneyToCents(a.unit_price_cents) ?? undefined;
      if (a.amount_cents?.trim()) x.amount_cents = parseMoneyToCents(a.amount_cents) ?? undefined;
      if (Object.keys(x).length) out[id] = x;
    }
    return out;
  };
  if (!open) return <button type="button" className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}><PenLine className="i" />Change hours or prices before invoicing</button>;
  const set = (id: string, k: string, v: string) => setAdj(a => ({ ...a, [id]: { ...(a[id] || {}), [k]: v } }));
  return (
    <div className="block">
      <h4><PenLine className="i" />Actual hours and final prices</h4>
      <div className="table-wrap"><table className="t mini">
        <thead><tr><th>Line</th><th className="r">Approved</th><th className="r">Actual</th></tr></thead>
        <tbody>{lines.map(l => (
          <tr key={l.id}>
            <td>{l.description}</td>
            <td className="r">{l.kind === 'labour' ? `${Number(l.hours ?? 0).toFixed(1)} h` : l.kind === 'part' ? `${Number(l.qty)} × ${formatCents(l.unit_price_cents)}` : formatCents(lineTotalCents(l))}</td>
            <td className="r">
              {l.kind === 'labour' && <input className="input sm num" style={{ width: 80 }} placeholder={String(l.hours ?? '')} value={adj[l.id]?.hours ?? ''} onChange={e => set(l.id, 'hours', e.target.value)} aria-label="Actual hours" />}
              {l.kind === 'part' && <span className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}><input className="input sm num" style={{ width: 56 }} placeholder={String(l.qty)} value={adj[l.id]?.qty ?? ''} onChange={e => set(l.id, 'qty', e.target.value)} aria-label="Quantity" /><input className="input sm num" style={{ width: 90 }} placeholder={centsToInput(l.unit_price_cents)} value={adj[l.id]?.unit_price_cents ?? ''} onChange={e => set(l.id, 'unit_price_cents', e.target.value)} aria-label="Price each" /></span>}
              {['supply', 'fee', 'sublet', 'discount'].includes(l.kind) && <input className="input sm num" style={{ width: 90 }} placeholder={centsToInput(Math.abs(l.amount_cents ?? 0))} value={adj[l.id]?.amount_cents ?? ''} onChange={e => set(l.id, 'amount_cents', e.target.value)} aria-label="Amount" />}
            </td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="btn sm primary" onClick={() => act(() => api(siteId, `/jobs/${d.job.id}`, { body: { action: 'adjustments', adjustments: payload() } }), 'Invoice updated.')}>Save changes</button>
        <span className="note">The bill can go up to 10% over the approved estimate. More than that needs a revised estimate.</span>
      </div>
    </div>
  );
}

function IssueModal({ d, kind, onClose, onDone }: { d: Detail; kind: 'repair' | 'estimate_fee'; onClose: () => void; onDone: () => void }) {
  const { siteId, toast } = useShop();
  const [odo, setOdo] = useState(String(d.job.odometer_out ?? d.job.odometer_in ?? d.vehicle.last_odometer ?? ''));
  const [returned, setReturned] = useState('');
  const [email, setEmail] = useState(!!d.customer.email);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title={kind === 'repair' ? 'Issue the invoice' : 'Issue the estimate-fee invoice'} eyebrow={`${roLabel(d.job.ro_number)} · ${d.customer.name}`} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button type="button" className="btn primary" disabled={busy} onClick={async () => {
        setBusy(true); setError(null);
        try {
          const res = await api<{ invoice: { invoice_number: number } }>(siteId, `/jobs/${d.job.id}`, { body: { action: 'invoice', kind, odometer_out: odo.replace(/[^0-9]/g, '') || null, returned_on: returned || null, send_email: email } });
          toast(`${invoiceLabel(res.invoice.invoice_number)} issued${email ? ` and emailed to ${d.customer.email}` : ''}.`);
          onDone();
        } catch (err) { setError(err); } finally { setBusy(false); }
      }}><Check className="i" />{busy ? 'Issuing…' : 'Issue invoice'}</button>
    </>}>
      {error ? <RuleErrors error={error} /> : null}
      <div className="grid2">
        <Field label="Odometer when returned" required={kind === 'repair'} hint={d.job.odometer_in != null ? `In: ${d.job.odometer_in.toLocaleString('en-CA')} km` : undefined} htmlFor="iss-odo"><input id="iss-odo" className="input num" inputMode="numeric" value={odo} onChange={e => setOdo(e.target.value)} /></Field>
        <Field label="Returned to the customer" hint="Leave blank if they haven’t picked it up yet." htmlFor="iss-ret"><input id="iss-ret" className="input" type="date" value={returned} onChange={e => setReturned(e.target.value)} /></Field>
      </div>
      {d.customer.email && <label className="check-inline"><input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} /> Email it to {d.customer.email}{d.site.stripe || d.site.paypal ? ' with a link to pay online' : ''}</label>}
      <p className="note">Once issued, the invoice is frozen with a number. Changes after that mean voiding it and issuing a new one.</p>
    </Dialog>
  );
}

const PAY_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'debit', label: 'Debit' }, { value: 'credit', label: 'Credit' }, { value: 'cash', label: 'Cash' },
  { value: 'etransfer', label: 'E-transfer' }, { value: 'cheque', label: 'Cheque' }, { value: 'other', label: 'Other' },
];

export function PaymentModal({ d, balance, onClose, onDone, lienNote }: { d: Detail; balance: number; onClose: () => void; onDone: (msg: string) => void; lienNote?: string }) {
  const { siteId } = useShop();
  const [amount, setAmount] = useState(centsToInput(balance));
  const [method, setMethod] = useState<PaymentMethod>('debit');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title="Record a payment" eyebrow={`${d.invoice ? invoiceLabel(d.invoice.invoice_number) : ''} · ${d.customer.name}`} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button type="button" className="btn primary" disabled={busy} onClick={async () => {
        setBusy(true); setError(null);
        try {
          const cents = parseMoneyToCents(amount) ?? 0;
          const res = await api<{ balance_cents: number }>(siteId, `/invoices/${d.invoice!.id}`, { body: { action: 'payment', amount_cents: cents, method, reference, received_at: date === todayISO() ? null : `${date}T12:00:00` } });
          onDone(res.balance_cents > 0 ? `${formatCents(cents)} recorded. ${formatCents(res.balance_cents)} still owing.` : `Paid in full. ${roLabel(d.job.ro_number)} is closed.${d.job.key_tag ? ` Hand back key ${d.job.key_tag}.` : ''}`);
        } catch (err) { setError(err); } finally { setBusy(false); }
      }}><Check className="i" />Save payment</button>
    </>}>
      {error ? <RuleErrors error={error} /> : null}
      <div className="grid2">
        <Field label="Amount" htmlFor="py-amt"><input id="py-amt" className="input num" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
        <Field label="Reference" htmlFor="py-ref"><input id="py-ref" className="input" value={reference} onChange={e => setReference(e.target.value)} placeholder="Last 4 digits, cheque number…" /></Field>
      </div>
      <Field label="Method"><Seg label="Payment method" value={method} onChange={setMethod} options={PAY_METHODS} /></Field>
      <Field label="Received" htmlFor="py-date"><input id="py-date" className="input" type="date" max={todayISO()} value={date} onChange={e => setDate(e.target.value)} /></Field>
      <p className="note num">{lienNote || `Balance ${formatCents(balance)}. If they can’t pay it all, record what they pay and use “Can’t pay in full” for the rest.`}</p>
    </Dialog>
  );
}

function VoidModal({ d, onClose, act }: { d: Detail; onClose: () => void; act: Act }) {
  const { siteId } = useShop();
  const [reason, setReason] = useState('');
  return (
    <Dialog title="Void this invoice" eyebrow={invoiceLabel(d.invoice!.invoice_number)} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>Cancel</button>
      <button type="button" className="btn primary" disabled={!reason.trim()} onClick={async () => { if (await act(() => api(siteId, `/invoices/${d.invoice!.id}`, { body: { action: 'void', reason } }), 'Invoice voided. You can issue a new one.')) onClose(); }}>Void it</button>
    </>}>
      <Field label="Why" required hint="Kept on file with the voided invoice." htmlFor="void-r"><input id="void-r" className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Wrong odometer reading" /></Field>
    </Dialog>
  );
}

function LienSummary({ lien, d }: { lien: Lien; d: Detail }) {
  const { siteId, href } = useShop();
  return (
    <div className="block">
      <h4><Landmark className="i" />Payment plan and lien</h4>
      <div className="checks">
        <div className="check ok"><span className="ci"><Check className="i" /></span><div className="ct"><b>Released on a signed acknowledgment</b> <span className="cite">{LAW.ack.cite}</span><p>{lien.ack_signer_name} signed {formatDateTime(lien.ack_signed_at)}. {formatCents(lien.amount_owing_cents)} owing after a {formatCents(lien.down_payment_cents)} down payment.</p></div></div>
        <div className={`check ${lien.ppsr_registration_number ? 'ok' : 'warn'}`}><span className="ci">{lien.ppsr_registration_number ? <Check className="i" /> : <AlertTriangle className="i" />}</span><div className="ct"><b>{lien.ppsr_registration_number ? 'Claim for lien registered in the PPSR' : 'Register the claim for lien'}</b> <span className="cite">{LAW.ppsr.cite}</span><p>{lien.ppsr_registration_number ? `No. ${lien.ppsr_registration_number}, expires ${formatDate(lien.ppsr_expires_on)}.` : `Until it’s registered, a sale of the car wipes out your lien. VIN ${d.vehicle.vin || '—'}.`}</p></div></div>
        <div className={`check ${lien.status === 'discharged' ? 'ok' : lien.status === 'paid' && lien.ppsr_registration_number ? 'warn' : 'todo'}`}><span className="ci">{lien.status === 'discharged' ? <Check className="i" /> : null}</span><div className="ct"><b>{LAW.discharge.short}</b> <span className="cite">{LAW.discharge.cite}</span><p>{lien.status === 'discharged' ? 'Discharged.' : lien.status === 'paid' ? (lien.discharge_due_on ? `Paid off. Register the discharge by ${formatDate(lien.discharge_due_on)}.` : 'Paid off. Nothing was registered, so there’s nothing to discharge.') : 'Keystone reminds you the day the last payment clears.'}</p></div></div>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <a className="btn sm" href={href('/money', { lien: lien.id })}><Landmark className="i" />Open the lien file</a>
        <a className="btn sm" href={shopUrl(siteId, `/liens/${lien.id}/pdf`)} target="_blank" rel="noopener noreferrer"><Printer className="i" />Signed acknowledgment</a>
      </div>
    </div>
  );
}

// ── Lien / payment plan wizard ─────────────────────────────────────────────

type Freq = 'single' | 'weekly' | 'biweekly' | 'monthly';

function LienWizard({ d, balance, onClose, onDone }: { d: Detail; balance: number; onClose: () => void; onDone: (msg: string) => void }) {
  const { siteId } = useShop();
  const [step, setStep] = useState(1);
  const [down, setDown] = useState('0.00');
  const [downMethod, setDownMethod] = useState<PaymentMethod>('debit');
  const [freq, setFreq] = useState<Freq>('biweekly');
  const [pay, setPay] = useState(centsToInput(Math.max(100, Math.round(balance / 6 / 100) * 100)));
  const [firstDue, setFirstDue] = useState(addDays(todayISO(), 14));
  const [signer, setSigner] = useState(d.customer.name);
  const [capacity, setCapacity] = useState<'owner' | 'authorized_agent'>(d.job.owner_is_customer ? 'owner' : 'authorized_agent');
  const [signature, setSignature] = useState<string | null>(null);
  const [disclosure, setDisclosure] = useState(false);
  const [debtorName, setDebtorName] = useState(d.customer.name);
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState(d.customer.address || '');
  const [years, setYears] = useState(1);
  const [reg, setReg] = useState('');
  const [emailCopy, setEmailCopy] = useState(!!d.customer.email);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);

  const check = lienCheck(d);
  const downCents = Math.max(0, parseMoneyToCents(down) ?? 0);
  const owing = balance - downCents;
  const single = freq === 'single';
  const schedule = owing > 0 ? buildSchedule({ owingCents: owing, planKind: single ? 'single' : 'instalments', frequency: single ? null : freq, instalmentCents: parseMoneyToCents(pay), firstDue }) : [];
  const first = d.customer.name.split(' ')[0];
  const inv = d.invoice!;
  const ack = buildAcknowledgmentDoc({
    shop: shopIdentity(d.settings, d.site), customer: d.customer, vehicle: d.vehicle,
    invoice: { label: invoiceLabel(inv.invoice_number), issued_on: inv.issued_at.slice(0, 10), total_cents: inv.total_cents },
    owingCents: owing, downPaymentCents: downCents, planKind: single ? 'single' : 'instalments', frequency: single ? null : freq, schedule,
    signerName: signer, signerCapacity: capacity, releasedOn: todayISO(), signedAt: null,
  });
  const steps = ['Choose', 'Plan', 'Sign', 'Register'];
  const titles = ['', 'Can’t pay in full', 'Set up the payment plan', 'Sign the acknowledgment', 'Register the lien'];

  async function hold() {
    setBusy(true); setError(null);
    try { await api(siteId, `/jobs/${d.job.id}`, { body: { action: 'hold', hold: true } }); onDone('Holding the car until the bill is paid.'); }
    catch (err) { setError(err); } finally { setBusy(false); }
  }
  async function release() {
    setBusy(true); setError(null);
    try {
      await api(siteId, `/jobs/${d.job.id}`, {
        body: {
          action: 'release', down_payment_cents: downCents, down_payment_method: downMethod, plan_kind: single ? 'single' : 'instalments',
          frequency: single ? null : freq, instalment_cents: parseMoneyToCents(pay), first_due: firstDue, signer_name: signer, signer_capacity: capacity,
          signature, credit_disclosure_given: disclosure, debtor_legal_name: debtorName, debtor_dob: dob || null, debtor_address: address,
          ppsr_registration_number: reg || null, ppsr_years: years, send_email: emailCopy,
        },
      });
      onDone(reg ? `Car released. Lien registered (${reg}).` : 'Car released. “Register the lien” stays at the top of My desk until it’s done.');
    } catch (err) { setError(err); setStep(s => (s === 4 ? 4 : s)); } finally { setBusy(false); }
  }

  let body: React.ReactNode = null;
  let foot: React.ReactNode = null;
  if (step === 1) {
    body = <>
      {check.valid
        ? <Callout tone="ok" icon={<Shield className="i" />}><b>Your repair lien is valid.</b> The estimate, the estimate-fee agreement and {first}’s approval are all on file. Without them there’d be no lien to rely on. <span className="cite">{LAW.noLien.cite}</span></Callout>
        : <Callout tone="warn" icon={<AlertTriangle className="i" />}><b>No valid lien.</b> {check.reasons.join(' ')} Don’t hold the car; if it leaves unpaid, you’re an ordinary creditor. <span className="cite">{LAW.noLien.cite}</span></Callout>}
      <div className="choice">
        <button type="button" disabled={!check.valid || busy || !!d.job.holding_since} onClick={hold}>
          <Pill icon={<Key className="i" />}>Possessory lien</Pill><b>Keep the car until they pay</b><span>{LAW.hold.text}</span><span>Only for this bill. You can’t hold it for old balances from other visits.</span><span className="cite">{LAW.hold.cite}, 26</span>
        </button>
        <button type="button" disabled={!check.valid} onClick={() => setStep(2)}>
          <Pill tone="info" icon={<Landmark className="i" />}>Non-possessory lien</Pill><b>Give the car back on a payment plan</b><span>{first} signs an acknowledgment of what they owe. You register a claim for lien against the VIN the same day, so the car can’t be sold clear of it.</span><span className="cite">{LAW.ack.cite} · {LAW.ppsr.cite}</span>
        </button>
      </div>
    </>;
    foot = <button type="button" className="btn" onClick={onClose}>Cancel</button>;
  }
  if (step === 2) {
    body = <>
      <div className="grid2">
        <Field label="Paid today" htmlFor="lw-down"><input id="lw-down" className="input num" inputMode="decimal" value={down} onChange={e => setDown(e.target.value)} /></Field>
        {downCents > 0 && <Field label="Paid by" htmlFor="lw-dm"><select id="lw-dm" className="input" value={downMethod} onChange={e => setDownMethod(e.target.value as PaymentMethod)}>{PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>}
        <Field label="How they’ll pay the rest" htmlFor="lw-freq">
          <select id="lw-freq" className="input" value={freq} onChange={e => setFreq(e.target.value as Freq)}>
            <option value="single">One payment</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option>
          </select>
        </Field>
        {!single && <Field label="Each payment" htmlFor="lw-pay"><input id="lw-pay" className="input num" inputMode="decimal" value={pay} onChange={e => setPay(e.target.value)} /></Field>}
        <Field label={single ? 'Pay by' : 'First payment'} htmlFor="lw-first"><input id="lw-first" className="input" type="date" min={todayISO()} value={firstDue} onChange={e => setFirstDue(e.target.value)} /></Field>
      </div>
      <Callout icon={<Calendar className="i" />}>
        {owing <= 0 ? <b>The down payment covers the bill. Record it as a payment instead.</b>
          : single ? <><b>One payment of {formatCents(owing)}</b> by {schedule[0] ? formatDate(schedule[0].due) : '—'}, after {formatCents(downCents)} today.</>
            : <><b>{schedule.length} payments</b> after {formatCents(downCents)} today. The last one is {schedule.length ? `${formatDate(schedule[schedule.length - 1].due)} (${formatCents(schedule[schedule.length - 1].amount_cents)})` : '—'}.</>}
      </Callout>
      {single
        ? <div className="law"><Landmark className="i" /><div><b>Simplest option.</b> One interest-free payment with no fees isn’t treated as credit, so no disclosure statement is needed. <span className="cite">CPA 2002, s. 67</span></div></div>
        : <LawNote law={LAW.credit}>{LAW.credit.text} Keystone adds the statement to the signing step.</LawNote>}
    </>;
    foot = <><button type="button" className="btn" onClick={() => setStep(1)}>Back</button><button type="button" className="btn primary" disabled={owing <= 0 || !schedule.length || firstDue < todayISO()} onClick={() => setStep(3)}>Next: signature</button></>;
  }
  if (step === 3) {
    body = <>
      <div className="paper" style={{ padding: 20 }}>
        <div className="p-head"><div className="p-shop"><b>Acknowledgment of indebtedness and payment agreement</b><span className="p-muted">{ack.shop.name}{ack.shop.address ? ` · ${ack.shop.address}` : ''}</span></div><div className="p-doc"><span className="p-muted">{roLabel(d.job.ro_number)}<br />{ack.invoice_label}</span></div></div>
        <p style={{ marginTop: 12 }}>{ack.lien_text}</p>
        <p style={{ marginTop: 8 }}>{downCents > 0 ? `I have paid ${formatCents(downCents)} today. ` : ''}{ack.terms_text}</p>
        <div className="p-grid"><div><h5>Vehicle</h5>{ack.vehicle.description}<br /><span className="p-muted">VIN {ack.vehicle.vin || '—'} · Plate {ack.vehicle.plate || '—'}{ack.vehicle.color ? ` · ${ack.vehicle.color}` : ''}</span></div><div><h5>Released</h5>{formatDate(todayISO())}</div></div>
        <table><thead><tr><th>Due</th><th className="r">Amount</th></tr></thead><tbody>{schedule.map((s, i) => <tr key={i}><td>{formatDate(s.due)}</td><td className="r">{formatCents(s.amount_cents)}</td></tr>)}</tbody></table>
        {ack.credit_disclosure && (
          <div className="p-legal">
            <span><b>Credit disclosure statement (CPA 2002, Part VII)</b></span>
            <span>Amount of credit: {formatCents(ack.credit_disclosure.amount_financed_cents)} · Total of payments: {formatCents(ack.credit_disclosure.total_of_payments_cents)} · Cost of borrowing: {formatCents(0)} · {ack.credit_disclosure.apr_text}</span>
            <span>{ack.credit_disclosure.prepayment_text}</span>
            <span>{ack.credit_disclosure.default_text}</span>
          </div>
        )}
        <div className="p-sign">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div>{signature && <img src={signature} alt="Customer signature" />}Signature of {signer}{capacity === 'authorized_agent' ? ' (authorized agent)' : ''}</div>
          <div>Date: {formatDate(todayISO())}</div>
        </div>
      </div>
      <div className="grid2">
        <Field label="Signed by" htmlFor="lw-signer"><input id="lw-signer" className="input" value={signer} onChange={e => setSigner(e.target.value)} /></Field>
        <Field label="As" htmlFor="lw-cap"><select id="lw-cap" className="input" value={capacity} onChange={e => setCapacity(e.target.value as 'owner' | 'authorized_agent')}><option value="owner">Registered owner</option><option value="authorized_agent">Authorized agent of the owner</option></select></Field>
      </div>
      <Field label={`${signer.split(' ')[0] || first} signs here`} required>
        <SignaturePad ref={sigRef} onChange={setSignature} />
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn sm ghost" onClick={() => sigRef.current?.clear()}>Clear</button></div>
      </Field>
      {!single && <label className="check-inline"><input type="checkbox" checked={disclosure} onChange={e => setDisclosure(e.target.checked)} /> I gave {first} a copy of the credit disclosure statement before they signed</label>}
      <LawNote law={LAW.ack} />
    </>;
    foot = <><button type="button" className="btn" onClick={() => setStep(2)}>Back</button><button type="button" className="btn primary" disabled={!signature || (!single && !disclosure) || !signer.trim()} onClick={() => setStep(4)}><PenLine className="i" />Signed, next</button></>;
  }
  if (step === 4) {
    body = <>
      <div className="countdown"><span className="big">Today</span><p><b>Register the claim for lien before the day ends.</b> There’s no legal deadline, but if the car is sold or changes owners before you register, the lien is gone. The PPSR takes registrations Monday to Friday, 8 a.m. to 8 p.m. <span className="cite">{LAW.ppsr.cite}</span></p></div>
      <div className="grid2">
        <Field label="Debtor name for the PPSR" hint="First given name, middle initial, surname." htmlFor="lw-dname"><input id="lw-dname" className="input" value={debtorName} onChange={e => setDebtorName(e.target.value)} /></Field>
        <Field label="Date of birth" hint="Required for a person. Used only for this registration." htmlFor="lw-dob"><input id="lw-dob" className="input" type="date" value={dob} onChange={e => setDob(e.target.value)} /></Field>
        <Field label="Debtor address" htmlFor="lw-addr"><input id="lw-addr" className="input" value={address} onChange={e => setAddress(e.target.value)} /></Field>
        <Field label="Registration period" hint={`Runs to ${formatDate(ppsrExpiresOn(todayISO(), years))}. Can’t run past 3 years.`} htmlFor="lw-years">
          <select id="lw-years" className="input" value={years} onChange={e => setYears(Number(e.target.value))}>{[1, 2, 3].map(y => <option key={y} value={y}>{y} year{y > 1 ? 's' : ''} · {formatCents(800 * y)}</option>)}</select>
        </Field>
        <Field label="Registration number" hint="Add it now or later from the lien file." htmlFor="lw-reg"><input id="lw-reg" className="input mono" value={reg} onChange={e => setReg(e.target.value)} /></Field>
      </div>
      <div className="checks">
        <div className="check ok"><span className="ci"><Check className="i" /></span><div className="ct"><b>Signed acknowledgment saved to the file</b><p>{d.customer.email ? <label className="check-inline" style={{ minHeight: 0 }}><input type="checkbox" checked={emailCopy} onChange={e => setEmailCopy(e.target.checked)} /> Email a copy to {d.customer.email}{single ? '' : ' with the credit disclosure statement'}</label> : 'Print a copy for them from the lien file.'}</p></div></div>
        <div className="check todo"><span className="ci" /><div className="ct"><b>Register the claim for lien</b><p>Through ServiceOntario or a registration service: VIN <span className="mono">{d.vehicle.vin || '—'}</span>, {vehicleLabel(d.vehicle)}, amount {formatCents(owing)}.</p></div></div>
        <div className="check todo"><span className="ci" /><div className="ct"><b>{LAW.discharge.short}</b><p>{LAW.discharge.text}</p></div></div>
      </div>
    </>;
    foot = <><button type="button" className="btn" onClick={() => setStep(3)}>Back</button><button type="button" className="btn primary" disabled={busy} onClick={release}><Check className="i" />{busy ? 'Saving…' : 'Release the car'}</button></>;
  }

  return (
    <Dialog title={titles[step]} eyebrow={`${roLabel(d.job.ro_number)} · ${vehicleLabel(d.vehicle)} · owes ${formatCents(balance)}`} onClose={onClose} labelId="lw-t" footer={foot}>
      <div className="wiz-steps">{steps.map((s, i) => <span key={s} className={i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}>{i + 1}. {s}</span>)}</div>
      {error ? <RuleErrors error={error} /> : null}
      {body}
    </Dialog>
  );
}

