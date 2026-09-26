'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, CreditCard, Download, FileText, Send, Shield, X } from 'lucide-react';
import { computeTotals, formatCents } from '@/lib/shop/money';
import { formatDate, formatDateTime } from '@/lib/shop/dates';
import type { PublicDoc } from '@/lib/shop/actions/public';
import { EstimatePaper, InvoicePaper } from '../Paper';
import { Callout, Field, Seg, SignaturePad, ToastProvider, type SignaturePadHandle } from '../ui';
import '../shop.css';

async function call<T>(token: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/shop/public/${encodeURIComponent(token)}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Something went wrong. Try again.');
  return data as T;
}

export default function PublicDocPage({ token }: { token: string }) {
  const [doc, setDoc] = useState<PublicDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<string | null>(null);

  const load = () => call<PublicDoc>(token).then(d => { setDoc(d); setError(null); }).catch(err => setError(err.message));
  useEffect(() => {
    load();
    setPayment(new URLSearchParams(window.location.search).get('payment'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="shop-ui doc-page shop-auto-dark">
      <ToastProvider>
        <div className="doc-wrap">
          {error && <div className="panel empty"><AlertTriangle className="i" /> {error}</div>}
          {!doc && !error && <div className="panel empty">Loading…</div>}
          {doc && (
            <>
              <div className="doc-top">
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {doc.shop.logo_url && <img src={doc.shop.logo_url} alt="" />}
                  <div><h1>{doc.shop.name}</h1><p className="note">{[doc.shop.phone, doc.shop.address].filter(Boolean).join(' · ')}</p></div>
                </div>
                <a className="btn" href={`/api/shop/public/${encodeURIComponent(token)}/pdf?download=1`}><Download className="i" />Download PDF</a>
              </div>
              {doc.kind === 'estimate' && doc.estimate && <EstimateSide token={token} e={doc.estimate} shopName={doc.shop.name} onChanged={load} />}
              {doc.kind === 'invoice' && doc.invoice && <InvoiceSide token={token} inv={doc.invoice} shopName={doc.shop.name} payment={payment} />}
              <p className="note" style={{ textAlign: 'center' }}>Questions? Call {doc.shop.name}{doc.shop.phone ? ` at ${doc.shop.phone}` : ''}{doc.shop.email ? ` or email ${doc.shop.email}` : ''}.</p>
            </>
          )}
        </div>
      </ToastProvider>
    </div>
  );
}

function EstimateSide({ token, e, shopName, onChanged }: { token: string; e: NonNullable<PublicDoc['estimate']>; shopName: string; onChanged: () => void }) {
  const offered = e.lines.filter(l => l.decision === 'include');
  const [declined, setDeclined] = useState<Set<string>>(new Set());
  const [partsBack, setPartsBack] = useState<'yes' | 'no' | ''>('');
  const [name, setName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [mode, setMode] = useState<'approve' | 'decline'>('approve');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const sig = useRef<SignaturePadHandle>(null);

  const total = useMemo(() => computeTotals(
    offered.filter(l => !declined.has(l.id)).map(l => ({ kind: 'fee' as const, amount_cents: l.amount_cents })),
    e.tax_rate_bps,
  ).total_cents, [offered, declined, e.tax_rate_bps]);

  async function approve() {
    setError(null);
    if (!name.trim()) { setError('Type your full name to approve.'); return; }
    if (!partsBack) { setError('Tell us whether you want the replaced parts back.'); return; }
    if (declined.size === offered.length) { setError('Everything is unchecked. To say no to all of it, choose “Decline”.'); return; }
    setBusy(true);
    try {
      await call(token, { action: 'approve', typed_name: name, signature, parts_back: partsBack === 'yes', declined_line_ids: [...declined] });
      setDone(`Thanks, ${name.split(' ')[0]}. Your approval is saved and ${shopName} has been told. We’ll be in touch when it’s ready.`);
      onChanged();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function decline() {
    setBusy(true); setError(null);
    try {
      await call(token, { action: 'decline', reason });
      setDone(`Got it. ${shopName} has been told you’d rather not go ahead. You can still call them to talk it over.`);
      onChanged();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      {done && <Callout tone="ok" icon={<Check className="i" />}>{done}</Callout>}
      {e.status === 'approved' && !done && <Callout tone="ok" icon={<Shield className="i" />}><b>You approved this estimate</b>{e.approved_at ? ` on ${formatDateTime(e.approved_at)}` : ''}. Thank you.</Callout>}
      {e.status === 'declined' && !done && <Callout tone="warn" icon={<X className="i" />}><b>You declined this estimate</b>{e.declined_at ? ` on ${formatDate(e.declined_at.slice(0, 10))}` : ''}.</Callout>}
      {e.status === 'replaced' && <Callout icon={<FileText className="i" />}><b>This estimate was replaced by a newer one.</b> {e.newer_token ? <a href={`/shop-doc/${e.newer_token}`}>See the current estimate</a> : 'Ask the shop for the current one.'}</Callout>}
      {e.expired && e.status === 'sent' && <Callout tone="warn" icon={<AlertTriangle className="i" />}><b>This estimate expired on {formatDate(e.doc.valid_until)}.</b> Call the shop for an updated one.</Callout>}
      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 12 }}><EstimatePaper doc={e.doc} /></div>
      {e.can_act && !done && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title"><Shield className="i" />{e.is_revision ? 'Approve the extra work' : 'Approve the work'}</span><Seg label="Approve or decline" value={mode} onChange={setMode} options={[{ value: 'approve', label: 'Approve' }, { value: 'decline', label: 'Decline' }]} /></div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'approve' ? (
              <>
                <div>
                  <p className="note" style={{ marginBottom: 6 }}>Uncheck anything you don’t want done.</p>
                  <div className="doc-lines">
                    {offered.map(l => (
                      <label key={l.id}>
                        <input type="checkbox" checked={!declined.has(l.id)} onChange={ev => { const n = new Set(declined); if (ev.target.checked) n.delete(l.id); else n.add(l.id); setDeclined(n); }} />
                        <span className={declined.has(l.id) ? 'off' : ''}>{l.description}{l.added ? ' (added work)' : ''}{l.detail && <span className="note" style={{ display: 'block' }}>{l.detail}</span>}</span>
                        <span className={`num${declined.has(l.id) ? ' off' : ''}`}>{formatCents(l.amount_cents)}</span>
                      </label>
                    ))}
                  </div>
                  <div className="totals" style={{ marginTop: 10 }}><div className="grand"><span>Total with tax</span><span>{formatCents(total)}</span></div></div>
                </div>
                <Field label="Do you want the replaced parts back?" required>
                  <Seg label="Replaced parts" value={partsBack} onChange={setPartsBack} options={[{ value: 'yes', label: 'Yes, give them back' }, { value: 'no', label: 'No, keep them' }]} />
                </Field>
                <Field label="Your full name" required htmlFor="pd-name"><input id="pd-name" className="input" autoComplete="name" value={name} onChange={ev => setName(ev.target.value)} /></Field>
                <Field label="Sign (optional)">
                  <SignaturePad ref={sig} onChange={setSignature} />
                  <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn sm ghost" onClick={() => sig.current?.clear()}>Clear</button></div>
                </Field>
                <p className="note">By tapping Approve, you authorize {shopName} to do the work checked above for {formatCents(total)}. The final bill can’t be more than 10% above that, and no other work will be done without your OK (Consumer Protection Act, 2002). Your name, the time and this device are recorded with your approval.</p>
                {error && <Callout tone="warn" icon={<AlertTriangle className="i" />}>{error}</Callout>}
                <div className="row"><button type="button" className="btn primary" disabled={busy} onClick={approve} style={{ height: 44, fontSize: 14 }}><Check className="i" />{busy ? 'Saving…' : `Approve ${formatCents(total)}`}</button></div>
              </>
            ) : (
              <>
                <Field label="Anything you’d like the shop to know?" htmlFor="pd-reason"><textarea id="pd-reason" className="input" value={reason} onChange={ev => setReason(ev.target.value)} placeholder="Optional" /></Field>
                {error && <Callout tone="warn" icon={<AlertTriangle className="i" />}>{error}</Callout>}
                <div className="row"><button type="button" className="btn" disabled={busy} onClick={decline}><Send className="i" />{busy ? 'Sending…' : 'Decline the estimate'}</button></div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function InvoiceSide({ token, inv, shopName, payment }: { token: string; inv: NonNullable<PublicDoc['invoice']>; shopName: string; payment: string | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function pay(provider: 'stripe' | 'paypal') {
    setBusy(provider); setError(null);
    try {
      const res = await call<{ url: string }>(token, { action: 'pay', provider });
      window.location.href = res.url;
    } catch (err) { setError((err as Error).message); setBusy(null); }
  }
  return (
    <>
      {payment === 'done' && <Callout tone="ok" icon={<Check className="i" />}><b>Thanks! Your payment went through.</b> {shopName} has been told. {inv.balance_cents > 0 ? `${formatCents(inv.balance_cents)} is still owing.` : 'You’re all paid up.'}</Callout>}
      {payment === 'failed' && <Callout tone="warn" icon={<AlertTriangle className="i" />}><b>The payment didn’t go through.</b> Nothing was charged. Try again, or pay at the shop.</Callout>}
      {inv.status === 'void' && <Callout tone="warn" icon={<X className="i" />}><b>This invoice was voided.</b> Ask the shop for the current one.</Callout>}
      {inv.status === 'issued' && inv.balance_cents > 0 && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title"><CreditCard className="i" />Amount due: {formatCents(inv.balance_cents)}</span></div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(inv.pay.stripe || inv.pay.paypal) ? (
              <div className="pay-buttons">
                {inv.pay.stripe && <button type="button" className="btn primary" disabled={!!busy} onClick={() => pay('stripe')}><CreditCard className="i" />{busy === 'stripe' ? 'Opening…' : 'Pay by card'}</button>}
                {inv.pay.paypal && <button type="button" className="btn" disabled={!!busy} onClick={() => pay('paypal')}>{busy === 'paypal' ? 'Opening…' : 'Pay with PayPal'}</button>}
              </div>
            ) : <p>Pay at the shop when you pick up your car: {inv.snapshot.payment_methods}.</p>}
            {inv.pay.etransfer_email && <p className="note">Or send an Interac e-Transfer to <b>{inv.pay.etransfer_email}</b> with <b>{inv.snapshot.number_label}</b> in the message.</p>}
            {error && <Callout tone="warn" icon={<AlertTriangle className="i" />}>{error}</Callout>}
          </div>
        </div>
      )}
      {inv.status === 'issued' && inv.balance_cents <= 0 && <Callout tone="ok" icon={<Check className="i" />}><b>Paid in full.</b> Thank you.</Callout>}
      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 12 }}><InvoicePaper s={inv.snapshot} paidCents={inv.paid_cents} voidReason={inv.void_reason} /></div>
    </>
  );
}
