/**
 * Repair liens under Ontario's Repair and Storage Liens Act:
 *   - hold the car until the approved bill is paid (possessory lien, s. 3)
 *   - or release it on a payment plan with a signed acknowledgment of the
 *     debt (non-possessory lien, s. 7), then register it in the PPSR (s. 10)
 *     and discharge it within 30 days of payment in full (s. 12(4))
 * No lien exists unless the estimate, fee and approval rules were followed
 * (s. 3(2)); lienCheck enforces that before either path.
 */

import type { NextRequest } from 'next/server';
import { ShopRuleError, type ShopAccess } from '../access';
import { addEvent, loadSiteInfo } from '../data';
import { formatCents } from '../money';
import { buildSchedule, dischargeDueOn, lienCheck, ppsrExpiresOn } from '../rules';
import { formatDate, todayISO } from '../dates';
import { buildAcknowledgmentDoc, shopIdentity } from '../documents';
import { acknowledgmentPdf } from '../pdf';
import { sendShopEmail } from '../mail';
import { downloadShopFile, storeSignature } from '../files';
import { invoiceLabel, vehicleLabel } from '../board';
import type { Lien, PaymentMethod } from '../types';
import { fail, int, isIsoDate, isUuid, nowIso, requireJob, str } from './common';
import { recordPayment } from './invoices';

function balanceOf(detail: Awaited<ReturnType<typeof requireJob>>) {
  const inv = detail.invoice;
  if (!inv) return { inv: null, paid: 0, balance: 0 };
  const paid = detail.payments.filter(p => p.invoice_id === inv.id).reduce((s, p) => s + p.amount_cents, 0);
  return { inv, paid, balance: inv.total_cents - paid };
}

/** Keep (or stop keeping) the car until the bill is paid. */
export async function setHold(access: ShopAccess, jobId: string, hold: boolean) {
  const detail = await requireJob(access, jobId);
  const { db, siteId } = access;
  if (!hold) {
    if (!detail.job.holding_since) return { ok: true };
    await db.from('shop_jobs').update({ holding_since: null }).eq('site_id', siteId).eq('id', jobId);
    await addEvent(db, siteId, jobId, 'lien', { actor: access.actor, body: 'Stopped holding the car for payment.' });
    return { ok: true };
  }
  const { inv, balance } = balanceOf(detail);
  if (!inv || balance <= 0) throw new ShopRuleError('There’s no unpaid invoice on this car to hold it for.', undefined, 409);
  if (inv.snapshot.kind !== 'repair') throw new ShopRuleError('A car can’t be held for an estimate fee alone. The repair lien covers repair work.', undefined, 409);
  const check = lienCheck(detail);
  if (!check.valid) throw new ShopRuleError('You don’t have a repair lien on this car, so you can’t hold it for payment:', check.reasons);
  if (detail.job.returned_at) throw new ShopRuleError('The car was already handed back.', undefined, 409);
  const { error } = await db.from('shop_jobs').update({ holding_since: nowIso() }).eq('site_id', siteId).eq('id', jobId);
  fail(error, 'Hold car');
  await addEvent(db, siteId, jobId, 'lien', {
    actor: access.actor,
    body: `Holding the car until ${formatCents(balance)} is paid (repair lien, RSLA s. 3). Only this invoice counts; older balances can’t be added (s. 26).`,
  });
  return { ok: true };
}

export interface ReleaseInput {
  down_payment_cents?: unknown;
  down_payment_method?: unknown;
  plan_kind?: unknown;
  frequency?: unknown;
  instalment_cents?: unknown;
  first_due?: unknown;
  signer_name?: unknown;
  signer_capacity?: unknown;
  signature?: unknown;
  credit_disclosure_given?: unknown;
  debtor_legal_name?: unknown;
  debtor_dob?: unknown;
  debtor_address?: unknown;
  ppsr_registration_number?: unknown;
  ppsr_years?: unknown;
  notes?: unknown;
  send_email?: unknown;
}

/** Release the car before it's paid, keeping the lien with a signed acknowledgment and a payment plan. */
export async function releaseOnCredit(access: ShopAccess, jobId: string, input: ReleaseInput, request: NextRequest | null): Promise<{ lien: Lien; emailed: boolean }> {
  const detail = await requireJob(access, jobId);
  const { db, siteId } = access;
  const { inv, balance } = balanceOf(detail);
  if (!inv || balance <= 0) throw new ShopRuleError('Issue the invoice first. The plan covers what’s owing on it.', undefined, 409);
  if (inv.snapshot.kind !== 'repair') throw new ShopRuleError('Liens cover repair work, not an estimate fee alone.', undefined, 409);
  if (detail.lien && ['active', 'paid'].includes(detail.lien.status)) throw new ShopRuleError('This car already has a payment plan.', undefined, 409);
  const check = lienCheck(detail);
  if (!check.valid) throw new ShopRuleError('There’s no valid repair lien to keep on this car:', check.reasons);

  const down = Math.max(0, int(input.down_payment_cents) ?? 0);
  if (down >= balance) throw new ShopRuleError('The down payment covers the whole bill. Record it as a payment instead.', undefined, 400);
  const owing = balance - down;
  const planKind = input.plan_kind === 'instalments' ? 'instalments' : 'single';
  const frequency = planKind === 'instalments' ? (['weekly', 'biweekly', 'monthly'].includes(String(input.frequency)) ? input.frequency as Lien['frequency'] : 'biweekly') : null;
  const today = todayISO();
  const firstDue = isIsoDate(input.first_due) ? input.first_due : null;
  if (!firstDue || firstDue < today) throw new ShopRuleError('Pick the first payment date (today or later).', undefined, 400);
  const instalment = planKind === 'instalments' ? int(input.instalment_cents) : null;
  if (planKind === 'instalments' && (!instalment || instalment < 100)) throw new ShopRuleError('Enter the payment amount for each instalment.', undefined, 400);
  if (planKind === 'instalments' && instalment! >= owing) throw new ShopRuleError('One instalment covers it all. Choose a single payment instead.', undefined, 400);
  const schedule = buildSchedule({ owingCents: owing, planKind, frequency, instalmentCents: instalment, firstDue });
  if (!schedule.length) throw new ShopRuleError('The payment schedule is empty.', undefined, 400);
  if (schedule.length > 104) throw new ShopRuleError('That plan runs too long. Raise the payment amount.', undefined, 400);
  const lastDue = schedule[schedule.length - 1].due;
  if (lastDue > ppsrExpiresOn(today, 3)) throw new ShopRuleError('Keep the plan within 3 years, the longest a lien registration lasts.', undefined, 400);

  const signerName = str(input.signer_name, 120);
  if (!signerName) throw new ShopRuleError('Who is signing the acknowledgment?', undefined, 400);
  const capacity = input.signer_capacity === 'authorized_agent' ? 'authorized_agent' : 'owner';
  const signature = typeof input.signature === 'string' ? input.signature : '';
  if (!signature.startsWith('data:image/')) throw new ShopRuleError('The customer has to sign the acknowledgment (RSLA s. 7).', undefined, 400);
  if (planKind === 'instalments' && input.credit_disclosure_given !== true) {
    throw new ShopRuleError('Give the customer the credit disclosure statement (it prints with the acknowledgment) and confirm you did.', undefined, 400);
  }
  const dob = isIsoDate(input.debtor_dob) ? input.debtor_dob : null;
  const signaturePath = await storeSignature(access, request, signature);

  if (down > 0) {
    const method = (['cash', 'debit', 'credit', 'etransfer', 'cheque', 'other'].includes(String(input.down_payment_method)) ? input.down_payment_method : 'debit') as PaymentMethod;
    await recordPayment(access, inv.id, { amount_cents: down, method, notes: 'Down payment at release' });
  }

  const regNumber = str(input.ppsr_registration_number, 60);
  const years = Math.min(3, Math.max(1, int(input.ppsr_years) ?? 3));
  const signedAt = nowIso();
  const { data: lien, error } = await db.from('shop_liens').insert({
    site_id: siteId,
    job_id: jobId,
    invoice_id: inv.id,
    status: 'active',
    released_at: signedAt,
    amount_owing_cents: owing,
    down_payment_cents: down,
    plan_kind: planKind,
    frequency,
    instalment_cents: instalment,
    schedule,
    ack_signer_name: signerName,
    ack_signer_capacity: capacity,
    ack_signature_path: signaturePath,
    ack_signed_at: signedAt,
    credit_disclosure_given: planKind === 'instalments',
    debtor_legal_name: str(input.debtor_legal_name, 120) || detail.customer.name,
    debtor_dob: dob,
    debtor_address: str(input.debtor_address, 300) || detail.customer.address,
    ppsr_registration_number: regNumber,
    ppsr_registered_at: regNumber ? signedAt : null,
    ppsr_years: regNumber ? years : null,
    ppsr_expires_on: regNumber ? ppsrExpiresOn(today, years) : null,
    notes: str(input.notes, 1000),
  }).select('*').single();
  fail(error, 'Save payment plan');

  await db.from('shop_jobs').update({
    status: 'closed', closed_reason: 'released_on_plan', closed_at: signedAt, returned_at: signedAt, holding_since: null, bay: null,
  }).eq('site_id', siteId).eq('id', jobId);
  await addEvent(db, siteId, jobId, 'lien', {
    actor: access.actor,
    body: `Released on a ${planKind === 'single' ? `single payment of ${formatCents(owing)} due ${formatDate(firstDue)}` : `plan: ${schedule.length} payments of about ${formatCents(instalment!)} (${frequency}) from ${formatDate(firstDue)}`}. ${signerName} signed the acknowledgment of ${formatCents(owing)} owing (RSLA s. 7).${regNumber ? ` PPSR registration ${regNumber}.` : ' Register the claim for lien in the PPSR today.'}`,
  });

  let emailed = false;
  if (input.send_email === true && detail.customer.email) {
    const { buffer, filename } = await acknowledgmentPdfFor(access, (lien as Lien).id);
    const site = await loadSiteInfo(db, siteId, detail.settings);
    const res = await sendShopEmail(db, siteId, {
      to: detail.customer.email,
      subject: `Your payment agreement for the ${vehicleLabel(detail.vehicle)}`,
      heading: 'Your payment agreement',
      paragraphs: [
        `Hi ${detail.customer.name.split(' ')[0]},`,
        `Attached is the signed acknowledgment and payment schedule for ${formatCents(owing)} owing on ${invoiceLabel(inv.invoice_number)}.`,
        planKind === 'instalments' ? 'The credit disclosure statement is included. There’s no interest, and you can pay it off early at any time.' : `The balance is due ${formatDate(firstDue)}. There’s no interest.`,
      ],
      attachments: [{ filename, content: buffer }],
      shopName: shopIdentity(detail.settings, site).name,
      logoUrl: site.logo_url,
    });
    emailed = res.ok;
  }
  return { lien: lien as Lien, emailed };
}

export async function requireLien(access: ShopAccess, lienId: string): Promise<Lien> {
  if (!isUuid(lienId)) throw new ShopRuleError('Lien not found.', undefined, 404);
  const { data } = await access.db.from('shop_liens').select('*').eq('site_id', access.siteId).eq('id', lienId).maybeSingle();
  if (!data) throw new ShopRuleError('Lien not found.', undefined, 404);
  return data as Lien;
}

export interface LienUpdateInput {
  action?: unknown;
  registration_number?: unknown;
  registered_on?: unknown;
  years?: unknown;
  reference?: unknown;
  debtor_legal_name?: unknown;
  debtor_dob?: unknown;
  debtor_address?: unknown;
  notes?: unknown;
}

export async function updateLien(access: ShopAccess, lienId: string, input: LienUpdateInput) {
  const lien = await requireLien(access, lienId);
  const { db, siteId } = access;
  const today = todayISO();
  switch (input.action) {
    case 'register_ppsr': {
      const number = str(input.registration_number, 60);
      if (!number) throw new ShopRuleError('Enter the PPSR registration number.', undefined, 400);
      if (lien.status === 'cancelled' || lien.status === 'discharged') throw new ShopRuleError(`This lien is ${lien.status}.`, undefined, 409);
      const on = isIsoDate(input.registered_on) && input.registered_on <= today ? input.registered_on : today;
      const years = Math.min(3, Math.max(1, int(input.years) ?? 3));
      const { error } = await db.from('shop_liens').update({
        ppsr_registration_number: number,
        ppsr_registered_at: new Date(`${on}T12:00:00Z`).toISOString(),
        ppsr_years: years,
        ppsr_expires_on: ppsrExpiresOn(on, years),
        discharge_due_on: lien.status === 'paid' ? dischargeDueOn(lien.paid_off_at?.slice(0, 10) || today) : lien.discharge_due_on,
      }).eq('site_id', siteId).eq('id', lienId);
      fail(error, 'Save registration');
      await addEvent(db, siteId, lien.job_id, 'lien', { actor: access.actor, body: `Claim for lien registered in the PPSR: ${number}, ${years} year${years === 1 ? '' : 's'} (expires ${formatDate(ppsrExpiresOn(on, years))}).` });
      return { ok: true };
    }
    case 'register_discharge': {
      if (lien.status !== 'paid') throw new ShopRuleError(lien.status === 'active' ? 'The customer still owes on this plan. Discharge the lien after it’s paid in full.' : `This lien is ${lien.status}.`, undefined, 409);
      if (!lien.ppsr_registration_number) throw new ShopRuleError('This lien was never registered, so there’s nothing to discharge.', undefined, 409);
      const ref = str(input.reference, 60);
      const on = isIsoDate(input.registered_on) && input.registered_on <= today ? input.registered_on : today;
      const { error } = await db.from('shop_liens').update({
        status: 'discharged', discharge_registered_at: new Date(`${on}T12:00:00Z`).toISOString(), discharge_reference: ref,
      }).eq('site_id', siteId).eq('id', lienId);
      fail(error, 'Save discharge');
      await addEvent(db, siteId, lien.job_id, 'lien', { actor: access.actor, body: `Discharge registered in the PPSR${ref ? ` (${ref})` : ''}. The lien is off the car.` });
      return { ok: true };
    }
    case 'update_debtor': {
      const patch: Record<string, unknown> = {};
      if (input.debtor_legal_name !== undefined) patch.debtor_legal_name = str(input.debtor_legal_name, 120);
      if (input.debtor_dob !== undefined) patch.debtor_dob = isIsoDate(input.debtor_dob) ? input.debtor_dob : null;
      if (input.debtor_address !== undefined) patch.debtor_address = str(input.debtor_address, 300);
      if (input.notes !== undefined) patch.notes = str(input.notes, 1000);
      const { error } = await db.from('shop_liens').update(patch).eq('site_id', siteId).eq('id', lienId);
      fail(error, 'Save lien');
      return { ok: true };
    }
    case 'cancel': {
      if (lien.ppsr_registration_number) throw new ShopRuleError('This lien is registered. Register a discharge instead of cancelling.', undefined, 409);
      const { count } = await db.from('shop_payments').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('lien_id', lienId);
      if ((count ?? 0) > 0) throw new ShopRuleError('Payments were made on this plan, so it stays on file.', undefined, 409);
      const { error } = await db.from('shop_liens').update({ status: 'cancelled' }).eq('site_id', siteId).eq('id', lienId);
      fail(error, 'Cancel lien');
      await addEvent(db, siteId, lien.job_id, 'lien', { actor: access.actor, body: `Payment plan cancelled${input.notes ? `: ${str(input.notes, 300)}` : ''}. The balance is still owed on the invoice.` });
      return { ok: true };
    }
    default:
      throw new ShopRuleError('Unknown lien action.', undefined, 400);
  }
}

export async function acknowledgmentDocFor(access: ShopAccess, lien: Lien) {
  const detail = await requireJob(access, lien.job_id);
  const { data: inv } = await access.db.from('shop_invoices').select('*').eq('site_id', access.siteId).eq('id', lien.invoice_id).single();
  const site = await loadSiteInfo(access.db, access.siteId, detail.settings);
  return {
    detail,
    doc: buildAcknowledgmentDoc({
      shop: shopIdentity(detail.settings, site),
      customer: detail.customer,
      vehicle: detail.vehicle,
      invoice: { label: invoiceLabel(inv!.invoice_number), issued_on: String(inv!.issued_at).slice(0, 10), total_cents: inv!.total_cents },
      owingCents: lien.amount_owing_cents,
      downPaymentCents: lien.down_payment_cents,
      planKind: lien.plan_kind,
      frequency: lien.frequency,
      schedule: lien.schedule,
      signerName: lien.ack_signer_name,
      signerCapacity: lien.ack_signer_capacity,
      releasedOn: lien.released_at.slice(0, 10),
      signedAt: lien.ack_signed_at,
    }),
  };
}

export async function acknowledgmentPdfFor(access: ShopAccess, lienId: string): Promise<{ buffer: Buffer; filename: string }> {
  const lien = await requireLien(access, lienId);
  const { doc } = await acknowledgmentDocFor(access, lien);
  const signature = lien.ack_signature_path ? await downloadShopFile(access, lien.ack_signature_path) : null;
  return { buffer: await acknowledgmentPdf(doc, signature), filename: `Acknowledgment-${doc.invoice_label}.pdf` };
}

/** Everything the PPSR registration screen asks for, in one place. */
export async function ppsrSheet(access: ShopAccess, lienId: string) {
  const lien = await requireLien(access, lienId);
  const detail = await requireJob(access, lien.job_id);
  const v = detail.vehicle;
  const missing: string[] = [];
  if (!lien.debtor_legal_name) missing.push('Debtor’s full legal name');
  if (!lien.debtor_dob) missing.push('Debtor’s date of birth');
  if (!lien.debtor_address) missing.push('Debtor’s address');
  if (!v.vin) missing.push('VIN');
  if (!v.year || !v.make || !v.model) missing.push('Year, make and model');
  return {
    form: 'Claim for lien under the Repair and Storage Liens Act (ServiceOntario PPSR)',
    collateral: 'Motor vehicle',
    debtor: { name: lien.debtor_legal_name, dob: lien.debtor_dob, address: lien.debtor_address },
    vehicle: { vin: v.vin, year: v.year, make: v.make, model: v.model },
    amount_cents: lien.amount_owing_cents,
    lien_date: lien.released_at.slice(0, 10),
    missing,
  };
}
