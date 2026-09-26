'use client';

import { formatCents } from '@/lib/shop/money';
import { formatDate, formatDateTime } from '@/lib/shop/dates';
import { docLine, type EstimateDoc } from '@/lib/shop/documents';
import { methodLabel } from '@/lib/shop/rules';
import type { InvoiceSnapshot } from '@/lib/shop/types';

function ShopHead({ shop, title, lines }: { shop: EstimateDoc['shop']; title: string; lines: (string | null)[] }) {
  return (
    <div className="p-head">
      <div className="p-shop">
        <b>{shop.name}</b>
        <span className="p-muted">
          {shop.address}{shop.address && <br />}
          {[shop.phone, shop.website].filter(Boolean).join(' · ')}
          {shop.email && <><br />{shop.email}</>}
          {shop.hst_number && <><br />HST {shop.hst_number}</>}
        </span>
      </div>
      <div className="p-doc">
        <b>{title}</b>
        <span className="p-muted">{lines.filter(Boolean).map((l, i) => <span key={i} style={{ display: 'block' }}>{l}</span>)}</span>
      </div>
    </div>
  );
}

export function EstimatePaper({ doc }: { doc: EstimateDoc }) {
  const t = doc.totals;
  return (
    <div className="paper" aria-label="Estimate">
      <ShopHead shop={doc.shop} title={doc.title} lines={[doc.number_label, doc.date_label ? formatDate(doc.date_label) : 'Draft, not given yet', doc.valid_until ? `Valid until ${formatDate(doc.valid_until)}` : 'Valid-until date set when sent']} />
      <div className="p-grid">
        <div><h5>Customer</h5>{doc.customer.name}<br /><span className="p-muted">{doc.customer.phone}{doc.customer.phone && <br />}{doc.customer.email}</span></div>
        <div><h5>Vehicle</h5>{doc.vehicle.description}<br /><span className="p-muted">VIN {doc.vehicle.vin || '—'}<br />Plate {doc.vehicle.plate || '—'}<br />Odometer {doc.vehicle.odometer != null ? `${doc.vehicle.odometer.toLocaleString('en-CA')} km` : '—'}</span></div>
        <div><h5>Work requested</h5>{doc.work_requested}<br /><span className="p-muted">Ready by {doc.ready_by ? formatDate(doc.ready_by) : 'date set when sent'}</span></div>
      </div>
      <div className="p-table-wrap"><table>
        <thead><tr><th>Description</th><th className="r">Qty / hrs</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
        <tbody>{doc.lines.map((l, i) => (
          <tr key={i}><td>{l.description}{l.detail && <><br /><span className="p-muted">{l.detail}</span></>}{l.added && <><br /><b>Added work</b></>}</td><td className="r">{l.qty}</td><td className="r">{l.rate}</td><td className="r">{formatCents(l.amount_cents)}</td></tr>
        ))}</tbody>
      </table></div>
      <div className="p-tot">
        <div><span>Labour</span><span>{formatCents(t.labour_cents)}</span></div>
        <div><span>Parts</span><span>{formatCents(t.parts_cents)}</span></div>
        {t.supplies_cents !== 0 && <div><span>Shop supplies</span><span>{formatCents(t.supplies_cents)}</span></div>}
        <div><span>Subtotal</span><span>{formatCents(t.subtotal_cents)}</span></div>
        <div><span>{doc.tax_label} {(doc.tax_rate_bps / 100).toFixed(doc.tax_rate_bps % 100 ? 2 : 0)}%</span><span>{formatCents(t.tax_cents)}</span></div>
        <div className="g"><span>Estimated total</span><span>{formatCents(t.total_cents)}</span></div>
      </div>
      <div className="p-legal">
        {doc.declined.length > 0 && <span><b>Recommended, declined for now:</b> {doc.declined.map(d => `${d.description} (${formatCents(d.amount_cents)})`).join('; ')}</span>}
        <span><b>{doc.ten_percent_statement}</b></span>
        <span>{doc.estimate_fee_statement.startsWith('Estimate fee:') ? <><b>Estimate fee:</b>{doc.estimate_fee_statement.slice('Estimate fee:'.length)}</> : doc.estimate_fee_statement}</span>
        <span><b>Replaced parts:</b> {doc.parts_statement}</span>
        {doc.other_charges && <span><b>Other charges:</b> {doc.other_charges}</span>}
        {doc.notes && <span><b>Notes:</b> {doc.notes}</span>}
      </div>
      <div className="p-sign"><div>Customer approval (signature, or recorded phone approval)</div><div>Date and time</div></div>
    </div>
  );
}

export function InvoicePaper({ s, paidCents = 0, voidReason }: { s: InvoiceSnapshot; paidCents?: number; voidReason?: string | null }) {
  const t = s.totals;
  const lines = s.lines.map(docLine);
  return (
    <div className="paper" aria-label="Invoice">
      {voidReason && <div className="p-void">VOID · {voidReason}</div>}
      <ShopHead shop={s.shop} title={s.kind === 'estimate_fee' ? 'INVOICE · ESTIMATE FEE' : 'INVOICE'} lines={[s.number_label, formatDate(s.issued_on), `RO-${s.ro_number}`]} />
      <div className="p-grid">
        <div><h5>Customer</h5>{s.customer.name}<br /><span className="p-muted">{s.customer.phone}{s.customer.phone && <br />}{s.customer.email}{s.customer.address && <><br />{s.customer.address}</>}</span></div>
        <div><h5>Vehicle</h5>{s.vehicle.description}<br /><span className="p-muted">VIN {s.vehicle.vin || '—'}<br />Plate {s.vehicle.plate || '—'}<br />Odometer in {s.vehicle.odometer_in != null ? s.vehicle.odometer_in.toLocaleString('en-CA') : '—'} / out {s.vehicle.odometer_out != null ? s.vehicle.odometer_out.toLocaleString('en-CA') : '—'} km</span></div>
        <div><h5>Dates</h5><span className="p-muted">Approved:</span> {s.dates.authorized ? formatDateTime(s.dates.authorized) : '—'}<br /><span className="p-muted">Completed:</span> {s.dates.completed ? formatDate(s.dates.completed.slice(0, 10)) : '—'}<br /><span className="p-muted">Returned:</span> {s.dates.returned ? formatDate(s.dates.returned) : 'at pickup'}</div>
      </div>
      <p className="p-muted" style={{ marginBottom: 8 }}><b style={{ color: 'var(--paper-text)' }}>Work requested:</b> {s.work_requested}</p>
      <div className="p-table-wrap"><table>
        <thead><tr><th>Description</th><th className="r">Qty / hrs</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
        <tbody>{lines.map((l, i) => (
          <tr key={i}><td>{l.description}{l.detail && <><br /><span className="p-muted">{l.detail}</span></>}{l.added && <><br /><b>Added work, approved on a revised estimate</b></>}</td><td className="r">{l.qty}</td><td className="r">{l.rate}</td><td className="r">{formatCents(l.amount_cents)}</td></tr>
        ))}</tbody>
      </table></div>
      <div className="p-tot">
        <div><span>Labour</span><span>{formatCents(t.labour_cents)}</span></div>
        <div><span>Parts</span><span>{formatCents(t.parts_cents)}</span></div>
        {t.supplies_cents !== 0 && <div><span>Shop supplies</span><span>{formatCents(t.supplies_cents)}</span></div>}
        <div><span>Subtotal</span><span>{formatCents(t.subtotal_cents)}</span></div>
        <div><span>{t.tax_label} {(t.tax_rate_bps / 100).toFixed(t.tax_rate_bps % 100 ? 2 : 0)}%</span><span>{formatCents(t.tax_cents)}</span></div>
        <div className="g"><span>Total</span><span>{formatCents(t.total_cents)}</span></div>
        {paidCents > 0 && <><div><span>Paid</span><span>{formatCents(paidCents)}</span></div><div className="g"><span>Balance</span><span>{formatCents(t.total_cents - paidCents)}</span></div></>}
      </div>
      <div className="p-legal">
        {s.declined.length > 0 && <span><b>Recommended, declined for now:</b> {s.declined.map(d => d.description).join('; ')}</span>}
        {s.estimate && <span><b>Estimate:</b> {s.estimate.label}, {formatCents(s.estimate.total_cents)}. {s.authorization && <><b>Approved:</b> {methodLabel(s.authorization.method).toLowerCase()} by {s.authorization.by}{s.authorization.method === 'phone' && s.authorization.phone ? ` at ${s.authorization.phone}` : ''}, {formatDateTime(s.authorization.when)}.</>}</span>}
        {s.estimate_fee_note && <span><b>Estimate fee:</b> {s.estimate_fee_note}</span>}
        {s.parts_returned != null && <span><b>Replaced parts:</b> {s.parts_returned ? 'returned to you.' : 'you told us when approving that you don’t want them back.'}</span>}
        <span><b>Payment:</b> {s.payment_terms}. {s.payment_methods}.</span>
        {s.kind === 'repair' && <span><b>Warranty:</b> {s.warranty_text}{s.warranty_extra ? ` ${s.warranty_extra}` : ''}</span>}
        <span>{s.statutory_statement}</span>
      </div>
    </div>
  );
}
