/**
 * Customer files, vehicles, suppliers and shop settings.
 */

import bcrypt from 'bcryptjs';
import { ShopRuleError, type ShopAccess } from '../access';
import { ensureSettings, ensureSettingsRow, paidByInvoice, toPublicSettings } from '../data';
import { newTechCode } from '../links';
import type { Bay, Customer, ShopSettings, StaffMember, Supplier, Vehicle } from '../types';
import { fail, int, isUuid, nowIso, str } from './common';
import { customerFields, vehicleFields, type CustomerInput, type VehicleInput } from './jobs';

// ── Customers ──────────────────────────────────────────────────────────────

export interface CustomerListRow extends Customer {
  vehicles: Pick<Vehicle, 'id' | 'year' | 'make' | 'model' | 'plate' | 'vin' | 'color'>[];
  open_jobs: number;
  visits: number;
  last_visit: string | null;
  owing_cents: number;
  lifetime_cents: number;
}

export async function listCustomers(access: ShopAccess, q: string | null, includeArchived = false): Promise<CustomerListRow[]> {
  const { db, siteId } = access;
  let ids: string[] | null = null;
  const term = (q || '').trim().replace(/[%,()]/g, ' ').slice(0, 60);
  if (term) {
    const like = `%${term}%`;
    const [byCustomer, byVehicle] = await Promise.all([
      db.from('shop_customers').select('id').eq('site_id', siteId).or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`).limit(200),
      db.from('shop_vehicles').select('customer_id').eq('site_id', siteId).or(`plate.ilike.${like},vin.ilike.${like},make.ilike.${like},model.ilike.${like}`).limit(200),
    ]);
    ids = [...new Set([...(byCustomer.data || []).map(r => r.id as string), ...(byVehicle.data || []).map(r => r.customer_id as string)])];
    if (!ids.length) return [];
  }
  let cq = db.from('shop_customers').select('*').eq('site_id', siteId);
  if (ids) cq = cq.in('id', ids);
  if (!includeArchived) cq = cq.is('archived_at', null);
  const { data: customers } = await cq.order('name').limit(500);
  const list = (customers || []) as Customer[];
  if (!list.length) return [];
  const cids = list.map(c => c.id);
  const [vehicles, jobs] = await Promise.all([
    db.from('shop_vehicles').select('id, customer_id, year, make, model, plate, vin, color').eq('site_id', siteId).in('customer_id', cids).is('archived_at', null),
    db.from('shop_jobs').select('id, customer_id, status, created_at').eq('site_id', siteId).in('customer_id', cids),
  ]);
  const jobRows = (jobs.data || []) as { id: string; customer_id: string; status: string; created_at: string }[];
  const { data: invoices } = jobRows.length
    ? await db.from('shop_invoices').select('id, job_id, total_cents').eq('site_id', siteId).eq('status', 'issued').in('job_id', jobRows.map(j => j.id))
    : { data: [] };
  const invRows = (invoices || []) as { id: string; job_id: string; total_cents: number }[];
  const paid = await paidByInvoice(db, siteId, invRows.map(i => i.id));
  const customerOfJob = new Map(jobRows.map(j => [j.id, j.customer_id]));
  const owing = new Map<string, number>();
  const lifetime = new Map<string, number>();
  for (const inv of invRows) {
    const cid = customerOfJob.get(inv.job_id)!;
    const p = paid.get(inv.id) ?? 0;
    owing.set(cid, (owing.get(cid) ?? 0) + (inv.total_cents - p));
    lifetime.set(cid, (lifetime.get(cid) ?? 0) + p);
  }
  return list.map(c => {
    const mine = jobRows.filter(j => j.customer_id === c.id);
    return {
      ...c,
      vehicles: ((vehicles.data || []) as (Vehicle & { customer_id: string })[]).filter(v => v.customer_id === c.id),
      open_jobs: mine.filter(j => j.status === 'open').length,
      visits: mine.length,
      last_visit: mine.map(j => j.created_at).sort().pop() ?? null,
      owing_cents: owing.get(c.id) ?? 0,
      lifetime_cents: lifetime.get(c.id) ?? 0,
    };
  });
}

export async function customerFile(access: ShopAccess, customerId: string) {
  if (!isUuid(customerId)) throw new ShopRuleError('Customer not found.', undefined, 404);
  const { db, siteId } = access;
  const { data: customer } = await db.from('shop_customers').select('*').eq('site_id', siteId).eq('id', customerId).maybeSingle();
  if (!customer) throw new ShopRuleError('Customer not found.', undefined, 404);
  const [vehicles, jobs] = await Promise.all([
    db.from('shop_vehicles').select('*').eq('site_id', siteId).eq('customer_id', customerId).order('created_at'),
    db.from('shop_jobs').select('id, ro_number, vehicle_id, complaint, stage, status, closed_reason, created_at, closed_at').eq('site_id', siteId).eq('customer_id', customerId).order('created_at', { ascending: false }),
  ]);
  const jobRows = (jobs.data || []) as { id: string }[];
  const [invoices, liens] = jobRows.length
    ? await Promise.all([
      db.from('shop_invoices').select('id, job_id, invoice_number, total_cents, issued_at, status').eq('site_id', siteId).in('job_id', jobRows.map(j => j.id)),
      db.from('shop_liens').select('id, job_id, status, amount_owing_cents, ppsr_registration_number').eq('site_id', siteId).in('job_id', jobRows.map(j => j.id)),
    ])
    : [{ data: [] }, { data: [] }];
  const invRows = (invoices.data || []) as { id: string; job_id: string; invoice_number: number; total_cents: number; issued_at: string; status: string }[];
  const paid = await paidByInvoice(db, siteId, invRows.map(i => i.id));
  return {
    customer: customer as Customer,
    vehicles: (vehicles.data || []) as Vehicle[],
    jobs: (jobs.data || []).map(j => {
      const inv = invRows.find(i => i.job_id === j.id && i.status === 'issued');
      return { ...j, invoice: inv ? { ...inv, paid_cents: paid.get(inv.id) ?? 0 } : null };
    }),
    liens: liens.data || [],
  };
}

export async function createCustomer(access: ShopAccess, input: CustomerInput & { vehicle?: VehicleInput }) {
  const fields = customerFields(input);
  if (!fields.name) throw new ShopRuleError('Enter the customer’s name.', undefined, 400);
  const { data, error } = await access.db.from('shop_customers').insert({ site_id: access.siteId, ...fields }).select('*').single();
  fail(error, 'Create customer');
  if (input.vehicle) await createVehicle(access, (data as Customer).id, input.vehicle);
  return data as Customer;
}

export async function updateCustomer(access: ShopAccess, customerId: string, input: CustomerInput & { archived?: unknown }) {
  if (!isUuid(customerId)) throw new ShopRuleError('Customer not found.', undefined, 404);
  const patch = customerFields(input, true);
  if ('name' in patch && !patch.name) throw new ShopRuleError('The name can’t be blank.', undefined, 400);
  if (input.archived !== undefined) patch.archived_at = input.archived === true ? nowIso() : null;
  const { data, error } = await access.db.from('shop_customers').update(patch).eq('site_id', access.siteId).eq('id', customerId).select('*').maybeSingle();
  fail(error, 'Update customer');
  if (!data) throw new ShopRuleError('Customer not found.', undefined, 404);
  return data as Customer;
}

export async function createVehicle(access: ShopAccess, customerId: unknown, input: VehicleInput) {
  if (!isUuid(customerId)) throw new ShopRuleError('Customer not found.', undefined, 404);
  const { data: c } = await access.db.from('shop_customers').select('id').eq('site_id', access.siteId).eq('id', customerId).maybeSingle();
  if (!c) throw new ShopRuleError('Customer not found.', undefined, 404);
  const fields = vehicleFields(input);
  if (!fields.make && !fields.model && !fields.plate && !fields.vin) throw new ShopRuleError('Enter the make and model, plate or VIN.', undefined, 400);
  const { data, error } = await access.db.from('shop_vehicles').insert({ site_id: access.siteId, customer_id: customerId, ...fields }).select('*').single();
  fail(error, 'Add vehicle');
  return data as Vehicle;
}

export async function updateVehicle(access: ShopAccess, vehicleId: string, input: VehicleInput & { archived?: unknown; customer_id?: unknown }) {
  if (!isUuid(vehicleId)) throw new ShopRuleError('Vehicle not found.', undefined, 404);
  const patch = vehicleFields(input, true);
  if (input.archived !== undefined) patch.archived_at = input.archived === true ? nowIso() : null;
  if (input.customer_id !== undefined) {
    if (!isUuid(input.customer_id)) throw new ShopRuleError('Customer not found.', undefined, 404);
    const { data: c } = await access.db.from('shop_customers').select('id').eq('site_id', access.siteId).eq('id', input.customer_id).maybeSingle();
    if (!c) throw new ShopRuleError('Customer not found.', undefined, 404);
    patch.customer_id = input.customer_id;
  }
  const { data, error } = await access.db.from('shop_vehicles').update(patch).eq('site_id', access.siteId).eq('id', vehicleId).select('*').maybeSingle();
  fail(error, 'Update vehicle');
  if (!data) throw new ShopRuleError('Vehicle not found.', undefined, 404);
  return data as Vehicle;
}

// ── Suppliers ──────────────────────────────────────────────────────────────

function supplierFields(input: Record<string, unknown>, partial = false) {
  const out: Record<string, unknown> = {};
  for (const [k, max] of [['name', 120], ['account_number', 60], ['rep_name', 120], ['phone', 40], ['email', 200], ['terms', 120]] as const) {
    if (!partial || input[k] !== undefined) out[k] = str(input[k], max);
  }
  return out;
}

export async function createSupplier(access: ShopAccess, input: Record<string, unknown>) {
  const fields = supplierFields(input);
  if (!fields.name) throw new ShopRuleError('Enter the supplier’s name.', undefined, 400);
  const { data, error } = await access.db.from('shop_suppliers').insert({ site_id: access.siteId, ...fields }).select('*').single();
  fail(error, 'Add supplier');
  return data as Supplier;
}

export async function updateSupplier(access: ShopAccess, supplierId: string, input: Record<string, unknown>) {
  if (!isUuid(supplierId)) throw new ShopRuleError('Supplier not found.', undefined, 404);
  const patch = supplierFields(input, true);
  if ('name' in patch && !patch.name) throw new ShopRuleError('The name can’t be blank.', undefined, 400);
  if (input.archived !== undefined) patch.archived_at = input.archived === true ? nowIso() : null;
  const { data, error } = await access.db.from('shop_suppliers').update(patch).eq('site_id', access.siteId).eq('id', supplierId).select('*').maybeSingle();
  fail(error, 'Update supplier');
  if (!data) throw new ShopRuleError('Supplier not found.', undefined, 404);
  return data as Supplier;
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function saveSettings(access: ShopAccess, input: Record<string, unknown>): Promise<ShopSettings> {
  const { db, siteId } = access;
  const current = await ensureSettings(db, siteId);
  const patch: Record<string, unknown> = {};
  const text = (k: keyof ShopSettings, max: number, required = false) => {
    if (input[k] === undefined) return;
    const v = str(input[k], max);
    if (required && !v) throw new ShopRuleError(`${String(k).replace(/_/g, ' ')} can’t be blank.`, undefined, 400);
    patch[k] = v;
  };
  text('legal_name', 160); text('address', 300); text('phone', 40); text('email', 200); text('hst_number', 40);
  text('tax_label', 20, true); text('payment_terms', 200, true); text('payment_methods_note', 300, true);
  text('etransfer_email', 200); text('warranty_extra', 2000); text('diagnostic_policy', 1000); text('flat_rate_policy', 1000);
  text('parts_commission_policy', 500, true); text('other_charges', 1000);
  const range = (k: keyof ShopSettings, min: number, max: number, label: string) => {
    if (input[k] === undefined) return;
    const v = int(input[k]);
    if (v == null || v < min || v > max) throw new ShopRuleError(`${label} must be between ${min} and ${max}.`, undefined, 400);
    patch[k] = v;
  };
  range('tax_rate_bps', 0, 3000, 'Tax rate (basis points)');
  range('labour_rate_cents', 0, 10_000_00, 'Labour rate');
  range('estimate_fee_cents', 0, 5_000_00, 'Estimate fee');
  range('estimate_valid_days', 1, 365, 'Days an estimate is good for');
  range('key_tag_max', 1, 9999, 'Highest key tag');

  if (input.bays !== undefined) {
    if (!Array.isArray(input.bays) || input.bays.length < 1 || input.bays.length > 12) throw new ShopRuleError('Set up between 1 and 12 bays.', undefined, 400);
    const bays: Bay[] = (input.bays as Record<string, unknown>[]).map((b, i) => ({
      id: str(b?.id, 40)?.replace(/[^a-z0-9_-]/gi, '') || `bay${Date.now().toString(36)}${i}`,
      label: str(b?.label, 40) || `Bay ${i + 1}`,
    }));
    if (new Set(bays.map(b => b.id)).size !== bays.length) throw new ShopRuleError('Two bays have the same id.', undefined, 400);
    const removed = current.bays.filter(b => !bays.some(n => n.id === b.id)).map(b => b.id);
    if (removed.length) {
      const { data: inUse } = await db.from('shop_jobs').select('ro_number, bay').eq('site_id', siteId).eq('status', 'open').in('bay', removed);
      if (inUse?.length) throw new ShopRuleError(`There’s a car in ${current.bays.find(b => b.id === inUse[0].bay)?.label}. Move it out before removing the bay.`, undefined, 409);
    }
    patch.bays = bays;
  }
  if (input.staff !== undefined) {
    if (!Array.isArray(input.staff) || input.staff.length > 30) throw new ShopRuleError('Up to 30 people on the staff list.', undefined, 400);
    const staff: StaffMember[] = (input.staff as Record<string, unknown>[])
      .map(s => ({ name: str(s?.name, 60) || '', role: (['tech', 'desk', 'owner'].includes(String(s?.role)) ? s.role : 'tech') as StaffMember['role'] }))
      .filter(s => s.name);
    if (new Set(staff.map(s => s.name.toLowerCase())).size !== staff.length) throw new ShopRuleError('Two people have the same name. Add a last initial.', undefined, 400);
    patch.staff = staff;
  }
  if (Object.keys(patch).length) {
    const { error } = await db.from('shop_settings').update(patch).eq('site_id', siteId);
    fail(error, 'Save settings');
  }
  return ensureSettings(db, siteId);
}

/** Set the shop PIN the bay phone/tablet uses. Optionally sign out every device. */
export async function setTechPin(access: ShopAccess, pin: unknown, opts: { signOutDevices?: boolean; newCode?: boolean } = {}) {
  const p = typeof pin === 'string' ? pin.trim() : '';
  if (!/^\d{4,8}$/.test(p)) throw new ShopRuleError('The PIN must be 4 to 8 digits.', undefined, 400);
  if (/^(\d)\1+$/.test(p) || '0123456789'.includes(p) || '9876543210'.includes(p)) throw new ShopRuleError('Pick a PIN that’s harder to guess.', undefined, 400);
  const row = await ensureSettingsRow(access.db, access.siteId);
  const patch: Record<string, unknown> = { tech_pin_hash: await bcrypt.hash(p, 10), tech_failed_attempts: 0, tech_locked_until: null };
  if (opts.newCode || !row.tech_code) patch.tech_code = newTechCode();
  const { error } = await access.db.from('shop_settings').update(patch).eq('site_id', access.siteId);
  fail(error, 'Save PIN');
  if (opts.signOutDevices) {
    await access.db.from('shop_tech_devices').update({ revoked_at: nowIso() }).eq('site_id', access.siteId).is('revoked_at', null);
  }
  return toPublicSettings(await ensureSettingsRow(access.db, access.siteId));
}

export async function listDevices(access: ShopAccess) {
  const { data } = await access.db.from('shop_tech_devices').select('id, label, created_at, last_seen_at, revoked_at').eq('site_id', access.siteId).order('created_at', { ascending: false }).limit(50);
  return data || [];
}

export async function revokeDevice(access: ShopAccess, deviceId: string) {
  if (!isUuid(deviceId)) throw new ShopRuleError('Device not found.', undefined, 404);
  const { error } = await access.db.from('shop_tech_devices').update({ revoked_at: nowIso() }).eq('site_id', access.siteId).eq('id', deviceId);
  fail(error, 'Sign out device');
  return { ok: true };
}
