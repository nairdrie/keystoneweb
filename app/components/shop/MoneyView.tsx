'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, BarChart3, Check, ChevronLeft, ChevronRight, DollarSign, Download, FileText, Key, Landmark, Printer, RotateCcw } from 'lucide-react';
import { LAW, saleEligibleOn } from '@/lib/shop/rules';
import { PAYMENT_METHOD_LABELS } from '@/lib/shop/board';
import { formatCents, parseMoneyToCents, centsToInput } from '@/lib/shop/money';
import { addMonths, daysBetween, formatDate, quarterRange, todayISO } from '@/lib/shop/dates';
import type { HstReturn, ProfitAndLoss, ReceivableRow, SupplierTab } from '@/lib/shop/reports';
import type { LienSummary, Payment, PaymentMethod } from '@/lib/shop/types';
import { api, errorText, shopUrl } from './api';
import { useShop } from './ShopContext';
import { Dialog, Field, Pill, RuleErrors, Seg } from './ui';


interface MoneyData {
  period: string;
  supplier_tabs: SupplierTab[];
  supplier_owed_cents: number;
  receivables: ReceivableRow[];
  aging: { current: number; d30: number; d60: number; d90: number };
  owed_cents: number;
  liens: LienSummary[];
  hst: HstReturn;
  pnl: ProfitAndLoss;
  collected_week_cents: number;
  collected_month_cents: number;
  payments: Payment[];
  hst_number: string | null;
  tax_label: string;
}

function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const dt = new Date(Date.UTC(y, m - 1, d - ((day + 6) % 7)));
  return dt.toISOString().slice(0, 10);
}

export default function MoneyView() {
  const { siteId, href, version, bump } = useShop();
  const params = useSearchParams();
  const [period, setPeriod] = useState(todayISO());
  const [data, setData] = useState<MoneyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const urlLien = params.get('lien');
  const lienId = picked ?? (urlLien && urlLien !== dismissed ? urlLien : null);
  const setLienId = (id: string | null) => { setPicked(id); if (!id) setDismissed(urlLien); };

  const load = useCallback(async () => {
    try { setData(await api<MoneyData>(siteId, '/money', { query: { period } })); setError(null); } catch (err) { setError(errorText(err)); }
  }, [siteId, period]);
  useEffect(() => {
    let live = true;
    api<MoneyData>(siteId, '/money', { query: { period } })
      .then(d => { if (live) { setData(d); setError(null); } })
      .catch(err => { if (live) setError(errorText(err)); });
    return () => { live = false; };
  }, [siteId, period, version]);

  if (error && !data) return <div className="empty">{error}</div>;
  if (!data) return <div className="empty">Loading the books…</div>;
  const q = quarterRange(period);
  const holding = data.receivables.filter(r => r.situation === 'holding');
  const ageChip = (r: ReceivableRow) => r.situation === 'plan' ? <Pill tone="info">On a plan</Pill> : r.age_days > 30 ? <Pill tone="crit">{r.age_days} days</Pill> : r.age_days > 14 ? <Pill tone="warn">{r.age_days} days</Pill> : <Pill>{r.age_days ? `${r.age_days} days` : 'Today'}</Pill>;
  const situationText = (r: ReceivableRow) => ({ holding: 'Car held on the lot', plan: 'Payment plan', on_lot: 'Car on the lot · pays at pickup', released: r.customer_type === 'business' ? 'Business account' : 'Car picked up' }[r.situation]);
  const lien = lienId ? data.liens.find(l => l.id === lienId) : null;

  return (
    <>
      <div className="view-head">
        <div><h2>Money</h2><p>Who owes you, who you owe, and what the government gets. The QuickBooks part of the tab.</p></div>
        <div className="row"><a className="btn" href="#quickbooks"><Download className="i" />Send to QuickBooks</a></div>
      </div>
      <div className="kpis">
        <div className="kpi"><span className="eyebrow">Customers owe you</span><b>{formatCents(data.owed_cents)}</b><small>{data.receivables.length} open invoice{data.receivables.length === 1 ? '' : 's'}</small></div>
        <div className="kpi"><span className="eyebrow">Collected this week</span><b>{formatCents(data.collected_week_cents)}</b><small>{formatDate(mondayOf(todayISO()), { year: undefined })} to today · {formatCents(data.collected_month_cents)} this month</small></div>
        <div className="kpi"><span className="eyebrow">You owe suppliers</span><b>{formatCents(data.supplier_owed_cents)}</b><small>{data.supplier_tabs.slice(0, 2).map(t => t.name).join(' · ') || 'Nothing unpaid'}</small></div>
        <div className="kpi"><span className="eyebrow">{data.tax_label} to send CRA</span><b>{formatCents(data.hst.line109_net_cents)}</b><small>{data.hst.label} · due {formatDate(data.hst.due, { weekday: undefined })}</small></div>
      </div>
      <div className="money-grid">
        <div className="stack">
          <div className="panel">
            <div className="panel-head"><span className="panel-title"><DollarSign className="i" />Open invoices</span><span className="note">Aging: {formatCents(data.aging.current)} current · {formatCents(data.aging.d30)} 30+ · {formatCents(data.aging.d60 + data.aging.d90)} 60+</span></div>
            <div className="table-wrap"><table className="t">
              <thead><tr><th>Customer</th><th>Invoice</th><th>Age</th><th className="r">Balance</th><th /></tr></thead>
              <tbody>{data.receivables.map(r => (
                <tr key={r.invoice_id}>
                  <td><b>{r.customer_name}</b><span className="sub">{r.vehicle} · {situationText(r)}</span></td>
                  <td className="mono" style={{ whiteSpace: 'nowrap' }}>{r.invoice_label}<span className="sub" style={{ fontFamily: 'var(--font)' }}>{formatDate(r.issued_on)}</span></td>
                  <td>{ageChip(r)}</td>
                  <td className="r"><b>{formatCents(r.balance_cents)}</b></td>
                  <td className="r">{r.lien_id ? <button type="button" className="btn sm" onClick={() => setLienId(r.lien_id)}>Plan</button> : <Link className="btn sm" href={href(`/jobs/${r.job_id}`, { tab: 'invoice' })}>Open</Link>}</td>
                </tr>
              ))}</tbody>
            </table>{!data.receivables.length && <div className="empty"><Check className="i" /> Nobody owes you anything.</div>}</div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title"><Landmark className="i" />Liens and payment plans</span><span className="note">Release a car on a plan from its invoice</span></div>
            <div className="table-wrap"><table className="t">
              <thead><tr><th>Customer · vehicle</th><th>How it’s secured</th><th className="r">Owing</th><th /></tr></thead>
              <tbody>
                {data.liens.map(l => (
                  <tr key={l.id}>
                    <td><b>{l.customer_name}</b><span className="sub">{l.vehicle_label} · released {formatDate(l.released_at.slice(0, 10))}</span></td>
                    <td>
                      <Pill tone="ok" icon={<Check className="i" />}>Acknowledgment signed</Pill>{' '}
                      {l.status === 'discharged' ? <Pill tone="ok" icon={<Check className="i" />}>Discharged</Pill>
                        : l.ppsr_registration_number ? <Pill tone="ok" icon={<Check className="i" />}>PPSR registered</Pill>
                          : <Pill tone="warn" icon={<AlertTriangle className="i" />}>Register the lien today</Pill>}
                      {l.status === 'paid' && l.ppsr_registration_number && <> <Pill tone="warn">Discharge by {formatDate(l.discharge_due_on, { weekday: undefined })}</Pill></>}
                      <span className="sub">{l.plan_kind === 'single' ? 'One payment, no interest' : `${formatCents(l.instalment_cents)} ${l.frequency}`}{l.next_due ? ` · next ${formatCents(l.next_due.amount_cents)} on ${formatDate(l.next_due.due, { weekday: undefined })}${l.overdue ? ' (overdue)' : ''}` : ''}</span>
                    </td>
                    <td className="r"><b>{formatCents(l.balance_cents)}</b></td>
                    <td className="r"><button type="button" className="btn sm" onClick={() => setLienId(l.id)}>Open</button></td>
                  </tr>
                ))}
                {holding.map(r => {
                  const days = daysBetween(r.issued_on);
                  return (
                    <tr key={`h-${r.invoice_id}`}>
                      <td><b>{r.customer_name}</b><span className="sub">{r.vehicle} · invoiced {formatDate(r.issued_on)}</span></td>
                      <td><Pill tone="warn" icon={<Key className="i" />}>Holding the car · day {days} of 60</Pill><span className="sub">Sale possible from {formatDate(saleEligibleOn(r.issued_on), { weekday: undefined })}, after 15 days’ written notice · {LAW.hold.cite}</span></td>
                      <td className="r"><b>{formatCents(r.balance_cents)}</b></td>
                      <td className="r"><Link className="btn sm" href={href(`/jobs/${r.job_id}`, { tab: 'invoice' })}>Plan</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>{!data.liens.length && !holding.length && <div className="empty">No liens or held cars.</div>}</div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title"><RotateCcw className="i" />Recent payments</span></div>
            <div className="table-wrap"><table className="t">
              <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th className="r">Amount</th></tr></thead>
              <tbody>{data.payments.slice(0, 15).map(p => (
                <tr key={p.id}><td>{formatDate(p.received_at.slice(0, 10))}</td><td>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}{p.lien_id ? ' · plan' : ''}</td><td>{p.reference || '—'}</td><td className="r">{formatCents(p.amount_cents)}</td></tr>
              ))}</tbody>
            </table>{!data.payments.length && <div className="empty">No payments in the last 60 days.</div>}</div>
          </div>
        </div>
        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title"><FileText className="i" />{data.tax_label} return · {q.label}</span>
              <span className="row" style={{ flexWrap: 'nowrap' }}>
                <button type="button" className="icon-btn" aria-label="Previous quarter" onClick={() => setPeriod(addMonths(q.start, -3))}><ChevronLeft className="i" /></button>
                <button type="button" className="icon-btn" aria-label="Next quarter" disabled={q.end >= todayISO()} onClick={() => setPeriod(addMonths(q.start, 3))}><ChevronRight className="i" /></button>
              </span>
            </div>
            <div className="panel-body hst">
              <div><span><span className="ln">101</span>Sales and other revenue</span><b>{formatCents(data.hst.line101_sales_cents)}</b></div>
              <div><span><span className="ln">103</span>{data.tax_label} collected</span><b>{formatCents(data.hst.line103_collected_cents)}</b></div>
              <div><span><span className="ln">106</span>{data.tax_label} you paid (supplier invoices)</span><b>{formatCents(data.hst.line106_itc_cents)}</b></div>
              <div><span><span className="ln">109</span>Net tax to send</span><b>{formatCents(data.hst.line109_net_cents)}</b></div>
              <p className="note" style={{ paddingTop: 8 }}>Line numbers match the CRA return. The tax you paid comes from the supplier invoices you snap; add rent, tools and other expenses from your other records.{data.hst_number ? ` Business number ${data.hst_number}.` : ' Add your HST number in Settings.'}</p>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title"><BarChart3 className="i" />{data.pnl.label}</span><span className="note">{data.pnl.invoices} invoice{data.pnl.invoices === 1 ? '' : 's'}</span></div>
            <div className="panel-body stat-list">
              <div><span>Labour billed</span><b>{formatCents(data.pnl.labour_cents)}</b></div>
              <div><span>Parts and supplies sold</span><b>{formatCents(data.pnl.parts_sold_cents)}</b></div>
              <div><span>Parts cost</span><b>{formatCents(data.pnl.parts_cost_cents)}</b></div>
              <div><span>Parts margin</span><b>{data.pnl.parts_margin_pct}%</b></div>
              <div><span>Gross profit</span><b>{formatCents(data.pnl.gross_profit_cents)}</b></div>
            </div>
          </div>
          <QuickBooksPanel />
        </div>
      </div>
      {lien && <LienFile lien={lien} onClose={() => setLienId(null)} onChanged={() => { load(); bump(); }} />}
    </>
  );
}

function QuickBooksPanel() {
  const { siteId } = useShop();
  const q = quarterRange();
  const [from, setFrom] = useState(q.start);
  const [to, setTo] = useState(todayISO() < q.end ? todayISO() : q.end);
  const link = (kind: string) => shopUrl(siteId, '/export', { kind, from, to });
  return (
    <div className="panel" id="quickbooks">
      <div className="panel-head"><span className="panel-title"><RotateCcw className="i" />QuickBooks</span><Pill tone="info">Keep it while you switch</Pill></div>
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="grid2">
          <Field label="From" htmlFor="qb-from"><input id="qb-from" className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
          <Field label="To" htmlFor="qb-to"><input id="qb-to" className="input" type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
        </div>
        <div className="row">
          <a className="btn sm primary" href={link('invoices')}><Download className="i" />Invoices</a>
          <a className="btn sm" href={link('payments')}><Download className="i" />Payments</a>
          <a className="btn sm" href={link('bills')}><Download className="i" />Supplier bills</a>
          <a className="btn sm" href={link('iif')}><Download className="i" />All (Desktop .iif)</a>
        </div>
        <p className="note">QuickBooks Online: import the CSVs under Settings → Import data (invoices, then payments, then bills). QuickBooks Desktop: File → Utilities → Import → IIF. Each invoice, payment and supplier bill goes over once, so nothing is typed twice.</p>
      </div>
    </div>
  );
}

interface PpsrSheet { form: string; collateral: string; debtor: { name: string | null; dob: string | null; address: string | null }; vehicle: { vin: string | null; year: number | null; make: string | null; model: string | null }; amount_cents: number; lien_date: string; missing: string[] }

function LienFile({ lien, onClose, onChanged }: { lien: LienSummary; onClose: () => void; onChanged: () => void }) {
  const { siteId, toast } = useShop();
  const [sheet, setSheet] = useState<PpsrSheet | null>(null);
  const [reg, setReg] = useState('');
  const [regOn, setRegOn] = useState(todayISO());
  const [years, setYears] = useState(lien.ppsr_years || 1);
  const [disRef, setDisRef] = useState('');
  const [debtor, setDebtor] = useState({ name: lien.debtor_legal_name || '', dob: lien.debtor_dob || '', address: lien.debtor_address || '' });
  const [pay, setPay] = useState(centsToInput(lien.next_due?.amount_cents ?? lien.balance_cents));
  const [method, setMethod] = useState<PaymentMethod>('etransfer');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const loadSheet = useCallback(() => { api<PpsrSheet>(siteId, `/liens/${lien.id}`).then(setSheet).catch(() => {}); }, [siteId, lien.id]);
  useEffect(() => { loadSheet(); }, [loadSheet]);

  async function patch(body: Record<string, unknown>, msg: string) {
    setBusy(true); setError(null);
    try { await api(siteId, `/liens/${lien.id}`, { method: 'PATCH', body }); toast(msg); onChanged(); loadSheet(); } catch (err) { setError(err); } finally { setBusy(false); }
  }
  async function recordPayment() {
    setBusy(true); setError(null);
    try {
      const res = await api<{ balance_cents: number }>(siteId, `/invoices/${lien.invoice_id}`, { body: { action: 'payment', amount_cents: parseMoneyToCents(pay), method } });
      toast(res.balance_cents > 0 ? `Payment recorded. ${formatCents(res.balance_cents)} left on the plan.` : 'Plan paid off.');
      onChanged();
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  const planPaid = lien.amount_owing_cents - lien.balance_cents;
  const rows = useMemo(() => {
    let cum = 0;
    return lien.schedule.map((s, i) => {
      cum += s.amount_cents;
      const status = cum <= planPaid ? 'paid' : cum - s.amount_cents < planPaid ? 'part' : lien.next_due && s.due === lien.next_due.due ? 'due' : 'upcoming';
      return { ...s, n: i + 1, status };
    });
  }, [lien, planPaid]);

  return (
    <Dialog wide title={`${lien.customer_name} · ${lien.vehicle_label}`} eyebrow={`${lien.invoice_label} · lien file`} onClose={onClose} labelId="ln-t"
      footLeft={<>Owing now: <b className="num">{formatCents(lien.balance_cents)}</b></>}
      footer={<>
        <a className="btn" href={shopUrl(siteId, `/liens/${lien.id}/pdf`)} target="_blank" rel="noopener noreferrer"><Printer className="i" />Signed acknowledgment</a>
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </>}>
      {error ? <RuleErrors error={error} /> : null}
      <div className="checks">
        <div className="check ok"><span className="ci"><Check className="i" /></span><div className="ct"><b>Released on a signed acknowledgment</b> <span className="cite">{LAW.ack.cite}</span><p>{lien.ack_signer_name} signed {formatDate(lien.ack_signed_at.slice(0, 10))}. {formatCents(lien.amount_owing_cents)} owing after a {formatCents(lien.down_payment_cents)} down payment.</p></div></div>
        {lien.credit_disclosure_given && <div className="check ok"><span className="ci"><Check className="i" /></span><div className="ct"><b>Credit disclosure statement given</b> <span className="cite">{LAW.credit.cite}</span><p>Interest-free, no fees, and they can pay it off early at any time.</p></div></div>}
        <div className={`check ${lien.ppsr_registration_number ? 'ok' : 'warn'}`}>
          <span className="ci">{lien.ppsr_registration_number ? <Check className="i" /> : <AlertTriangle className="i" />}</span>
          <div className="ct">
            {lien.ppsr_registration_number ? (
              <><b>Claim for lien registered in the PPSR</b> <span className="cite">{LAW.ppsr.cite}</span><p>{formatDate(lien.ppsr_registered_at?.slice(0, 10))} · no. <span className="mono">{lien.ppsr_registration_number}</span> · {lien.ppsr_years}-year registration, runs to {formatDate(lien.ppsr_expires_on)} · against VIN <span className="mono">{lien.vin}</span>. Anyone who searches the VIN before buying sees it.</p></>
            ) : (
              <><b>Register the claim for lien today</b> <span className="cite">{LAW.ppsr.cite}</span><p>Until it’s registered, a sale of the car wipes out your lien. VIN <span className="mono">{lien.vin || '—'}</span>, amount {formatCents(lien.balance_cents)}.</p>
                <div className="grid3" style={{ marginTop: 8 }}>
                  <Field label="Registration number" htmlFor="ln-reg"><input id="ln-reg" className="input mono" value={reg} onChange={e => setReg(e.target.value)} /></Field>
                  <Field label="Registered on" htmlFor="ln-on"><input id="ln-on" className="input" type="date" max={todayISO()} value={regOn} onChange={e => setRegOn(e.target.value)} /></Field>
                  <Field label="Period" htmlFor="ln-years"><select id="ln-years" className="input" value={years} onChange={e => setYears(Number(e.target.value))}>{[1, 2, 3].map(y => <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>)}</select></Field>
                </div>
                <div className="row" style={{ marginTop: 6 }}><button type="button" className="btn sm primary" disabled={busy || !reg.trim()} onClick={() => patch({ action: 'register_ppsr', registration_number: reg, registered_on: regOn, years }, 'Registration saved.')}>Save registration</button></div>
              </>
            )}
          </div>
        </div>
        <div className={`check ${lien.status === 'discharged' ? 'ok' : lien.status === 'paid' && lien.ppsr_registration_number ? 'warn' : 'todo'}`}>
          <span className="ci">{lien.status === 'discharged' ? <Check className="i" /> : lien.status === 'paid' && lien.ppsr_registration_number ? <AlertTriangle className="i" /> : null}</span>
          <div className="ct">
            <b>{LAW.discharge.short}</b> <span className="cite">{LAW.discharge.cite}</span>
            <p>{lien.status === 'discharged' ? `Discharged${lien.discharge_reference ? ` (${lien.discharge_reference})` : ''}.` : lien.status === 'paid' ? (lien.ppsr_registration_number ? `Paid off. Register the discharge by ${formatDate(lien.discharge_due_on)}. It’s free.` : 'Paid off. Nothing was registered, so there’s nothing to discharge.') : 'Free to file. Keystone reminds you the day the last payment clears.'}</p>
            {lien.status === 'paid' && lien.ppsr_registration_number && (
              <div className="row" style={{ marginTop: 6, flexWrap: 'nowrap' }}>
                <input className="input mono" placeholder="Discharge reference (optional)" value={disRef} onChange={e => setDisRef(e.target.value)} />
                <button type="button" className="btn sm primary" disabled={busy} onClick={() => patch({ action: 'register_discharge', reference: disRef }, 'Discharge recorded. The lien is off the car.')}>Discharge filed</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {sheet && (
        <div className="block">
          <h4><Landmark className="i" />What the PPSR registration asks for</h4>
          <div className="grid3">
            <Field label="Debtor’s legal name" htmlFor="ln-dn"><input id="ln-dn" className="input" value={debtor.name} onChange={e => setDebtor({ ...debtor, name: e.target.value })} /></Field>
            <Field label="Date of birth" htmlFor="ln-dob"><input id="ln-dob" className="input" type="date" value={debtor.dob} onChange={e => setDebtor({ ...debtor, dob: e.target.value })} /></Field>
            <Field label="Address" htmlFor="ln-ad"><input id="ln-ad" className="input" value={debtor.address} onChange={e => setDebtor({ ...debtor, address: e.target.value })} /></Field>
          </div>
          <p className="note" style={{ marginTop: 6 }}>{sheet.collateral}: {[sheet.vehicle.year, sheet.vehicle.make, sheet.vehicle.model].filter(Boolean).join(' ')} · VIN <span className="mono">{sheet.vehicle.vin || '—'}</span> · amount {formatCents(sheet.amount_cents)} · lien date {formatDate(sheet.lien_date)}.</p>
          {sheet.missing.length > 0 && <p className="note needs">Still missing: {sheet.missing.join(', ')}.</p>}
          <div className="row" style={{ marginTop: 6 }}><button type="button" className="btn sm" disabled={busy} onClick={() => patch({ action: 'update_debtor', debtor_legal_name: debtor.name, debtor_dob: debtor.dob || null, debtor_address: debtor.address }, 'Saved.')}>Save debtor details</button></div>
        </div>
      )}
      <div className="table-wrap"><table className="t sched">
        <thead><tr><th>Date</th><th>Payment</th><th className="r">Amount</th><th>Status</th></tr></thead>
        <tbody>
          {lien.down_payment_cents > 0 && <tr><td>{formatDate(lien.released_at.slice(0, 10))}</td><td>Down payment</td><td className="r">{formatCents(lien.down_payment_cents)}</td><td><Pill tone="ok" icon={<Check className="i" />}>Paid</Pill></td></tr>}
          {rows.map(r => (
            <tr key={r.n}>
              <td>{formatDate(r.due)}</td><td>{lien.plan_kind === 'single' ? 'Balance' : `Payment ${r.n} of ${rows.length}`}</td><td className="r">{formatCents(r.amount_cents)}</td>
              <td>{r.status === 'paid' ? <Pill tone="ok" icon={<Check className="i" />}>Paid</Pill> : r.status === 'part' ? <Pill tone="warn">Part paid</Pill> : r.status === 'due' ? <Pill tone={lien.overdue ? 'crit' : 'warn'}>{lien.overdue ? 'Overdue' : 'Due next'}</Pill> : <Pill>Upcoming</Pill>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {lien.status === 'active' && lien.balance_cents > 0 && (
        <div className="block">
          <h4><DollarSign className="i" />Record a payment on the plan</h4>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Field label="Amount" htmlFor="ln-pay"><input id="ln-pay" className="input num" style={{ width: 120 }} value={pay} onChange={e => setPay(e.target.value)} /></Field>
            <Seg label="Method" value={method} onChange={setMethod} options={[{ value: 'etransfer', label: 'E-transfer' }, { value: 'debit', label: 'Debit' }, { value: 'credit', label: 'Credit' }, { value: 'cash', label: 'Cash' }, { value: 'cheque', label: 'Cheque' }]} />
            <button type="button" className="btn primary" disabled={busy} onClick={recordPayment}><DollarSign className="i" />Record</button>
          </div>
        </div>
      )}
      {lien.status === 'active' && !lien.ppsr_registration_number && planPaid === 0 && (
        <button type="button" className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => { const why = prompt('Why cancel the plan? The balance stays owing on the invoice.'); if (why !== null) patch({ action: 'cancel', notes: why }, 'Plan cancelled.'); }}>Cancel this plan</button>
      )}
    </Dialog>
  );
}
