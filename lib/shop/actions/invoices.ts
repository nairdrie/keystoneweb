/**
 * Invoices and payments. An invoice is built from the approved estimate plus
 * adjustments (actual hours, final prices), can't exceed the approved total by
 * more than 10% (CPA s. 58(2)), and is frozen once issued.
 */

import { ShopRuleError, type ShopAccess } from '../access';
import { addEvent, loadSiteInfo, paidByInvoice } from '../data';
import { computeTotals, formatCents, applyAdjustments } from '../money';
import { capCheck, dischargeDueOn, estimateFeeChargeable } from '../rules';
import { formatDate, todayISO } from '../dates';
import { buildInvoiceSnapshot } from '../documents';
import { invoicePdf } from '../pdf';
import { docUrl, newPublicToken } from '../links';
import { sendShopEmail } from '../mail';
import { invoiceLabel, vehicleLabel } from '../board';
import type { Invoice, LineAdjustment, PaymentMethod } from '../types';
import { fail, int, isIsoDate, isUuid, jobIdForInvoice, nowIso, num, requireJob, str } from './common';

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'debit', 'credit', 'etransfer', 'cheque', 'stripe', 'paypal', 'other'];

/** Save actual hours / final prices against the approved lines before invoicing. */
export async function saveAdjustments(access: ShopAccess, jobId: string, raw: unknown) {
  const detail = await requireJob(access, jobId);
  if (detail.invoice) throw new ShopRuleError('The invoice is already issued. Void it to change the bill.', undefined, 409);
  const approved = detail.estimates.find(e => e.status === 'approved');
  if (!approved) throw new ShopRuleError('There’s no approved estimate to invoice from.', undefined, 409);
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, Record<string, unknown>>;
  const out: Record<string, LineAdjustment> = {};
  for (const line of approved.lines) {
    const a = input[line.id];
    if (!a || line.decision !== 'include') continue;
    const adj: LineAdjustment = {};
    if (line.kind === 'labour' && num(a.hours) != null) adj.hours = Math.max(0, Math.round(num(a.hours)! * 100) / 100);
    if (line.kind === 'part') {
      if (num(a.qty) != null && num(a.qty)! > 0) adj.qty = Math.round(num(a.qty)! * 100) / 100;
      if (int(a.unit_price_cents) != null) adj.unit_price_cents = Math.max(0, int(a.unit_price_cents)!);
    }
    if (['supply', 'fee', 'sublet'].includes(line.kind) && int(a.amount_cents) != null) adj.amount_cents = Math.max(0, int(a.amount_cents)!);
    if (line.kind === 'discount' && int(a.amount_cents) != null) adj.amount_cents = -Math.abs(int(a.amount_cents)!);
    if (Object.keys(adj).length) out[line.id] = adj;
  }
  const { error } = await access.db.from('shop_jobs').update({ invoice_adjustments: out }).eq('site_id', access.siteId).eq('id', jobId);
  fail(error, 'Save invoice changes');
  const approvedTotal = computeTotals(approved.lines, detail.settings.tax_rate_bps).total_cents;
  const billed = computeTotals(applyAdjustments(approved.lines.filter(l => l.decision === 'include'), out), detail.settings.tax_rate_bps).total_cents;
  return { ok: true, adjustments: out, cap: capCheck(approvedTotal, billed), billed_cents: billed, approved_cents: approvedTotal };
}

export interface IssueInvoiceInput {
  kind?: unknown;
  odometer_out?: unknown;
  returned_on?: unknown;
  send_email?: unknown;
  email_to?: unknown;
}

export async function issueInvoice(access: ShopAccess, jobId: string, input: IssueInvoiceInput): Promise<{ invoice: Invoice; emailed: boolean; url: string }> {
  const detail = await requireJob(access, jobId);
  const { db, siteId } = access;
  const { job, estimates, vehicle, settings } = detail;
  const kind = input.kind === 'estimate_fee' ? 'estimate_fee' : 'repair';
  if (detail.invoice) throw new ShopRuleError('This job already has an invoice. Void it before issuing a new one.', undefined, 409);
  const approved = estimates.find(e => e.status === 'approved') ?? null;
  const problems: string[] = [];
  const odometerOut = int(input.odometer_out) ?? job.odometer_out;

  if (kind === 'repair') {
    if (!approved) throw new ShopRuleError('Nothing was approved on this job, so there’s nothing to bill. (If they declined, you can invoice the agreed estimate fee.)', undefined, 409);
    const revision = estimates.find(e => e.is_revision && (e.status === 'draft' || e.status === 'sent'));
    if (revision) {
      throw new ShopRuleError(`Revised estimate v${revision.version} (extra work) isn’t approved. Get it approved, or delete it so the extra work stays off the bill.`, undefined, 409);
    }
    if (job.stage !== 'done') problems.push('Mark the repair done first');
    if (odometerOut == null) problems.push('Odometer reading when the car is returned');
    else if (job.odometer_in != null && odometerOut < job.odometer_in) problems.push('Odometer out is lower than odometer in');
    if (!vehicle.vin) problems.push('VIN');
    if (!vehicle.plate) problems.push('Licence plate');
    if (job.odometer_in == null) problems.push('Odometer reading when the car came in');
  } else {
    if (!estimateFeeChargeable(job, !!approved)) {
      throw new ShopRuleError(approved
        ? 'The estimate fee can’t be charged: the customer approved the repair (CPA s. 57).'
        : 'The estimate fee can only be charged if the customer agreed to it before the estimate.', undefined, 409);
    }
  }
  if (problems.length) throw new ShopRuleError('Before issuing the invoice, add:', problems);

  const site = await loadSiteInfo(db, siteId, settings);
  const today = todayISO();
  const returnedOn = isIsoDate(input.returned_on) ? input.returned_on : null;
  const preview = buildInvoiceSnapshot({
    job, customer: detail.customer, vehicle, estimates, authorizations: detail.authorizations, settings, site,
    number: 0, issuedOn: today, odometerOut, returnedOn, kind,
  });
  if (kind === 'repair' && preview.snapshot.estimate) {
    const cap = capCheck(preview.snapshot.estimate.total_cents, preview.totals.total_cents);
    if (!cap.ok) {
      throw new ShopRuleError(
        `This bill is ${cap.overPct.toFixed(1)}% over the approved estimate (${formatCents(preview.totals.total_cents)} vs ${formatCents(preview.snapshot.estimate.total_cents)}). Ontario caps it at 10% (${formatCents(cap.limitCents)}). Lower it, or get a revised estimate approved for the extra.`,
        undefined, 409,
      );
    }
  }
  if (preview.totals.total_cents <= 0) throw new ShopRuleError('The invoice total is zero. Close the job with no charge instead.', undefined, 409);

  const { data: number, error: numErr } = await db.rpc('shop_next_number', { p_site_id: siteId, p_kind: 'invoice' });
  fail(numErr, 'Get invoice number');
  const { snapshot, totals, estimateId } = buildInvoiceSnapshot({
    job: { ...job, completed_at: job.completed_at ?? (kind === 'repair' ? nowIso() : null) },
    customer: detail.customer, vehicle, estimates, authorizations: detail.authorizations, settings, site,
    number: number as number, issuedOn: today, odometerOut, returnedOn, kind,
  });
  const token = newPublicToken();
  const { data: inv, error } = await db.from('shop_invoices').insert({
    site_id: siteId,
    job_id: jobId,
    invoice_number: number as number,
    status: 'issued',
    estimate_id: kind === 'repair' ? estimateId : null,
    subtotal_cents: totals.subtotal_cents,
    tax_cents: totals.tax_cents,
    total_cents: totals.total_cents,
    snapshot,
    public_token: token,
  }).select('*').single();
  fail(error, 'Issue invoice');
  const invoice = inv as Invoice;

  const jobPatch: Record<string, unknown> = { stage: 'done', bay: null };
  if (odometerOut != null) jobPatch.odometer_out = odometerOut;
  if (kind === 'repair' && !job.completed_at) jobPatch.completed_at = nowIso();
  if (returnedOn) jobPatch.returned_at = new Date(`${returnedOn}T12:00:00Z`).toISOString();
  await db.from('shop_jobs').update(jobPatch).eq('site_id', siteId).eq('id', jobId);
  if (odometerOut != null) await db.from('shop_vehicles').update({ last_odometer: odometerOut }).eq('site_id', siteId).eq('id', vehicle.id);
  await addEvent(db, siteId, jobId, 'invoice', {
    actor: access.actor,
    body: `${invoiceLabel(invoice.invoice_number)} issued${kind === 'estimate_fee' ? ' for the estimate fee' : ''}: ${formatCents(invoice.total_cents)}.`,
    meta: { invoice_id: invoice.id },
  });

  const url = docUrl(site, token);
  let emailed = false;
  if (input.send_email === true) {
    await sendInvoice(access, invoice.id, { to: input.email_to });
    emailed = true;
  }
  return { invoice, emailed, url };
}

export async function invoicePdfFor(access: ShopAccess, invoiceId: string): Promise<{ buffer: Buffer; filename: string }> {
  if (!isUuid(invoiceId)) throw new ShopRuleError('Invoice not found.', undefined, 404);
  const { data } = await access.db.from('shop_invoices').select('*').eq('site_id', access.siteId).eq('id', invoiceId).maybeSingle();
  if (!data) throw new ShopRuleError('Invoice not found.', undefined, 404);
  const inv = data as Invoice;
  const paid = (await paidByInvoice(access.db, access.siteId, [inv.id])).get(inv.id) ?? 0;
  const buffer = await invoicePdf(inv.snapshot, { paid_cents: paid, void_reason: inv.status === 'void' ? inv.void_reason || 'Void' : null });
  return { buffer, filename: `${invoiceLabel(inv.invoice_number)}.pdf` };
}

export async function sendInvoice(access: ShopAccess, invoiceId: string, input: { to?: unknown; message?: unknown } = {}) {
  const detail = await requireJob(access, await jobIdForInvoice(access, invoiceId));
  const inv = detail.invoice?.id === invoiceId ? detail.invoice : null;
  if (!inv) throw new ShopRuleError('Only the current invoice can be sent.', undefined, 409);
  const to = str(input.to, 200)?.toLowerCase() || detail.customer.email;
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new ShopRuleError('Add the customer’s email address to send it.', undefined, 400);
  const site = await loadSiteInfo(access.db, access.siteId, detail.settings);
  const paid = detail.payments.filter(p => p.invoice_id === inv.id).reduce((s, p) => s + p.amount_cents, 0);
  const balance = inv.total_cents - paid;
  const token = inv.public_token || newPublicToken();
  if (!inv.public_token) await access.db.from('shop_invoices').update({ public_token: token }).eq('site_id', access.siteId).eq('id', inv.id);
  const url = docUrl(site, token);
  const pdf = await invoicePdf(inv.snapshot, { paid_cents: paid });
  const canPayOnline = site.stripe || site.paypal;
  const first = detail.customer.name.split(' ')[0];
  const car = vehicleLabel(detail.vehicle);
  const result = await sendShopEmail(access.db, access.siteId, {
    to,
    subject: `Invoice ${invoiceLabel(inv.invoice_number)} for your ${car}`,
    heading: balance > 0 ? `Invoice ${invoiceLabel(inv.invoice_number)}` : 'Your receipt',
    paragraphs: [
      `Hi ${first},`,
      str(input.message, 2000) || (balance > 0
        ? `Your ${car} is ready. The invoice is attached${canPayOnline ? ', and you can pay it online' : ''}.`
        : `Thanks for your payment. Your paid invoice for the ${car} is attached.`),
      balance > 0 ? `Amount due: ${formatCents(balance)}.` : `Paid in full: ${formatCents(inv.total_cents)}.`,
      ...(balance > 0 && detail.settings.etransfer_email ? [`You can also e-transfer ${detail.settings.etransfer_email} with ${invoiceLabel(inv.invoice_number)} in the message.`] : []),
    ],
    button: { label: balance > 0 && canPayOnline ? 'View and pay' : 'View invoice', url },
    attachments: [{ filename: `${invoiceLabel(inv.invoice_number)}.pdf`, content: pdf }],
    shopName: inv.snapshot.shop.name,
    logoUrl: site.logo_url,
  });
  if (!result.ok) throw new ShopRuleError(result.error || 'The email didn’t send.', undefined, 502);
  if (!detail.customer.email) await access.db.from('shop_customers').update({ email: to }).eq('site_id', access.siteId).eq('id', detail.customer.id);
  await addEvent(access.db, access.siteId, detail.job.id, 'email', { actor: access.actor, body: `${invoiceLabel(inv.invoice_number)} emailed to ${to}.` });
  return { ok: true, url };
}

export async function voidInvoice(access: ShopAccess, invoiceId: string, reason: unknown) {
  const detail = await requireJob(access, await jobIdForInvoice(access, invoiceId));
  const inv = detail.invoice?.id === invoiceId ? detail.invoice : null;
  if (!inv) throw new ShopRuleError('That invoice is already void.', undefined, 409);
  if (detail.payments.some(p => p.invoice_id === inv.id)) throw new ShopRuleError('Payments are recorded against this invoice, so it can’t be voided.', undefined, 409);
  if (detail.lien && detail.lien.invoice_id === inv.id && detail.lien.status !== 'cancelled') throw new ShopRuleError('A lien is tied to this invoice.', undefined, 409);
  const why = str(reason, 300);
  if (!why) throw new ShopRuleError('Say why it’s being voided (kept on file).', undefined, 400);
  const { error } = await access.db.from('shop_invoices').update({ status: 'void', voided_at: nowIso(), void_reason: why }).eq('site_id', access.siteId).eq('id', inv.id);
  fail(error, 'Void invoice');
  await access.db.from('shop_jobs').update({ holding_since: null }).eq('site_id', access.siteId).eq('id', detail.job.id);
  await addEvent(access.db, access.siteId, detail.job.id, 'invoice', { actor: access.actor, body: `${invoiceLabel(inv.invoice_number)} voided: ${why}` });
  return { ok: true };
}

export interface PaymentInput {
  amount_cents?: unknown;
  method?: unknown;
  reference?: unknown;
  received_at?: unknown;
  notes?: unknown;
  provider_ref?: unknown;
}

export async function recordPayment(access: ShopAccess, invoiceId: string, input: PaymentInput): Promise<{ ok: true; balance_cents: number; duplicate?: boolean }> {
  const detail = await requireJob(access, await jobIdForInvoice(access, invoiceId));
  const { db, siteId } = access;
  const inv = detail.invoice?.id === invoiceId ? detail.invoice : null;
  if (!inv) throw new ShopRuleError('That invoice is void.', undefined, 409);
  const providerRef = str(input.provider_ref, 200);
  if (providerRef) {
    const { data: dup } = await db.from('shop_payments').select('id').eq('site_id', siteId).eq('provider_ref', providerRef).maybeSingle();
    if (dup) {
      const paidNow = (await paidByInvoice(db, siteId, [inv.id])).get(inv.id) ?? 0;
      return { ok: true, balance_cents: inv.total_cents - paidNow, duplicate: true };
    }
  }
  const amount = int(input.amount_cents);
  if (!amount || amount <= 0) throw new ShopRuleError('Enter the amount received.', undefined, 400);
  const method = input.method as PaymentMethod;
  if (!PAYMENT_METHODS.includes(method)) throw new ShopRuleError('How did they pay?', undefined, 400);
  const paid = detail.payments.filter(p => p.invoice_id === inv.id).reduce((s, p) => s + p.amount_cents, 0);
  const balance = inv.total_cents - paid;
  // Online payments are already captured, so they're always recorded (an overpayment gets refunded).
  if (balance <= 0 && !providerRef) throw new ShopRuleError('This invoice is already paid.', undefined, 409);
  if (amount > balance && !providerRef) throw new ShopRuleError(`That’s more than the ${formatCents(balance)} owing.`, undefined, 400);
  let receivedAt = nowIso();
  if (input.received_at) {
    const d = new Date(String(input.received_at));
    if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 5 * 60_000) throw new ShopRuleError('Check the payment date.', undefined, 400);
    receivedAt = d.toISOString();
  }
  const lien = detail.lien && detail.lien.invoice_id === inv.id && detail.lien.status === 'active' ? detail.lien : null;
  const { error } = await db.from('shop_payments').insert({
    site_id: siteId,
    invoice_id: inv.id,
    job_id: detail.job.id,
    lien_id: lien?.id ?? null,
    amount_cents: amount,
    method,
    reference: str(input.reference, 120),
    provider_ref: providerRef,
    received_at: receivedAt,
    recorded_by: access.actor,
    notes: str(input.notes, 500),
  });
  if (error?.code === '23505' && providerRef) return { ok: true, balance_cents: Math.max(0, balance - amount), duplicate: true };
  fail(error, 'Record payment');
  const left = balance - amount;
  const methodName = { cash: 'Cash', debit: 'Debit', credit: 'Credit card', etransfer: 'E-transfer', cheque: 'Cheque', stripe: 'Card (online)', paypal: 'PayPal', other: 'Payment' }[method];
  await addEvent(db, siteId, detail.job.id, 'payment', {
    actor: access.actor,
    body: `${methodName} ${formatCents(amount)} received${lien ? ' on the payment plan' : ''}. ${left > 0 ? `${formatCents(left)} left.` : left < 0 ? `Overpaid by ${formatCents(-left)}. Refund the difference.` : 'Paid in full.'}`,
    meta: { invoice_id: inv.id },
  });

  if (left <= 0 && balance > 0) {
    if (detail.job.status === 'open') {
      await db.from('shop_jobs').update({
        status: 'closed', closed_reason: 'paid', closed_at: nowIso(), holding_since: null, bay: null,
        returned_at: detail.job.returned_at ?? nowIso(),
      }).eq('site_id', siteId).eq('id', detail.job.id);
    }
    if (lien) {
      const today = todayISO();
      const due = lien.ppsr_registration_number ? dischargeDueOn(today) : null;
      await db.from('shop_liens').update({ status: 'paid', paid_off_at: nowIso(), discharge_due_on: due }).eq('site_id', siteId).eq('id', lien.id);
      await addEvent(db, siteId, detail.job.id, 'lien', {
        actor: access.actor,
        body: due
          ? `Payment plan paid off. Register the discharge of the lien in the PPSR by ${formatDate(due)} (RSLA s. 12(4)). It’s free.`
          : 'Payment plan paid off. The lien was never registered, so there’s nothing to discharge.',
      });
    }
  }
  return { ok: true, balance_cents: Math.max(0, left) };
}

export async function deletePayment(access: ShopAccess, paymentId: string) {
  if (!isUuid(paymentId)) throw new ShopRuleError('Payment not found.', undefined, 404);
  const { data: p } = await access.db.from('shop_payments').select('*').eq('site_id', access.siteId).eq('id', paymentId).maybeSingle();
  if (!p) throw new ShopRuleError('Payment not found.', undefined, 404);
  if (p.provider_ref) throw new ShopRuleError('Online payments can’t be deleted here. Refund them in Stripe or PayPal.', undefined, 409);
  if (Date.now() - Date.parse(p.created_at) > 7 * 86400_000) throw new ShopRuleError('Payments older than a week stay on the books. Record a correction instead.', undefined, 409);
  const { error } = await access.db.from('shop_payments').delete().eq('site_id', access.siteId).eq('id', paymentId);
  fail(error, 'Delete payment');
  const { data: job } = await access.db.from('shop_jobs').select('status, closed_reason').eq('site_id', access.siteId).eq('id', p.job_id).single();
  if (job?.status === 'closed' && job.closed_reason === 'paid') {
    await access.db.from('shop_jobs').update({ status: 'open', closed_reason: null, closed_at: null }).eq('site_id', access.siteId).eq('id', p.job_id);
  }
  if (p.lien_id) await access.db.from('shop_liens').update({ status: 'active', paid_off_at: null, discharge_due_on: null }).eq('site_id', access.siteId).eq('id', p.lien_id).eq('status', 'paid');
  await addEvent(access.db, access.siteId, p.job_id, 'payment', { actor: access.actor, body: `Payment of ${formatCents(p.amount_cents)} deleted (entered by mistake).` });
  return { ok: true };
}
