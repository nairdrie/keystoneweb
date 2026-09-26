/**
 * Builds the data printed on estimates, invoices and lien paperwork. Client-safe,
 * so the admin preview, the customer page and the PDF all render the same thing.
 */

import { applyAdjustments, computeTotals, formatCents, toInvoiceLine, type Totals } from './money';
import { CONDITION_LABELS, STATUTORY_STATEMENT, TEN_PERCENT_STATEMENT, WARRANTY_TEXT, estimateFeeChargeable } from './rules';
import { invoiceLabel, vehicleLabel } from './board';
import { formatDate } from './dates';
import type {
  Authorization, Customer, Estimate, InvoiceLine, InvoiceSnapshot, Job, Lien, ScheduleItem, ShopSettings, Vehicle,
} from './types';

export interface ShopIdentity {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hst_number: string | null;
}

export function shopIdentity(settings: ShopSettings, site: { name: string; base_url: string | null }): ShopIdentity {
  return {
    name: settings.legal_name || site.name,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    website: site.base_url ? site.base_url.replace(/^https?:\/\//, '') : null,
    hst_number: settings.hst_number,
  };
}

export function estimateNumber(roNumber: number, version: number): string {
  return `EST-${roNumber}-v${version}`;
}

export interface DocLine {
  kind: InvoiceLine['kind'];
  description: string;
  detail: string | null;
  qty: string;
  rate: string;
  amount_cents: number;
  added: boolean;
}

export function docLine(l: InvoiceLine): DocLine {
  let detail: string | null = null;
  let qty = '';
  let rate = '';
  if (l.kind === 'labour') {
    detail = `Labour: ${(l.hours ?? 0).toFixed(1)} h at ${formatCents(l.rate_cents)}/h`;
    qty = (l.hours ?? 0).toFixed(1);
    rate = formatCents(l.rate_cents);
  } else if (l.kind === 'part') {
    const bits = [l.condition ? CONDITION_LABELS[l.condition] : null, l.part_number ? `part #${l.part_number}` : null, l.no_warranty ? 'not covered by the warranty' : null].filter(Boolean);
    detail = bits.join(' · ') || null;
    qty = String(l.qty);
    rate = l.unit_price_cents == null ? 'TBD' : formatCents(l.unit_price_cents);
  } else if (l.kind === 'supply') {
    detail = 'Shop supply';
  }
  return { kind: l.kind, description: l.description, detail, qty, rate, amount_cents: l.amount_cents, added: l.is_added_work };
}

// ── Estimates ───────────────────────────────────────────────────────────────

export interface EstimateDoc {
  title: 'ESTIMATE' | 'REVISED ESTIMATE';
  number_label: string;
  date_label: string | null;
  valid_until: string | null;
  ready_by: string | null;
  shop: ShopIdentity;
  customer: Pick<Customer, 'name' | 'phone' | 'email'>;
  vehicle: { description: string; vin: string | null; plate: string | null; odometer: number | null };
  work_requested: string;
  lines: DocLine[];
  declined: { description: string; amount_cents: number }[];
  totals: Totals;
  tax_label: string;
  tax_rate_bps: number;
  ten_percent_statement: string;
  estimate_fee_statement: string;
  parts_statement: string;
  other_charges: string | null;
  notes: string | null;
}

export function buildEstimateDoc(input: {
  estimate: Estimate;
  job: Pick<Job, 'ro_number' | 'complaint' | 'odometer_in' | 'estimate_fee_cents' | 'estimate_fee_note' | 'estimate_fee_agreed_at'>;
  customer: Pick<Customer, 'name' | 'phone' | 'email'>;
  vehicle: Pick<Vehicle, 'year' | 'make' | 'model' | 'trim' | 'vin' | 'plate'>;
  settings: ShopSettings;
  site: { name: string; base_url: string | null };
}): EstimateDoc {
  const { estimate, job, settings } = input;
  const included = estimate.lines.filter(l => l.decision === 'include');
  const totals = computeTotals(estimate.lines, settings.tax_rate_bps);
  const fee = job.estimate_fee_cents;
  return {
    title: estimate.is_revision ? 'REVISED ESTIMATE' : 'ESTIMATE',
    number_label: estimateNumber(job.ro_number, estimate.version),
    date_label: estimate.sent_at ? estimate.sent_at.slice(0, 10) : null,
    valid_until: estimate.valid_until,
    ready_by: estimate.ready_by,
    shop: shopIdentity(settings, input.site),
    customer: input.customer,
    vehicle: {
      description: [vehicleLabel(input.vehicle), input.vehicle.trim].filter(Boolean).join(' '),
      vin: input.vehicle.vin, plate: input.vehicle.plate, odometer: job.odometer_in,
    },
    work_requested: job.complaint,
    lines: included.map(l => docLine(toInvoiceLine(l))),
    declined: estimate.lines.filter(l => l.decision === 'declined').map(l => ({ description: l.description, amount_cents: toInvoiceLine(l).amount_cents })),
    totals,
    tax_label: settings.tax_label,
    tax_rate_bps: settings.tax_rate_bps,
    ten_percent_statement: TEN_PERCENT_STATEMENT(formatCents(totals.total_cents)),
    estimate_fee_statement: fee > 0
      ? `Estimate fee: ${formatCents(fee)}${job.estimate_fee_note ? ` (${job.estimate_fee_note})` : ''}. We don’t charge it if you approve the repair and we do the work.`
      : 'There is no charge for this estimate.',
    parts_statement: 'Replaced parts are returned to you unless you tell us, when you approve, that you don’t want them.',
    other_charges: settings.other_charges,
    notes: estimate.notes,
  };
}

// ── Invoices ────────────────────────────────────────────────────────────────

export function latestEstimateAuth(authorizations: Authorization[], estimateId: string | null): Authorization | null {
  if (!estimateId) return null;
  return authorizations
    .filter(a => a.estimate_id === estimateId && a.kind === 'estimate')
    .sort((a, b) => b.authorized_at.localeCompare(a.authorized_at))[0] ?? null;
}

export function buildInvoiceSnapshot(input: {
  job: Job;
  customer: Customer;
  vehicle: Vehicle;
  estimates: Estimate[];
  authorizations: Authorization[];
  settings: ShopSettings;
  site: { name: string; base_url: string | null };
  number: number | null;
  issuedOn: string;
  odometerOut: number | null;
  returnedOn: string | null;
  kind?: 'repair' | 'estimate_fee';
}): { snapshot: InvoiceSnapshot; totals: Totals; estimateId: string | null } {
  const { job, customer, vehicle, settings } = input;
  const approved = input.estimates.find(e => e.status === 'approved') ?? null;
  const kind = input.kind ?? 'repair';
  let lines: InvoiceLine[];
  let totals: Totals;
  let declined: { description: string; amount_cents: number }[] = [];
  if (kind === 'estimate_fee') {
    const feeLine = { kind: 'fee' as const, description: 'Estimate fee (repair not approved)', decision: 'include' as const, amount_cents: job.estimate_fee_cents };
    totals = computeTotals([feeLine], settings.tax_rate_bps);
    lines = [{
      estimate_line_id: null, kind: 'fee', description: feeLine.description, qty: 1, hours: null, rate_cents: null,
      unit_price_cents: null, amount_cents: job.estimate_fee_cents, condition: null, part_number: null, no_warranty: false, is_added_work: false,
    }];
    const latest = [...input.estimates].sort((a, b) => b.version - a.version)[0];
    if (latest) declined = latest.lines.filter(l => l.decision === 'include').map(l => ({ description: l.description, amount_cents: toInvoiceLine(l).amount_cents }));
  } else {
    const approvedLines = approved ? approved.lines.filter(l => l.decision === 'include') : [];
    const adjusted = applyAdjustments(approvedLines, job.invoice_adjustments || {});
    totals = computeTotals(adjusted, settings.tax_rate_bps);
    lines = adjusted.map(toInvoiceLine);
    declined = approved ? approved.lines.filter(l => l.decision === 'declined').map(l => ({ description: l.description, amount_cents: toInvoiceLine(l).amount_cents })) : [];
  }
  const auth = latestEstimateAuth(input.authorizations, approved?.id ?? null);
  const approvedTotal = approved ? computeTotals(approved.lines, settings.tax_rate_bps).total_cents : null;
  const feeWaivedNote = kind === 'repair' && job.estimate_fee_cents > 0 && !estimateFeeChargeable(job, true)
    ? `Estimate fee of ${formatCents(job.estimate_fee_cents)} not charged because the repair was approved.`
    : null;
  const snapshot: InvoiceSnapshot = {
    number_label: input.number != null ? invoiceLabel(input.number) : 'Draft',
    issued_on: input.issuedOn,
    kind,
    shop: shopIdentity(settings, input.site),
    customer: { name: customer.name, phone: customer.phone, email: customer.email, address: customer.address, customer_type: customer.customer_type },
    vehicle: {
      description: [vehicleLabel(vehicle), vehicle.trim].filter(Boolean).join(' '),
      vin: vehicle.vin, plate: vehicle.plate, odometer_in: job.odometer_in, odometer_out: input.odometerOut,
    },
    ro_number: job.ro_number,
    work_requested: job.complaint,
    dates: {
      authorized: auth?.authorized_at ?? null,
      completed: job.completed_at ?? (kind === 'estimate_fee' ? null : input.issuedOn),
      returned: input.returnedOn,
    },
    lines,
    declined,
    totals: {
      labour_cents: totals.labour_cents, parts_cents: totals.parts_cents, supplies_cents: totals.supplies_cents,
      subtotal_cents: totals.subtotal_cents, tax_cents: totals.tax_cents, total_cents: totals.total_cents,
      tax_label: settings.tax_label, tax_rate_bps: settings.tax_rate_bps,
    },
    estimate: approved && approvedTotal != null ? { label: estimateNumber(job.ro_number, approved.version), total_cents: approvedTotal } : null,
    authorization: auth ? { method: auth.method, by: auth.authorized_by, phone: auth.phone, when: auth.authorized_at, taken_by: auth.taken_by } : null,
    estimate_fee_note: kind === 'estimate_fee'
      ? `Agreed before the estimate${job.estimate_fee_note ? ` (${job.estimate_fee_note})` : ''}. Charged because the repair was not approved.`
      : feeWaivedNote,
    parts_returned: auth?.parts_back ?? null,
    payment_terms: settings.payment_terms,
    payment_methods: settings.payment_methods_note,
    warranty_text: WARRANTY_TEXT,
    warranty_extra: settings.warranty_extra,
    statutory_statement: STATUTORY_STATEMENT,
  };
  return { snapshot, totals, estimateId: approved?.id ?? null };
}

// ── Lien paperwork ──────────────────────────────────────────────────────────

export interface AcknowledgmentDoc {
  shop: ShopIdentity;
  signer_name: string;
  signer_capacity: string;
  customer_name: string;
  vehicle: { description: string; vin: string | null; plate: string | null; color: string | null };
  invoice_label: string;
  invoice_date: string;
  invoice_total_cents: number;
  owing_cents: number;
  down_payment_cents: number;
  plan_kind: 'single' | 'instalments';
  frequency: Lien['frequency'];
  schedule: ScheduleItem[];
  released_on: string;
  signed_at: string | null;
  terms_text: string;
  lien_text: string;
  credit_disclosure: null | {
    amount_financed_cents: number;
    total_of_payments_cents: number;
    cost_of_borrowing_cents: number;
    apr_text: string;
    payments: ScheduleItem[];
    prepayment_text: string;
    default_text: string;
  };
}

export function buildAcknowledgmentDoc(input: {
  shop: ShopIdentity;
  customer: Pick<Customer, 'name'>;
  vehicle: Pick<Vehicle, 'year' | 'make' | 'model' | 'trim' | 'vin' | 'plate' | 'color'>;
  invoice: { label: string; issued_on: string; total_cents: number };
  owingCents: number;
  downPaymentCents: number;
  planKind: 'single' | 'instalments';
  frequency: Lien['frequency'];
  schedule: ScheduleItem[];
  signerName: string;
  signerCapacity: 'owner' | 'authorized_agent';
  releasedOn: string;
  signedAt: string | null;
}): AcknowledgmentDoc {
  const freqLabel = input.frequency === 'weekly' ? 'weekly' : input.frequency === 'monthly' ? 'monthly' : 'every two weeks';
  const first = input.schedule[0];
  const terms = input.planKind === 'single'
    ? `I agree to pay the remaining ${formatCents(input.owingCents)} by ${first ? formatDate(first.due) : ''}, with no interest or fees.`
    : `I agree to pay the remaining ${formatCents(input.owingCents)} in ${input.schedule.length} payments (${freqLabel}) starting ${first ? formatDate(first.due) : ''}, as scheduled below, with no interest or fees. I can pay the balance early at any time without penalty.`;
  return {
    shop: input.shop,
    signer_name: input.signerName,
    signer_capacity: input.signerCapacity === 'owner' ? 'Registered owner' : 'Authorized agent of the owner',
    customer_name: input.customer.name,
    vehicle: {
      description: [vehicleLabel(input.vehicle), input.vehicle.trim].filter(Boolean).join(' '),
      vin: input.vehicle.vin, plate: input.vehicle.plate, color: input.vehicle.color,
    },
    invoice_label: input.invoice.label,
    invoice_date: input.invoice.issued_on,
    invoice_total_cents: input.invoice.total_cents,
    owing_cents: input.owingCents,
    down_payment_cents: input.downPaymentCents,
    plan_kind: input.planKind,
    frequency: input.frequency,
    schedule: input.schedule,
    released_on: input.releasedOn,
    signed_at: input.signedAt,
    terms_text: terms,
    lien_text: `I acknowledge that I owe ${input.shop.name} ${formatCents(input.owingCents)} for repairs to the vehicle described below, as shown on invoice ${input.invoice.label} dated ${formatDate(input.invoice.issued_on)}. I understand the repairer keeps a lien against this vehicle under the Repair and Storage Liens Act (Ontario) until the amount is paid, and may register it in the Personal Property Security Registration System.`,
    credit_disclosure: input.planKind === 'instalments' ? {
      amount_financed_cents: input.owingCents,
      total_of_payments_cents: input.schedule.reduce((s, i) => s + i.amount_cents, 0),
      cost_of_borrowing_cents: 0,
      apr_text: '0% annual percentage rate. No interest is charged.',
      payments: input.schedule,
      prepayment_text: 'You may pay the full outstanding balance, or any part of it, at any time without any charge or penalty.',
      default_text: 'No default charges apply other than those the Consumer Protection Act, 2002 allows: reasonable legal costs to collect, costs of realizing on the lien, and a charge for a dishonoured payment.',
    } : null,
  };
}
