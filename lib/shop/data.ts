/**
 * Server-side reads and small shared writes for the Shop tab.
 * Callers pass the service-role client from requireShopAccess; every query
 * here filters by siteId.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { computeTotals } from './money';
import { addDays, todayISO } from './dates';
import { newTechCode, siteBaseUrl } from './links';
import { invoiceLabel, vehicleLabel } from './board';
import type {
  Authorization, BillLine, Customer, Estimate, EstimateLine, EventKind, ExpectedPart, IntakeItem, Invoice, Job,
  JobDetail, JobEvent, JobSummary, Lien, LienSummary, PartReceived, Payment, ShopSettings, Supplier, SupplierBill,
  Vehicle, Workspace,
} from './types';

type Db = SupabaseClient;

// ── Settings and site ───────────────────────────────────────────────────────

export interface SettingsRow extends Omit<ShopSettings, 'has_tech_pin'> {
  tech_pin_hash: string | null;
  tech_failed_attempts: number;
  tech_locked_until: string | null;
}

export function toPublicSettings(row: SettingsRow): ShopSettings {
  return {
    site_id: row.site_id,
    legal_name: row.legal_name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    hst_number: row.hst_number,
    tax_label: row.tax_label,
    tax_rate_bps: row.tax_rate_bps,
    labour_rate_cents: row.labour_rate_cents,
    estimate_fee_cents: row.estimate_fee_cents,
    estimate_valid_days: row.estimate_valid_days,
    payment_terms: row.payment_terms,
    payment_methods_note: row.payment_methods_note,
    etransfer_email: row.etransfer_email,
    warranty_extra: row.warranty_extra,
    diagnostic_policy: row.diagnostic_policy,
    flat_rate_policy: row.flat_rate_policy,
    parts_commission_policy: row.parts_commission_policy,
    other_charges: row.other_charges,
    bays: Array.isArray(row.bays) && row.bays.length ? row.bays : [{ id: 'bay1', label: 'Bay 1' }, { id: 'bay2', label: 'Bay 2' }],
    staff: Array.isArray(row.staff) ? row.staff : [],
    intake_dismissed: Array.isArray(row.intake_dismissed) ? row.intake_dismissed : [],
    province: row.province,
    key_tag_max: row.key_tag_max,
    tech_code: row.tech_code,
    has_tech_pin: !!row.tech_pin_hash,
  };
}

export async function ensureSettingsRow(db: Db, siteId: string): Promise<SettingsRow> {
  await db.from('shop_settings').upsert({ site_id: siteId }, { onConflict: 'site_id', ignoreDuplicates: true });
  const { data } = await db.from('shop_settings').select('*').eq('site_id', siteId).single();
  let row = data as SettingsRow;
  if (row && !row.tech_code) {
    for (let i = 0; i < 5 && !row.tech_code; i++) {
      await db.from('shop_settings').update({ tech_code: newTechCode() }).eq('site_id', siteId).is('tech_code', null);
      const { data: again } = await db.from('shop_settings').select('*').eq('site_id', siteId).single();
      row = again as SettingsRow;
    }
  }
  return row;
}

export async function ensureSettings(db: Db, siteId: string): Promise<ShopSettings> {
  return toPublicSettings(await ensureSettingsRow(db, siteId));
}

export interface SiteInfo {
  id: string;
  name: string;
  base_url: string;
  stripe: boolean;
  paypal: boolean;
  owner_email: string | null;
  logo_url: string | null;
  custom_domain: string | null;
  published_domain: string | null;
  is_published: boolean;
}

export async function loadSiteInfo(db: Db, siteId: string, settings?: ShopSettings): Promise<SiteInfo> {
  const { data } = await db
    .from('sites')
    .select('id, user_id, site_slug, custom_domain, published_domain, is_published, stripe_account_id, paypal_client_id, paypal_secret, design_data')
    .eq('id', siteId)
    .single();
  const design = (data?.design_data || {}) as Record<string, unknown>;
  let ownerEmail: string | null = null;
  if (data?.user_id) {
    const { data: owner } = await db.from('users').select('email').eq('id', data.user_id).maybeSingle();
    ownerEmail = (owner?.email as string | undefined) ?? null;
  }
  return {
    id: siteId,
    name: settings?.legal_name || data?.site_slug || 'Our shop',
    base_url: siteBaseUrl(data || {}),
    stripe: !!data?.stripe_account_id,
    paypal: !!(data?.paypal_client_id && data?.paypal_secret),
    owner_email: ownerEmail,
    logo_url: (design.headerLogo as string) || (design.siteLogo as string) || null,
    custom_domain: data?.custom_domain ?? null,
    published_domain: data?.published_domain ?? null,
    is_published: !!data?.is_published,
  };
}

// ── Events ──────────────────────────────────────────────────────────────────

export async function addEvent(
  db: Db,
  siteId: string,
  jobId: string,
  kind: EventKind,
  fields: { actor?: string | null; body?: string | null; quote?: string | null; file_path?: string | null; meta?: Record<string, unknown> } = {},
) {
  const { error } = await db.from('shop_job_events').insert({
    site_id: siteId,
    job_id: jobId,
    kind,
    actor: fields.actor ?? null,
    body: fields.body ?? null,
    quote: fields.quote ?? null,
    file_path: fields.file_path ?? null,
    meta: fields.meta ?? {},
  });
  if (error) console.error('[shop] addEvent failed:', error.message);
}

// ── Key tags ────────────────────────────────────────────────────────────────

export async function nextFreeKeyTag(db: Db, siteId: string, max: number): Promise<string | null> {
  const { data } = await db.from('shop_jobs').select('key_tag').eq('site_id', siteId).eq('status', 'open');
  const used = new Set((data || []).map(r => String(r.key_tag ?? '')));
  for (let i = 1; i <= max; i++) {
    const tag = String(i).padStart(2, '0');
    if (!used.has(tag) && !used.has(String(i))) return tag;
  }
  return null;
}

// ── Parts matching ──────────────────────────────────────────────────────────

const normPart = (s: string | null | undefined) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const words = (s: string | null | undefined) =>
  new Set((s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !['with', 'left', 'right', 'front', 'rear', 'part'].includes(w)));

export function similarDescriptions(a: string, b: string): boolean {
  const wa = words(a), wb = words(b);
  if (!wa.size || !wb.size) return false;
  let shared = 0;
  wa.forEach(w => { if (wb.has(w)) shared++; });
  return shared / Math.min(wa.size, wb.size) >= 0.5;
}

export function matchExpectedParts(lines: EstimateLine[], received: Pick<BillLine, 'description' | 'part_number' | 'is_core'>[]): ExpectedPart[] {
  const pool = received.filter(r => !r.is_core).map(r => ({ ...r, used: false }));
  return lines
    .filter(l => l.kind === 'part' && l.decision === 'include')
    .map(l => {
      const fromStock = !l.supplier_id;
      const pn = normPart(l.part_number);
      let hit = pn ? pool.find(r => !r.used && normPart(r.part_number) === pn) : undefined;
      if (!hit) hit = pool.find(r => !r.used && similarDescriptions(r.description, l.description));
      if (hit) hit.used = true;
      return {
        line_id: l.id,
        description: l.description,
        part_number: l.part_number,
        supplier_id: l.supplier_id,
        eta: l.eta,
        received: !!hit || fromStock,
        from_stock: fromStock,
      };
    });
}

// ── Workspace (board, desk) ────────────────────────────────────────────────

interface JobRowWithRefs extends Job {
  customer: Customer;
  vehicle: Vehicle;
}

function sortEstimates(list: Estimate[]): Estimate[] {
  return list
    .map(e => ({ ...e, lines: [...(e.lines || [])].sort((a, b) => a.position - b.position) }))
    .sort((a, b) => a.version - b.version);
}

export async function loadEstimatesForJobs(db: Db, siteId: string, jobIds: string[]): Promise<Map<string, Estimate[]>> {
  const map = new Map<string, Estimate[]>();
  if (!jobIds.length) return map;
  const { data } = await db
    .from('shop_estimates')
    .select('*, lines:shop_estimate_lines(*)')
    .eq('site_id', siteId)
    .in('job_id', jobIds);
  for (const e of (data || []) as Estimate[]) {
    const list = map.get(e.job_id) || [];
    list.push(e);
    map.set(e.job_id, list);
  }
  map.forEach((list, k) => map.set(k, sortEstimates(list)));
  return map;
}

export function summarizeJob(
  j: JobRowWithRefs,
  estimates: Estimate[],
  invoice: (Invoice & { paid_cents: number }) | null,
  received: BillLine[],
  lastVoiceAt: string | null,
  taxBps: number,
): JobSummary {
  const latest = estimates[estimates.length - 1] ?? null;
  const approved = estimates.find(e => e.status === 'approved') ?? null;
  const revision = estimates.find(e => e.is_revision && (e.status === 'draft' || e.status === 'sent')) ?? null;
  const latestTotals = latest ? computeTotals(latest.lines, taxBps) : null;
  const approvedTotal = approved ? computeTotals(approved.lines, taxBps).total_cents : 0;
  const expected = matchExpectedParts((approved ?? latest)?.lines ?? [], received).filter(p => !p.from_stock);
  const missing = expected.filter(p => !p.received);
  return {
    id: j.id,
    ro_number: j.ro_number,
    key_tag: j.key_tag,
    stage: j.stage,
    bay: j.bay,
    sort_order: j.sort_order,
    assigned_tech: j.assigned_tech,
    complaint: j.complaint,
    source: j.source,
    next_step: j.next_step,
    holding_since: j.holding_since,
    created_at: j.created_at,
    updated_at: j.updated_at,
    status: j.status,
    customer: {
      id: j.customer.id, name: j.customer.name, phone: j.customer.phone, email: j.customer.email,
      preferences: j.customer.preferences, customer_type: j.customer.customer_type,
    },
    vehicle: {
      id: j.vehicle.id, year: j.vehicle.year, make: j.vehicle.make, model: j.vehicle.model, trim: j.vehicle.trim,
      plate: j.vehicle.plate, color: j.vehicle.color, vin: j.vehicle.vin,
    },
    estimate: latest && latestTotals ? {
      id: latest.id, version: latest.version, status: latest.status, is_revision: latest.is_revision,
      total_cents: latestTotals.total_cents, needs_price: latestTotals.needs_price, sent_at: latest.sent_at,
    } : null,
    approved: approved ? { id: approved.id, version: approved.version, total_cents: approvedTotal } : null,
    pending_revision: revision ? {
      id: revision.id,
      version: revision.version,
      added_cents: computeTotals(revision.lines, taxBps).total_cents - approvedTotal,
      added_lines: revision.lines.filter(l => l.is_added_work && l.decision === 'include').length,
    } : null,
    parts: { expected: expected.length, received: expected.length - missing.length, next_eta: missing.find(p => p.eta)?.eta ?? null },
    invoice: invoice ? {
      id: invoice.id, number: invoice.invoice_number, total_cents: invoice.total_cents, paid_cents: invoice.paid_cents,
      balance_cents: invoice.total_cents - invoice.paid_cents, issued_at: invoice.issued_at,
    } : null,
    voice_ready: !!latest && latest.status === 'draft' && latest.needs_review,
    last_voice_at: lastVoiceAt,
  };
}

async function loadActiveInvoices(db: Db, siteId: string, jobIds: string[]) {
  const map = new Map<string, Invoice & { paid_cents: number }>();
  if (!jobIds.length) return map;
  const { data: invoices } = await db.from('shop_invoices').select('*').eq('site_id', siteId).eq('status', 'issued').in('job_id', jobIds);
  const list = (invoices || []) as Invoice[];
  const paid = await paidByInvoice(db, siteId, list.map(i => i.id));
  for (const inv of list) map.set(inv.job_id, { ...inv, paid_cents: paid.get(inv.id) ?? 0 });
  return map;
}

export async function paidByInvoice(db: Db, siteId: string, invoiceIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!invoiceIds.length) return map;
  const { data } = await db.from('shop_payments').select('invoice_id, amount_cents').eq('site_id', siteId).in('invoice_id', invoiceIds);
  for (const p of data || []) map.set(p.invoice_id, (map.get(p.invoice_id) ?? 0) + p.amount_cents);
  return map;
}

export async function loadJobSummaries(db: Db, siteId: string, settings: ShopSettings, filter: { status?: 'open'; ids?: string[] } = { status: 'open' }): Promise<JobSummary[]> {
  let q = db
    .from('shop_jobs')
    .select('*, customer:shop_customers(*), vehicle:shop_vehicles(*)')
    .eq('site_id', siteId);
  if (filter.status) q = q.eq('status', filter.status);
  if (filter.ids) q = q.in('id', filter.ids.length ? filter.ids : ['00000000-0000-0000-0000-000000000000']);
  const { data: jobRows } = await q.order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  const jobs = (jobRows || []) as JobRowWithRefs[];
  const ids = jobs.map(j => j.id);
  const [estimates, invoices, billLines, voice] = await Promise.all([
    loadEstimatesForJobs(db, siteId, ids),
    loadActiveInvoices(db, siteId, ids),
    ids.length ? db.from('shop_supplier_bill_lines').select('*').eq('site_id', siteId).in('job_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? db.from('shop_job_events').select('job_id, created_at').eq('site_id', siteId).eq('kind', 'voice').in('job_id', ids).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const linesByJob = new Map<string, BillLine[]>();
  for (const l of (billLines.data || []) as BillLine[]) {
    if (!l.job_id) continue;
    linesByJob.set(l.job_id, [...(linesByJob.get(l.job_id) || []), l]);
  }
  const lastVoice = new Map<string, string>();
  for (const e of (voice.data || []) as { job_id: string; created_at: string }[]) {
    if (!lastVoice.has(e.job_id)) lastVoice.set(e.job_id, e.created_at);
  }
  return jobs.map(j => summarizeJob(j, estimates.get(j.id) || [], invoices.get(j.id) || null, linesByJob.get(j.id) || [], lastVoice.get(j.id) ?? null, settings.tax_rate_bps));
}

export async function loadLiens(db: Db, siteId: string, statuses: Lien['status'][] = ['active', 'paid']): Promise<LienSummary[]> {
  const { data } = await db
    .from('shop_liens')
    .select('*, job:shop_jobs(ro_number, customer:shop_customers(name), vehicle:shop_vehicles(year, make, model, vin)), invoice:shop_invoices(invoice_number, total_cents)')
    .eq('site_id', siteId)
    .in('status', statuses)
    .order('released_at', { ascending: false });
  const rows = (data || []) as (Lien & {
    job: { ro_number: number; customer: { name: string }; vehicle: { year: number | null; make: string | null; model: string | null; vin: string | null } };
    invoice: { invoice_number: number; total_cents: number };
  })[];
  const paid = await paidByInvoice(db, siteId, rows.map(r => r.invoice_id));
  const planPaidRes = rows.length
    ? await db.from('shop_payments').select('lien_id, amount_cents').eq('site_id', siteId).in('lien_id', rows.map(r => r.id))
    : { data: [] };
  const planPaid = new Map<string, number>();
  for (const p of (planPaidRes.data || []) as { lien_id: string; amount_cents: number }[]) {
    planPaid.set(p.lien_id, (planPaid.get(p.lien_id) ?? 0) + p.amount_cents);
  }
  const today = todayISO();
  return rows.map(r => {
    const balance = r.invoice.total_cents - (paid.get(r.invoice_id) ?? 0);
    const nextDue = nextScheduleItem(r.schedule || [], planPaid.get(r.id) ?? 0);
    const { job, invoice, ...lien } = r;
    return {
      ...lien,
      customer_name: job.customer.name,
      vehicle_label: vehicleLabel(job.vehicle),
      vin: job.vehicle.vin,
      invoice_label: invoiceLabel(invoice.invoice_number),
      balance_cents: balance,
      next_due: balance > 0 ? nextDue : null,
      overdue: balance > 0 && !!nextDue && nextDue.due < today,
    };
  });
}

/** The next unpaid schedule item, reduced by what's been paid so far. */
export function nextScheduleItem(schedule: { due: string; amount_cents: number }[], paidTowardPlan: number) {
  let cumulative = 0;
  for (const item of schedule) {
    cumulative += item.amount_cents;
    if (cumulative > paidTowardPlan) {
      return { due: item.due, amount_cents: Math.min(item.amount_cents, cumulative - paidTowardPlan) };
    }
  }
  return null;
}

export async function loadIntake(db: Db, siteId: string, dismissed: string[]): Promise<IntakeItem[]> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const today = todayISO();
  const [forms, bookings] = await Promise.all([
    db.from('contact_submissions')
      .select('id, sender_name, sender_email, sender_phone, message, created_at, source_type, status')
      .eq('site_id', siteId)
      .eq('direction', 'inbound')
      .in('source_type', ['estimate_form', 'contact_form'])
      .neq('status', 'spam')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(40),
    db.from('bookings')
      .select('id, customer_name, customer_email, customer_phone, booking_date, start_time, notes, status, service:booking_services(name)')
      .eq('site_id', siteId)
      .in('status', ['pending', 'confirmed'])
      .gte('booking_date', addDays(today, -1))
      .lte('booking_date', addDays(today, 14))
      .order('booking_date', { ascending: true })
      .limit(40),
  ]);
  const items: IntakeItem[] = [];
  for (const f of forms.data || []) {
    items.push({
      ref: String(f.id), kind: 'website_form', name: f.sender_name || 'Website visitor', email: f.sender_email || null,
      phone: f.sender_phone || null, message: f.message || '', when: f.created_at,
      detail: f.source_type === 'estimate_form' ? 'Estimate request' : 'Contact form',
    });
  }
  for (const b of (bookings.data || []) as unknown as {
    id: string; customer_name: string; customer_email: string | null; customer_phone: string | null;
    booking_date: string; start_time: string; notes: string | null; service: { name: string } | { name: string }[] | null;
  }[]) {
    const service = Array.isArray(b.service) ? b.service[0]?.name : b.service?.name;
    items.push({
      ref: String(b.id), kind: 'booking', name: b.customer_name, email: b.customer_email, phone: b.customer_phone,
      message: [service, b.notes].filter(Boolean).join(' · ') || 'Booked appointment',
      when: `${b.booking_date}T${b.start_time}`, detail: `Booked ${b.booking_date} ${String(b.start_time).slice(0, 5)}`,
    });
  }
  const refs = items.map(i => i.ref);
  if (!refs.length) return [];
  const { data: used } = await db.from('shop_jobs').select('source_ref').eq('site_id', siteId).in('source_ref', refs);
  const usedSet = new Set((used || []).map(u => u.source_ref));
  const hidden = new Set(dismissed);
  return items.filter(i => !usedSet.has(i.ref) && !hidden.has(i.ref));
}

export async function loadWorkspace(db: Db, siteId: string): Promise<Workspace> {
  const settings = await ensureSettings(db, siteId);
  const [site, jobs, suppliers, pile, liens, intake] = await Promise.all([
    loadSiteInfo(db, siteId, settings),
    loadJobSummaries(db, siteId, settings),
    db.from('shop_suppliers').select('*').eq('site_id', siteId).is('archived_at', null).order('name'),
    db.from('shop_supplier_bills').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'needs_match'),
    loadLiens(db, siteId),
    loadIntake(db, siteId, settings.intake_dismissed),
  ]);
  return {
    settings,
    jobs,
    suppliers: (suppliers.data || []) as Supplier[],
    pile_count: pile.count ?? 0,
    liens,
    intake,
    site: { name: site.name, base_url: site.base_url, stripe: site.stripe, paypal: site.paypal },
  };
}

// ── Job file ────────────────────────────────────────────────────────────────

export async function loadJobDetail(db: Db, siteId: string, jobId: string): Promise<JobDetail | null> {
  const { data: jobRow } = await db
    .from('shop_jobs')
    .select('*, customer:shop_customers(*), vehicle:shop_vehicles(*)')
    .eq('site_id', siteId)
    .eq('id', jobId)
    .maybeSingle();
  if (!jobRow) return null;
  const { customer, vehicle, ...job } = jobRow as JobRowWithRefs;
  const settings = await ensureSettings(db, siteId);
  const [site, estimatesMap, auths, events, billLines, invoices, suppliers, lien, history] = await Promise.all([
    loadSiteInfo(db, siteId, settings),
    loadEstimatesForJobs(db, siteId, [jobId]),
    db.from('shop_authorizations').select('*').eq('site_id', siteId).eq('job_id', jobId).order('authorized_at'),
    db.from('shop_job_events').select('*').eq('site_id', siteId).eq('job_id', jobId).order('created_at'),
    db.from('shop_supplier_bill_lines').select('*, bill:shop_supplier_bills(invoice_number, invoice_date, file_path, supplier_name_raw, supplier:shop_suppliers(name))').eq('site_id', siteId).eq('job_id', jobId).order('created_at'),
    db.from('shop_invoices').select('*').eq('site_id', siteId).eq('job_id', jobId).order('issued_at'),
    db.from('shop_suppliers').select('*').eq('site_id', siteId).order('name'),
    db.from('shop_liens').select('*').eq('site_id', siteId).eq('job_id', jobId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('shop_jobs').select('id, ro_number, created_at, status').eq('site_id', siteId).eq('vehicle_id', (jobRow as Job).vehicle_id).neq('id', jobId).order('created_at', { ascending: false }).limit(20),
  ]);
  const estimates = estimatesMap.get(jobId) || [];
  const allInvoices = (invoices.data || []) as Invoice[];
  const active = allInvoices.find(i => i.status === 'issued') ?? null;
  const payments = allInvoices.length
    ? ((await db.from('shop_payments').select('*').eq('site_id', siteId).in('invoice_id', allInvoices.map(i => i.id)).order('received_at')).data || []) as Payment[]
    : [];
  const received: PartReceived[] = ((billLines.data || []) as (BillLine & {
    bill: { invoice_number: string | null; invoice_date: string | null; file_path: string | null; supplier_name_raw: string | null; supplier: { name: string } | null } | null;
  })[]).map(({ bill, ...l }) => ({
    ...l,
    bill_invoice_number: bill?.invoice_number ?? null,
    bill_invoice_date: bill?.invoice_date ?? null,
    supplier_name: bill?.supplier?.name ?? bill?.supplier_name_raw ?? null,
    bill_file_path: bill?.file_path ?? null,
  }));
  const approved = estimates.find(e => e.status === 'approved') ?? null;
  const latest = estimates[estimates.length - 1] ?? null;
  return {
    job: job as Job,
    customer,
    vehicle,
    estimates,
    authorizations: (auths.data || []) as Authorization[],
    events: (events.data || []) as JobEvent[],
    parts_received: received,
    parts_expected: matchExpectedParts((approved ?? latest)?.lines ?? [], received),
    invoice: active,
    void_invoices: allInvoices.filter(i => i.status === 'void'),
    payments,
    lien: (lien.data as Lien | null) ?? null,
    suppliers: (suppliers.data || []) as Supplier[],
    settings,
    site: { name: site.name, base_url: site.base_url, stripe: site.stripe, paypal: site.paypal },
    other_jobs: (history.data || []) as JobDetail['other_jobs'],
  };
}

// ── Supplier bills ─────────────────────────────────────────────────────────

export async function loadBills(db: Db, siteId: string, opts: { status?: SupplierBill['status'][]; since?: string; ids?: string[] } = {}): Promise<SupplierBill[]> {
  let q = db.from('shop_supplier_bills').select('*, lines:shop_supplier_bill_lines(*)').eq('site_id', siteId);
  if (opts.status) q = q.in('status', opts.status);
  if (opts.since) q = q.gte('created_at', opts.since);
  if (opts.ids) q = q.in('id', opts.ids.length ? opts.ids : ['00000000-0000-0000-0000-000000000000']);
  const { data } = await q.order('created_at', { ascending: false }).limit(200);
  return ((data || []) as SupplierBill[]).map(b => ({ ...b, lines: [...(b.lines || [])].sort((a, c) => a.position - c.position) }));
}
