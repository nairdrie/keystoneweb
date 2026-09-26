/**
 * Estimates: versions, revisions for extra work, sending, approvals and
 * declines. The Ontario rules are checked here, not just in the UI:
 *   - a written estimate with every required item before the customer sees it (CPA s. 56, O. Reg. 17/05 s. 48)
 *   - an approval record with who, when and how (ss. 58–59, s. 49)
 *   - extra work goes on a revised estimate that needs its own approval (s. 58(2))
 */

import type { NextRequest } from 'next/server';
import { ShopRuleError, type ShopAccess } from '../access';
import { addEvent, loadSiteInfo, type SiteInfo } from '../data';
import { computeTotals, formatCents } from '../money';
import { authProblems, estimateProblems, methodLabel } from '../rules';
import { addDays, formatDate, todayISO } from '../dates';
import { buildEstimateDoc, estimateNumber } from '../documents';
import { estimatePdf } from '../pdf';
import { docUrl, newPublicToken } from '../links';
import { sendShopEmail } from '../mail';
import { storeSignature } from '../files';
import { vehicleLabel } from '../board';
import type { DraftLine } from '../ai';
import type { Alternate, AuthMethod, Estimate, EstimateLine, JobDetail, LineKind, PartCondition } from '../types';
import { checkedTime, clientIp, fail, isIsoDate, isUuid, jobIdForEstimate, nowIso, num, int, requireJob, str } from './common';

const KINDS: LineKind[] = ['labour', 'part', 'supply', 'fee', 'discount', 'sublet'];
const CONDITIONS: PartCondition[] = ['new_oem', 'new_non_oem', 'used', 'reconditioned'];
const METHODS: AuthMethod[] = ['phone', 'in_person', 'online', 'email', 'text'];

type LineRow = Omit<EstimateLine, 'id' | 'estimate_id'>;

interface LineCtx { supplierIds: Set<string>; actor: string; today: string }

function cleanAlternates(v: unknown, ctx: LineCtx): Alternate[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 10).map(a => {
    const r = (a || {}) as Record<string, unknown>;
    return {
      description: str(r.description, 300) || 'Option',
      supplier_id: isUuid(r.supplier_id) && ctx.supplierIds.has(r.supplier_id) ? r.supplier_id : null,
      part_number: str(r.part_number, 80),
      condition: CONDITIONS.includes(r.condition as PartCondition) ? (r.condition as PartCondition) : null,
      unit_price_cents: int(r.unit_price_cents),
      unit_cost_cents: int(r.unit_cost_cents),
      note: str(r.note, 300),
    };
  });
}

export function cleanLine(raw: Record<string, unknown>, position: number, ctx: LineCtx): LineRow {
  const kind = (KINDS.includes(raw.kind as LineKind) ? raw.kind : 'labour') as LineKind;
  const nonNeg = (v: unknown) => { const n = int(v); return n == null ? null : Math.max(0, n); };
  const qtyRaw = num(raw.qty);
  const hoursRaw = num(raw.hours);
  const supplierId = isUuid(raw.supplier_id) && ctx.supplierIds.has(raw.supplier_id) ? raw.supplier_id : null;
  const unitPrice = kind === 'part' ? nonNeg(raw.unit_price_cents) : null;
  const unitCost = kind === 'part' || kind === 'sublet' ? nonNeg(raw.unit_cost_cents) : null;
  let amount: number | null = null;
  if (kind === 'discount') { const a = int(raw.amount_cents); amount = a == null ? null : -Math.abs(a); }
  else if (kind === 'supply' || kind === 'fee' || kind === 'sublet') amount = nonNeg(raw.amount_cents);
  // Part-source memory: when a supplier and a price are on the line, remember when and who quoted it.
  const hasQuote = kind === 'part' && !!supplierId && (unitCost != null || unitPrice != null);
  const quotedAt = isIsoDate(raw.quoted_at) ? raw.quoted_at : hasQuote ? ctx.today : null;
  return {
    position,
    kind,
    description: str(raw.description, 500) || '',
    decision: raw.decision === 'declined' ? 'declined' : 'include',
    qty: kind === 'part' && qtyRaw != null && qtyRaw > 0 ? Math.round(qtyRaw * 100) / 100 : 1,
    hours: kind === 'labour' && hoursRaw != null && hoursRaw >= 0 ? Math.round(hoursRaw * 100) / 100 : null,
    rate_cents: kind === 'labour' ? nonNeg(raw.rate_cents) : null,
    unit_price_cents: unitPrice,
    amount_cents: amount,
    unit_cost_cents: unitCost,
    supplier_id: kind === 'part' || kind === 'sublet' ? supplierId : null,
    part_number: kind === 'part' ? str(raw.part_number, 80) : null,
    brand: kind === 'part' ? str(raw.brand, 80) : null,
    condition: kind === 'part' && CONDITIONS.includes(raw.condition as PartCondition) ? (raw.condition as PartCondition) : null,
    quoted_at: quotedAt,
    quoted_by: str(raw.quoted_by, 80) || (hasQuote ? ctx.actor : null),
    eta: str(raw.eta, 40),
    core_charge_cents: kind === 'part' ? nonNeg(raw.core_charge_cents) : null,
    no_warranty: raw.no_warranty === true,
    is_added_work: raw.is_added_work === true,
    alternates: kind === 'part' ? cleanAlternates(raw.alternates, ctx) : [],
    ordered_at: typeof raw.ordered_at === 'string' && !Number.isNaN(Date.parse(raw.ordered_at)) ? new Date(raw.ordered_at).toISOString() : null,
  };
}

async function supplierIdSet(access: ShopAccess): Promise<Set<string>> {
  const { data } = await access.db.from('shop_suppliers').select('id').eq('site_id', access.siteId);
  return new Set((data || []).map(s => s.id as string));
}

function findEstimate(detail: JobDetail, estimateId: string): Estimate {
  const est = detail.estimates.find(e => e.id === estimateId);
  if (!est) throw new ShopRuleError('Estimate not found.', undefined, 404);
  return est;
}

function copyLine(l: EstimateLine, position: number): LineRow {
  const { id: _id, estimate_id: _e, ...rest } = l;
  void _id; void _e;
  return { ...rest, position };
}

async function insertEstimate(access: ShopAccess, detail: JobDetail, opts: { isRevision: boolean; lines: LineRow[]; needsReview?: boolean; notes?: string | null; readyBy?: string | null }) {
  const version = detail.estimates.reduce((m, e) => Math.max(m, e.version), 0) + 1;
  const { data: est, error } = await access.db.from('shop_estimates').insert({
    site_id: access.siteId,
    job_id: detail.job.id,
    version,
    status: 'draft',
    is_revision: opts.isRevision,
    needs_review: !!opts.needsReview,
    notes: opts.notes ?? null,
    ready_by: opts.readyBy ?? null,
  }).select('id').single();
  fail(error, 'Create estimate');
  if (opts.lines.length) {
    const { error: lineErr } = await access.db.from('shop_estimate_lines').insert(
      opts.lines.map(l => ({ ...l, site_id: access.siteId, estimate_id: est!.id })),
    );
    fail(lineErr, 'Copy estimate lines');
  }
  return { id: est!.id as string, version };
}

/** Open the estimate the desk should be editing, creating a draft if needed. */
export async function startEstimate(access: ShopAccess, jobId: string): Promise<{ id: string }> {
  const detail = await requireJob(access, jobId);
  const approved = detail.estimates.find(e => e.status === 'approved');
  if (approved) return createRevision(access, jobId, [], { detail });
  const draft = detail.estimates.find(e => e.status === 'draft' && !e.is_revision);
  if (draft) return { id: draft.id };
  const latest = detail.estimates[detail.estimates.length - 1];
  if (latest) return newVersion(access, latest.id, { detail });
  const est = await insertEstimate(access, detail, { isRevision: false, lines: [] });
  await addEvent(access.db, access.siteId, jobId, 'estimate', { actor: access.actor, body: 'Estimate v1 started.' });
  return { id: est.id };
}

/** Copy an estimate into a new draft version (e.g. after the customer negotiates). */
export async function newVersion(access: ShopAccess, estimateId: string, opts: { detail?: JobDetail } = {}): Promise<{ id: string }> {
  const detail = opts.detail ?? (await requireJob(access, await jobIdForEstimate(access, estimateId)));
  const source = findEstimate(detail, estimateId);
  if (source.status === 'approved') return createRevision(access, detail.job.id, [], { detail });
  const draft = detail.estimates.find(e => e.status === 'draft' && e.is_revision === source.is_revision);
  if (draft) return { id: draft.id };
  const est = await insertEstimate(access, detail, {
    isRevision: source.is_revision,
    lines: source.lines.map((l, i) => copyLine(l, i)),
    notes: source.notes,
    readyBy: source.ready_by && source.ready_by >= todayISO() ? source.ready_by : null,
  });
  await addEvent(access.db, access.siteId, detail.job.id, 'estimate', { actor: access.actor, body: `Estimate v${est.version} started from v${source.version}.` });
  return { id: est.id };
}

/**
 * Extra work on an approved job becomes a revised estimate: the approved lines
 * plus the added ones, which the customer has to approve before it's billed.
 */
export async function createRevision(access: ShopAccess, jobId: string, added: LineRow[], opts: { detail?: JobDetail; needsReview?: boolean } = {}): Promise<{ id: string; added: number }> {
  const detail = opts.detail ?? (await requireJob(access, jobId));
  const approved = detail.estimates.find(e => e.status === 'approved');
  if (!approved) throw new ShopRuleError('There’s no approved estimate to add work to.', undefined, 409);
  if (detail.invoice) throw new ShopRuleError('This job is already invoiced. Void the invoice before adding work.', undefined, 409);
  const existing = detail.estimates.find(e => e.is_revision && e.status === 'draft');
  if (existing) {
    if (added.length) {
      const start = existing.lines.length;
      const { error } = await access.db.from('shop_estimate_lines').insert(
        added.map((l, i) => ({ ...l, position: start + i, is_added_work: true, site_id: access.siteId, estimate_id: existing.id })),
      );
      fail(error, 'Add lines');
      if (opts.needsReview) await access.db.from('shop_estimates').update({ needs_review: true }).eq('site_id', access.siteId).eq('id', existing.id);
    }
    return { id: existing.id, added: added.length };
  }
  const base = approved.lines.map((l, i) => copyLine(l, i));
  const est = await insertEstimate(access, detail, {
    isRevision: true,
    lines: [...base, ...added.map((l, i) => ({ ...l, position: base.length + i, is_added_work: true }))],
    needsReview: opts.needsReview,
    notes: approved.notes,
    readyBy: approved.ready_by && approved.ready_by >= todayISO() ? approved.ready_by : null,
  });
  await addEvent(access.db, access.siteId, jobId, 'estimate', {
    actor: access.actor,
    body: `Revised estimate v${est.version} started for extra work. It needs the customer’s approval before it goes on the bill.`,
  });
  return { id: est.id, added: added.length };
}

export interface SaveEstimateInput {
  lines?: unknown;
  valid_until?: unknown;
  ready_by?: unknown;
  notes?: unknown;
}

export async function saveEstimate(access: ShopAccess, estimateId: string, input: SaveEstimateInput): Promise<Estimate> {
  const detail = await requireJob(access, await jobIdForEstimate(access, estimateId));
  const est = findEstimate(detail, estimateId);
  if (est.status !== 'draft') {
    throw new ShopRuleError(est.status === 'sent'
      ? 'This version was already given to the customer. Make a new version to change it.'
      : 'This estimate can’t be changed anymore. Make a new version.', undefined, 409);
  }
  const { db, siteId } = access;
  const patch: Record<string, unknown> = { needs_review: false };
  if (input.valid_until !== undefined) patch.valid_until = isIsoDate(input.valid_until) ? input.valid_until : null;
  if (input.ready_by !== undefined) patch.ready_by = isIsoDate(input.ready_by) ? input.ready_by : null;
  if (input.notes !== undefined) patch.notes = str(input.notes, 2000);
  const { error } = await db.from('shop_estimates').update(patch).eq('site_id', siteId).eq('id', estimateId);
  fail(error, 'Save estimate');

  if (Array.isArray(input.lines)) {
    if (input.lines.length > 200) throw new ShopRuleError('That’s too many lines for one estimate.', undefined, 400);
    const ctx: LineCtx = { supplierIds: await supplierIdSet(access), actor: access.actor, today: todayISO() };
    const existingIds = new Set(est.lines.map(l => l.id));
    const updates: (LineRow & { id: string; site_id: string; estimate_id: string })[] = [];
    const inserts: (LineRow & { site_id: string; estimate_id: string })[] = [];
    (input.lines as Record<string, unknown>[]).forEach((raw, i) => {
      const row = cleanLine(raw || {}, i, ctx);
      // Revisions: the approved lines stay as approved; only added work is new.
      const id = isUuid(raw?.id) && existingIds.has(raw.id) ? raw.id : null;
      if (id) updates.push({ ...row, id, site_id: siteId, estimate_id: estimateId });
      else inserts.push({ ...row, is_added_work: est.is_revision ? true : row.is_added_work, site_id: siteId, estimate_id: estimateId });
    });
    const keep = new Set(updates.map(u => u.id));
    const remove = est.lines.filter(l => !keep.has(l.id)).map(l => l.id);
    if (remove.length) {
      const { error: delErr } = await db.from('shop_estimate_lines').delete().eq('site_id', siteId).eq('estimate_id', estimateId).in('id', remove);
      fail(delErr, 'Remove lines');
    }
    if (updates.length) {
      const { error: upErr } = await db.from('shop_estimate_lines').upsert(updates, { onConflict: 'id' });
      fail(upErr, 'Save lines');
    }
    if (inserts.length) {
      const { error: insErr } = await db.from('shop_estimate_lines').insert(inserts);
      fail(insErr, 'Add lines');
    }
  }
  const fresh = await requireJob(access, detail.job.id);
  return findEstimate(fresh, estimateId);
}

export async function deleteEstimate(access: ShopAccess, estimateId: string) {
  const detail = await requireJob(access, await jobIdForEstimate(access, estimateId));
  const est = findEstimate(detail, estimateId);
  if (est.status !== 'draft') throw new ShopRuleError('Only drafts can be deleted. Sent estimates stay on file.', undefined, 409);
  const { error } = await access.db.from('shop_estimates').delete().eq('site_id', access.siteId).eq('id', estimateId);
  fail(error, 'Delete estimate');
  await addEvent(access.db, access.siteId, detail.job.id, 'estimate', {
    actor: access.actor,
    body: est.is_revision ? `Revised estimate v${est.version} deleted. The extra work won’t be billed.` : `Draft v${est.version} deleted.`,
  });
  return { ok: true };
}

export async function estimateDocFor(access: ShopAccess, detail: JobDetail, est: Estimate, site?: SiteInfo) {
  const info = site ?? (await loadSiteInfo(access.db, access.siteId, detail.settings));
  return buildEstimateDoc({ estimate: est, job: detail.job, customer: detail.customer, vehicle: detail.vehicle, settings: detail.settings, site: info });
}

export async function estimatePdfFor(access: ShopAccess, estimateId: string): Promise<{ buffer: Buffer; filename: string }> {
  const detail = await requireJob(access, await jobIdForEstimate(access, estimateId));
  const est = findEstimate(detail, estimateId);
  const doc = await estimateDocFor(access, detail, est);
  return { buffer: await estimatePdf(doc), filename: `${doc.number_label}.pdf` };
}

function problemsFor(detail: JobDetail, est: Estimate, site: SiteInfo, validUntil: string | null, readyBy: string | null) {
  return estimateProblems({
    estimate: { valid_until: validUntil, ready_by: readyBy },
    lines: est.lines,
    job: detail.job,
    customer: detail.customer,
    vehicle: detail.vehicle,
    settings: detail.settings,
    shopName: site.name,
  });
}

export interface SendEstimateInput {
  via?: unknown;
  to?: unknown;
  message?: unknown;
  valid_until?: unknown;
  ready_by?: unknown;
}

/** Give the customer the written estimate: email (PDF + approval link), in person, or a link to text. */
export async function sendEstimate(access: ShopAccess, estimateId: string, input: SendEstimateInput): Promise<{ url: string; emailed: boolean; estimate_id: string }> {
  const detail = await requireJob(access, await jobIdForEstimate(access, estimateId));
  const est = findEstimate(detail, estimateId);
  const { db, siteId } = access;
  const via = (['email', 'in_person', 'text', 'link'].includes(String(input.via)) ? input.via : 'email') as 'email' | 'in_person' | 'text' | 'link';
  if (est.status !== 'draft' && est.status !== 'sent') {
    throw new ShopRuleError(`This estimate was ${est.status}. Make a new version to send.`, undefined, 409);
  }
  if (est.is_revision && !detail.estimates.some(e => e.status === 'approved')) {
    throw new ShopRuleError('The approved estimate this revision adds to is gone. Start a new estimate.', undefined, 409);
  }
  const site = await loadSiteInfo(db, siteId, detail.settings);
  const today = todayISO();
  const validUntil = est.status === 'draft' && isIsoDate(input.valid_until) ? input.valid_until : est.valid_until || addDays(today, detail.settings.estimate_valid_days);
  const readyBy = est.status === 'draft' && isIsoDate(input.ready_by) ? input.ready_by : est.ready_by;
  const problems = problemsFor(detail, est, site, validUntil, readyBy);
  if (problems.length) throw new ShopRuleError('Before the customer sees this estimate, add:', problems.map(p => p.message));
  if (validUntil < today) throw new ShopRuleError(`This estimate expired on ${formatDate(validUntil)}. Change the date or make a new version.`, undefined, 409);

  const token = est.public_token || newPublicToken();
  const url = docUrl(site, token);
  const sentEst: Estimate = { ...est, valid_until: validUntil, ready_by: readyBy, sent_at: est.sent_at ?? nowIso() };
  const doc = await estimateDocFor(access, detail, sentEst, site);
  let emailed = false;
  if (via === 'email') {
    const to = str(input.to, 200)?.toLowerCase() || detail.customer.email;
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new ShopRuleError('Add the customer’s email address to send it.', undefined, 400);
    const pdf = await estimatePdf(doc);
    const car = vehicleLabel(detail.vehicle);
    const first = detail.customer.name.split(' ')[0];
    const result = await sendShopEmail(db, siteId, {
      to,
      subject: `${doc.title === 'REVISED ESTIMATE' ? 'Revised estimate' : 'Estimate'} for your ${car} · ${formatCents(doc.totals.total_cents)}`,
      heading: doc.title === 'REVISED ESTIMATE' ? 'Your revised estimate' : 'Your estimate',
      paragraphs: [
        `Hi ${first},`,
        str(input.message, 2000) || (doc.title === 'REVISED ESTIMATE'
          ? `While working on your ${car} we found more that needs doing. Here’s the revised estimate. Nothing extra gets done or charged until you approve it.`
          : `Here’s the estimate for your ${car}. You can approve it (or pick the items you want) online, or reply to this email.`),
        `Estimated total: ${formatCents(doc.totals.total_cents)} including ${doc.tax_label}. Good until ${formatDate(validUntil)}.`,
        doc.ten_percent_statement,
      ],
      button: { label: 'Review and approve', url },
      attachments: [{ filename: `${doc.number_label}.pdf`, content: pdf }],
      shopName: doc.shop.name,
      logoUrl: site.logo_url,
    });
    if (!result.ok) throw new ShopRuleError(result.error || 'The email didn’t send.', undefined, 502);
    emailed = true;
    if (!detail.customer.email) await db.from('shop_customers').update({ email: to }).eq('site_id', siteId).eq('id', detail.customer.id);
  }

  const { error } = await db.from('shop_estimates').update({
    status: 'sent',
    sent_at: est.sent_at ?? nowIso(),
    sent_via: est.sent_via ?? via,
    valid_until: validUntil,
    ready_by: readyBy,
    public_token: token,
    needs_review: false,
  }).eq('site_id', siteId).eq('id', estimateId);
  fail(error, 'Mark estimate sent');
  const others = detail.estimates.filter(e => e.id !== est.id && (e.status === 'draft' || e.status === 'sent') && e.is_revision === est.is_revision).map(e => e.id);
  if (others.length) await db.from('shop_estimates').update({ status: 'replaced' }).eq('site_id', siteId).in('id', others);
  if (!est.is_revision && ['dropped', 'estimate'].includes(detail.job.stage)) {
    await db.from('shop_jobs').update({ stage: 'waiting' }).eq('site_id', siteId).eq('id', detail.job.id);
  }
  const how = via === 'email' ? `emailed to ${str(input.to, 200) || detail.customer.email}` : via === 'in_person' ? 'handed to the customer' : 'shared as a link';
  await addEvent(db, siteId, detail.job.id, 'estimate', {
    actor: access.actor,
    body: `${est.is_revision ? 'Revised estimate' : 'Estimate'} v${est.version} ${est.status === 'sent' ? 're-sent' : 'given'}: ${how}. ${formatCents(doc.totals.total_cents)}, good until ${formatDate(validUntil)}.`,
    meta: { estimate_id: est.id, via },
  });
  return { url, emailed, estimate_id: est.id };
}

export interface AuthorizeInput {
  method?: unknown;
  authorized_by?: unknown;
  phone?: unknown;
  contact?: unknown;
  authorized_at?: unknown;
  parts_back?: unknown;
  signature?: unknown;
  typed_name?: unknown;
  notes?: unknown;
  taken_by?: unknown;
  /** line id → include/declined, for customers who approve only part of it. */
  decisions?: unknown;
}

/** Record the customer's approval. The only way a job reaches "Approved". */
export async function authorizeEstimate(
  access: ShopAccess,
  estimateId: string,
  input: AuthorizeInput,
  ctx: { request?: NextRequest | null; userAgent?: string | null } = {},
): Promise<{ ok: true; amount_cents: number; job_id: string; version: number }> {
  const detail = await requireJob(access, await jobIdForEstimate(access, estimateId));
  const est = findEstimate(detail, estimateId);
  const { db, siteId } = access;
  const method = input.method as AuthMethod;
  if (!METHODS.includes(method)) throw new ShopRuleError('How did the customer approve it?', undefined, 400);
  const today = todayISO();

  if (est.status === 'approved') throw new ShopRuleError('This estimate is already approved.', undefined, 409);
  if (est.status !== 'sent' && !(est.status === 'draft' && method === 'in_person')) {
    throw new ShopRuleError(est.status === 'draft'
      ? 'Give the customer the written estimate first. It can be approved on the spot if they’re at the counter.'
      : `This estimate was ${est.status}. Approve the current version instead.`, undefined, 409);
  }
  const site = await loadSiteInfo(db, siteId, detail.settings);
  let validUntil = est.valid_until;
  if (est.status === 'draft') {
    validUntil = validUntil || addDays(today, detail.settings.estimate_valid_days);
    const problems = problemsFor(detail, est, site, validUntil, est.ready_by);
    if (problems.length) throw new ShopRuleError('Before the customer approves this estimate, add:', problems.map(p => p.message));
  }
  if (validUntil && validUntil < today) {
    throw new ShopRuleError(`This estimate expired on ${formatDate(validUntil)}. Make a new version and give it to the customer again.`, undefined, 409);
  }

  const authorizedBy = str(input.authorized_by, 120) || (method === 'online' ? str(input.typed_name, 120) : null);
  const signature = typeof input.signature === 'string' && input.signature.startsWith('data:image/') ? input.signature : null;
  const authorizedAt = method === 'online' ? nowIso() : checkedTime(input.authorized_at, 'The approval time');
  const problems = authProblems({
    method,
    authorized_by: authorizedBy,
    phone: str(input.phone, 40),
    contact: str(input.contact, 200),
    authorized_at: authorizedAt,
    signature,
    typed_name: str(input.typed_name, 120),
  });
  if (problems.length) throw new ShopRuleError('The approval record needs:', problems.map(p => p.message));
  if (est.sent_at && Date.parse(authorizedAt) < Date.parse(est.sent_at) - 60_000) {
    throw new ShopRuleError('The approval can’t be earlier than when the estimate was given.', undefined, 400);
  }
  if (typeof input.parts_back !== 'boolean') {
    throw new ShopRuleError('Ask whether they want the replaced parts back (CPA s. 61).', undefined, 400);
  }

  // Line choices: customers can approve part of an estimate.
  const decisions = (input.decisions && typeof input.decisions === 'object' ? input.decisions : {}) as Record<string, unknown>;
  const lines = est.lines.map(l => {
    const d = decisions[l.id];
    return d === 'include' || d === 'declined' ? { ...l, decision: d as EstimateLine['decision'] } : l;
  });
  const included = lines.filter(l => l.decision === 'include');
  if (!included.length) throw new ShopRuleError('Nothing is approved. If they don’t want any of it, record it as declined.', undefined, 400);
  const changed = lines.filter((l, i) => l.decision !== est.lines[i].decision);
  for (const l of changed) {
    const { error } = await db.from('shop_estimate_lines').update({ decision: l.decision }).eq('site_id', siteId).eq('id', l.id);
    fail(error, 'Save line choice');
  }
  const amount = computeTotals(lines, detail.settings.tax_rate_bps).total_cents;

  const signaturePath = signature ? await storeSignature(access, ctx.request ?? null, signature) : null;
  const { error: authErr } = await db.from('shop_authorizations').insert({
    site_id: siteId,
    job_id: detail.job.id,
    estimate_id: est.id,
    kind: 'estimate',
    method,
    authorized_by: authorizedBy,
    phone: str(input.phone, 40),
    contact: str(input.contact, 200),
    authorized_at: authorizedAt,
    taken_by: str(input.taken_by, 80) || access.actor,
    amount_cents: amount,
    line_ids: included.map(l => l.id),
    parts_back: input.parts_back,
    signature_path: signaturePath,
    typed_name: str(input.typed_name, 120),
    ip_address: clientIp(ctx.request),
    user_agent: str(ctx.userAgent ?? ctx.request?.headers.get('user-agent'), 300),
    notes: str(input.notes, 1000),
  });
  fail(authErr, 'Save approval');

  const now = nowIso();
  const { error: estErr } = await db.from('shop_estimates').update({
    status: 'approved',
    approved_at: now,
    needs_review: false,
    ...(est.status === 'draft' ? { sent_at: now, sent_via: 'in_person', valid_until: validUntil, public_token: est.public_token || newPublicToken() } : {}),
  }).eq('site_id', siteId).eq('id', est.id);
  fail(estErr, 'Approve estimate');
  const previous = detail.estimates.find(e => e.status === 'approved' && e.id !== est.id) ?? null;
  const replace = detail.estimates.filter(e => e.id !== est.id && ['draft', 'sent', 'approved'].includes(e.status) && (e.status !== 'draft' || e.is_revision === est.is_revision)).map(e => e.id);
  if (replace.length) await db.from('shop_estimates').update({ status: 'replaced' }).eq('site_id', siteId).in('id', replace);

  const jobPatch: Record<string, unknown> = {};
  if (!est.is_revision) {
    jobPatch.stage = 'approved';
    jobPatch.completed_at = null;
  }
  // Keep invoice adjustments (actual hours etc.) on the matching lines of the new approved version.
  if (previous && Object.keys(detail.job.invoice_adjustments || {}).length) {
    const remapped: Record<string, unknown> = {};
    for (const [oldId, adj] of Object.entries(detail.job.invoice_adjustments)) {
      const old = previous.lines.find(l => l.id === oldId);
      const match = old && lines.find(l => l.kind === old.kind && l.description === old.description && !l.is_added_work);
      if (match) remapped[match.id] = adj;
    }
    jobPatch.invoice_adjustments = remapped;
  }
  if (Object.keys(jobPatch).length) {
    const { error } = await db.from('shop_jobs').update(jobPatch).eq('site_id', siteId).eq('id', detail.job.id);
    fail(error, 'Update job');
  }
  const declined = lines.filter(l => l.decision === 'declined');
  const phone = str(input.phone, 40);
  await addEvent(db, siteId, detail.job.id, 'authorization', {
    actor: access.actor,
    body: `${est.is_revision ? 'Extra work approved' : 'Approved'}: ${methodLabel(method)} by ${authorizedBy}${method === 'phone' && phone ? ` (${phone})` : ''}. ${formatCents(amount)} for ${included.length} line${included.length === 1 ? '' : 's'}${declined.length ? `, ${declined.length} declined` : ''}. ${input.parts_back ? 'Wants the old parts back.' : 'Doesn’t want the old parts.'}`,
    meta: { estimate_id: est.id, method },
  });
  return { ok: true, amount_cents: amount, job_id: detail.job.id, version: est.version };
}

export async function declineEstimate(access: ShopAccess, estimateId: string, input: { reason?: unknown; by?: unknown } = {}) {
  const detail = await requireJob(access, await jobIdForEstimate(access, estimateId));
  const est = findEstimate(detail, estimateId);
  if (est.status !== 'sent') throw new ShopRuleError(est.status === 'draft' ? 'Drafts aren’t declined. Delete the draft instead.' : `This estimate was already ${est.status}.`, undefined, 409);
  const { db, siteId } = access;
  const { error } = await db.from('shop_estimates').update({ status: 'declined', declined_at: nowIso() }).eq('site_id', siteId).eq('id', est.id);
  fail(error, 'Decline estimate');
  if (!est.is_revision) {
    await db.from('shop_jobs').update({ stage: 'done', bay: null }).eq('site_id', siteId).eq('id', detail.job.id);
  }
  const reason = str(input.reason, 500);
  const feeNote = !est.is_revision && detail.job.estimate_fee_cents > 0 && detail.job.estimate_fee_agreed_at
    ? ` The agreed estimate fee (${formatCents(detail.job.estimate_fee_cents)}) can be invoiced.`
    : '';
  await addEvent(db, siteId, detail.job.id, 'estimate', {
    actor: access.actor,
    body: `${est.is_revision ? 'Extra work declined. The bill stays at the approved estimate.' : `Estimate v${est.version} declined${str(input.by, 120) ? ` by ${str(input.by, 120)}` : ''}. Car is ready for pickup.`}${reason ? ` “${reason}”` : ''}${feeNote}`,
  });
  return { ok: true };
}

/** Voice-note lines land on the right estimate: a revision if work is approved, else the draft. */
export async function appendDraftLines(access: ShopAccess, detail: JobDetail, lines: DraftLine[]): Promise<{ estimate_id: string | null; added: number; revision: boolean }> {
  if (!lines.length) return { estimate_id: null, added: 0, revision: false };
  const rows: LineRow[] = lines.map((l, i) => ({
    position: i,
    kind: l.kind,
    description: l.description,
    decision: 'include',
    qty: l.kind === 'part' ? l.qty : 1,
    hours: l.kind === 'labour' ? l.hours : null,
    rate_cents: l.kind === 'labour' ? detail.settings.labour_rate_cents : null,
    unit_price_cents: null,
    amount_cents: null,
    unit_cost_cents: null,
    supplier_id: null,
    part_number: l.kind === 'part' ? l.part_number : null,
    brand: null,
    condition: l.kind === 'part' ? l.condition : null,
    quoted_at: null,
    quoted_by: null,
    eta: null,
    core_charge_cents: null,
    no_warranty: l.no_warranty,
    is_added_work: l.is_added_work,
    alternates: [],
    ordered_at: null,
  }));
  const approved = detail.estimates.find(e => e.status === 'approved');
  if (approved) {
    const r = await createRevision(access, detail.job.id, rows.map(r => ({ ...r, is_added_work: true })), { detail, needsReview: true });
    return { estimate_id: r.id, added: rows.length, revision: true };
  }
  let draft = detail.estimates.find(e => e.status === 'draft' && !e.is_revision) ?? null;
  if (!draft) {
    const latest = detail.estimates[detail.estimates.length - 1];
    const { id } = latest ? await newVersion(access, latest.id, { detail }) : await insertEstimate(access, detail, { isRevision: false, lines: [] });
    const { data } = await access.db.from('shop_estimates').select('*, lines:shop_estimate_lines(*)').eq('site_id', access.siteId).eq('id', id).single();
    draft = data as Estimate;
  }
  const start = draft.lines?.length ?? 0;
  const { error } = await access.db.from('shop_estimate_lines').insert(rows.map((r, i) => ({ ...r, position: start + i, site_id: access.siteId, estimate_id: draft!.id })));
  fail(error, 'Add drafted lines');
  await access.db.from('shop_estimates').update({ needs_review: true }).eq('site_id', access.siteId).eq('id', draft.id);
  return { estimate_id: draft.id, added: rows.length, revision: false };
}

export { estimateNumber };
