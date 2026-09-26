/**
 * Money math for estimates and invoices. Client-safe.
 * All amounts are integer cents; tax is rounded once, on the subtotal.
 */

import type { EstimateLine, InvoiceLine, LineAdjustment, LineKind } from './types';

export interface PricedLine {
  kind: LineKind;
  decision?: 'include' | 'declined';
  qty?: number | string | null;
  hours?: number | string | null;
  rate_cents?: number | null;
  unit_price_cents?: number | null;
  amount_cents?: number | null;
  unit_cost_cents?: number | null;
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? parseFloat(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};

export function lineTotalCents(l: PricedLine): number {
  if (l.kind === 'labour') return Math.round(num(l.hours) * (l.rate_cents ?? 0));
  if (l.kind === 'part') return Math.round(num(l.qty) * (l.unit_price_cents ?? 0));
  return l.amount_cents ?? 0;
}

export function lineCostCents(l: PricedLine): number {
  if (l.kind === 'part') return Math.round(num(l.qty) * (l.unit_cost_cents ?? 0));
  if (l.kind === 'sublet') return l.unit_cost_cents ?? 0;
  return 0;
}

/** A line that can't go on a sent estimate yet. */
export function lineNeedsPrice(l: PricedLine): boolean {
  if (l.kind === 'part') return l.unit_price_cents == null;
  if (l.kind === 'labour') return l.hours == null || l.rate_cents == null;
  return l.amount_cents == null;
}

export function taxCents(subtotalCents: number, taxRateBps: number): number {
  return Math.round((subtotalCents * taxRateBps) / 10000);
}

export interface Totals {
  labour_cents: number;
  parts_cents: number;
  supplies_cents: number;
  fees_cents: number;
  discount_cents: number;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  cost_cents: number;
  gross_profit_cents: number;
  margin_pct: number;
  needs_price: number;
}

export function computeTotals(lines: PricedLine[], taxRateBps: number): Totals {
  const t: Totals = {
    labour_cents: 0, parts_cents: 0, supplies_cents: 0, fees_cents: 0, discount_cents: 0,
    subtotal_cents: 0, tax_cents: 0, total_cents: 0, cost_cents: 0, gross_profit_cents: 0,
    margin_pct: 0, needs_price: 0,
  };
  for (const l of lines) {
    if (l.decision === 'declined') continue;
    if (lineNeedsPrice(l)) t.needs_price++;
    const amount = lineTotalCents(l);
    if (l.kind === 'labour') t.labour_cents += amount;
    else if (l.kind === 'part') t.parts_cents += amount;
    else if (l.kind === 'supply') t.supplies_cents += amount;
    else if (l.kind === 'discount') t.discount_cents += amount;
    else t.fees_cents += amount;
    t.subtotal_cents += amount;
    t.cost_cents += lineCostCents(l);
  }
  t.tax_cents = taxCents(t.subtotal_cents, taxRateBps);
  t.total_cents = t.subtotal_cents + t.tax_cents;
  t.gross_profit_cents = t.subtotal_cents - t.cost_cents;
  t.margin_pct = t.subtotal_cents > 0 ? Math.round((t.gross_profit_cents / t.subtotal_cents) * 100) : 0;
  return t;
}

/** Apply pre-invoice adjustments (actual hours, changed prices) to approved lines. */
export function applyAdjustments(lines: EstimateLine[], adjustments: Record<string, LineAdjustment>): EstimateLine[] {
  return lines.map(l => {
    const a = adjustments[l.id];
    if (!a) return l;
    return {
      ...l,
      hours: a.hours ?? l.hours,
      qty: a.qty ?? l.qty,
      unit_price_cents: a.unit_price_cents ?? l.unit_price_cents,
      amount_cents: a.amount_cents ?? l.amount_cents,
    };
  });
}

export function toInvoiceLine(l: EstimateLine): InvoiceLine {
  return {
    estimate_line_id: l.id,
    kind: l.kind,
    description: l.description,
    qty: num(l.qty),
    hours: l.hours == null ? null : num(l.hours),
    rate_cents: l.rate_cents,
    unit_price_cents: l.unit_price_cents,
    amount_cents: lineTotalCents(l),
    condition: l.condition,
    part_number: l.part_number,
    no_warranty: l.no_warranty,
    is_added_work: l.is_added_work,
  };
}

export function formatCents(cents: number | null | undefined): string {
  const v = (cents ?? 0) / 100;
  const s = Math.abs(v).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
  return v < 0 ? `−${s}` : s;
}

/** "$1,234.50" / "1234.5" / "-40" → cents. Returns null for blank or unparseable input. */
export function parseMoneyToCents(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : null;
  const cleaned = input.replace(/[^0-9.\-−]/g, '').replace('−', '-');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const v = parseFloat(cleaned);
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}
