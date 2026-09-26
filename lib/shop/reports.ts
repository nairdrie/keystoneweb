/**
 * Money reports for the Shop tab. Pure functions over rows so the numbers are
 * easy to test: receivables, supplier tabs, HST return lines, P&L, cores owed
 * and parts bought but never billed.
 */

import { addDays, addMonths, daysBetween, monthRange, quarterRange, todayISO } from './dates';
import { similarDescriptions } from './data';
import type { BillLine, Invoice, Payment, SupplierBill, Supplier } from './types';

export interface ReceivableRow {
  invoice_id: string;
  job_id: string;
  invoice_label: string;
  customer_name: string;
  customer_type: 'consumer' | 'business';
  vehicle: string;
  issued_on: string;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  age_days: number;
  situation: 'holding' | 'plan' | 'on_lot' | 'released';
  lien_id: string | null;
}

export interface HstReturn {
  label: string;
  start: string;
  end: string;
  due: string;
  line101_sales_cents: number;
  line103_collected_cents: number;
  line106_itc_cents: number;
  line109_net_cents: number;
}

export function hstReturn(invoices: Pick<Invoice, 'issued_at' | 'subtotal_cents' | 'tax_cents' | 'status'>[], bills: Pick<SupplierBill, 'invoice_date' | 'created_at' | 'tax_cents' | 'status'>[], today: string = todayISO()): HstReturn {
  const q = quarterRange(today);
  const inRange = (d: string) => d >= q.start && d <= q.end;
  const issued = invoices.filter(i => i.status === 'issued' && inRange(i.issued_at.slice(0, 10)));
  const itcBills = bills.filter(b => b.status !== 'returned' && inRange((b.invoice_date || b.created_at).slice(0, 10)));
  const sales = issued.reduce((s, i) => s + i.subtotal_cents, 0);
  const collected = issued.reduce((s, i) => s + i.tax_cents, 0);
  const itc = itcBills.reduce((s, b) => s + (b.tax_cents ?? 0), 0);
  return {
    label: q.label,
    start: q.start,
    end: q.end,
    due: addDays(addMonths(addDays(q.end, 1), 1), -1),
    line101_sales_cents: sales,
    line103_collected_cents: collected,
    line106_itc_cents: itc,
    line109_net_cents: collected - itc,
  };
}

export interface ProfitAndLoss {
  label: string;
  labour_cents: number;
  parts_sold_cents: number;
  parts_cost_cents: number;
  parts_margin_pct: number;
  gross_profit_cents: number;
  invoices: number;
}

export function profitAndLoss(invoices: Pick<Invoice, 'issued_at' | 'status' | 'snapshot'>[], bills: (Pick<SupplierBill, 'invoice_date' | 'created_at' | 'status'> & { lines: Pick<BillLine, 'line_total_cents' | 'is_core'>[] })[], today: string = todayISO()): ProfitAndLoss {
  const m = monthRange(today);
  const inRange = (d: string) => d >= m.start && d <= m.end;
  const issued = invoices.filter(i => i.status === 'issued' && inRange(i.issued_at.slice(0, 10)));
  const labour = issued.reduce((s, i) => s + (i.snapshot?.totals?.labour_cents ?? 0), 0);
  const partsSold = issued.reduce((s, i) => s + (i.snapshot?.totals?.parts_cents ?? 0) + (i.snapshot?.totals?.supplies_cents ?? 0), 0);
  const partsCost = bills
    .filter(b => b.status !== 'returned' && inRange((b.invoice_date || b.created_at).slice(0, 10)))
    .reduce((s, b) => s + b.lines.filter(l => !l.is_core).reduce((x, l) => x + l.line_total_cents, 0), 0);
  return {
    label: m.label,
    labour_cents: labour,
    parts_sold_cents: partsSold,
    parts_cost_cents: partsCost,
    parts_margin_pct: partsSold > 0 ? Math.round(((partsSold - partsCost) / partsSold) * 1000) / 10 : 0,
    gross_profit_cents: labour + partsSold - partsCost,
    invoices: issued.length,
  };
}

export interface SupplierTab {
  supplier_id: string | null;
  name: string;
  unpaid_cents: number;
  unpaid_count: number;
  oldest: string | null;
  bill_ids: string[];
}

export function supplierTabs(bills: SupplierBill[], suppliers: Supplier[]): SupplierTab[] {
  const map = new Map<string, SupplierTab>();
  for (const b of bills) {
    if (b.paid_at || b.status === 'returned') continue;
    const key = b.supplier_id || `raw:${(b.supplier_name_raw || 'Unknown supplier').toLowerCase()}`;
    const name = suppliers.find(s => s.id === b.supplier_id)?.name || b.supplier_name_raw || 'Unknown supplier';
    const tab = map.get(key) || { supplier_id: b.supplier_id, name, unpaid_cents: 0, unpaid_count: 0, oldest: null, bill_ids: [] };
    tab.unpaid_cents += b.total_cents ?? 0;
    tab.unpaid_count += 1;
    tab.bill_ids.push(b.id);
    const d = (b.invoice_date || b.created_at).slice(0, 10);
    if (!tab.oldest || d < tab.oldest) tab.oldest = d;
    map.set(key, tab);
  }
  return [...map.values()].sort((a, b) => b.unpaid_cents - a.unpaid_cents);
}

export interface CoreOwed {
  line_id: string;
  description: string;
  amount_cents: number;
  supplier: string;
  job_id: string | null;
  bill_invoice_number: string | null;
  since: string;
}

export function coresOwed(bills: SupplierBill[], suppliers: Supplier[]): CoreOwed[] {
  const out: CoreOwed[] = [];
  for (const b of bills) {
    if (b.status === 'returned') continue;
    for (const l of b.lines) {
      if (!l.is_core || l.core_returned_at) continue;
      out.push({
        line_id: l.id,
        description: l.description,
        amount_cents: l.line_total_cents,
        supplier: suppliers.find(s => s.id === b.supplier_id)?.name || b.supplier_name_raw || 'Supplier',
        job_id: l.job_id,
        bill_invoice_number: b.invoice_number,
        since: (b.invoice_date || b.created_at).slice(0, 10),
      });
    }
  }
  return out;
}

export interface UnbilledPart {
  line_id: string;
  bill_id: string;
  bill_invoice_number: string | null;
  supplier: string;
  date: string;
  description: string;
  cost_cents: number;
  reason: string;
  job_id: string | null;
}

/**
 * Parts the shop paid for that aren't on any customer's invoice: matched to a
 * job whose invoice doesn't include them, or never matched after a week.
 */
export function unbilledParts(
  bills: SupplierBill[],
  suppliers: Supplier[],
  invoicesByJob: Map<string, Pick<Invoice, 'snapshot'>>,
  roByJob: Map<string, number>,
  today: string = todayISO(),
): UnbilledPart[] {
  const out: UnbilledPart[] = [];
  const norm = (s: string | null | undefined) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const b of bills) {
    if (b.status === 'returned' || b.status === 'stock') continue;
    const supplier = suppliers.find(s => s.id === b.supplier_id)?.name || b.supplier_name_raw || 'Supplier';
    const date = (b.invoice_date || b.created_at).slice(0, 10);
    for (const l of b.lines) {
      if (l.is_core) continue;
      if (!l.job_id) {
        if (b.status === 'needs_match' && daysBetween(b.created_at, today) >= 7) {
          out.push({ line_id: l.id, bill_id: b.id, bill_invoice_number: b.invoice_number, supplier, date, description: l.description, cost_cents: l.line_total_cents, reason: 'Never matched to a job', job_id: null });
        }
        continue;
      }
      const inv = invoicesByJob.get(l.job_id);
      if (!inv) continue;
      const billed = inv.snapshot.lines.some(il => il.kind === 'part' && ((l.part_number && norm(il.part_number) === norm(l.part_number)) || similarDescriptions(il.description, l.description)));
      if (!billed) {
        out.push({ line_id: l.id, bill_id: b.id, bill_invoice_number: b.invoice_number, supplier, date, description: l.description, cost_cents: l.line_total_cents, reason: `Matched to RO-${roByJob.get(l.job_id) ?? '?'}, missing from its invoice`, job_id: l.job_id });
      }
    }
  }
  return out;
}

export function collectedSince(payments: Pick<Payment, 'received_at' | 'amount_cents'>[], since: string): number {
  return payments.filter(p => p.received_at.slice(0, 10) >= since).reduce((s, p) => s + p.amount_cents, 0);
}

/** Monday of the current week (the shop's week starts Monday). */
export function weekStart(today: string = todayISO()): string {
  const [y, m, d] = today.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(today, -((day + 6) % 7));
}

/** Compare a supplier statement's invoice numbers with what's been snapped. */
export function reconcileStatement(statementNumbers: string[], bills: Pick<SupplierBill, 'id' | 'invoice_number' | 'total_cents' | 'invoice_date'>[]) {
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const wanted = [...new Set(statementNumbers.map(s => s.trim()).filter(Boolean))];
  const byNumber = new Map(bills.filter(b => b.invoice_number).map(b => [norm(b.invoice_number!), b]));
  const found = wanted.filter(n => byNumber.has(norm(n)));
  const missing = wanted.filter(n => !byNumber.has(norm(n)));
  const wantedSet = new Set(wanted.map(norm));
  const notOnStatement = bills.filter(b => b.invoice_number && !wantedSet.has(norm(b.invoice_number)));
  return { found, missing, notOnStatement };
}
