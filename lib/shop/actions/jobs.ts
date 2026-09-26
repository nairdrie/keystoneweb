/**
 * Jobs: drop-off, board moves, tech "done" buttons, notes and closing a job.
 */

import { ShopRuleError, type ShopAccess } from '../access';
import { addEvent, ensureSettings, nextFreeKeyTag } from '../data';
import { STAGE_LABELS } from '../board';
import { methodLabel } from '../rules';
import { formatCents } from '../money';
import type { AuthMethod, CustomerType, JobSource, Stage } from '../types';
import { checkedTime, fail, int, isIsoDate, isUuid, nowIso, requireJob, str } from './common';

const SOURCES: JobSource[] = ['walk_in', 'key_drop', 'phone', 'website_form', 'booking', 'other'];
const STAGES: Stage[] = ['dropped', 'estimate', 'waiting', 'approved', 'done'];
const METHODS: AuthMethod[] = ['phone', 'in_person', 'online', 'email', 'text'];

export interface CustomerInput {
  name?: unknown; phone?: unknown; email?: unknown; address?: unknown;
  customer_type?: unknown; business_reason?: unknown; preferences?: unknown; notes?: unknown;
}

export interface VehicleInput {
  year?: unknown; make?: unknown; model?: unknown; trim?: unknown; vin?: unknown; plate?: unknown;
  color?: unknown; engine?: unknown; notes?: unknown;
}

export function customerFields(c: CustomerInput, partial = false) {
  const out: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (!partial || v !== undefined) out[k] = v; };
  set('name', c.name === undefined ? undefined : str(c.name, 120));
  set('phone', c.phone === undefined ? undefined : str(c.phone, 40));
  set('email', c.email === undefined ? undefined : str(c.email, 200)?.toLowerCase() ?? null);
  set('address', c.address === undefined ? undefined : str(c.address, 300));
  set('customer_type', c.customer_type === undefined ? undefined : (c.customer_type === 'business' ? 'business' : 'consumer') as CustomerType);
  set('business_reason', c.business_reason === undefined ? undefined : str(c.business_reason, 200));
  set('preferences', c.preferences === undefined ? undefined : str(c.preferences, 500));
  set('notes', c.notes === undefined ? undefined : str(c.notes, 2000));
  if (out.email && typeof out.email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) {
    throw new ShopRuleError('That email address doesn’t look right.', undefined, 400);
  }
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

export function vehicleFields(v: VehicleInput, partial = false) {
  const out: Record<string, unknown> = {};
  const set = (k: string, val: unknown) => { if (!partial || val !== undefined) out[k] = val; };
  const year = v.year === undefined ? undefined : int(v.year);
  if (year != null && (year < 1900 || year > 2100)) throw new ShopRuleError('That model year doesn’t look right.', undefined, 400);
  set('year', year);
  set('make', v.make === undefined ? undefined : str(v.make, 60));
  set('model', v.model === undefined ? undefined : str(v.model, 80));
  set('trim', v.trim === undefined ? undefined : str(v.trim, 80));
  const vin = v.vin === undefined ? undefined : str(v.vin, 17)?.toUpperCase().replace(/[^A-Z0-9]/g, '') ?? null;
  if (vin && vin.length !== 17) throw new ShopRuleError('A VIN has 17 characters.', undefined, 400);
  set('vin', vin);
  set('plate', v.plate === undefined ? undefined : str(v.plate, 12)?.toUpperCase() ?? null);
  set('color', v.color === undefined ? undefined : str(v.color, 40));
  set('engine', v.engine === undefined ? undefined : str(v.engine, 80));
  set('notes', v.notes === undefined ? undefined : str(v.notes, 2000));
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

export interface FeeAgreementInput {
  cents?: unknown;
  method?: unknown;
  authorized_by?: unknown;
  phone?: unknown;
  contact?: unknown;
  note?: unknown;
  authorized_at?: unknown;
}

async function recordFeeAgreement(access: ShopAccess, jobId: string, fee: FeeAgreementInput, customerName: string, defaultCents: number) {
  const cents = int(fee.cents) ?? defaultCents;
  if (cents <= 0) throw new ShopRuleError('Enter the estimate fee the customer agreed to.', undefined, 400);
  const method = (METHODS.includes(fee.method as AuthMethod) ? fee.method : 'in_person') as AuthMethod;
  const by = str(fee.authorized_by, 120) || customerName;
  const phone = str(fee.phone, 40);
  if (method === 'phone' && !phone) throw new ShopRuleError('Record the phone number you called when the fee was agreed.', undefined, 400);
  const at = checkedTime(fee.authorized_at, 'The time the fee was agreed');
  const note = str(fee.note, 200) || `${methodLabel(method)} with ${by}`;
  const { error } = await access.db.from('shop_jobs').update({
    estimate_fee_cents: cents, estimate_fee_note: note, estimate_fee_agreed_at: at,
  }).eq('site_id', access.siteId).eq('id', jobId);
  fail(error, 'Save estimate fee');
  const { error: authErr } = await access.db.from('shop_authorizations').insert({
    site_id: access.siteId, job_id: jobId, kind: 'estimate_fee', method, authorized_by: by, phone,
    contact: str(fee.contact, 200), authorized_at: at, taken_by: access.actor, amount_cents: cents,
  });
  fail(authErr, 'Save fee authorization');
  await addEvent(access.db, access.siteId, jobId, 'authorization', {
    actor: access.actor,
    body: `Estimate fee of ${formatCents(cents)} agreed (${note}). Waived if the repair is approved.`,
  });
}

export interface CreateJobInput {
  customer_id?: unknown;
  customer?: CustomerInput;
  vehicle_id?: unknown;
  vehicle?: VehicleInput;
  complaint?: unknown;
  customer_words?: unknown;
  key_tag?: unknown;
  odometer_in?: unknown;
  source?: unknown;
  source_ref?: unknown;
  promised_date?: unknown;
  next_step?: unknown;
  fee?: FeeAgreementInput | null;
  owner_is_customer?: unknown;
  registered_owner_name?: unknown;
}

export async function createJob(access: ShopAccess, input: CreateJobInput): Promise<{ id: string; ro_number: number; key_tag: string | null }> {
  const { db, siteId } = access;
  const settings = await ensureSettings(db, siteId);
  const complaint = str(input.complaint, 4000);
  if (!complaint) throw new ShopRuleError('Write down what the customer says is wrong.', undefined, 400);

  // Customer
  let customerId: string;
  let customerName: string;
  if (isUuid(input.customer_id)) {
    const { data } = await db.from('shop_customers').select('id, name').eq('site_id', siteId).eq('id', input.customer_id).maybeSingle();
    if (!data) throw new ShopRuleError('Customer not found.', undefined, 404);
    customerId = data.id;
    customerName = data.name;
    if (input.customer) {
      const patch = customerFields(input.customer, true);
      delete patch.name;
      if (Object.keys(patch).length) await db.from('shop_customers').update(patch).eq('site_id', siteId).eq('id', customerId);
    }
  } else {
    const fields = customerFields(input.customer || {});
    if (!fields.name) throw new ShopRuleError('Enter the customer’s name.', undefined, 400);
    if (!fields.phone && !fields.email) throw new ShopRuleError('Enter a phone number or email so you can reach the customer.', undefined, 400);
    const { data, error } = await db.from('shop_customers').insert({ site_id: siteId, ...fields }).select('id, name').single();
    fail(error, 'Create customer');
    customerId = data!.id;
    customerName = data!.name;
  }

  // Vehicle
  let vehicleId: string;
  if (isUuid(input.vehicle_id)) {
    const { data } = await db.from('shop_vehicles').select('id, customer_id').eq('site_id', siteId).eq('id', input.vehicle_id).maybeSingle();
    if (!data) throw new ShopRuleError('Vehicle not found.', undefined, 404);
    vehicleId = data.id;
    const patch = input.vehicle ? vehicleFields(input.vehicle, true) : {};
    // A car that changed hands follows its new owner.
    if (data.customer_id !== customerId) patch.customer_id = customerId;
    if (Object.keys(patch).length) {
      const { error } = await db.from('shop_vehicles').update(patch).eq('site_id', siteId).eq('id', vehicleId);
      fail(error, 'Update vehicle');
    }
  } else {
    const fields = vehicleFields(input.vehicle || {});
    if (!fields.make && !fields.model && !fields.plate && !fields.vin) {
      throw new ShopRuleError('Enter the vehicle (make and model, plate or VIN).', undefined, 400);
    }
    const { data, error } = await db.from('shop_vehicles').insert({ site_id: siteId, customer_id: customerId, ...fields }).select('id').single();
    fail(error, 'Create vehicle');
    vehicleId = data!.id;
  }

  const { data: openForCar } = await db.from('shop_jobs').select('ro_number').eq('site_id', siteId).eq('vehicle_id', vehicleId).eq('status', 'open').maybeSingle();
  if (openForCar) throw new ShopRuleError(`This vehicle is already on the board as RO-${openForCar.ro_number}.`, undefined, 409);

  // Key tag
  let keyTag = str(input.key_tag, 12);
  if (keyTag) {
    const { data: taken } = await db.from('shop_jobs').select('ro_number').eq('site_id', siteId).eq('status', 'open').eq('key_tag', keyTag).maybeSingle();
    if (taken) throw new ShopRuleError(`Key tag ${keyTag} is already on RO-${taken.ro_number}.`, undefined, 409);
  } else {
    keyTag = await nextFreeKeyTag(db, siteId, settings.key_tag_max);
  }

  const odometer = int(input.odometer_in);
  if (odometer != null && (odometer < 0 || odometer > 3_000_000)) throw new ShopRuleError('That odometer reading doesn’t look right.', undefined, 400);
  const source = (SOURCES.includes(input.source as JobSource) ? input.source : 'walk_in') as JobSource;
  const promised = isIsoDate(input.promised_date) ? input.promised_date : null;

  const { data: ro, error: roErr } = await db.rpc('shop_next_number', { p_site_id: siteId, p_kind: 'ro' });
  fail(roErr, 'Get RO number');
  const { data: last } = await db.from('shop_jobs').select('sort_order').eq('site_id', siteId).eq('status', 'open').order('sort_order', { ascending: false }).limit(1).maybeSingle();

  const ownerIsCustomer = input.owner_is_customer !== false;
  const { data: job, error } = await db.from('shop_jobs').insert({
    site_id: siteId,
    ro_number: ro as number,
    customer_id: customerId,
    vehicle_id: vehicleId,
    key_tag: keyTag,
    stage: 'dropped',
    sort_order: ((last?.sort_order as number | undefined) ?? 0) + 1,
    complaint,
    source,
    source_ref: str(input.source_ref, 80),
    odometer_in: odometer,
    next_step: str(input.next_step, 300),
    promised_date: promised,
    owner_is_customer: ownerIsCustomer,
    registered_owner_name: ownerIsCustomer ? null : str(input.registered_owner_name, 120),
  }).select('id, ro_number, key_tag').single();
  fail(error, 'Create job');
  const jobId = job!.id as string;

  if (odometer != null) await db.from('shop_vehicles').update({ last_odometer: odometer }).eq('site_id', siteId).eq('id', vehicleId);

  const sourceLabel = { walk_in: 'Walk-in', key_drop: 'Key drop', phone: 'Phoned in', website_form: 'Website form', booking: 'Online booking', other: 'Dropped off' }[source];
  await addEvent(db, siteId, jobId, 'intake', {
    actor: access.actor,
    body: `${sourceLabel}.${keyTag ? ` Key tag ${keyTag}.` : ' No key tag free.'}${odometer != null ? ` Odometer ${odometer.toLocaleString('en-CA')} km.` : ''}`,
    quote: str(input.customer_words, 4000) || complaint,
  });

  if (input.fee && (input.fee.cents !== undefined || input.fee.method !== undefined)) {
    await recordFeeAgreement(access, jobId, input.fee, customerName, settings.estimate_fee_cents);
  }
  return { id: jobId, ro_number: job!.ro_number as number, key_tag: (job!.key_tag as string | null) ?? null };
}

export interface UpdateJobInput {
  complaint?: unknown;
  diagnosis?: unknown;
  key_tag?: unknown;
  odometer_in?: unknown;
  odometer_out?: unknown;
  next_step?: unknown;
  promised_date?: unknown;
  assigned_tech?: unknown;
  owner_is_customer?: unknown;
  registered_owner_name?: unknown;
  fee?: FeeAgreementInput | null;
  remove_fee?: unknown;
}

export async function updateJob(access: ShopAccess, jobId: string, input: UpdateJobInput) {
  const detail = await requireJob(access, jobId);
  const { db, siteId } = access;
  const { job } = detail;
  const patch: Record<string, unknown> = {};
  const changes: string[] = [];

  if (input.complaint !== undefined) {
    const c = str(input.complaint, 4000);
    if (!c) throw new ShopRuleError('The complaint can’t be blank.', undefined, 400);
    patch.complaint = c;
  }
  if (input.diagnosis !== undefined) patch.diagnosis = str(input.diagnosis, 8000);
  if (input.next_step !== undefined) patch.next_step = str(input.next_step, 300);
  if (input.promised_date !== undefined) patch.promised_date = isIsoDate(input.promised_date) ? input.promised_date : null;
  if (input.assigned_tech !== undefined) patch.assigned_tech = str(input.assigned_tech, 60);
  if (input.owner_is_customer !== undefined) patch.owner_is_customer = input.owner_is_customer !== false;
  if (input.registered_owner_name !== undefined) patch.registered_owner_name = str(input.registered_owner_name, 120);

  if (input.key_tag !== undefined) {
    const tag = str(input.key_tag, 12);
    if (tag !== job.key_tag) {
      if (tag && job.status === 'open') {
        const { data: taken } = await db.from('shop_jobs').select('ro_number').eq('site_id', siteId).eq('status', 'open').eq('key_tag', tag).neq('id', jobId).maybeSingle();
        if (taken) throw new ShopRuleError(`Key tag ${tag} is already on RO-${taken.ro_number}.`, undefined, 409);
      }
      patch.key_tag = tag;
      changes.push(`Key tag ${job.key_tag ?? 'none'} → ${tag ?? 'none'}`);
    }
  }
  for (const field of ['odometer_in', 'odometer_out'] as const) {
    if (input[field] === undefined) continue;
    const v = int(input[field]);
    if (v != null && (v < 0 || v > 3_000_000)) throw new ShopRuleError('That odometer reading doesn’t look right.', undefined, 400);
    if (field === 'odometer_in' && detail.invoice) throw new ShopRuleError('The invoice is already issued with this odometer reading.', undefined, 409);
    if (v !== job[field]) {
      patch[field] = v;
      changes.push(`${field === 'odometer_in' ? 'Odometer in' : 'Odometer out'} ${job[field]?.toLocaleString('en-CA') ?? '—'} → ${v?.toLocaleString('en-CA') ?? '—'}`);
    }
  }

  if (Object.keys(patch).length) {
    const { error } = await db.from('shop_jobs').update(patch).eq('site_id', siteId).eq('id', jobId);
    fail(error, 'Update job');
  }
  if (patch.odometer_in != null) await db.from('shop_vehicles').update({ last_odometer: patch.odometer_in }).eq('site_id', siteId).eq('id', job.vehicle_id);
  if (changes.length) await addEvent(db, siteId, jobId, 'system', { actor: access.actor, body: changes.join('. ') });

  if (input.remove_fee === true) {
    if (detail.invoice?.snapshot.kind === 'estimate_fee') throw new ShopRuleError('The estimate fee is already invoiced.', undefined, 409);
    await db.from('shop_jobs').update({ estimate_fee_cents: 0, estimate_fee_note: null, estimate_fee_agreed_at: null }).eq('site_id', siteId).eq('id', jobId);
    await addEvent(db, siteId, jobId, 'system', { actor: access.actor, body: 'Estimate fee removed.' });
  } else if (input.fee) {
    // CPA s. 57: the fee must be agreed before the estimate is prepared.
    if (detail.estimates.some(e => e.sent_at)) {
      throw new ShopRuleError('The estimate fee has to be agreed before the estimate is given. It can’t be added now.', undefined, 409);
    }
    const settings = detail.settings;
    await recordFeeAgreement(access, jobId, input.fee, detail.customer.name, settings.estimate_fee_cents);
  }
  return { ok: true };
}

export interface MoveInput { stage?: unknown; bay?: unknown; sort_order?: unknown; assigned_tech?: unknown }

/**
 * Board moves. Dropping on a bay keeps the stage; dropping on a lane takes the
 * car out of its bay. Stage changes that imply paperwork require it.
 */
export async function moveJob(access: ShopAccess, jobId: string, input: MoveInput) {
  const detail = await requireJob(access, jobId);
  const { db, siteId } = access;
  const { job, estimates, settings } = detail;
  if (job.status !== 'open') throw new ShopRuleError('This job is closed.', undefined, 409);
  const patch: Record<string, unknown> = {};
  const notes: string[] = [];
  const approved = estimates.find(e => e.status === 'approved');

  if (input.bay !== undefined) {
    const bayId = input.bay === null || input.bay === '' ? null : String(input.bay);
    if (bayId) {
      const bay = settings.bays.find(b => b.id === bayId);
      if (!bay) throw new ShopRuleError('That bay doesn’t exist. Check Settings → Bays.', undefined, 400);
      const { data: inBay } = await db.from('shop_jobs')
        .select('ro_number, vehicle:shop_vehicles(year, make, model)')
        .eq('site_id', siteId).eq('status', 'open').eq('bay', bayId).neq('id', jobId).maybeSingle();
      if (inBay) {
        const v = (Array.isArray(inBay.vehicle) ? inBay.vehicle[0] : inBay.vehicle) as { year: number | null; make: string | null; model: string | null } | null;
        throw new ShopRuleError(`${bay.label} has ${v ? [v.year, v.make, v.model].filter(Boolean).join(' ') : `RO-${inBay.ro_number}`} in it. Move it out first.`, undefined, 409);
      }
      if (detail.invoice) throw new ShopRuleError('This car is invoiced. It doesn’t need a bay.', undefined, 409);
      if (job.bay !== bayId) notes.push(`Moved into ${bay.label}`);
    } else if (job.bay) {
      notes.push(`Out of ${settings.bays.find(b => b.id === job.bay)?.label ?? 'the bay'}`);
    }
    patch.bay = bayId;
  }

  if (input.stage !== undefined) {
    const stage = input.stage as Stage;
    if (!STAGES.includes(stage)) throw new ShopRuleError('Unknown board lane.', undefined, 400);
    if (stage !== job.stage) {
      if (detail.invoice && stage !== 'done') throw new ShopRuleError('This car is invoiced, so it stays in Done. Void the invoice to reopen it.', undefined, 409);
      if (stage === 'approved' && !approved) {
        throw new ShopRuleError('The customer hasn’t approved an estimate yet. Record their approval first.', undefined, 409);
      }
      if (stage === 'waiting' && !estimates.some(e => e.status === 'sent' || e.status === 'approved')) {
        throw new ShopRuleError('Send the estimate first. Then the car waits on the customer.', undefined, 409);
      }
      if (stage === 'done' && approved && !job.completed_at) patch.completed_at = nowIso();
      if (stage !== 'done' && job.stage === 'done') patch.completed_at = null;
      if (stage === 'estimate' && !job.diagnosed_at) patch.diagnosed_at = nowIso();
      patch.stage = stage;
      if (input.bay === undefined && job.bay) patch.bay = null;
      notes.push(`Moved to ${STAGE_LABELS[stage]}`);
    }
  }
  if (input.sort_order !== undefined && Number.isFinite(Number(input.sort_order))) patch.sort_order = Number(input.sort_order);
  if (input.assigned_tech !== undefined) patch.assigned_tech = str(input.assigned_tech, 60);

  if (Object.keys(patch).length) {
    const { error } = await db.from('shop_jobs').update(patch).eq('site_id', siteId).eq('id', jobId);
    fail(error, 'Move job');
  }
  if (notes.length) await addEvent(db, siteId, jobId, 'move', { actor: access.actor, body: notes.join('. ') });
  return { ok: true };
}

/** Tech buttons: diagnosis done (car out of the bay, ready to price) or repair done. */
export async function markDone(access: ShopAccess, jobId: string, kind: 'diagnosis' | 'repair') {
  const detail = await requireJob(access, jobId);
  const { db, siteId } = access;
  const { job, estimates } = detail;
  if (job.status !== 'open') throw new ShopRuleError('This job is closed.', undefined, 409);
  const approved = estimates.find(e => e.status === 'approved');
  if (kind === 'diagnosis') {
    const patch: Record<string, unknown> = { bay: null, diagnosed_at: job.diagnosed_at ?? nowIso() };
    if (job.stage === 'dropped') patch.stage = 'estimate';
    const { error } = await db.from('shop_jobs').update(patch).eq('site_id', siteId).eq('id', jobId);
    fail(error, 'Mark diagnosis done');
    await addEvent(db, siteId, jobId, 'diagnosis', { actor: access.actor, body: 'Diagnosis done. Car out of the bay, ready to price.' });
    return { ok: true, stage: (patch.stage as Stage) ?? job.stage };
  }
  if (!approved) {
    throw new ShopRuleError('Nothing is approved on this car. Work the customer hasn’t approved can’t be charged for.', undefined, 409);
  }
  const { error } = await db.from('shop_jobs').update({ bay: null, stage: 'done', completed_at: job.completed_at ?? nowIso() }).eq('site_id', siteId).eq('id', jobId);
  fail(error, 'Mark repair done');
  const revision = estimates.find(e => e.is_revision && (e.status === 'draft' || e.status === 'sent'));
  await addEvent(db, siteId, jobId, 'system', {
    actor: access.actor,
    body: revision ? 'Repair done and parked. Extra work is waiting on the customer’s approval.' : 'Repair done and parked. Ready to invoice.',
  });
  return { ok: true, stage: 'done' as Stage };
}

export async function addNote(access: ShopAccess, jobId: string, input: { kind?: unknown; body?: unknown; quote?: unknown; file_path?: string | null; phone?: unknown; outcome?: unknown }) {
  const detail = await requireJob(access, jobId);
  const kind = input.kind === 'call' ? 'call' : input.kind === 'photo' ? 'photo' : 'note';
  const body = str(input.body, 4000);
  if (!body && !input.file_path) throw new ShopRuleError('Write a note first.', undefined, 400);
  await addEvent(access.db, access.siteId, detail.job.id, kind, {
    actor: access.actor,
    body: kind === 'call' ? `Called ${str(input.phone, 40) || detail.customer.phone || 'the customer'}${input.outcome ? `: ${str(input.outcome, 200)}` : ''}.${body ? ` ${body}` : ''}` : body,
    quote: str(input.quote, 4000),
    file_path: input.file_path ?? null,
  });
  return { ok: true };
}

/** The customer picked the car up without paying, or before the invoice. */
export async function markReturned(access: ShopAccess, jobId: string) {
  const detail = await requireJob(access, jobId);
  const { job, invoice } = detail;
  if (job.holding_since) throw new ShopRuleError('You’re holding this car for payment. Stop holding it first.', undefined, 409);
  const { error } = await access.db.from('shop_jobs').update({ returned_at: nowIso(), bay: null }).eq('site_id', access.siteId).eq('id', jobId);
  fail(error, 'Mark returned');
  await addEvent(access.db, access.siteId, jobId, 'system', {
    actor: access.actor,
    body: invoice ? 'Key handed back. The car left without a payment plan, so there is no lien on it.' : 'Key handed back.',
  });
  return { ok: true };
}

/** Close a job with no charge (declined, no fee) or cancel it. */
export async function closeJob(access: ShopAccess, jobId: string, reason: 'no_charge' | 'cancelled', note?: unknown) {
  const detail = await requireJob(access, jobId);
  const { job, invoice, payments } = detail;
  if (job.status !== 'open') throw new ShopRuleError('This job is already closed.', undefined, 409);
  if (invoice) {
    const paid = payments.filter(p => p.invoice_id === invoice.id).reduce((s, p) => s + p.amount_cents, 0);
    if (paid < invoice.total_cents) throw new ShopRuleError('There’s an unpaid invoice. Record the payment, void it, or release the car on a plan.', undefined, 409);
  }
  const { error } = await access.db.from('shop_jobs').update({
    status: 'closed', closed_reason: reason, closed_at: nowIso(), bay: null, holding_since: null, returned_at: job.returned_at ?? nowIso(),
  }).eq('site_id', access.siteId).eq('id', jobId);
  fail(error, 'Close job');
  await addEvent(access.db, access.siteId, jobId, 'system', {
    actor: access.actor,
    body: `${reason === 'cancelled' ? 'Job cancelled' : 'Closed with no charge'}.${note ? ` ${str(note, 300)}` : ''}`,
  });
  return { ok: true };
}

export async function reopenJob(access: ShopAccess, jobId: string) {
  const detail = await requireJob(access, jobId);
  const { job } = detail;
  if (job.status === 'open') return { ok: true };
  if (job.closed_reason === 'paid' || job.closed_reason === 'released_on_plan') {
    throw new ShopRuleError('Paid and released jobs stay closed. Start a new job for a comeback.', undefined, 409);
  }
  if (job.key_tag) {
    const { data: taken } = await access.db.from('shop_jobs').select('id').eq('site_id', access.siteId).eq('status', 'open').eq('key_tag', job.key_tag).maybeSingle();
    if (taken) await access.db.from('shop_jobs').update({ key_tag: null }).eq('site_id', access.siteId).eq('id', jobId);
  }
  const { error } = await access.db.from('shop_jobs').update({ status: 'open', closed_reason: null, closed_at: null, returned_at: null }).eq('site_id', access.siteId).eq('id', jobId);
  fail(error, 'Reopen job');
  await addEvent(access.db, access.siteId, jobId, 'system', { actor: access.actor, body: 'Job reopened.' });
  return { ok: true };
}

export async function dismissIntake(access: ShopAccess, ref: unknown) {
  const id = str(ref, 80);
  if (!id) throw new ShopRuleError('Nothing to dismiss.', undefined, 400);
  const settings = await ensureSettings(access.db, access.siteId);
  const list = [...new Set([...settings.intake_dismissed, id])].slice(-300);
  const { error } = await access.db.from('shop_settings').update({ intake_dismissed: list }).eq('site_id', access.siteId);
  fail(error, 'Dismiss');
  return { ok: true };
}
