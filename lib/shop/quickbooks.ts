/**
 * QuickBooks exports, so nothing is typed twice while the shop still uses
 * QuickBooks: CSV files for QuickBooks Online imports and an IIF file for
 * QuickBooks Desktop. Account and item names are defaults an accountant can
 * map on import.
 */

import { invoiceLabel } from './board';
import type { Invoice, Payment, SupplierBill, Supplier } from './types';

export const QB_ACCOUNTS = {
  receivable: 'Accounts Receivable',
  labour: 'Labour Income',
  parts: 'Parts Income',
  supplies: 'Shop Supplies Income',
  other: 'Other Income',
  discounts: 'Discounts Given',
  taxPayable: 'GST/HST Payable',
  undeposited: 'Undeposited Funds',
  payable: 'Accounts Payable',
  partsCost: 'Parts Cost',
};

const ITEM_BY_KIND: Record<string, { item: string; account: string }> = {
  labour: { item: 'Labour', account: QB_ACCOUNTS.labour },
  part: { item: 'Parts', account: QB_ACCOUNTS.parts },
  supply: { item: 'Shop supplies', account: QB_ACCOUNTS.supplies },
  fee: { item: 'Fees', account: QB_ACCOUNTS.other },
  sublet: { item: 'Sublet', account: QB_ACCOUNTS.other },
  discount: { item: 'Discount', account: QB_ACCOUNTS.discounts },
};

const csvCell = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: (string | number | null | undefined)[][]) => rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
const dollars = (cents: number) => (cents / 100).toFixed(2);
const mdy = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const iifCell = (v: string | number | null | undefined) => String(v ?? '').replace(/[\t\r\n]/g, ' ');

export type ExportInvoice = Pick<Invoice, 'invoice_number' | 'issued_at' | 'snapshot' | 'status' | 'total_cents' | 'tax_cents'>;
export interface ExportPayment extends Pick<Payment, 'received_at' | 'amount_cents' | 'method' | 'reference'> { invoice_number: number; customer_name: string }

export function invoicesCsv(invoices: ExportInvoice[], taxCode = 'HST ON'): string {
  const rows: (string | number | null)[][] = [[
    'InvoiceNo', 'Customer', 'InvoiceDate', 'DueDate', 'Terms', 'Memo', 'Item(Product/Service)', 'ItemDescription',
    'ItemQuantity', 'ItemRate', 'ItemAmount', 'ItemTaxCode', 'ItemTaxAmount', 'Currency',
  ]];
  for (const inv of invoices.filter(i => i.status === 'issued')) {
    const s = inv.snapshot;
    const date = inv.issued_at.slice(0, 10);
    const memo = `RO-${s.ro_number} · ${s.vehicle.description}${s.vehicle.vin ? ` · VIN ${s.vehicle.vin}` : ''}`;
    s.lines.forEach((l, i) => {
      const map = ITEM_BY_KIND[l.kind] || ITEM_BY_KIND.fee;
      const qty = l.kind === 'labour' ? l.hours ?? 1 : l.kind === 'part' ? l.qty : 1;
      const rate = l.kind === 'labour' ? (l.rate_cents ?? 0) : l.kind === 'part' ? (l.unit_price_cents ?? 0) : l.amount_cents;
      const lineTax = Math.round((l.amount_cents * s.totals.tax_rate_bps) / 10000);
      rows.push([
        invoiceLabel(inv.invoice_number), s.customer.name, date, date, s.payment_terms, i === 0 ? memo : '',
        map.item, l.description, qty, dollars(rate), dollars(l.amount_cents), taxCode, dollars(lineTax), 'CAD',
      ]);
    });
  }
  return toCsv(rows);
}

export function paymentsCsv(payments: ExportPayment[]): string {
  const rows: (string | number | null)[][] = [['Date', 'Customer', 'InvoiceNo', 'Amount', 'PaymentMethod', 'ReferenceNo', 'DepositTo']];
  for (const p of payments) {
    rows.push([p.received_at.slice(0, 10), p.customer_name, invoiceLabel(p.invoice_number), dollars(p.amount_cents), p.method, p.reference ?? '', QB_ACCOUNTS.undeposited]);
  }
  return toCsv(rows);
}

export function billsCsv(bills: SupplierBill[], suppliers: Supplier[], taxCode = 'HST ON'): string {
  const rows: (string | number | null)[][] = [['BillNo', 'Supplier', 'BillDate', 'DueDate', 'Account', 'LineDescription', 'LineAmount', 'LineTaxCode', 'LineTaxAmount', 'Memo', 'Currency']];
  for (const b of bills.filter(x => x.status !== 'returned')) {
    const supplier = suppliers.find(s => s.id === b.supplier_id)?.name || b.supplier_name_raw || 'Supplier';
    const date = (b.invoice_date || b.created_at).slice(0, 10);
    const lines = b.lines.length ? b.lines : [{ description: 'Parts', line_total_cents: b.subtotal_cents ?? 0 } as SupplierBill['lines'][number]];
    const subtotal = lines.reduce((s, l) => s + l.line_total_cents, 0);
    let taxLeft = b.tax_cents ?? 0;
    lines.forEach((l, i) => {
      const share = i === lines.length - 1 ? taxLeft : subtotal ? Math.round(((b.tax_cents ?? 0) * l.line_total_cents) / subtotal) : 0;
      taxLeft -= share;
      rows.push([b.invoice_number || b.id.slice(0, 8), supplier, date, date, QB_ACCOUNTS.partsCost, l.description, dollars(l.line_total_cents), taxCode, dollars(share), l.job_id ? 'Billed to a job' : b.status === 'stock' ? 'Shop stock' : '', 'CAD']);
    });
  }
  return toCsv(rows);
}

/** QuickBooks Desktop IIF: invoices, payments and bills as balanced transactions. */
export function transactionsIif(invoices: ExportInvoice[], payments: ExportPayment[], bills: SupplierBill[], suppliers: Supplier[]): string {
  const out: string[] = [];
  out.push(['!TRNS', 'TRNSID', 'TRNSTYPE', 'DATE', 'ACCNT', 'NAME', 'AMOUNT', 'DOCNUM', 'MEMO'].join('\t'));
  out.push(['!SPL', 'SPLID', 'TRNSTYPE', 'DATE', 'ACCNT', 'NAME', 'AMOUNT', 'DOCNUM', 'MEMO', 'QNTY', 'PRICE', 'INVITEM'].join('\t'));
  out.push('!ENDTRNS');
  for (const inv of invoices.filter(i => i.status === 'issued')) {
    const s = inv.snapshot;
    const date = mdy(inv.issued_at.slice(0, 10));
    const doc = invoiceLabel(inv.invoice_number);
    const name = iifCell(s.customer.name);
    out.push(['TRNS', '', 'INVOICE', date, QB_ACCOUNTS.receivable, name, dollars(inv.total_cents), doc, iifCell(`RO-${s.ro_number} ${s.vehicle.description}`)].join('\t'));
    for (const l of s.lines) {
      const map = ITEM_BY_KIND[l.kind] || ITEM_BY_KIND.fee;
      const qty = l.kind === 'labour' ? l.hours ?? 1 : l.kind === 'part' ? l.qty : 1;
      const price = qty ? l.amount_cents / qty : l.amount_cents;
      out.push(['SPL', '', 'INVOICE', date, map.account, name, dollars(-l.amount_cents), doc, iifCell(l.description), String(-qty), dollars(price), map.item].join('\t'));
    }
    out.push(['SPL', '', 'INVOICE', date, QB_ACCOUNTS.taxPayable, name, dollars(-inv.tax_cents), doc, `${s.totals.tax_label} ${(s.totals.tax_rate_bps / 100).toFixed(0)}%`, '', '', ''].join('\t'));
    out.push('ENDTRNS');
  }
  for (const p of payments) {
    const date = mdy(p.received_at.slice(0, 10));
    const doc = invoiceLabel(p.invoice_number);
    const name = iifCell(p.customer_name);
    out.push(['TRNS', '', 'PAYMENT', date, QB_ACCOUNTS.undeposited, name, dollars(p.amount_cents), doc, iifCell(`${p.method}${p.reference ? ` ${p.reference}` : ''}`)].join('\t'));
    out.push(['SPL', '', 'PAYMENT', date, QB_ACCOUNTS.receivable, name, dollars(-p.amount_cents), doc, '', '', '', ''].join('\t'));
    out.push('ENDTRNS');
  }
  for (const b of bills.filter(x => x.status !== 'returned')) {
    const date = mdy((b.invoice_date || b.created_at).slice(0, 10));
    const supplier = iifCell(suppliers.find(s => s.id === b.supplier_id)?.name || b.supplier_name_raw || 'Supplier');
    const doc = iifCell(b.invoice_number || b.id.slice(0, 8));
    const total = b.total_cents ?? ((b.subtotal_cents ?? 0) + (b.tax_cents ?? 0));
    out.push(['TRNS', '', 'BILL', date, QB_ACCOUNTS.payable, supplier, dollars(-total), doc, 'Parts'].join('\t'));
    out.push(['SPL', '', 'BILL', date, QB_ACCOUNTS.partsCost, supplier, dollars(total - (b.tax_cents ?? 0)), doc, 'Parts', '', '', ''].join('\t'));
    if (b.tax_cents) out.push(['SPL', '', 'BILL', date, QB_ACCOUNTS.taxPayable, supplier, dollars(b.tax_cents), doc, 'Input tax credit', '', '', ''].join('\t'));
    out.push('ENDTRNS');
  }
  return out.join('\r\n') + '\r\n';
}
