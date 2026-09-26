/**
 * Helpers shared by the Shop action modules. Actions take a ShopAccess (from
 * requireShopAccess / requireShopTechOrOwner, or a customer-page context) and
 * enforce the shop's rules server-side, so the UI can't skip a step.
 */

import { ShopRuleError, type ShopAccess } from '../access';
import { loadJobDetail } from '../data';
import type { JobDetail } from '../types';

export type Db = ShopAccess['db'];

interface PgError { message: string; code?: string; details?: string | null }

/** Throw on a Supabase error; friendly messages for the unique indexes users can hit. */
export function fail(error: PgError | null, what: string): void {
  if (!error) return;
  if (error.code === '23505') {
    const m = `${error.message} ${error.details ?? ''}`;
    if (m.includes('shop_jobs_open_key_tag')) throw new ShopRuleError('That key tag is already on another car. Pick a different tag.', undefined, 409);
    if (m.includes('shop_jobs_open_bay')) throw new ShopRuleError('That bay already has a car in it. Move that car out first.', undefined, 409);
    if (m.includes('shop_supplier_bills_number')) throw new ShopRuleError('That supplier invoice number is already on file.', undefined, 409);
    if (m.includes('shop_invoices_one_active')) throw new ShopRuleError('This job already has an invoice. Void it before issuing a new one.', undefined, 409);
    if (m.includes('shop_payments_provider_ref')) throw new ShopRuleError('That payment is already recorded.', undefined, 409);
    throw new ShopRuleError('That would create a duplicate.', undefined, 409);
  }
  if (error.code === '23503') throw new ShopRuleError('That record is still in use, so it can’t be removed.', undefined, 409);
  throw new Error(`${what}: ${error.message}`);
}

export async function requireJob(access: ShopAccess, jobId: string): Promise<JobDetail> {
  if (!isUuid(jobId)) throw new ShopRuleError('Job not found.', undefined, 404);
  const detail = await loadJobDetail(access.db, access.siteId, jobId);
  if (!detail) throw new ShopRuleError('Job not found.', undefined, 404);
  return detail;
}

/** Find the job an estimate belongs to (scoped to the site). */
export async function jobIdForEstimate(access: ShopAccess, estimateId: string): Promise<string> {
  if (!isUuid(estimateId)) throw new ShopRuleError('Estimate not found.', undefined, 404);
  const { data } = await access.db.from('shop_estimates').select('job_id').eq('site_id', access.siteId).eq('id', estimateId).maybeSingle();
  if (!data) throw new ShopRuleError('Estimate not found.', undefined, 404);
  return data.job_id as string;
}

export async function jobIdForInvoice(access: ShopAccess, invoiceId: string): Promise<string> {
  if (!isUuid(invoiceId)) throw new ShopRuleError('Invoice not found.', undefined, 404);
  const { data } = await access.db.from('shop_invoices').select('job_id').eq('site_id', access.siteId).eq('id', invoiceId).maybeSingle();
  if (!data) throw new ShopRuleError('Invoice not found.', undefined, 404);
  return data.job_id as string;
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime());
}

/** Trimmed string or null, capped in length. */
export function str(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

export function int(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? Number(v.replace(/[, ]/g, '')) : Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? Number(v.replace(/[, ]/g, '')) : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** An approval time the desk typed in: not in the future, not absurdly old. */
export function checkedTime(v: unknown, label: string): string {
  if (v == null || v === '') return nowIso();
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new ShopRuleError(`${label} isn’t a valid date and time.`, undefined, 400);
  if (d.getTime() > Date.now() + 5 * 60_000) throw new ShopRuleError(`${label} can’t be in the future.`, undefined, 400);
  if (d.getTime() < Date.now() - 400 * 86400_000) throw new ShopRuleError(`${label} is more than a year ago.`, undefined, 400);
  return d.toISOString();
}

export function clientIp(request: { headers: Headers } | null | undefined): string | null {
  if (!request) return null;
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
}
