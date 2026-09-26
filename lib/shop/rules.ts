/**
 * Ontario repair and lien rules, as product guardrails. Client-safe.
 *
 * Sources (researched Sept 2026, confirm with a paralegal before relying on them):
 *   Consumer Protection Act, 2002 (CPA), Part VI ss. 55–65; O. Reg. 17/05 ss. 48–52
 *   Repair and Storage Liens Act (RSLA), ss. 3, 7, 10, 12, 15, 26
 *   CPA Part VII (supplier credit) for instalment payment plans
 * The Consumer Protection Act, 2023 has passed but is not in force; keep these
 * values in one place so they can change with the new regulations.
 */

import { addDays, addYears, addMonths, formatDate, todayISO } from './dates';
import { computeTotals, lineNeedsPrice } from './money';
import type {
  Authorization, Customer, Estimate, EstimateLine, JobDetail, Job, PartCondition, ScheduleItem,
  ShopSettings, Vehicle,
} from './types';

export interface LawRef { cite: string; short: string; text: string }

export const LAW = {
  estimate: { cite: 'CPA 2002, s. 56 · O. Reg. 17/05, s. 48', short: 'Written estimate first', text: 'You can’t charge for any work unless the customer first got a written estimate, or declined one and set a maximum they’ll pay.' },
  estFee: { cite: 'CPA 2002, s. 57', short: 'Estimate fee agreed up front', text: 'You can charge for an estimate only if you told the customer the fee in advance, and not at all if they approve the work and you do it.' },
  auth: { cite: 'CPA 2002, ss. 58–59 · O. Reg. 17/05, s. 49', short: 'Customer approved the work', text: 'No charge for work the customer didn’t approve. A phone approval counts only if you record who approved, the date and time, and the number you called.' },
  cap: { cite: 'CPA 2002, s. 58(2)', short: 'Bill within 10% of the estimate', text: 'The bill can’t be more than 10% over the approved estimate. Extra work needs a revised estimate and a new approval.' },
  invoice: { cite: 'CPA 2002, s. 62 · O. Reg. 17/05, s. 51', short: 'Complete invoice', text: 'Each part and its condition (new OEM, new non-OEM, used or reconditioned), each shop supply, labour hours and rate, odometer in and out, the dates, the estimate total, and the prescribed statement of rights.' },
  warranty: { cite: 'CPA 2002, s. 63 · O. Reg. 17/05, s. 52', short: '90-day / 5,000 km warranty', text: 'New and reconditioned parts and the labour to install them are warranted for at least 90 days or 5,000 km, whichever comes first. Fluids, filters, lights, tires and batteries are excluded.' },
  parts: { cite: 'CPA 2002, s. 61', short: 'Old parts back unless declined', text: 'Return the replaced parts unless the customer said, when approving, that they don’t want them. Parts owed back under a warranty are the exception.' },
  sign: { cite: 'CPA 2002, s. 60 · O. Reg. 17/05, s. 50', short: 'Shop sign', text: 'Post a sign covering the right to an estimate, the estimate fee, how labour is charged, parts commissions, other charges like storage, and that old parts are available.' },
  noLien: { cite: 'RSLA, s. 3(2)', short: 'Paperwork first, or no lien', text: 'If the estimate, estimate-fee and approval rules weren’t followed, the shop has no repair lien at all.' },
  hold: { cite: 'RSLA, ss. 3, 15', short: 'Keep the car until paid', text: 'You have a lien for the approved bill and can keep the car until it’s paid. After 60 days unpaid you can sell it, with written notice at least 15 days before the sale to the customer, the registered owner and anyone registered against the car.' },
  noTacking: { cite: 'RSLA, s. 26', short: 'Only this bill', text: 'Each repair has its own lien. You can’t hold the car for balances from earlier visits.' },
  ack: { cite: 'RSLA, s. 7', short: 'Signed acknowledgment of the debt', text: 'If the car leaves before you’re paid, your lien survives only if the customer signs an acknowledgment of what they owe. It can be on the invoice.' },
  ppsr: { cite: 'RSLA, ss. 10, 12', short: 'Register the lien the same day', text: 'Register a claim for lien against the VIN in Ontario’s PPSR. There’s no deadline, but an unregistered lien is wiped out if the car changes owners. A registration lasts up to 3 years.' },
  discharge: { cite: 'RSLA, s. 12(4)', short: 'Discharge within 30 days of payment', text: 'When the customer pays in full, register a discharge within 30 days. It’s free; missing it can cost $100 plus damages.' },
  credit: { cite: 'CPA 2002, Part VII', short: 'Credit disclosure for instalments', text: 'A plan with instalments is credit. Give the customer a credit disclosure statement at or before signing, let them pay it off early without penalty, and add no fees the Act doesn’t allow.' },
  consumer: { cite: 'CPA 2002, s. 1', short: 'People, not businesses', text: 'The repair rules protect individuals. Business and fleet customers aren’t covered, but Keystone keeps the same paper trail for them.' },
} satisfies Record<string, LawRef>;

/** O. Reg. 17/05, s. 51, para. 23: printed verbatim on every repair invoice. */
export const STATUTORY_STATEMENT =
  'The Consumer Protection Act, 2002 provides you with rights in relation to having a motor vehicle repaired. Among other things, you have a right to a written estimate. A repairer may not charge an amount that is more than ten (10) per cent above that estimate. If you waived your right to an estimate, the repairer must have your authorization of the maximum amount that you will pay for the repairs. The repairer may not charge more than the maximum amount you authorized. In either case, the repairer may not charge for any work you did not authorize. If you have concerns about the work or repairs performed by the repairer or about your rights or duties under the Consumer Protection Act, 2002, you should contact the Ministry of Consumer and Business Services.';

/** O. Reg. 17/05, s. 51, paras. 19–20. */
export const WARRANTY_TEXT =
  'New and reconditioned parts and the labour to install them are warranted for a minimum of 90 days or 5,000 kilometres, whichever comes first. This warranty is provided under the Consumer Protection Act, 2002 and may not be waived by the consumer. It does not apply to fluids, filters, lights, tires or batteries, or to a part that was not warranted by the manufacturer of the vehicle when the vehicle was sold as new.';

export const TEN_PERCENT_STATEMENT = (totalLabel: string) =>
  `We will not charge you more than 10% above the estimated total of ${totalLabel}, and we won’t do any work you haven’t approved.`;

export const CONDITION_LABELS: Record<PartCondition, string> = {
  new_oem: 'New, OEM',
  new_non_oem: 'New, non-OEM',
  used: 'Used',
  reconditioned: 'Reconditioned',
};

export const CONDITION_OPTIONS: { value: PartCondition; label: string }[] = [
  { value: 'new_non_oem', label: 'New, non-OEM (aftermarket)' },
  { value: 'new_oem', label: 'New, OEM' },
  { value: 'reconditioned', label: 'Reconditioned' },
  { value: 'used', label: 'Used' },
];

export interface Problem { field: string; message: string }

// ── 10% cap ────────────────────────────────────────────────────────────────

export function capCheck(approvedCents: number, invoiceCents: number) {
  const limitCents = Math.floor((approvedCents * 11) / 10);
  const overPct = approvedCents > 0 ? ((invoiceCents - approvedCents) / approvedCents) * 100 : 0;
  return { ok: invoiceCents <= limitCents, limitCents, overPct };
}

// ── Estimates (O. Reg. 17/05, s. 48) ───────────────────────────────────────

export function estimateProblems(ctx: {
  estimate: Pick<Estimate, 'valid_until' | 'ready_by'>;
  lines: Pick<EstimateLine, 'kind' | 'description' | 'decision' | 'condition' | 'hours' | 'rate_cents' | 'unit_price_cents' | 'amount_cents' | 'qty'>[];
  job: Pick<Job, 'odometer_in' | 'estimate_fee_cents' | 'estimate_fee_agreed_at'>;
  customer: Pick<Customer, 'name'>;
  vehicle: Pick<Vehicle, 'make' | 'model' | 'vin' | 'plate'>;
  settings: Pick<ShopSettings, 'legal_name' | 'phone' | 'address'>;
  shopName?: string;
}): Problem[] {
  const p: Problem[] = [];
  const { lines, job, customer, vehicle, settings, estimate } = ctx;
  if (!customer.name?.trim()) p.push({ field: 'customer', message: 'Customer’s name' });
  if (!(settings.legal_name || ctx.shopName)) p.push({ field: 'shop', message: 'Your business name (Settings)' });
  if (!settings.phone) p.push({ field: 'shop', message: 'Your phone number (Settings)' });
  if (!settings.address) p.push({ field: 'shop', message: 'Your business address (Settings)' });
  if (!vehicle.make || !vehicle.model) p.push({ field: 'vehicle', message: 'Vehicle make and model' });
  if (!vehicle.vin) p.push({ field: 'vehicle', message: 'VIN' });
  if (!vehicle.plate) p.push({ field: 'vehicle', message: 'Licence plate' });
  if (job.odometer_in == null) p.push({ field: 'odometer', message: 'Odometer reading' });
  const included = lines.filter(l => l.decision !== 'declined');
  if (included.length === 0) p.push({ field: 'lines', message: 'At least one line of work' });
  included.forEach((l, i) => {
    const label = l.description?.trim() || `Line ${i + 1}`;
    if (!l.description?.trim()) p.push({ field: 'lines', message: `A description for line ${i + 1}` });
    if (l.kind === 'part' && !l.condition) p.push({ field: 'lines', message: `Condition of “${label}” (new OEM, new non-OEM, used or reconditioned)` });
    if (lineNeedsPrice(l)) p.push({ field: 'lines', message: l.kind === 'labour' ? `Hours and rate for “${label}”` : `A price for “${label}”` });
  });
  if (!estimate.valid_until) p.push({ field: 'valid_until', message: 'The date the estimate stops applying' });
  if (!estimate.ready_by) p.push({ field: 'ready_by', message: 'The date the work will be done' });
  if (job.estimate_fee_cents > 0 && !job.estimate_fee_agreed_at) {
    p.push({ field: 'estimate_fee', message: 'Record that the customer agreed to the estimate fee' });
  }
  return p;
}

// ── Authorization records (CPA s. 59, O. Reg. 17/05, s. 49) ────────────────

export function authProblems(input: {
  method: Authorization['method'];
  authorized_by?: string | null;
  phone?: string | null;
  contact?: string | null;
  authorized_at?: string | null;
  signature?: string | null;
  typed_name?: string | null;
}): Problem[] {
  const p: Problem[] = [];
  if (!input.authorized_by?.trim()) p.push({ field: 'authorized_by', message: 'Name of the person approving' });
  if (!input.authorized_at) p.push({ field: 'authorized_at', message: 'Date and time of the approval' });
  if (input.method === 'phone' && !input.phone?.trim()) p.push({ field: 'phone', message: 'The phone number you called' });
  if ((input.method === 'email' || input.method === 'text') && !input.contact?.trim()) {
    p.push({ field: 'contact', message: input.method === 'email' ? 'The email address it came from' : 'The number the text came from' });
  }
  if (input.method === 'in_person' && !input.signature && !input.typed_name?.trim()) {
    p.push({ field: 'signature', message: 'The customer’s signature' });
  }
  if (input.method === 'online' && !input.typed_name?.trim()) p.push({ field: 'typed_name', message: 'The customer’s typed name' });
  return p;
}

// ── Estimate fee (CPA s. 57) ───────────────────────────────────────────────

/** The estimate fee can be charged only if it was agreed in advance and the repair was NOT approved and done. */
export function estimateFeeChargeable(job: Pick<Job, 'estimate_fee_cents' | 'estimate_fee_agreed_at'>, repairApproved: boolean): boolean {
  return job.estimate_fee_cents > 0 && !!job.estimate_fee_agreed_at && !repairApproved;
}

// ── Lien validity (RSLA s. 3(2)) ───────────────────────────────────────────

export function lienCheck(detail: Pick<JobDetail, 'job' | 'estimates' | 'authorizations'>): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const approved = detail.estimates.find(e => e.status === 'approved');
  if (!approved) {
    return { valid: false, reasons: ['No approved estimate. There’s no repair lien without one.'] };
  }
  if (!approved.sent_at) reasons.push('The approved estimate was never given to the customer in writing.');
  const auth = detail.authorizations
    .filter(a => a.estimate_id === approved.id && a.kind === 'estimate')
    .sort((a, b) => b.authorized_at.localeCompare(a.authorized_at))[0];
  if (!auth) reasons.push('No record of the customer approving the estimate.');
  else {
    const missing = authProblems({
      method: auth.method, authorized_by: auth.authorized_by, phone: auth.phone, contact: auth.contact,
      authorized_at: auth.authorized_at, signature: auth.signature_path, typed_name: auth.typed_name,
    });
    if (missing.length) reasons.push(`The approval record is missing: ${missing.map(m => m.message.toLowerCase()).join(', ')}.`);
  }
  if (detail.job.estimate_fee_cents > 0 && !detail.job.estimate_fee_agreed_at) {
    reasons.push('The estimate fee was never recorded as agreed.');
  }
  return { valid: reasons.length === 0, reasons };
}

// ── Liens: dates and schedules ─────────────────────────────────────────────

/** RSLA s. 3(3): the right to sell arises 60 days after the amount comes due. */
export function saleEligibleOn(dueDate: string): string { return addDays(dueDate, 60); }

/** RSLA s. 12(4): register the discharge within 30 days of payment. */
export function dischargeDueOn(paidOn: string): string { return addDays(paidOn, 30); }

/** RSLA s. 10(3): 1, 2 or 3 whole years, never past the third anniversary. */
export function ppsrExpiresOn(registeredOn: string, years: number): string {
  return addYears(registeredOn, Math.min(3, Math.max(1, Math.round(years))));
}

export function buildSchedule(input: {
  owingCents: number;
  planKind: 'single' | 'instalments';
  frequency?: 'weekly' | 'biweekly' | 'monthly' | null;
  instalmentCents?: number | null;
  firstDue: string;
}): ScheduleItem[] {
  const out: ScheduleItem[] = [];
  let left = input.owingCents;
  if (left <= 0) return out;
  if (input.planKind === 'single') return [{ due: input.firstDue, amount_cents: left }];
  const step = Math.max(100, input.instalmentCents ?? 0);
  let due = input.firstDue;
  for (let i = 0; left > 0 && i < 156; i++) {
    const amount = Math.min(step, left);
    out.push({ due, amount_cents: amount });
    left -= amount;
    due = input.frequency === 'weekly' ? addDays(due, 7)
      : input.frequency === 'monthly' ? addMonths(due, 1)
      : addDays(due, 14);
  }
  // Fold a tiny final remainder (under a quarter of a payment) into the one before it.
  if (out.length > 1 && out[out.length - 1].amount_cents < step / 4) {
    const last = out.pop()!;
    out[out.length - 1].amount_cents += last.amount_cents;
  }
  return out;
}

export function isConsumer(customer: Pick<Customer, 'customer_type'>): boolean {
  return customer.customer_type !== 'business';
}

// ── Checklist shown on the job file ────────────────────────────────────────

export interface ChecklistItem { status: 'ok' | 'warn' | 'todo'; law: LawRef; note: string }

export function complianceChecklist(detail: JobDetail, now: string = todayISO()): ChecklistItem[] {
  const { job, estimates, authorizations, customer, invoice } = detail;
  const items: ChecklistItem[] = [];
  const approved = estimates.find(e => e.status === 'approved') ?? null;
  const latest = [...estimates].sort((a, b) => b.version - a.version)[0] ?? null;
  const pendingRevision = estimates.find(e => e.is_revision && (e.status === 'draft' || e.status === 'sent')) ?? null;

  if (!isConsumer(customer)) {
    items.push({ status: 'ok', law: LAW.consumer, note: customer.business_reason ? `Business customer: ${customer.business_reason}` : 'Business customer.' });
  }

  if (job.estimate_fee_cents > 0) {
    const agreed = !!job.estimate_fee_agreed_at;
    items.push({
      status: agreed ? 'ok' : 'warn',
      law: LAW.estFee,
      note: agreed
        ? `${job.estimate_fee_note || 'Agreed'}${approved ? '. Not charged, because the repair was approved.' : '. Charged only if they decline the repair.'}`
        : 'Record that the customer agreed to the fee before you charge it.',
    });
  } else {
    items.push({ status: 'ok', law: LAW.estFee, note: 'No estimate fee on this job.' });
  }

  const sentEstimate = approved ?? (latest && latest.sent_at ? latest : null);
  items.push(sentEstimate
    ? { status: 'ok', law: LAW.estimate, note: `v${sentEstimate.version} given ${sentEstimate.sent_via === 'in_person' ? 'in person' : 'in writing'}${sentEstimate.valid_until ? `, good until ${formatDate(sentEstimate.valid_until)}` : ''}.` }
    : { status: 'todo', law: LAW.estimate, note: latest ? 'Draft. Not given to the customer yet.' : 'No estimate yet.' });

  const approvedAuth = approved
    ? authorizations.filter(a => a.estimate_id === approved.id && a.kind === 'estimate').sort((a, b) => b.authorized_at.localeCompare(a.authorized_at))[0]
    : null;
  items.push(approvedAuth
    ? { status: 'ok', law: LAW.auth, note: `${methodLabel(approvedAuth.method)} by ${approvedAuth.authorized_by}.` }
    : { status: 'todo', law: LAW.auth, note: 'Needed before any work.' });

  if (approved) {
    if (pendingRevision) {
      items.push({ status: 'warn', law: { ...LAW.cap, short: 'Extra work not approved yet' }, note: 'Needs the revised estimate approved before it goes on the bill.' });
    }
    const approvedTotal = computeTotals(approved.lines, detail.settings.tax_rate_bps).total_cents;
    const billed = invoice ? invoice.total_cents : computeInvoiceTotal(detail);
    const cap = capCheck(approvedTotal, billed);
    items.push({ status: cap.ok ? 'ok' : 'warn', law: LAW.cap, note: `${invoice ? 'Invoice' : 'Bill so far'} ${fmt(billed)} vs approved ${fmt(approvedTotal)} (limit ${fmt(cap.limitCents)}).` });
    items.push({ status: 'ok', law: LAW.invoice, note: 'Keystone prints every required item, including the statement of rights.' });
    items.push({ status: 'ok', law: LAW.warranty, note: 'Printed on the invoice. Fluids, filters, tires and batteries are marked as not covered.' });
    const partsBack = approvedAuth?.parts_back;
    items.push({ status: partsBack == null ? 'todo' : 'ok', law: LAW.parts, note: partsBack == null ? 'Ask whether they want the replaced parts back.' : partsBack ? 'Customer wants the old parts back. Bag them.' : 'Customer said at approval they don’t want them.' });
    const lien = lienCheck(detail);
    items.push({ status: lien.valid ? 'ok' : 'warn', law: LAW.noLien, note: lien.valid ? 'Estimate, fee and approval records are complete, so the repair lien holds.' : lien.reasons.join(' ') });
  }

  if (job.holding_since && invoice) {
    const due = invoice.issued_at.slice(0, 10);
    const saleOn = saleEligibleOn(due);
    items.push({ status: 'warn', law: LAW.hold, note: `Holding the car. From ${formatDate(saleOn)} you can start a sale, with 15 days’ written notice first.${now >= saleOn ? ' That date has passed.' : ''}` });
  }
  return items;
}

/** What the invoice would total today: the approved estimate plus any pre-invoice adjustments. */
export function computeInvoiceTotal(detail: Pick<JobDetail, 'estimates' | 'job' | 'settings'>): number {
  const approved = detail.estimates.find(e => e.status === 'approved');
  if (!approved) return 0;
  const adjusted = approved.lines.map(l => {
    const a = detail.job.invoice_adjustments?.[l.id];
    return a ? { ...l, ...a } : l;
  });
  return computeTotals(adjusted, detail.settings.tax_rate_bps).total_cents;
}

export function methodLabel(method: Authorization['method']): string {
  return { phone: 'Phone call', in_person: 'In person', online: 'Online', email: 'Email', text: 'Text message' }[method];
}

function fmt(cents: number): string {
  return (cents / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}
