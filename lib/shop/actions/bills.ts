/**
 * The parts pile: supplier invoices snapped by the tech or the desk, read by
 * AI, matched to the car they're for (or shop stock), and tracked against the
 * supplier's monthly statement.
 */

import type { NextRequest } from 'next/server';
import { ShopRuleError, type ShopAccess } from '../access';
import { addEvent, loadBills, loadEstimatesForJobs } from '../data';
import { aiConfigured, readSupplierInvoice, type OpenJobContext } from '../ai';
import { DOC_TYPES, SHOP_BUCKET, baseMime, downloadShopFile, storeShopFile } from '../files';
import { formatCents } from '../money';
import { vehicleLabel } from '../board';
import type { Supplier, SupplierBill } from '../types';
import { fail, int, isIsoDate, isUuid, nowIso, num, str } from './common';

const normName = (s: string | null | undefined) =>
  (s || '').toLowerCase().replace(/\b(inc|ltd|limited|corp|corporation|co|company|the)\b/g, '').replace(/[^a-z0-9]/g, '');

export function matchSupplier(name: string | null | undefined, suppliers: Supplier[]): Supplier | null {
  const n = normName(name);
  if (n.length < 3) return null;
  return suppliers.find(s => normName(s.name) === n)
    || suppliers.find(s => { const m = normName(s.name); return m.length >= 3 && (n.includes(m) || m.includes(n)); })
    || null;
}

async function openJobContext(access: ShopAccess): Promise<(OpenJobContext & { id: string })[]> {
  const { data } = await access.db
    .from('shop_jobs')
    .select('id, ro_number, customer:shop_customers(name), vehicle:shop_vehicles(year, make, model)')
    .eq('site_id', access.siteId)
    .eq('status', 'open')
    .limit(60);
  const jobs = (data || []) as unknown as { id: string; ro_number: number; customer: { name: string } | null; vehicle: { year: number | null; make: string | null; model: string | null } | null }[];
  const estimates = await loadEstimatesForJobs(access.db, access.siteId, jobs.map(j => j.id));
  return jobs.map(j => {
    const list = estimates.get(j.id) || [];
    const est = list.find(e => e.status === 'approved') ?? list[list.length - 1];
    return {
      id: j.id,
      ro_number: j.ro_number,
      customer: j.customer?.name || 'Customer',
      vehicle: j.vehicle ? vehicleLabel(j.vehicle) : 'Vehicle',
      parts: (est?.lines || []).filter(l => l.kind === 'part' && l.decision === 'include').map(l => [l.description, l.part_number].filter(Boolean).join(' #')).slice(0, 12),
    };
  });
}

async function suppliersOf(access: ShopAccess): Promise<Supplier[]> {
  const { data } = await access.db.from('shop_suppliers').select('*').eq('site_id', access.siteId).is('archived_at', null);
  return (data || []) as Supplier[];
}

/** Run the AI reader on a stored bill and fill in what it finds. Never throws for AI problems. */
async function readIntoBill(access: ShopAccess, billId: string, buffer: Buffer, mime: string, hintJobId: string | null) {
  const { db, siteId } = access;
  if (!aiConfigured()) {
    await db.from('shop_supplier_bills').update({ ai_error: 'AI reading isn’t set up on this server. Enter the lines by hand.' }).eq('site_id', siteId).eq('id', billId);
    return;
  }
  const [suppliers, jobs] = await Promise.all([suppliersOf(access), openJobContext(access)]);
  try {
    const read = await readSupplierInvoice({ buffer, mime, suppliers: suppliers.map(s => s.name), openJobs: jobs });
    const supplier = matchSupplier(read.supplier_name, suppliers);
    let aiError: string | null = null;
    let invoiceNumber: string | null = read.invoice_number || null;
    if (supplier && invoiceNumber) {
      const { data: dup } = await db.from('shop_supplier_bills').select('id, created_at').eq('site_id', siteId).eq('supplier_id', supplier.id).eq('invoice_number', invoiceNumber).neq('id', billId).maybeSingle();
      if (dup) {
        aiError = `Looks like a duplicate: ${supplier.name} invoice ${invoiceNumber} is already on file. Delete this one if it’s the same paper.`;
        invoiceNumber = null;
      }
    }
    const suggested = hintJobId || jobs.find(j => j.ro_number === read.suggested_job_ro)?.id || null;
    const { error } = await db.from('shop_supplier_bills').update({
      supplier_id: supplier?.id ?? null,
      supplier_name_raw: read.supplier_name || null,
      invoice_number: invoiceNumber,
      invoice_date: read.invoice_date || null,
      subtotal_cents: read.subtotal_cents || null,
      tax_cents: read.tax_cents || null,
      total_cents: read.total_cents || null,
      handwritten_note: read.handwritten_note || null,
      suggested_job_id: suggested,
      suggestion_reason: hintJobId ? 'Snapped from this car’s page.' : read.suggestion_reason || null,
      ai_error: aiError,
    }).eq('site_id', siteId).eq('id', billId);
    fail(error, 'Save invoice reading');
    if (read.lines.length) {
      await db.from('shop_supplier_bill_lines').delete().eq('site_id', siteId).eq('bill_id', billId);
      const { error: lineErr } = await db.from('shop_supplier_bill_lines').insert(read.lines.map((l, i) => ({
        site_id: siteId,
        bill_id: billId,
        position: i,
        description: l.description,
        part_number: l.part_number || null,
        qty: l.qty,
        unit_cost_cents: l.unit_cost_cents,
        line_total_cents: l.line_total_cents || Math.round(l.qty * l.unit_cost_cents),
        is_core: l.is_core,
      })));
      fail(lineErr, 'Save invoice lines');
    }
  } catch (err) {
    const message = err instanceof Error && err.name === 'ShopAiError' ? err.message : 'Couldn’t read this invoice. Enter the lines by hand.';
    if (!(err instanceof Error && err.name === 'ShopAiError')) console.error('[shop/bills] read failed:', err);
    await db.from('shop_supplier_bills').update({ ai_error: message, suggested_job_id: hintJobId }).eq('site_id', siteId).eq('id', billId);
  }
}

export async function createBillFromUpload(
  access: ShopAccess,
  request: NextRequest | null,
  input: { buffer: Buffer; mime: string; handwritten_note?: string | null; job_id?: string | null },
): Promise<SupplierBill> {
  const { db, siteId } = access;
  const mime = baseMime(input.mime);
  const path = await storeShopFile(access, request, 'bills', input.buffer, mime, DOC_TYPES);
  let jobId: string | null = null;
  if (isUuid(input.job_id)) {
    const { data } = await db.from('shop_jobs').select('id').eq('site_id', siteId).eq('id', input.job_id).maybeSingle();
    jobId = data?.id ?? null;
  }
  const { data: bill, error } = await db.from('shop_supplier_bills').insert({
    site_id: siteId,
    status: 'needs_match',
    file_path: path,
    file_mime: mime,
    handwritten_note: str(input.handwritten_note, 500),
    suggested_job_id: jobId,
    created_by: access.actor,
  }).select('id').single();
  fail(error, 'Save supplier invoice');
  await readIntoBill(access, bill!.id, input.buffer, mime, jobId);
  const [fresh] = await loadBills(db, siteId, { ids: [bill!.id] });
  return fresh;
}

export async function rereadBill(access: ShopAccess, billId: string): Promise<SupplierBill> {
  const bill = await requireBill(access, billId);
  if (!bill.file_path || !bill.file_mime) throw new ShopRuleError('There’s no photo on this invoice to read.', undefined, 409);
  const buffer = await downloadShopFile(access, bill.file_path);
  if (!buffer) throw new ShopRuleError('The photo is missing.', undefined, 404);
  await readIntoBill(access, billId, buffer, bill.file_mime, bill.suggested_job_id);
  const [fresh] = await loadBills(access.db, access.siteId, { ids: [billId] });
  return fresh;
}

async function requireBill(access: ShopAccess, billId: string): Promise<SupplierBill> {
  if (!isUuid(billId)) throw new ShopRuleError('Supplier invoice not found.', undefined, 404);
  const [bill] = await loadBills(access.db, access.siteId, { ids: [billId] });
  if (!bill) throw new ShopRuleError('Supplier invoice not found.', undefined, 404);
  return bill;
}

export interface BillInput {
  supplier_id?: unknown;
  supplier_name?: unknown;
  create_supplier?: unknown;
  invoice_number?: unknown;
  invoice_date?: unknown;
  subtotal_cents?: unknown;
  tax_cents?: unknown;
  total_cents?: unknown;
  handwritten_note?: unknown;
  lines?: unknown;
}

async function resolveSupplier(access: ShopAccess, input: BillInput): Promise<{ id: string | null; raw: string | null } | undefined> {
  if (input.create_supplier === true) {
    const name = str(input.supplier_name, 120);
    if (!name) throw new ShopRuleError('Enter the supplier’s name.', undefined, 400);
    const existing = matchSupplier(name, await suppliersOf(access));
    if (existing) return { id: existing.id, raw: name };
    const { data, error } = await access.db.from('shop_suppliers').insert({ site_id: access.siteId, name }).select('id').single();
    fail(error, 'Add supplier');
    return { id: data!.id, raw: name };
  }
  if (input.supplier_id !== undefined) {
    if (input.supplier_id === null || input.supplier_id === '') return { id: null, raw: str(input.supplier_name, 120) };
    if (!isUuid(input.supplier_id)) throw new ShopRuleError('Supplier not found.', undefined, 404);
    const { data } = await access.db.from('shop_suppliers').select('id, name').eq('site_id', access.siteId).eq('id', input.supplier_id).maybeSingle();
    if (!data) throw new ShopRuleError('Supplier not found.', undefined, 404);
    return { id: data.id, raw: data.name };
  }
  return undefined;
}

async function writeBillLines(access: ShopAccess, billId: string, raw: unknown, validJobs: Set<string>) {
  if (!Array.isArray(raw)) return;
  if (raw.length > 120) throw new ShopRuleError('That’s too many lines.', undefined, 400);
  const rows = (raw as Record<string, unknown>[]).map((l, i) => {
    const qty = num(l.qty);
    const unit = int(l.unit_cost_cents) ?? 0;
    const q = qty && qty > 0 ? Math.round(qty * 100) / 100 : 1;
    return {
      site_id: access.siteId,
      bill_id: billId,
      position: i,
      description: str(l.description, 300) || 'Part',
      part_number: str(l.part_number, 80),
      qty: q,
      unit_cost_cents: unit,
      line_total_cents: int(l.line_total_cents) ?? Math.round(q * unit),
      is_core: l.is_core === true,
      core_returned_at: typeof l.core_returned_at === 'string' ? l.core_returned_at : null,
      job_id: isUuid(l.job_id) && validJobs.has(l.job_id) ? l.job_id : null,
    };
  });
  await access.db.from('shop_supplier_bill_lines').delete().eq('site_id', access.siteId).eq('bill_id', billId);
  if (rows.length) {
    const { error } = await access.db.from('shop_supplier_bill_lines').insert(rows);
    fail(error, 'Save lines');
  }
}

async function siteJobIds(access: ShopAccess, ids: unknown[]): Promise<Set<string>> {
  const wanted = [...new Set(ids.filter(isUuid))];
  if (!wanted.length) return new Set();
  const { data } = await access.db.from('shop_jobs').select('id').eq('site_id', access.siteId).in('id', wanted);
  return new Set((data || []).map(j => j.id as string));
}

/** Typed-in supplier invoice (no photo). */
export async function createBillManual(access: ShopAccess, input: BillInput): Promise<SupplierBill> {
  const supplier = await resolveSupplier(access, input);
  const { data: bill, error } = await access.db.from('shop_supplier_bills').insert({
    site_id: access.siteId,
    status: 'needs_match',
    supplier_id: supplier?.id ?? null,
    supplier_name_raw: supplier?.raw ?? str(input.supplier_name, 120),
    invoice_number: str(input.invoice_number, 60),
    invoice_date: isIsoDate(input.invoice_date) ? input.invoice_date : null,
    subtotal_cents: int(input.subtotal_cents),
    tax_cents: int(input.tax_cents),
    total_cents: int(input.total_cents),
    handwritten_note: str(input.handwritten_note, 500),
    created_by: access.actor,
  }).select('id').single();
  fail(error, 'Save supplier invoice');
  const lines = Array.isArray(input.lines) ? input.lines as Record<string, unknown>[] : [];
  await writeBillLines(access, bill!.id, lines, await siteJobIds(access, lines.map(l => l?.job_id)));
  return requireBill(access, bill!.id);
}

export async function updateBill(access: ShopAccess, billId: string, input: BillInput): Promise<SupplierBill> {
  await requireBill(access, billId);
  const patch: Record<string, unknown> = {};
  const supplier = await resolveSupplier(access, input);
  if (supplier) { patch.supplier_id = supplier.id; patch.supplier_name_raw = supplier.raw; }
  if (input.invoice_number !== undefined) patch.invoice_number = str(input.invoice_number, 60);
  if (input.invoice_date !== undefined) patch.invoice_date = isIsoDate(input.invoice_date) ? input.invoice_date : null;
  for (const k of ['subtotal_cents', 'tax_cents', 'total_cents'] as const) if (input[k] !== undefined) patch[k] = int(input[k]);
  if (input.handwritten_note !== undefined) patch.handwritten_note = str(input.handwritten_note, 500);
  if (Object.keys(patch).length) {
    patch.ai_error = null;
    const { error } = await access.db.from('shop_supplier_bills').update(patch).eq('site_id', access.siteId).eq('id', billId);
    fail(error, 'Save supplier invoice');
  }
  if (Array.isArray(input.lines)) {
    const lines = input.lines as Record<string, unknown>[];
    await writeBillLines(access, billId, lines, await siteJobIds(access, lines.map(l => l?.job_id)));
  }
  return requireBill(access, billId);
}

export interface MatchInput { target?: unknown; job_id?: unknown; line_jobs?: unknown }

/** File a supplier invoice: to a car, to shop stock, or as returned. */
export async function matchBill(access: ShopAccess, billId: string, input: MatchInput): Promise<SupplierBill> {
  const bill = await requireBill(access, billId);
  const { db, siteId } = access;
  const target = input.target === 'stock' ? 'stock' : input.target === 'return' ? 'returned' : 'matched';
  if (target !== 'matched') {
    await db.from('shop_supplier_bill_lines').update({ job_id: null }).eq('site_id', siteId).eq('bill_id', billId);
    const { error } = await db.from('shop_supplier_bills').update({ status: target }).eq('site_id', siteId).eq('id', billId);
    fail(error, 'File supplier invoice');
    return requireBill(access, billId);
  }
  const lineJobs = (input.line_jobs && typeof input.line_jobs === 'object' ? input.line_jobs : {}) as Record<string, unknown>;
  const valid = await siteJobIds(access, [input.job_id, ...Object.values(lineJobs)]);
  const defaultJob = isUuid(input.job_id) && valid.has(input.job_id) ? input.job_id : null;
  if (!defaultJob && !Object.values(lineJobs).some(v => isUuid(v) && valid.has(v))) throw new ShopRuleError('Pick the car these parts are for.', undefined, 400);
  if (!bill.lines.length) throw new ShopRuleError('Add the invoice lines first, so the parts land on the right invoice.', undefined, 400);
  const touched = new Map<string, { count: number; cents: number }>();
  for (const line of bill.lines) {
    const choice = lineJobs[line.id];
    const jobId = choice === null ? null : isUuid(choice) && valid.has(choice) ? choice : defaultJob;
    await db.from('shop_supplier_bill_lines').update({ job_id: jobId }).eq('site_id', siteId).eq('id', line.id);
    if (jobId && !line.is_core) {
      const t = touched.get(jobId) || { count: 0, cents: 0 };
      t.count += 1;
      t.cents += line.line_total_cents;
      touched.set(jobId, t);
    }
  }
  const { error } = await db.from('shop_supplier_bills').update({ status: 'matched' }).eq('site_id', siteId).eq('id', billId);
  fail(error, 'File supplier invoice');
  const { data: supplier } = bill.supplier_id ? await db.from('shop_suppliers').select('name').eq('id', bill.supplier_id).maybeSingle() : { data: null };
  const who = supplier?.name || bill.supplier_name_raw || 'supplier';
  for (const [jobId, t] of touched) {
    await addEvent(db, siteId, jobId, 'parts', {
      actor: access.actor,
      body: `Parts in: ${t.count} line${t.count === 1 ? '' : 's'} from ${who}${bill.invoice_number ? ` (invoice ${bill.invoice_number})` : ''}, cost ${formatCents(t.cents)}.`,
      file_path: bill.file_path,
      meta: { bill_id: bill.id },
    });
  }
  return requireBill(access, billId);
}

export async function deleteBill(access: ShopAccess, billId: string) {
  const bill = await requireBill(access, billId);
  if (bill.status === 'matched') throw new ShopRuleError('This invoice is matched to a car. Unmatch it (file as stock) before deleting.', undefined, 409);
  if (bill.paid_at) throw new ShopRuleError('This invoice is marked paid. It stays on file.', undefined, 409);
  const { error } = await access.db.from('shop_supplier_bills').delete().eq('site_id', access.siteId).eq('id', billId);
  fail(error, 'Delete supplier invoice');
  if (bill.file_path) await access.db.storage.from(SHOP_BUCKET).remove([bill.file_path]);
  return { ok: true };
}

export async function setCoreReturned(access: ShopAccess, lineId: string, returned: boolean) {
  if (!isUuid(lineId)) throw new ShopRuleError('Line not found.', undefined, 404);
  const { data, error } = await access.db.from('shop_supplier_bill_lines')
    .update({ core_returned_at: returned ? nowIso() : null })
    .eq('site_id', access.siteId).eq('id', lineId).eq('is_core', true).select('id');
  fail(error, 'Update core');
  if (!data?.length) throw new ShopRuleError('That line isn’t a core charge.', undefined, 404);
  return { ok: true };
}

export async function markBillsPaid(access: ShopAccess, billIds: unknown, paidOn: unknown, paid = true) {
  const ids = Array.isArray(billIds) ? billIds.filter(isUuid) : [];
  if (!ids.length) throw new ShopRuleError('Pick the invoices you paid.', undefined, 400);
  const when = paid ? (isIsoDate(paidOn) ? new Date(`${paidOn}T12:00:00Z`).toISOString() : nowIso()) : null;
  const { error } = await access.db.from('shop_supplier_bills').update({ paid_at: when }).eq('site_id', access.siteId).in('id', ids);
  fail(error, 'Mark paid');
  return { ok: true, count: ids.length };
}
